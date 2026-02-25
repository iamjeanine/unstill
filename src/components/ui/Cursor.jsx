import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { INTERACTION_STATES } from '../../data/sceneConfig'

export default function Cursor({ interactionState }) {
  const outerRef = useRef(null)
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const mousePos = useRef({ x: -100, y: -100 })
  const cursorPos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })
  const prevState = useRef(INTERACTION_STATES.BROWSING)

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
      // Dot follows with slight lag (fast but noticeably trailing)
      cursorPos.current.x +=
        (mousePos.current.x - cursorPos.current.x) * 0.15
      cursorPos.current.y +=
        (mousePos.current.y - cursorPos.current.y) * 0.15

      // Ring follows with more lag (floaty, dreamy)
      ringPos.current.x +=
        (mousePos.current.x - ringPos.current.x) * 0.08
      ringPos.current.y +=
        (mousePos.current.y - ringPos.current.y) * 0.08

      // Apply transforms via GSAP (GPU-accelerated matrix3d)
      gsap.set(outer, {
        x: cursorPos.current.x,
        y: cursorPos.current.y,
      })
      gsap.set(ring, {
        x: ringPos.current.x - cursorPos.current.x,
        y: ringPos.current.y - cursorPos.current.y,
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    gsap.ticker.add(onTick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      gsap.ticker.remove(onTick)
    }
  }, [])

  // Animate cursor state transitions with GSAP (not CSS transitions)
  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    prevState.current = interactionState

    const isHovering = interactionState === INTERACTION_STATES.HOVERING
    const isDragging = interactionState === INTERACTION_STATES.DRAGGING
    const isStory = interactionState === INTERACTION_STATES.STORY

    if (isHovering) {
      // Dot shrinks to tiny crosshair point — "examine here"
      gsap.to(dot, {
        width: 4,
        height: 4,
        opacity: 0.6,
        duration: 0.4,
        ease: 'power2.out',
      })
      // Ring expands and appears — trails behind dot
      gsap.to(ring, {
        width: 40,
        height: 40,
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      })
    } else if (isDragging) {
      // Medium dot for grab state
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
      // Story mode — tiny subtle dot, no ring
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
      // BROWSING — default small dot
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
    </div>
  )
}
