import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'

// ─── Simplex noise (shared language with Entry + StoryLoupe) ─────────
function _mod289(x) { return x - Math.floor(x / 289.0) * 289.0 }
function _permute(x) { return _mod289((x * 34.0 + 1.0) * x) }

function snoise(x, y) {
  const Cx = 0.211324865405187, Cy = 0.366025403784439
  const Cz = -0.577350269189626, Cw = 0.024390243902439
  let ix = Math.floor(x + (x + y) * Cy), iy = Math.floor(y + (x + y) * Cy)
  const x0x = x - ix + (ix + iy) * Cx, x0y = y - iy + (ix + iy) * Cx
  const i1x = x0x > x0y ? 1 : 0, i1y = x0x > x0y ? 0 : 1
  const x12x = x0x + Cx - i1x, x12y = x0y + Cx - i1y
  const x12z = x0x + Cz, x12w = x0y + Cz
  ix = _mod289(ix); iy = _mod289(iy)
  const p = _permute(_permute(iy) + ix)
  const p1 = _permute(_permute(iy + i1y) + ix + i1x)
  const p2 = _permute(_permute(iy + 1) + ix + 1)
  let mx = Math.max(0, 0.5 - (x0x * x0x + x0y * x0y))
  let my = Math.max(0, 0.5 - (x12x * x12x + x12y * x12y))
  let mz = Math.max(0, 0.5 - (x12z * x12z + x12w * x12w))
  mx *= mx; my *= my; mz *= mz
  const oxx = (Math.floor(p * Cw) * 2 + 1) / 7 - 1
  const oxy = (Math.floor(p1 * Cw) * 2 + 1) / 7 - 1
  const oxz = (Math.floor(p2 * Cw) * 2 + 1) / 7 - 1
  const a0x = -1 + 2 * (p * Cw - Math.floor(p * Cw))
  const a0y = -1 + 2 * (p1 * Cw - Math.floor(p1 * Cw))
  const a0z = -1 + 2 * (p2 * Cw - Math.floor(p2 * Cw))
  const hx = Math.abs(a0x) - 0.5, hy = Math.abs(a0y) - 0.5, hz = Math.abs(a0z) - 0.5
  const sx = Math.floor(a0x) + 0.5, sy = Math.floor(a0y) + 0.5, sz = Math.floor(a0z) + 0.5
  const gx = sx * x0x + hx * x0y
  const gy = sy * x12x + hy * x12y
  const gz = sz * x12z + hz * x12w
  const nx = 1.79284291400159 - 0.85373472095314 * (oxx * oxx + hx * hx)
  const ny = 1.79284291400159 - 0.85373472095314 * (oxy * oxy + hy * hy)
  const nz = 1.79284291400159 - 0.85373472095314 * (oxz * oxz + hz * hz)
  return 130.0 * (mx * mx * nx * gx + my * my * ny * gy + mz * mz * nz * gz)
}

function fbm(x, y, t) {
  let v = 0, a = 0.5
  for (let i = 0; i < 3; i++) {
    v += a * snoise(x + t * 0.3, y + t * 0.2)
    x *= 2.0; y *= 2.0; a *= 0.5
  }
  return v
}

// ─── Constants ───────────────────────────────────────────────────────
const LOUPE_RADIUS = 120
const NOISE_SCALE = 1.0
const NOISE_STRENGTH = 0.35  // big billowy movement
const SEGMENTS = 80
const BREATHE_AMOUNT = 0.12  // how much the whole shape pulses
const BREATHE_SPEED = 0.4    // pulse frequency

export default function LoadingScreen({ isLoaded, onEnter }) {
  const screenRef = useRef(null)
  const canvasRef = useRef(null)
  const textRef = useRef(null)
  const dismissed = useRef(false)
  const loadedRef = useRef(false)
  const mouseRef = useRef({ x: -999, y: -999 })
  const smoothRef = useRef({ x: -999, y: -999 })
  const hintRef = useRef(null)
  const imgRef = useRef(null)
  const rafRef = useRef(null)
  const timeRef = useRef(0)
  const revealRef = useRef(0)
  const maskRef = useRef(document.createElement('canvas'))
  const isTouch = useRef(false)

  useEffect(() => {
    loadedRef.current = isLoaded
  }, [isLoaded])

  // Load hero image for loupe
  useEffect(() => {
    isTouch.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const img = new Image()
    img.src = '/mugshots/num-and-tom.jpg'
    img.onload = () => { imgRef.current = img }
  }, [])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio, 2)

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const img = imgRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      if (!img || isTouch.current) return

      timeRef.current += 0.016

      // Smooth cursor follow
      const lerp = 0.08
      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * lerp
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * lerp

      const mx = smoothRef.current.x
      const my = smoothRef.current.y

      // Reveal ramps up when cursor is on screen
      const onScreen = mx > -500 && my > -500
      const targetReveal = onScreen ? 1 : 0
      revealRef.current += (targetReveal - revealRef.current) * 0.06

      if (revealRef.current < 0.01) return

      const reveal = revealRef.current
      const r = LOUPE_RADIUS
      const t = timeRef.current

      // Cover-fit image calculations (bias left like Entry)
      const imgAspect = img.width / img.height
      const canvasAspect = w / h
      let drawW, drawH, drawX, drawY
      if (imgAspect > canvasAspect) {
        drawH = h
        drawW = h * imgAspect
        drawX = -(drawW - w) * 0.3
        drawY = 0
      } else {
        drawW = w
        drawH = w / imgAspect
        drawX = 0
        drawY = (h - drawH) * 0.5
      }

      // ── Soft billowy mask ──────────────────────────────────
      // Each radial ring samples noise at a different time offset
      // so the outer edges billow independently of the center,
      // like chemicals blooming on a developing print.

      const maskSize = Math.ceil(r * 3)
      const offscreen = maskRef.current
      offscreen.width = maskSize * 2
      offscreen.height = maskSize * 2
      const mctx = offscreen.getContext('2d')
      mctx.clearRect(0, 0, maskSize * 2, maskSize * 2)

      const cx = maskSize, cy = maskSize

      // Slow breathing pulse — whole shape expands/contracts
      const breathe = 1 + Math.sin(t * BREATHE_SPEED) * BREATHE_AMOUNT

      const steps = 28
      for (let s = steps; s >= 0; s--) {
        const frac = s / steps // 1 = outer, 0 = center

        // Each ring lives at a slightly different moment in time
        // so outer rings lag/lead the inner ones → billow effect
        const ringTime = t + frac * 1.8

        // Base radius expands with breathe, outer rings more affected
        const baseR = r * (0.25 + frac * 1.15) * (1 + (breathe - 1) * frac)

        mctx.beginPath()
        for (let i = 0; i <= SEGMENTS; i++) {
          const angle = (i / SEGMENTS) * Math.PI * 2
          const nx = Math.cos(angle) * NOISE_SCALE
          const ny = Math.sin(angle) * NOISE_SCALE

          // Layer 1: large slow billow
          const billow = fbm(nx, ny, ringTime * 0.7) * NOISE_STRENGTH * r
          // Layer 2: smaller faster ripple on outer rings
          const ripple = frac * snoise(
            nx * 2.5 + ringTime * 1.2,
            ny * 2.5 - ringTime * 0.8
          ) * NOISE_STRENGTH * r * 0.4

          const pr = baseR + billow + ripple
          const px = cx + Math.cos(angle) * pr
          const py = cy + Math.sin(angle) * pr
          if (i === 0) mctx.moveTo(px, py)
          else mctx.lineTo(px, py)
        }
        mctx.closePath()

        // Smooth alpha falloff — bright center, dissolving edges
        const alpha = Math.pow(1 - frac, 1.8) * 0.8
        mctx.fillStyle = `rgba(255,255,255,${alpha})`
        mctx.fill()
      }

      // ── Draw image masked by the soft blob ─────────────────
      ctx.save()
      ctx.globalAlpha = reveal

      // Draw the image into main canvas
      ctx.filter = 'grayscale(0.6) contrast(1.05) brightness(0.65)'
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.filter = 'none'

      // Cool archival tint
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(200, 210, 220, 0.15)'
      ctx.fillRect(0, 0, w, h)

      // Use the soft mask to cut out everything outside the blob
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(offscreen, mx - maskSize, my - maskSize, maskSize * 2, maskSize * 2)

      ctx.restore()
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }
    const onLeave = () => {
      mouseRef.current.x = -999
      mouseRef.current.y = -999
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // Text entrance + gentle breathing
  useEffect(() => {
    const text = textRef.current
    const hint = hintRef.current
    if (!text) return
    gsap.set(text, { opacity: 0, y: 12 })
    gsap.to(text, {
      opacity: 1,
      y: 0,
      duration: 2.5,
      delay: 0.6,
      ease: 'power2.out',
      onComplete: () => {
        // Slow breathe — visible pulse so it feels alive
        gsap.to(text, {
          opacity: 0.45,
          duration: 2.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      },
    })
    // Hint fades in quietly after the main text has settled
    if (hint) {
      gsap.set(hint, { opacity: 0 })
      gsap.to(hint, {
        opacity: 1,
        duration: 1.5,
        delay: 3.5,
        ease: 'power2.out',
      })
    }
  }, [])

  const handleEnter = useCallback(() => {
    if (dismissed.current || !loadedRef.current) return
    dismissed.current = true

    if (onEnter) onEnter()

    const screen = screenRef.current
    const text = textRef.current
    const canvas = canvasRef.current
    const tl = gsap.timeline()

    // Kill all running animations on text and hint
    const hint = hintRef.current
    if (hint) {
      gsap.killTweensOf(hint)
      gsap.set(hint, { opacity: 0 })
    }
    if (text) {
      gsap.killTweensOf(text)
    }

    // Text and loupe vanish quickly
    tl.to([text, canvas].filter(Boolean), {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    }, 0)

    // Screen dissolves slowly
    tl.to(screen, {
      opacity: 0,
      duration: 3.0,
      ease: 'power2.inOut',
      onComplete: () => {
        cancelAnimationFrame(rafRef.current)
        if (screen) {
          screen.style.display = 'none'
          screen.style.pointerEvents = 'none'
        }
      },
    }, 0.4)
  }, [onEnter])

  return (
    <div
      ref={screenRef}
      onClick={handleEnter}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--color-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        position: 'relative',
        zIndex: 1,
      }}>
        <p
          ref={textRef}
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.1rem, 2.2vw, 1.6rem)',
            fontWeight: 400,
            color: 'rgba(232, 228, 214, 0.5)',
            letterSpacing: '0.04em',
            margin: 0,
            opacity: 0,
            userSelect: 'none',
            transition: 'color 0.5s ease',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = 'rgba(232, 228, 214, 0.7)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = 'rgba(232, 228, 214, 0.5)')
          }
        >
          Look closer
        </p>
        <span
          ref={hintRef}
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(232, 228, 214, 0.45)',
            opacity: 0,
            userSelect: 'none',
          }}
        >
          Click anywhere to enter
        </span>
      </div>
    </div>
  )
}
