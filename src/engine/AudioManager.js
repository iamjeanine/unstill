/**
 * AudioManager — File-based ambient audio with crossfading.
 *
 * Both site ambient and story audio use Web Audio API AudioBufferSourceNode
 * routed through separate gain nodes for independent volume control.
 *
 * Architecture:
 *   site-ambient: AudioBufferSource → ambientGain → masterGain → ctx.destination
 *   story-audio:  AudioBufferSource → storyGain   → masterGain → ctx.destination
 *   video-audio:  (external)        → videoGain   → masterGain → ctx.destination
 */

// All stories share one cue — Elsie's piano works for every portrait
const STORY_CUE = '/audio/elsie-paul.mp3'

const CROSSFADE_MS = 1500

class AudioManager {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.ambientGain = null
    this.storyGain = null
    this.videoGain = null
    this.initialized = false
    this.muted = false
    this._currentStoryId = null

    // Site ambient — Web Audio API BufferSource (same as story)
    this._ambientBuffer = null
    this._ambientSource = null
    this._ambientTargetVol = 1.0

    // Story audio — single shared cue for all stories
    this._storyCueBuffer = null
    this._storySource = null
    this._storyStopTimer = null
  }

  // Must be called from a user gesture (click/scroll)
  init() {
    if (this.initialized) return
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()

      // Master output
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 1.0
      this.masterGain.connect(this.ctx.destination)

      // Ambient layer
      this.ambientGain = this.ctx.createGain()
      this.ambientGain.gain.value = 0.0
      this.ambientGain.connect(this.masterGain)

      // Story layer
      this.storyGain = this.ctx.createGain()
      this.storyGain.gain.value = 0.0
      this.storyGain.connect(this.masterGain)

      // Video layer
      this.videoGain = this.ctx.createGain()
      this.videoGain.gain.value = 0.0
      this.videoGain.connect(this.masterGain)

      this.initialized = true
    } catch (e) {
      console.warn('AudioManager: Web Audio API not available', e)
    }
  }

  // ─── AMBIENT (Web Audio API BufferSource) ─────────────────

  async startAmbient() {
    if (!this.initialized) this.init()
    if (!this.ctx) return

    // Resume AudioContext if suspended
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    // Load ambient buffer if not cached
    if (!this._ambientBuffer) {
      this._ambientBuffer = await this._loadBuffer('/audio/site-ambient.mp3')
      if (!this._ambientBuffer) return
    }

    // Don't restart if already playing
    if (this._ambientSource) return

    // Start ambient loop
    const source = this.ctx.createBufferSource()
    source.buffer = this._ambientBuffer
    source.loop = true
    source.connect(this.ambientGain)
    source.start()
    this._ambientSource = source

    // Fade in
    this._ambientTargetVol = 1.0
    const now = this.ctx.currentTime
    this.ambientGain.gain.cancelScheduledValues(now)
    this.ambientGain.gain.setTargetAtTime(
      this.muted ? 0 : 1.0,
      now,
      0.3 // ~800ms to reach target
    )
  }

  _fadeAmbient(targetVol, durationMs) {
    if (!this.ctx || !this.ambientGain) return
    this._ambientTargetVol = targetVol

    const now = this.ctx.currentTime
    // Time constant: durationMs * 0.001 / 3 ≈ reach target in durationMs
    const timeConstant = (durationMs / 1000) * 0.33
    this.ambientGain.gain.cancelScheduledValues(now)
    this.ambientGain.gain.setTargetAtTime(
      this.muted ? 0 : targetVol,
      now,
      timeConstant
    )
  }

  // ─── STORY ENTER / EXIT ──────────────────────────────────

  async enterStory(personId) {
    if (!this.initialized) return
    this._currentStoryId = personId

    // Cancel any pending story stop
    if (this._storyStopTimer) {
      clearTimeout(this._storyStopTimer)
      this._storyStopTimer = null
    }

    // Stop any existing story source
    this._stopStorySource()

    // Fade ambient down — still present underneath
    this._fadeAmbient(0.15, CROSSFADE_MS)

    // Load shared story cue if not cached
    if (!this._storyCueBuffer) {
      this._storyCueBuffer = await this._loadBuffer(STORY_CUE)
      if (!this._storyCueBuffer) return
    }

    // Start story audio loop
    const source = this.ctx.createBufferSource()
    source.buffer = this._storyCueBuffer
    source.loop = true
    source.connect(this.storyGain)
    source.start()
    this._storySource = source

    // Fade story in — present but not dominant, sits under the essay
    const now = this.ctx.currentTime
    this.storyGain.gain.cancelScheduledValues(now)
    this.storyGain.gain.setTargetAtTime(
      this.muted ? 0 : 0.3,
      now,
      CROSSFADE_MS * 0.00033 // time constant in seconds
    )
  }

  exitStory() {
    if (!this.initialized) return

    // Guard: if already exiting or no story playing, skip
    if (!this._currentStoryId && !this._storySource) return
    this._currentStoryId = null

    const now = this.ctx.currentTime

    // Fast fade-out: time constant 0.15s → ~95% faded by 0.5s
    this.storyGain.gain.cancelScheduledValues(now)
    this.storyGain.gain.setTargetAtTime(0, now, 0.15)

    // Fade ambient back up
    this._fadeAmbient(1.0, CROSSFADE_MS)

    // Kill story source after fade (0.8s is plenty for the fast fade)
    if (this._storyStopTimer) clearTimeout(this._storyStopTimer)
    this._storyStopTimer = setTimeout(() => {
      this._stopStorySource()
      // Force gain to absolute zero
      this.storyGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.storyGain.gain.value = 0
      this._storyStopTimer = null
    }, 800)
  }

  // ─── VIDEO ENTER / EXIT ──────────────────────────────────

  enterVideo() {
    if (!this.initialized) return
    this._fadeAmbient(0, 300)
    this.storyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
    this.videoGain.gain.setTargetAtTime(
      this.muted ? 0 : 1.0,
      this.ctx.currentTime,
      0.1
    )
  }

  exitVideo() {
    if (!this.initialized) return
    this.videoGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)

    if (this._currentStoryId) {
      this.storyGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.15)
      this._fadeAmbient(0.15, 600)
    } else {
      this._fadeAmbient(1.0, 600)
    }
  }

  // ─── MUTE ────────────────────────────────────────────────

  toggleMute() {
    this.muted = !this.muted
    if (!this.initialized) return

    if (this.muted) {
      // Mute everything
      this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
    } else {
      // Unmute — restore ambient to target level
      this.ambientGain.gain.setTargetAtTime(
        this._ambientTargetVol,
        this.ctx.currentTime,
        0.2
      )
      this.masterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.2)
    }
    return this.muted
  }

  // ─── HELPERS ─────────────────────────────────────────────

  async _loadBuffer(url) {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return await this.ctx.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.warn(`AudioManager: Failed to load ${url}`, e)
      return null
    }
  }

  _stopStorySource() {
    if (this._storySource) {
      try { this._storySource.stop() } catch (e) {}
      try { this._storySource.disconnect() } catch (e) {}
      this._storySource = null
    }
  }

  _stopAmbientSource() {
    if (this._ambientSource) {
      try { this._ambientSource.stop() } catch (e) {}
      try { this._ambientSource.disconnect() } catch (e) {}
      this._ambientSource = null
    }
  }

  setAmbientVolume(volume) {
    // No-op — ambient is managed internally now
  }

  dispose() {
    // Stop ambient
    this._stopAmbientSource()

    // Stop story
    this._stopStorySource()
    if (this._storyStopTimer) {
      clearTimeout(this._storyStopTimer)
    }

    // Clear caches
    this._storyCueBuffer = null
    this._ambientBuffer = null

    if (this.ctx) {
      this.ctx.close()
    }
    this.initialized = false
  }
}

export default AudioManager
