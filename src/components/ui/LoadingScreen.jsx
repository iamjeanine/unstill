import { useRef, useEffect } from 'react'
import gsap from 'gsap'

export default function LoadingScreen({ isLoaded }) {
  const screenRef = useRef(null)
  const textRef = useRef(null)
  const dismissed = useRef(false)

  useEffect(() => {
    if (isLoaded && !dismissed.current) {
      dismissed.current = true

      const tl = gsap.timeline()

      // First: fade out the loading text
      tl.to(textRef.current, {
        opacity: 0,
        y: -10,
        duration: 0.4,
        ease: 'power2.in',
      })

      // Then: clip-path wipe upward (theatrical curtain reveal)
      tl.to(
        screenRef.current,
        {
          clipPath: 'inset(0 0 100% 0)',
          duration: 1.0,
          ease: 'power3.inOut',
          onComplete: () => {
            if (screenRef.current) {
              screenRef.current.style.display = 'none'
            }
          },
        },
        '-=0.1'
      )
    }
  }, [isLoaded])

  return (
    <div
      ref={screenRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--color-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        clipPath: 'inset(0 0 0 0)',
      }}
    >
      <p
        ref={textRef}
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(1rem, 1.8vw, 1.3rem)',
          fontWeight: 400,
          letterSpacing: '0.02em',
          color: 'rgba(232, 228, 214, 0.35)',
        }}
      >
        Sydney, 1920s.
      </p>
    </div>
  )
}
