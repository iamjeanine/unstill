import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * MuteButton — Sound toggle, bottom-right corner.
 *
 * When `visible` transitions to true (music starts), the button fades in
 * and pulses gently twice to draw the eye, then settles.
 */
export default function MuteButton({ isMuted, onToggle, visible = true }) {
  const btnRef = useRef(null)
  const hasAppeared = useRef(false)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle]
  )

  // Entrance animation — pulse to draw attention when music starts
  useEffect(() => {
    if (!visible || hasAppeared.current || !btnRef.current) return
    hasAppeared.current = true

    const btn = btnRef.current
    gsap.set(btn, { opacity: 0, scale: 0.8 })

    const tl = gsap.timeline({ delay: 1.5 })

    // Fade in
    tl.to(btn, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power2.out',
    })

    // Two gentle pulses
    tl.to(btn, {
      scale: 1.18,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      duration: 0.5,
      ease: 'power2.out',
    })
    tl.to(btn, {
      scale: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      duration: 0.6,
      ease: 'power2.inOut',
    })
    tl.to(btn, {
      scale: 1.12,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      duration: 0.45,
      ease: 'power2.out',
    })
    tl.to(btn, {
      scale: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      duration: 0.5,
      ease: 'power2.inOut',
    })

    return () => tl.kill()
  }, [visible])

  return (
    <button
      ref={btnRef}
      className="mute-toggle"
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={isMuted}
      tabIndex={0}
      style={{
        position: 'fixed',
        bottom: 'max(2rem, env(safe-area-inset-bottom, 0px))',
        right: 'max(2rem, env(safe-area-inset-right, 0px))',
        zIndex: 100,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isMuted ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.85)',
        opacity: 0,
        transition:
          'color 0.3s ease, border-color 0.3s ease, background 0.3s ease, box-shadow 0.2s ease',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)'
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.45)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.35)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow =
          '0 0 0 2px rgba(232, 112, 90, 0.35)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'opacity 0.3s ease' }}
      >
        {/* Speaker body */}
        <polygon
          points="6,9 2,9 2,15 6,15 11,19 11,5"
          fill="currentColor"
          stroke="none"
          opacity="0.85"
        />
        {isMuted ? (
          /* Muted: X through waves */
          <>
            <line x1="16" y1="9" x2="22" y2="15" />
            <line x1="22" y1="9" x2="16" y2="15" />
          </>
        ) : (
          /* Unmuted: sound waves */
          <>
            <path d="M15.5 8.5a4 4 0 0 1 0 7" opacity="0.7" />
            <path d="M18.5 6a8 8 0 0 1 0 12" opacity="0.4" />
          </>
        )}
      </svg>
    </button>
  )
}
