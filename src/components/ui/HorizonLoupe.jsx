import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'

/**
 * HorizonLoupe — Magnifying loupe for Horizon gallery cards.
 *
 * Same organic FBM-edged circle as the archive/story loupes, but
 * this one simply magnifies the photograph — letting you see the
 * details of these century-old faces up close.
 *
 * Wraps an <img> element. On hover, draws a zoomed portion of the
 * same image through a noise-edged circular mask.
 * Desktop only — skipped on touch devices.
 */

// ─── Simplex noise (same as StoryLoupe) ──────────────────────────────
function _mod289(x) { return x - Math.floor(x / 289.0) * 289.0 }
function _permute(x) { return _mod289((x * 34.0 + 1.0) * x) }

function snoise(x, y) {
  const C_x = 0.211324865405187, C_y = 0.366025403784439
  const C_z = -0.577350269189626, C_w = 0.024390243902439
  let s = (x + y) * C_y
  let i = Math.floor(x + s), j = Math.floor(y + s)
  let t = (i + j) * C_x
  let x0_x = x - (i - t), x0_y = y - (j - t)
  let i1, j1
  if (x0_x > x0_y) { i1 = 1; j1 = 0 } else { i1 = 0; j1 = 1 }
  let x1_x = x0_x + C_x - i1, x1_y = x0_y + C_x - j1
  let x2_x = x0_x + C_z, x2_y = x0_y + C_z
  i = _mod289(i); j = _mod289(j)
  let p0 = _permute(_permute(j) + i)
  let p1 = _permute(_permute(j + j1) + i + i1)
  let p2 = _permute(_permute(j + 1) + i + 1)
  let m0 = Math.max(0, 0.5 - x0_x * x0_x - x0_y * x0_y)
  let m1 = Math.max(0, 0.5 - x1_x * x1_x - x1_y * x1_y)
  let m2 = Math.max(0, 0.5 - x2_x * x2_x - x2_y * x2_y)
  m0 *= m0; m1 *= m1; m2 *= m2
  let ox0 = Math.floor(p0 * C_w) * 2.0 - 1.0, oy0 = Math.abs(ox0) - 0.5
  ox0 -= Math.floor(ox0 + 0.5)
  let ox1 = Math.floor(p1 * C_w) * 2.0 - 1.0, oy1 = Math.abs(ox1) - 0.5
  ox1 -= Math.floor(ox1 + 0.5)
  let ox2 = Math.floor(p2 * C_w) * 2.0 - 1.0, oy2 = Math.abs(ox2) - 0.5
  ox2 -= Math.floor(ox2 + 0.5)
  return 130.0 * (m0 * m0 * (ox0 * x0_x + oy0 * x0_y) +
                  m1 * m1 * (ox1 * x1_x + oy1 * x1_y) +
                  m2 * m2 * (ox2 * x2_x + oy2 * x2_y))
}

function fbm(x, y, time) {
  let value = 0, amp = 0.5, sx = x, sy = y
  for (let i = 0; i < 4; i++) {
    value += amp * snoise(sx + time * 0.04, sy + time * 0.03)
    sx *= 2; sy *= 2; amp *= 0.5
  }
  return value
}

// ─── Constants ───────────────────────────────────────────────────────

const LOUPE_RADIUS = 70
const NOISE_SCALE = 1.6
const NOISE_STRENGTH = 0.05
const NOISE_RING_SCALE = 0.35
const EDGE_DARKEN = 0.10
const MAGNIFICATION = 2.5  // How much to zoom in

// ─── Component ───────────────────────────────────────────────────────

export default function HorizonLoupe({ src, children }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const mousePosRef = useRef({ x: -999, y: -999 })
  const smoothPosRef = useRef({ x: -999, y: -999 })
  const isHoveringRef = useRef(false)
  const revealRef = useRef(0)
  const timeRef = useRef(0)

  // Load the full-res image for the loupe
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => { imgRef.current = img }
  }, [src])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    const container = containerRef.current
    if (!canvas || !img || !container) return

    const ctx = canvas.getContext('2d')
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    ctx.clearRect(0, 0, w, h)

    const reveal = revealRef.current
    if (reveal < 0.01) return

    const mx = smoothPosRef.current.x
    const my = smoothPosRef.current.y
    if (mx < -200 || my < -200) return

    const radius = LOUPE_RADIUS * reveal
    const time = timeRef.current

    // ── Organic loupe clip path ─────────────────────────────
    ctx.save()
    ctx.globalAlpha = 1.0 * reveal

    const steps = 72
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2
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

    // ── Draw magnified portion of the image ──
    // Map cursor position to image coordinates, then draw zoomed
    const imgAspect = img.width / img.height
    const containerAspect = w / h

    // How the image is displayed (cover fit)
    let dispW, dispH, dispX, dispY
    if (imgAspect > containerAspect) {
      dispH = h
      dispW = dispH * imgAspect
      dispX = (w - dispW) / 2
      dispY = 0
    } else {
      dispW = w
      dispH = dispW / imgAspect
      dispX = 0
      dispY = (h - dispH) / 2
    }

    // Cursor position in image-display space (0–1)
    const uCursor = (mx - dispX) / dispW
    const vCursor = (my - dispY) / dispH

    // Source rectangle in image pixels (centered on cursor, zoomed)
    const srcW = img.width / MAGNIFICATION
    const srcH = img.height / MAGNIFICATION
    const srcX = uCursor * img.width - srcW / 2
    const srcY = vCursor * img.height - srcH / 2

    // Destination: draw the zoomed portion to fill the loupe area
    const destSize = radius * 2.5
    const destX = mx - destSize / 2
    const destY = my - destSize / 2

    ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destSize, destSize)

    ctx.globalAlpha = 1.0
    ctx.restore()

    // ── Edge darkening ──────────────────────────────────────
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
  }, [])

  // Animation loop + mouse tracking + resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !src) return

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current.x = e.clientX - rect.left
      mousePosRef.current.y = e.clientY - rect.top
      isHoveringRef.current = true
    }

    const onMouseLeave = () => {
      isHoveringRef.current = false
    }

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

    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(container)
    resizeCanvas()

    const onTick = () => {
      const smooth = smoothPosRef.current
      const target = mousePosRef.current
      smooth.x += (target.x - smooth.x) * 0.1
      smooth.y += (target.y - smooth.y) * 0.1

      const targetReveal = isHoveringRef.current ? 1 : 0
      const revealSpeed = isHoveringRef.current ? 0.08 : 0.06
      revealRef.current += (targetReveal - revealRef.current) * revealSpeed

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
  }, [draw, src])

  // Skip on touch devices
  const isTouch = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  if (!src || isTouch) {
    return <>{children}</>
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  )
}
