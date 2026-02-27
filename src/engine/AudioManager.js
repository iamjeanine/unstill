/**
 * AudioManager — One continuous ambient track.
 *
 * Architecture:
 *   site-ambient: AudioBufferSource → ambientGain → masterGain → ctx.destination
 *   video-audio:  (external)        → videoGain   → masterGain → ctx.destination
 *
 * Story panels just dip the ambient so the video audio has room.
 * No separate story cue — the ambient carries the whole experience.
 */

const CROSSFADE_MS = 1500

class AudioManager {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.ambientGain = null
    this.videoGain = null
    this.initialized = false
    this.muted = false
    this._currentStoryId = null

    // Site ambient
    this._ambientBuffer = null
    this._ambientSource = null
    this._ambientStarting = false
    this._ambientTargetVol = 1.0
    this._bufferLoading = null
  }

  /**
   * Preload the ambient audio buffer over the network.
   * Called early (during loading screen) so the file is ready
   * before the user's first interaction.
   */
  preload() {
    if (this._ambientBuffer || this._bufferLoading) return
    this._bufferLoading = fetch('/audio/site-ambient.mp3')
      .then((r) => r.arrayBuffer())
      .catch(() => null)
  }

  // Must be called from a user gesture (click/touch/key)
  init() {
    if (this.initialized) return
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()

      // Resume immediately inside the gesture — browsers require this
      // to be synchronous with the user interaction event.
      this.ctx.resume()

      // Master output
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 1.0
      this.masterGain.connect(this.ctx.destination)

      // Ambient layer
      this.ambientGain = this.ctx.createGain()
      this.ambientGain.gain.value = 0.0
      this.ambientGain.connect(this.masterGain)

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

    // Don't restart if already playing or in the process of starting
    if (this._ambientSource || this._ambientStarting) return
    this._ambientStarting = true

    // Decode the preloaded buffer (or fetch now if preload missed)
    if (!this._ambientBuffer) {
      let arrayBuffer = this._bufferLoading ? await this._bufferLoading : null
      if (!arrayBuffer) {
        try {
          const r = await fetch('/audio/site-ambient.mp3')
          arrayBuffer = await r.arrayBuffer()
        } catch (_) { this._ambientStarting = false; return }
      }
      try {
        this._ambientBuffer = await this.ctx.decodeAudioData(arrayBuffer)
      } catch (_) { this._ambientStarting = false; return }
    }

    // Re-resume — the gesture allowance may have expired during fetch
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume() } catch (_) {}
    }

    // Start ambient loop
    const source = this.ctx.createBufferSource()
    source.buffer = this._ambientBuffer
    source.loop = true
    source.connect(this.ambientGain)
    source.start()
    this._ambientSource = source

    // Fade in
    this._ambientTargetVol = 0.55
    const now = this.ctx.currentTime
    this.ambientGain.gain.cancelScheduledValues(now)
    this.ambientGain.gain.setTargetAtTime(
      this.muted ? 0 : 0.55,
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

  fadeToSilence(durationMs = 5000) {
    if (!this.initialized || !this.ctx) return

    // Linear ramp guarantees reaching exactly zero — no clip at disconnect
    const now = this.ctx.currentTime
    this.ambientGain.gain.cancelScheduledValues(now)
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now)
    this.ambientGain.gain.linearRampToValueAtTime(0, now + durationMs / 1000)
    this._ambientTargetVol = 0

    // Disconnect well after silence is reached
    setTimeout(() => { this._stopAmbientSource() }, durationMs + 2000)
  }

  // ─── STORY ENTER / EXIT ──────────────────────────────────

  enterStory(personId) {
    if (!this.initialized) return
    this._currentStoryId = personId

    // Dip the ambient so video audio has room
    this._fadeAmbient(0.18, CROSSFADE_MS)
  }

  exitStory() {
    if (!this.initialized) return
    if (!this._currentStoryId) return
    this._currentStoryId = null

    // Bring ambient back up
    this._fadeAmbient(0.55, CROSSFADE_MS)
  }

  // ─── VIDEO ENTER / EXIT ──────────────────────────────────

  enterVideo() {
    if (!this.initialized) return
    this._fadeAmbient(0, 300)
    this.videoGain.gain.setTargetAtTime(
      this.muted ? 0 : 1.0,
      this.ctx.currentTime,
      0.1
    )
  }

  exitVideo() {
    if (!this.initialized) return
    this.videoGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)

    // Return ambient to story-dipped level or full
    if (this._currentStoryId) {
      this._fadeAmbient(0.18, 600)
    } else {
      this._fadeAmbient(0.55, 600)
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
    this._stopAmbientSource()
    this._ambientBuffer = null

    if (this.ctx) {
      this.ctx.close()
    }
    this.initialized = false
  }
}

export default AudioManager
