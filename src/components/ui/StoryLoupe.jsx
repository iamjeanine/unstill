import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'

/**
 * StoryLoupe — Inverted magnifying glass for story panel videos.
 *
 * In the archive, the loupe reveals life (color) from stillness (B&W).
 * In the story, the loupe reveals the original B&W archive photograph
 * from within the living, colorized animation.
 * Same tool, opposite direction, deeper layer.
 *
 * Architecture:
 *   - Video plays normally as the base layer (alive, in color)
 *   - On hover, a <canvas> draws the B&W mugshot through a circular loupe mask
 *   - The color image is desaturated at load time into an offscreen canvas
 *   - FBM noise creates organic, watercolor-like loupe edges (matching archive shader)
 *   - Desktop only — skipped on touch devices
 */

// ─── Simplex noise (ported from GLSL includes/noise.glsl) ────────────

function _mod289(x) { return x - Math.floor(x / 289.0) * 289.0 }
function _permute(x) { return _mod289((x * 34.0 + 1.0) * x) }

function snoise(x, y) {
  const C_x = 0.211324865405187  // (3 - sqrt(3)) / 6
  const C_y = 0.366025403784439  // 0.5 * (sqrt(3) - 1)
  const C_z = -0.577350269189626 // -1 + 2 * C.x
  const C_w = 0.024390243902439  // 1/41

  // First corner
  let s = (x + y) * C_y
  let i = Math.floor(x + s)
  let j = Math.floor(y + s)
  let t = (i + j) * C_x
  let x0_x = x - (i - t)
  let x0_y = y - (j - t)

  // Which simplex
  let i1, j1
  if (x0_x > x0_y) { i1 = 1; j1 = 0 } else { i1 = 0; j1 = 1 }

  let x1_x = x0_x + C_x - i1
  let x1_y = x0_y + C_x - j1
  let x2_x = x0_x + C_z
  let x2_y = x0_y + C_z

  i = _mod289(i)
  j = _mod289(j)
  let p0 = _permute(_permute(j) + i)
  let p1 = _permute(_permute(j + j1) + i + i1)
  let p2 = _permute(_permute(j + 1) + i + 1)

  let m0 = Math.max(0, 0.5 - x0_x * x0_x - x0_y * x0_y)
  let m1 = Math.max(0, 0.5 - x1_x * x1_x - x1_y * x1_y)
  let m2 = Math.max(0, 0.5 - x2_x * x2_x - x2_y * x2_y)
  m0 *= m0; m1 *= m1; m2 *= m2

  // Gradients
  let ox0 = Math.floor(p0 * C_w) * 2.0 - 1.0
  let oy0 = Math.abs(ox0) - 0.5
  ox0 -= Math.floor(ox0 + 0.5)
  let g0x = ox0, g0y = oy0

  let ox1 = Math.floor(p1 * C_w) * 2.0 - 1.0
  let oy1 = Math.abs(ox1) - 0.5
  ox1 -= Math.floor(ox1 + 0.5)
  let g1x = ox1, g1y = oy1

  let ox2 = Math.floor(p2 * C_w) * 2.0 - 1.0
  let oy2 = Math.abs(ox2) - 0.5
  ox2 -= Math.floor(ox2 + 0.5)
  let g2x = ox2, g2y = oy2

  let d0 = g0x * x0_x + g0y * x0_y
  let d1 = g1x * x1_x + g1y * x1_y
  let d2 = g2x * x2_x + g2y * x2_y

  return 130.0 * (m0 * m0 * d0 + m1 * m1 * d1 + m2 * m2 * d2)
}

function fbm(x, y, time) {
  let value = 0
  let amp = 0.5
  let sx = x, sy = y
  for (let i = 0; i < 4; i++) { // 4 octaves (slightly fewer than shader for perf)
    value += amp * snoise(sx + time * 0.04, sy + time * 0.03)
    sx *= 2; sy *= 2
    amp *= 0.5
  }
  return value
}

// ─── Component ───────────────────────────────────────────────────────

const LOUPE_RADIUS = 75        // px radius of loupe circle (CSS pixels)
const NOISE_SCALE = 1.6        // FBM frequency (lower = smoother blobs)
const NOISE_STRENGTH = 0.05    // how much noise distorts the edge (subtle)
const NOISE_RING_SCALE = 0.35  // how far around the ring noise samples spread
const EDGE_DARKEN = 0.10       // darkening at loupe boundary
const MAGNIFICATION = 1.0      // 1.0 = exact overlay, no zoom distortion

export default function StoryLoupe({ videoRef, stillSrc, children }) {
  const canvasRef = useRef(null)
  const stillImgRef = useRef(null)
  const bwCanvasRef = useRef(null)  // offscreen canvas holding the B&W version
  const containerRef = useRef(null)
  const mousePosRef = useRef({ x: -999, y: -999 })
  const smoothPosRef = useRef({ x: -999, y: -999 })
  const isHoveringRef = useRef(false)
  const revealRef = useRef(0) // 0 = hidden, 1 = fully visible
  const timeRef = useRef(0)

  // Load the still image and create a B&W version
  useEffect(() => {
    if (!stillSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = stillSrc
    img.onload = () => {
      stillImgRef.current = img

      // Create offscreen B&W version — the original archive photograph
      const offscreen = document.createElement('canvas')
      offscreen.width = img.width
      offscreen.height = img.height
      const offCtx = offscreen.getContext('2d')

      // Draw with grayscale + slight contrast boost for archival look
      offCtx.filter = 'grayscale(1) contrast(1.08) brightness(0.95)'
      offCtx.drawImage(img, 0, 0)
      offCtx.filter = 'none'

      bwCanvasRef.current = offscreen
    }
  }, [stillSrc])

  // Draw the loupe on canvas
  // Note: canvas uses DPR scaling via setTransform, so all drawing uses CSS pixel coords
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const bwCanvas = bwCanvasRef.current
    const img = stillImgRef.current  // used for dimensions
    const container = containerRef.current
    if (!canvas || !bwCanvas || !img || !container) return

    const ctx = canvas.getContext('2d')
    // Use CSS pixel dimensions (not canvas.width which is device pixels)
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    // Clear in CSS pixel space (DPR transform handles the rest)
    ctx.clearRect(0, 0, w, h)

    const reveal = revealRef.current
    if (reveal < 0.01) return // Nothing to draw

    const mx = smoothPosRef.current.x
    const my = smoothPosRef.current.y

    // If cursor is way off screen, skip
    if (mx < -200 || my < -200) return

    const radius = LOUPE_RADIUS * reveal
    const time = timeRef.current

    // ── Organic loupe clip path ─────────────────────────────
    ctx.save()

    // Full opacity — the original underneath is definitive, not ghostly
    ctx.globalAlpha = 1.0 * reveal

    const steps = 72 // segments around the circle
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      // Sample noise — gentle, position-dependent organic wobble
      const nx = (mx / w) * NOISE_SCALE + Math.cos(angle) * NOISE_RING_SCALE
      const ny = (my / h) * NOISE_SCALE + Math.sin(angle) * NOISE_RING_SCALE
      const noise = fbm(nx, ny, time)
      const noiseOffset = noise * NOISE_STRENGTH * radius
      const r = radius + noiseOffset
      const px = mx + Math.cos(angle) * r
      const py = my + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.clip()

    // ── Draw still image (cover-fit, biased to front-face panel) ──
    // Mugshots are dual-panel composites (front + side). The front-facing
    // close-up is in the LEFT portion. Bias the cover-fit toward the left
    // so the loupe reveals the face, not the dividing line.
    const imgAspect = img.width / img.height
    const canvasAspect = w / h

    let drawW, drawH, drawX, drawY
    if (imgAspect > canvasAspect) {
      // Image wider than canvas → fit height, crop width
      drawH = h * MAGNIFICATION
      drawW = drawH * imgAspect
      // Bias left: show 30% from left edge instead of 50% center
      drawX = -(drawW - w) * 0.3
    } else {
      // Image taller than canvas → fit width, crop height
      drawW = w * MAGNIFICATION
      drawH = drawW / imgAspect
      drawX = (w - drawW) / 2
    }
    drawY = (h - drawH) / 2

    // Draw the B&W archive version (not the color image)
    ctx.drawImage(bwCanvas, drawX, drawY, drawW, drawH)

    ctx.globalAlpha = 1.0
    ctx.restore()

    // ── Edge darkening — subtle ring at loupe boundary ──────
    if (reveal > 0.3) {
      ctx.save()
      const gradient = ctx.createRadialGradient(mx, my, radius * 0.82, mx, my, radius * 1.15)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.5, `rgba(0,0,0,${EDGE_DARKEN * reveal})`)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(mx - radius * 1.5, my - radius * 1.5, radius * 3, radius * 3)
      ctx.restore()
    }

    // ── Subtle cool tint inside loupe (silver-gelatin archival feel) ──
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.beginPath()
    ctx.arc(mx, my, radius * 0.9, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = `rgba(220, 225, 230, ${0.08 * reveal})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }, [])

  // Animation loop + mouse tracking + resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !stillSrc) return

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current.x = e.clientX - rect.left
      mousePosRef.current.y = e.clientY - rect.top
      isHoveringRef.current = true
    }

    const onMouseLeave = () => {
      isHoveringRef.current = false
    }

    // Resize canvas to match container (called on mount + resize + video load)
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Use ResizeObserver to catch video dimension changes
    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(container)
    resizeCanvas()

    const onTick = () => {
      const smooth = smoothPosRef.current
      const target = mousePosRef.current

      // Smooth cursor (same lerp as Cursor.jsx)
      smooth.x += (target.x - smooth.x) * 0.1
      smooth.y += (target.y - smooth.y) * 0.1

      // Reveal animation — fade in on hover, fade out on leave
      const targetReveal = isHoveringRef.current ? 1 : 0
      const revealSpeed = isHoveringRef.current ? 0.08 : 0.06 // faster in, slower out
      revealRef.current += (targetReveal - revealRef.current) * revealSpeed

      // Time for noise animation
      timeRef.current += 0.016

      draw()
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    gsap.ticker.add(onTick)

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      ro.disconnect()
      gsap.ticker.remove(onTick)
    }
  }, [draw, stillSrc])

  // If no still image or touch device, just render children
  const isTouch = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  if (!stillSrc || isTouch) {
    return <>{children}</>
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: 'none',
      }}
    >
      {/* Video (or fallback image) as base layer */}
      {children}

      {/* Canvas overlay — draws still mugshot through loupe mask */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
    </div>
  )
}
