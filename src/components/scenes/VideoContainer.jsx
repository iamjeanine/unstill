export default function VideoContainer({ person }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 10, 0.95)',
      }}
    >
      <div
        style={{
          width: '80vw',
          maxWidth: '900px',
          aspectRatio: '16 / 9',
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Video
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {person.displayName}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          Coming soon
        </span>
      </div>
    </div>
  )
}
