import { useRef, useEffect } from 'react'
import gsap from 'gsap'

export default function LoadingScreen({ isLoaded }) {
  const screenRef = useRef(null)
  const dismissed = useRef(false)

  useEffect(() => {
    if (isLoaded && !dismissed.current) {
      dismissed.current = true

      const tl = gsap.timeline()

      // Clip-path wipe upward (theatrical curtain reveal)
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
        clipPath: 'inset(0 0 0 0)',
      }}
    />
  )
}
