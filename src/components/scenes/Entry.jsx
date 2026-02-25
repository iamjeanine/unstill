import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─── Simplex noise (same as StoryLoupe — shared language) ─────────────
function _mod289(x) { return x - Math.floor(x / 289.0) * 289.0 }
function _permute(x) { return _mod289((x * 34.0 + 1.0) * x) }

function snoise(x, y) {
  const C_x = 0.211324865405187, C_y = 0.366025403784439
  const C_z = -0.577350269189626, C_w = 0.024390243902439
  let i_x = Math.floor(x + (x + y) * C_y), i_y = Math.floor(y + (x + y) * C_y)
  const x0_x = x - i_x + (i_x + i_y) * C_x, x0_y = y - i_y + (i_x + i_y) * C_x
  const i1_x = x0_x > x0_y ? 1 : 0, i1_y = x0_x > x0_y ? 0 : 1
  const x12_x = x0_x + C_x - i1_x, x12_y = x0_y + C_x - i1_y
  const x12_z = x0_x + C_z, x12_w = x0_y + C_z
  i_x = _mod289(i_x); i_y = _mod289(i_y)
  const p = _permute(_permute(i_y + 0) + i_x + 0)
  const p1 = _permute(_permute(i_y + i1_y) + i_x + i1_x)
  const p2 = _permute(_permute(i_y + 1) + i_x + 1)
  let m_x = Math.max(0, 0.5 - (x0_x * x0_x + x0_y * x0_y))
  let m_y = Math.max(0, 0.5 - (x12_x * x12_x + x12_y * x12_y))
  let m_z = Math.max(0, 0.5 - (x12_z * x12_z + x12_w * x12_w))
  m_x *= m_x; m_y *= m_y; m_z *= m_z
  const ox_x = (Math.floor(p * C_w) * 2 + 1) / 7 - 1
  const ox_y = (Math.floor(p1 * C_w) * 2 + 1) / 7 - 1
  const ox_z = (Math.floor(p2 * C_w) * 2 + 1) / 7 - 1
  const a0_x = -1 + 2 * (p * C_w - Math.floor(p * C_w))
  const a0_y = -1 + 2 * (p1 * C_w - Math.floor(p1 * C_w))
  const a0_z = -1 + 2 * (p2 * C_w - Math.floor(p2 * C_w))
  const h_x = Math.abs(a0_x) - 0.5, h_y = Math.abs(a0_y) - 0.5, h_z = Math.abs(a0_z) - 0.5
  const s_x = Math.floor(a0_x) + 0.5, s_y = Math.floor(a0_y) + 0.5, s_z = Math.floor(a0_z) + 0.5
  const g_x = s_x * x0_x + h_x * x0_y
  const g_y = s_y * x12_x + h_y * x12_y
  const g_z = s_z * x12_z + h_z * x12_w
  const norm_x = 1.79284291400159 - 0.85373472095314 * (ox_x * ox_x + h_x * h_x)
  const norm_y = 1.79284291400159 - 0.85373472095314 * (ox_y * ox_y + h_y * h_y)
  const norm_z = 1.79284291400159 - 0.85373472095314 * (ox_z * ox_z + h_z * h_z)
  return 130.0 * (m_x * m_x * (g_x * norm_x) + m_y * m_y * (g_y * norm_y) + m_z * m_z * (g_z * norm_z))
}

function fbm(x, y, time) {
  let value = 0, amp = 0.5, sx = x, sy = y
  for (let i = 0; i < 4; i++) {
    value += amp * snoise(sx + time * 0.03, sy + time * 0.02)
    sx *= 2; sy *= 2; amp *= 0.5
  }
  return value
}

// ─── Component ───────────────────────────────────────────────────────

export default function Entry({ audioManager }) {
  const sectionRef = useRef(null)
  const titleRef = useRef(null)
  const taglineRef = useRef(null)
  const indicatorRef = useRef(null)
  const canvasRef = useRef(null)
  const grainRef = useRef(null)
  const audioStarted = useRef(false)

  // Mouse + animation state
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 })
  const timeRef = useRef(0)
  const heroImageRef = useRef(null)
  const heroOpacityRef = useRef(0)

  // Load hero image
  useEffect(() => {
    const img = new Image()
    img.src = '/mugshots/num-and-tom.jpg'
    img.onload = () => { heroImageRef.current = img }
  }, [])

  // ─── Canvas draw function ──────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = heroImageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const opacity = heroOpacityRef.current
    if (opacity <= 0.001) { ctx.restore(); return }

    const mx = smoothMouseRef.current.x
    const my = smoothMouseRef.current.y
    const time = timeRef.current

    // ── Full-bleed cover fit ──
    // Image fills the entire canvas. Their colors come through.
    const imgAspect = img.width / img.height
    const canvasAspect = w / h
    let drawW, drawH, drawX, drawY

    if (imgAspect > canvasAspect) {
      // Image wider than canvas — fit height, crop sides
      drawH = h
      drawW = drawH * imgAspect
      drawX = (w - drawW) * 0.3 // bias left — front-facing panel
    } else {
      // Image taller than canvas — fit width, crop top/bottom
      drawW = w
      drawH = drawW / imgAspect
      drawX = 0
    }
    // Always pin image to top edge — no gap, no dark band.
    // On landscape viewports the image is taller than the canvas,
    // so drawY=0 means the excess is cropped at the bottom (near the title).
    drawY = 0

    // ── Distortion grid ──
    // Full-bleed tiles. Each shifts near the cursor with FBM noise.
    // Like looking at the photograph through gently moving water.
    const cols = 32
    const rows = Math.max(1, Math.round(cols * (drawH / drawW)))
    const cellW = drawW / cols
    const cellH = drawH / rows

    // Mouse position in image-local 0–1 space
    const mxLocal = (mx * w - drawX) / drawW
    const myLocal = (my * h - drawY) / drawH

    ctx.globalAlpha = opacity

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = (col / cols) * img.width
        const sy = (row / rows) * img.height
        const sw = img.width / cols
        const sh = img.height / rows

        let dx = drawX + col * cellW
        let dy = drawY + row * cellH

        // Cell center in 0–1
        const cx = (col + 0.5) / cols
        const cy = (row + 0.5) / rows

        // Distance from cursor → proximity falloff
        const dist = Math.sqrt((cx - mxLocal) ** 2 + (cy - myLocal) ** 2)
        const radius = 0.3
        const proximity = Math.max(0, 1 - dist / radius)
        const strength = proximity * proximity * 10

        // FBM noise displacement — organic, watercolor ripple
        dx += fbm(cx * 3.0, cy * 3.0, time) * strength
        dy += fbm(cx * 3.0 + 100, cy * 3.0 + 100, time) * strength

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cellW + 0.5, cellH + 0.5)
      }
    }

    // ── Attention light — warm glow follows cursor ──
    const lightX = mx * w
    const lightY = my * h
    const lightRadius = Math.min(w, h) * 0.4
    const lightGrad = ctx.createRadialGradient(
      lightX, lightY, 0,
      lightX, lightY, lightRadius
    )
    lightGrad.addColorStop(0, `rgba(255, 245, 230, ${0.08 * opacity})`)
    lightGrad.addColorStop(0.5, `rgba(255, 240, 220, ${0.025 * opacity})`)
    lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = lightGrad
    ctx.fillRect(0, 0, w, h)

    // ── Bottom fade only — S-curve dissolve into the title area ──
    // No side fades. The image bleeds edge-to-edge, truly full-bleed.
    // The S-curve stays transparent longer, then drops fast — the image
    // "floats" above the dark rather than linearly fading into it.
    ctx.globalCompositeOperation = 'destination-out'
    const botFade = h * 0.5 // covers lower half of canvas
    const botGrad = ctx.createLinearGradient(0, h - botFade, 0, h)
    botGrad.addColorStop(0, 'rgba(0,0,0,0)')        // fully visible
    botGrad.addColorStop(0.3, 'rgba(0,0,0,0)')      // still visible — the "float"
    botGrad.addColorStop(0.5, 'rgba(0,0,0,0.2)')    // hint of fade
    botGrad.addColorStop(0.65, 'rgba(0,0,0,0.55)')  // dropping
    botGrad.addColorStop(0.78, 'rgba(0,0,0,0.85)')  // mostly gone — title zone
    botGrad.addColorStop(0.88, 'rgba(0,0,0,0.97)')  // tagline zone — nearly black
    botGrad.addColorStop(1, 'rgba(0,0,0,1)')        // fully erased
    ctx.fillStyle = botGrad
    ctx.fillRect(0, h - botFade, w, botFade)

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
  }, [])

  // ─── Main effect: animations, mouse tracking, resize ───────────────
  useEffect(() => {
    const section = sectionRef.current
    const title = titleRef.current
    const tagline = taglineRef.current
    const indicator = indicatorRef.current
    const canvas = canvasRef.current
    const grain = grainRef.current

    if (!canvas) return

    // ── Canvas sizing ──
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = section.clientWidth * dpr
      canvas.height = section.clientHeight * dpr
      canvas.style.width = section.clientWidth + 'px'
      canvas.style.height = section.clientHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Mouse tracking (section receives pointer events) ──
    const onMouseMove = (e) => {
      const rect = section.getBoundingClientRect()
      mouseRef.current.x = (e.clientX - rect.left) / rect.width
      mouseRef.current.y = (e.clientY - rect.top) / rect.height
    }
    section.addEventListener('mousemove', onMouseMove)

    // ── Title: letter-by-letter fade in ──
    const letters = title.querySelectorAll('.letter')
    gsap.set(letters, { opacity: 0, y: 20 })
    gsap.to(letters, {
      opacity: 1,
      y: 0,
      stagger: 0.08,
      duration: 0.7,
      delay: 0.6,
      ease: 'power3.out',
    })

    // Title breathe — pulses gently, then settles to full opacity.
    // Stillness after motion creates gravitas.
    gsap.to(letters, {
      opacity: 0.92,
      duration: 3.0,
      stagger: { each: 0.4, repeat: 3, yoyo: true },
      ease: 'sine.inOut',
      delay: 2.0,
    })

    // ── Tagline: fade up ──
    gsap.set(tagline, { opacity: 0, y: 30 })
    gsap.to(tagline, {
      opacity: 1,
      y: 0,
      duration: 1.0,
      delay: 1.8,
      ease: 'power2.out',
    })

    // ── Scroll indicator: fade in + pulse ──
    gsap.set(indicator, { opacity: 0 })
    gsap.to(indicator, {
      opacity: 1,
      duration: 0.8,
      delay: 2.6,
      ease: 'power2.out',
    })
    gsap.to(indicator, {
      y: 6,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: 2.6,
    })

    // ── Hero opacity: slow photographic emergence ──
    const opacityProxy = { value: 0 }
    gsap.to(opacityProxy, {
      value: 0.5,
      duration: 5.0,
      delay: 2.0,
      ease: 'sine.out',
      onUpdate: () => { heroOpacityRef.current = opacityProxy.value },
    })

    // ── Animated grain ──
    if (grain) {
      gsap.to(grain, {
        backgroundPosition: '256px 256px',
        duration: 0.8,
        repeat: -1,
        ease: 'steps(4)',
      })
    }

    // ── Render loop on GSAP ticker ──
    const onTick = (_, deltaTime) => {
      timeRef.current += deltaTime / 1000

      // Smooth mouse lerp — slow for a dreamlike lag
      const sm = smoothMouseRef.current
      const m = mouseRef.current
      sm.x += (m.x - sm.x) * 0.04
      sm.y += (m.y - sm.y) * 0.04

      draw()
    }
    gsap.ticker.add(onTick)

    // ── Scroll-driven exit ──
    const heroBaseOpacity = 0.5
    ScrollTrigger.create({
      trigger: section,
      start: '60% top',
      end: 'bottom top',
      scrub: 1,
      onUpdate: (self) => {
        const progress = self.progress
        gsap.set(title, { opacity: 1 - progress * 2 })
        gsap.set(tagline, { opacity: 1 - progress * 2 })
        gsap.set(indicator, { opacity: 1 - progress * 3 })

        // Hero canvas fades via opacity ref
        heroOpacityRef.current = Math.max(
          0,
          heroBaseOpacity * (1 - progress * 2.5)
        )

        // Background: gamma-corrected dark→cream
        const srgbToLinear = (c) => {
          const s = c / 255
          return s <= 0.04045
            ? s / 12.92
            : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        const linearToSrgb = (c) => {
          return c <= 0.0031308
            ? c * 12.92
            : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
        }
        const lerpLinear = (from, to, t) => {
          const f = srgbToLinear(from)
          const tt = srgbToLinear(to)
          return Math.round(linearToSrgb(f + (tt - f) * t) * 255)
        }
        const r = lerpLinear(10, 250, progress)
        const g = lerpLinear(10, 250, progress)
        const b = lerpLinear(10, 248, progress)
        section.style.backgroundColor = `rgb(${r}, ${g}, ${b})`

        // Start ambient audio on scroll
        if (progress > 0.05 && !audioStarted.current && audioManager) {
          audioManager.startAmbient()
          audioStarted.current = true
        }
      },
    })

    return () => {
      gsap.ticker.remove(onTick)
      gsap.killTweensOf([opacityProxy, grain, letters])
      window.removeEventListener('resize', resize)
      section.removeEventListener('mousemove', onMouseMove)
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === section) t.kill()
      })
    }
  }, [audioManager, draw])

  return (
    <section ref={sectionRef} className="scene scene--entry">
      {/* Grain overlay — animated film grain */}
      <div
        ref={grainRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px',
          backgroundPosition: '0 0',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Hero canvas — mouse-reactive tile displacement.
          Your cursor creates gentle ripples through the photograph,
          like looking at a print through moving water. The faces stay
          intact — the medium shifts, not the people. */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Spacer pushes the title group into the lower portion of the first
          viewport (100vh). The faces own the upper frame; UNSTILL anchors below.
          Using a max-height keeps everything visible above the fold. */}
      <div style={{ flex: '1 1 55%', maxHeight: '50vh' }} aria-hidden="true" />

      <h1
        ref={titleRef}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(3rem, 10vw, 8rem)',
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.2)',
          position: 'relative',
          zIndex: 3,
        }}
      >
        {'UNSTILL'.split('').map((char, i) => (
          <span className="letter" key={i} style={{ display: 'inline-block' }}>
            {char}
          </span>
        ))}
      </h1>

      <p
        ref={taglineRef}
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
          fontWeight: 400,
          color: 'rgba(255, 255, 255, 0.7)',
          marginTop: '1.5rem',
          letterSpacing: '0.02em',
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
          position: 'relative',
          zIndex: 3,
          maxWidth: '520px',
        }}
      >
        What does it mean for an archive to become an experience?
      </p>

      <div style={{ flex: '1 1 35%' }} aria-hidden="true" />

      <div
        ref={indicatorRef}
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 4,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Scroll
        </span>
        <div
          style={{
            width: '1px',
            height: '24px',
            background: 'var(--color-accent)',
          }}
        />
      </div>
    </section>
  )
}
