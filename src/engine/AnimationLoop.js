import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

class AnimationLoop {
  constructor({ lenis, engine }) {
    this.lenis = lenis
    this.engine = engine
    this.callbacks = []
    this._running = false

    // Bind Lenis scroll to ScrollTrigger
    if (this.lenis) {
      this.lenis.on('scroll', ScrollTrigger.update)
    }

    // Use GSAP ticker as the single heartbeat
    this._tick = this._tick.bind(this)
  }

  _tick(time) {
    // Update Lenis smooth scroll
    if (this.lenis) {
      this.lenis.raf(time * 1000)
    }

    // Run registered callbacks (interaction updates, shader uniforms, etc.)
    const elapsed = time
    for (let i = 0; i < this.callbacks.length; i++) {
      this.callbacks[i](elapsed)
    }

    // Render Three.js scene
    if (this.engine) {
      this.engine.render()
    }
  }

  start() {
    if (this._running) return
    this._running = true
    gsap.ticker.add(this._tick)
    gsap.ticker.lagSmoothing(0)
  }

  stop() {
    if (!this._running) return
    this._running = false
    gsap.ticker.remove(this._tick)
  }

  onTick(callback) {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx > -1) this.callbacks.splice(idx, 1)
    }
  }

  dispose() {
    this.stop()
    this.callbacks = []
  }
}

export default AnimationLoop
export { gsap, ScrollTrigger }
