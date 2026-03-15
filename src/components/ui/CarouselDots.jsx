import { useRef, useEffect } from 'react'
import gsap from 'gsap'

/**
 * CarouselDots — Mobile-only dot indicators for archive group carousel.
 *
 * Shows which person in a multi-person group is currently visible.
 * Fades in/out with GSAP. Purely visual (pointerEvents: none).
 */
export default function CarouselDots({ active, index, count }) {
  const containerRef = useRef(null)
  const prevActive = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return

    if (active && !prevActive.current) {
      gsap.to(containerRef.current, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
      })
    } else if (!active && prevActive.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
    }

    prevActive.current = active
  }, [active])

  if (!active && !prevActive.current) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? '10px' : '7px',
            height: i === index ? '10px' : '7px',
            borderRadius: '50%',
            background:
              i === index
                ? 'rgba(40, 35, 30, 0.7)'
                : 'rgba(40, 35, 30, 0.25)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}
