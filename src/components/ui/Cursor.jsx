import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { INTERACTION_STATES } from '../../data/sceneConfig'

/**
 * Custom cursor — evolves with the experience.
 *
 * BROWSING:  Small white dot (default)
 * HOVERING:  Tiny crosshair dot + trailing ring (archive mugshots)
 * DRAGGING:  Medium dot, no ring
 * STORY:     Tiny subtle dot
 *
 * Scroll-aware overlays:
 *  - Entry:   Soft warm glow (torch on a photograph)
 *  - Horizon: Ring appears with "+" crosshair on card hover
 *  - Closing: Cursor shrinks and fades — the interface withdrawing
 */

export default function Cursor({ interactionState, scrollSection }) {
  const outerRef = useRef(null)
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const glowRef = useRef(null)
  const mousePos = useRef({ x: -100, y: -100 })
  const cursorPos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })
  const prevSection = useRef('entry')
  const lerpFactor = useRef(0.15)
  const withdrawalProgress = useRef(0)

  // Set up mouse tracking + GSAP ticker lerp
  useEffect(() => {
    const outer = outerRef.current
    const ring = ringRef.current

    const onMouseMove = (e) => {
      mousePos.current.x = e.clientX
      mousePos.current.y = e.clientY
    }

    // GSAP ticker — runs every frame for smooth lerp
    const onTick = () => {
      const lerp = lerpFactor.current
      if (lerp <= 0.001) return // frozen — don't update position

      cursorPos.current.x +=
        (mousePos.current.x - cursorPos.current.x) * lerp
      cursorPos.current.y +=
        (mousePos.current.y - cursorPos.current.y) * lerp

      ringPos.current.x +=
        (mousePos.current.x - ringPos.current.x) * (lerp * 0.53)
      ringPos.current.y +=
        (mousePos.current.y - ringPos.current.y) * (lerp * 0.53)

      gsap.set(outer, {
        x: cursorPos.current.x,
        y: cursorPos.current.y,
      })
      gsap.set(ring, {
        x: ringPos.current.x - cursorPos.current.x,
        y: ringPos.current.y - cursorPos.current.y,
      })
    }

    // Withdrawal listener — closing section degrades cursor responsiveness
    const onWithdrawal = (e) => {
      const p = e.detail.progress // 0 → 1
      withdrawalProgress.current = p
      // Lerp degrades from 0.15 → 0 as withdrawal progresses
      lerpFactor.current = 0.15 * (1 - p)
      // Dot fades out
      gsap.set(dotRef.current, { opacity: Math.max(0.05, 1 - p * 1.2) })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('unstill:withdrawal', onWithdrawal)
    gsap.ticker.add(onTick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('unstill:withdrawal', onWithdrawal)
      gsap.ticker.remove(onTick)
    }
  }, [])

  // ─── Interaction state transitions (archive-driven) ─────────
  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current

    const isHovering = interactionState === INTERACTION_STATES.HOVERING
    const isDragging = interactionState === INTERACTION_STATES.DRAGGING
    const isStory = interactionState === INTERACTION_STATES.STORY

    if (isHovering) {
      gsap.to(dot, {
        width: 4,
        height: 4,
        opacity: 0.6,
        duration: 0.4,
        ease: 'power2.out',
      })
      gsap.to(ring, {
        width: 40,
        height: 40,
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      })
    } else if (isDragging) {
      gsap.to(dot, {
        width: 14,
        height: 14,
        opacity: 0.5,
        duration: 0.25,
        ease: 'power2.out',
      })
      gsap.to(ring, {
        width: 0,
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
    } else if (isStory) {
      gsap.to(dot, {
        width: 6,
        height: 6,
        opacity: 0.35,
        duration: 0.5,
        ease: 'power2.out',
      })
      gsap.to(ring, {
        width: 0,
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
    } else {
      // BROWSING — default, but scroll section may override below
      gsap.to(dot, {
        width: 8,
        height: 8,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
      })
      gsap.to(ring, {
        width: 0,
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
    }
  }, [interactionState])

  // ─── Scroll-section cursor personality ──────────────────────
  useEffect(() => {
    // Only apply section styling when browsing (not in story/drag)
    if (
      interactionState !== INTERACTION_STATES.BROWSING &&
      interactionState !== INTERACTION_STATES.HOVERING
    ) return

    const outer = outerRef.current
    const dot = dotRef.current
    const glow = glowRef.current

    if (scrollSection === 'entry') {
      // Torch on a photograph — warm glow around cursor
      gsap.to(outer, { mixBlendMode: 'normal', duration: 0 })
      gsap.to(dot, { opacity: 0.7, duration: 0.6, ease: 'power2.out' })
      gsap.to(glow, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' })
    } else if (scrollSection === 'closing') {
      // The interface withdraws — cursor fades nearly invisible
      gsap.to(outer, { mixBlendMode: 'difference', duration: 0 })
      gsap.to(dot, {
        width: 4,
        height: 4,
        opacity: 0.15,
        duration: 1.2,
        ease: 'power2.out',
      })
      gsap.to(glow, { opacity: 0, scale: 0.5, duration: 0.8, ease: 'power2.in' })
    } else if (scrollSection === 'horizon') {
      // Light table — crisp small dot, glow off
      gsap.to(outer, { mixBlendMode: 'difference', duration: 0 })
      gsap.to(dot, { width: 6, height: 6, opacity: 0.9, duration: 0.4, ease: 'power2.out' })
      gsap.to(glow, { opacity: 0, scale: 0.5, duration: 0.5, ease: 'power2.in' })
    } else {
      // Default for hartman, scale, archive — standard dot, no glow
      gsap.to(outer, { mixBlendMode: 'difference', duration: 0 })
      gsap.to(dot, { width: 8, height: 8, opacity: 1, duration: 0.35, ease: 'power2.out' })
      gsap.to(glow, { opacity: 0, scale: 0.5, duration: 0.5, ease: 'power2.in' })
    }

    prevSection.current = scrollSection
  }, [scrollSection, interactionState])

  return (
    <div
      ref={outerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        mixBlendMode: 'difference',
        willChange: 'transform',
      }}
    >
      {/* Inner dot — follows mouse with slight lag */}
      <div
        ref={dotRef}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'white',
          transform: 'translate(-50%, -50%)',
        }}
      />
      {/* Outer ring — follows with more lag, only visible on hover */}
      <div
        ref={ringRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          borderRadius: '50%',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          background: 'transparent',
          transform: 'translate(-50%, -50%)',
          opacity: 0,
        }}
      />
      {/* Warm glow — visible in hero section (torch on a photograph) */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232, 200, 170, 0.07) 0%, rgba(232, 200, 170, 0.02) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
