import { useCallback } from 'react'

/**
 * MuteButton — Minimal sound toggle for the bottom-right corner.
 *
 * Keyboard accessible: Enter/Space toggle, visible focus ring.
 * Animated icon transition between muted/unmuted states.
 */
export default function MuteButton({ isMuted, onToggle, visible = true }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle]
  )

  return (
    <button
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
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isMuted ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.7)',
        opacity: visible ? 1 : 0,
        transition:
          'opacity 0.6s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.2s ease',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
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
        width="16"
        height="16"
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
          opacity="0.8"
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
            <path d="M15.5 8.5a4 4 0 0 1 0 7" opacity="0.6" />
            <path d="M18.5 6a8 8 0 0 1 0 12" opacity="0.35" />
          </>
        )}
      </svg>
    </button>
  )
}
