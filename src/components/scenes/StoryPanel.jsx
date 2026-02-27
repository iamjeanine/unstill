import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import gsap from 'gsap'
import { people } from '../../data/people'
import StoryLoupe from '../ui/StoryLoupe'
import { generateMarginaliaImmediate } from '../../engine/MarginaliaAPI'
import { getPreviousNotes, addNotes, consumePrefetch, clearPrefetch } from '../../engine/marginaliaSessionStore'
import storyInscriptions from '../../data/storyInscriptions.json'

/**
 * StoryPanel — "The Lightbox with Focus Gradient"
 *
 * Museum conservation table aesthetic. Dark warm grey (#0c0a09).
 * Video centered at top with subtle warm glow. Viewer scrolls the
 * essay at their own pace through a CSS mask-image focus gradient
 * that sharpens text at the reading position and fades it above/below.
 *
 * Two-zone split:
 *   1. Video zone (fixed height) — video, StoryLoupe, meta label, inscriptions
 *   2. Essay zone (flex: 1, scrollable) — paragraphs with focus gradient mask
 *
 * Interactions:
 *   - Viewer scrolls essay manually at own pace
 *   - Loupe active on video throughout (hover to reveal B&W original)
 *   - Inscriptions develop in the margin like photographic chemistry
 */

// ─── Color palette (Lightbox dark theme) ─────────────────────────────
const COLORS = {
  bg: '#0c0a09',
  text: 'rgba(232, 228, 214, 0.85)',
  textMuted: 'rgba(232, 228, 214, 0.65)',
  textBright: 'rgba(232, 228, 214, 0.9)',
  accent: '#E8705A',
  reframe: 'rgba(214, 168, 152, 0.9)',
  backBtn: 'rgba(255, 255, 255, 0.55)',
  videoGlow: '0 0 80px rgba(232, 112, 90, 0.04)',
  inscriptionColors: [
    'rgba(255, 255, 255, 0.8)',
    'rgba(255, 255, 255, 0.7)',
    'rgba(255, 255, 255, 0.6)',
  ],
  borderSubtle: 'rgba(232, 228, 214, 0.12)',
  connectionBg: 'rgba(255, 255, 255, 0.04)',
}

export default function StoryPanel({ person, onClose, onCloseStart, onCloseComplete, onNavigate }) {
  const panelRef = useRef(null)
  const videoRef = useRef(null)
  const videoZoneRef = useRef(null)
  const essayZoneRef = useRef(null)
  const backRef = useRef(null)
  const loupeHintRef = useRef(null)

  // Magnifying glass presence — cursor tracking
  const presenceRef = useRef(null)
  const mousePosRef = useRef({ x: -200, y: -200 })
  const smoothPosRef = useRef({ x: -200, y: -200 })

  // ─── "The Photograph Resists" — glass plate inscriptions ────────
  const videoWrapperRef = useRef(null)
  const [inscriptionLines, setInscriptionLines] = useState(null)

  // Pre-compute essay paragraphs
  const paragraphs = useMemo(() => {
    const text = person.essay || person.narrative
    return text.split(/\n\n/).filter((p) => p.trim().length > 0)
  }, [person.essay, person.narrative])

  // ─── Animate in on mount + start video ─────────────────────────
  useEffect(() => {
    const panel = panelRef.current
    const video = videoRef.current
    const back = backRef.current

    // Panel fades in
    gsap.set(panel, { opacity: 0 })
    gsap.to(panel, { opacity: 1, duration: 0.8, ease: 'power2.out' })

    // Back arrow
    if (back) {
      gsap.set(back, { opacity: 0, x: -8 })
      gsap.to(back, {
        opacity: 1,
        x: 0,
        duration: 0.6,
        delay: 0.3,
        ease: 'power3.out',
      })
    }

    // Video fades in
    if (video) {
      gsap.set(video, { opacity: 0, scale: 0.97 })
      gsap.to(video, {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        delay: 0.15,
        ease: 'power3.out',
      })
      video.play().catch(() => {})
    }

    // Loupe hint — fades in after panel settles, stays until first hover
    const hint = loupeHintRef.current
    if (hint) {
      gsap.set(hint, { opacity: 0 })
      gsap.to(hint, {
        opacity: 1,
        duration: 1.2,
        delay: 1.5,
        ease: 'power2.out',
      })
    }

    // Dismiss hint on first mouse enter over the video wrapper
    const wrapper = videoWrapperRef.current
    const dismissHint = () => {
      if (hint) {
        gsap.to(hint, { opacity: 0, duration: 1.0, ease: 'power2.in' })
      }
      wrapper?.removeEventListener('mouseenter', dismissHint)
    }
    wrapper?.addEventListener('mouseenter', dismissHint)

    return () => {
      gsap.killTweensOf([panel, video, back, hint].filter(Boolean))
      wrapper?.removeEventListener('mouseenter', dismissHint)
      if (video) {
        video.pause()
        video.currentTime = 0
      }
    }
  }, [person.id])

  // ─── Inscription mount/reset + session storage ─────────────────
  useEffect(() => {
    setInscriptionLines(null)

    const visitKey = `unstill:visited:${person.id}`
    const countKey = 'unstill:storiesRead'
    try {
      if (!sessionStorage.getItem(visitKey)) {
        sessionStorage.setItem(visitKey, 'true')
        const count = parseInt(sessionStorage.getItem(countKey) || '0', 10)
        sessionStorage.setItem(countKey, String(count + 1))
      }
    } catch (_) {}
  }, [person.id])

  // ─── Reset scroll on person change ────────────────────────────
  useEffect(() => {
    const essayZone = essayZoneRef.current
    if (essayZone) essayZone.scrollTop = 0
  }, [person.id])

  // ─── Auto-scroll experiment (Fay & Elsie) ───────────────────
  useEffect(() => {
    if (person.id !== 'fay-watson' && person.id !== 'elsie-paul') return

    const essayZone = essayZoneRef.current
    if (!essayZone) return

    const SCROLL_SPEED = 22 // pixels per second — slow reader pace
    const START_DELAY = 5 // seconds — let the viewer settle before scroll begins

    let userTookControl = false
    let scrollTween = null

    const removeListeners = () => {
      essayZone.removeEventListener('wheel', handleUserIntervention)
      essayZone.removeEventListener('touchstart', handleUserIntervention)
      essayZone.removeEventListener('pointerdown', handleUserIntervention)
      essayZone.removeEventListener('keydown', handleUserIntervention)
    }

    const handleUserIntervention = () => {
      userTookControl = true
      if (scrollTween) {
        scrollTween.kill()
        scrollTween = null
      }
      removeListeners()
    }

    // Attach intervention listeners immediately — active during delay too
    essayZone.addEventListener('wheel', handleUserIntervention, { passive: true })
    essayZone.addEventListener('touchstart', handleUserIntervention, { passive: true })
    essayZone.addEventListener('pointerdown', handleUserIntervention, { passive: true })
    essayZone.addEventListener('keydown', handleUserIntervention, { passive: true })

    // Measure after layout settles
    const measureFrame = requestAnimationFrame(() => {
      if (userTookControl) return

      const scrollableDistance = essayZone.scrollHeight - essayZone.clientHeight
      if (scrollableDistance <= 0) return

      const duration = scrollableDistance / SCROLL_SPEED

      scrollTween = gsap.to(essayZone, {
        scrollTop: scrollableDistance,
        duration,
        ease: 'none',
        delay: START_DELAY,
      })
    })

    return () => {
      userTookControl = true
      if (scrollTween) {
        scrollTween.kill()
        scrollTween = null
      }
      cancelAnimationFrame(measureFrame)
      removeListeners()
    }
  }, [person.id])

  // ─── Magnifying Glass Presence Effect (desktop cursor) ─────────
  useEffect(() => {
    const panel = panelRef.current
    const presence = presenceRef.current
    if (!panel || !presence) return

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isTouch) return

    const onMouseMove = (e) => {
      const rect = panel.getBoundingClientRect()
      mousePosRef.current.x = e.clientX - rect.left
      mousePosRef.current.y = e.clientY - rect.top
    }

    const onMouseLeave = () => {
      mousePosRef.current.x = -200
      mousePosRef.current.y = -200
    }

    const onTick = () => {
      const smooth = smoothPosRef.current
      const target = mousePosRef.current
      smooth.x += (target.x - smooth.x) * 0.08
      smooth.y += (target.y - smooth.y) * 0.08
      presence.style.setProperty('--presence-x', `${smooth.x}px`)
      presence.style.setProperty('--presence-y', `${smooth.y}px`)
    }

    panel.addEventListener('mousemove', onMouseMove)
    panel.addEventListener('mouseleave', onMouseLeave)
    gsap.ticker.add(onTick)

    return () => {
      panel.removeEventListener('mousemove', onMouseMove)
      panel.removeEventListener('mouseleave', onMouseLeave)
      gsap.ticker.remove(onTick)
    }
  }, [])

  // ─── Inscription trigger logic (prefetch-first, API fallback, static last resort) ──
  const fetchIdRef = useRef(0)

  useEffect(() => {
    const currentFetchId = ++fetchIdRef.current
    const isStale = () => fetchIdRef.current !== currentFetchId

    const fetchInscription = async () => {
      // Try prefetch first (non-destructive read — safe across re-mounts)
      const prefetchPromise = consumePrefetch(person.id)
      if (prefetchPromise) {
        const prefetchedLines = await prefetchPromise
        if (isStale()) return
        if (prefetchedLines && prefetchedLines.length > 0) {
          setInscriptionLines(prefetchedLines)
          clearPrefetch(person.id)
          return
        }
      }

      // Fallback: fresh API call via serverless proxy
      const previousNotes = getPreviousNotes(person.id)
      const text = await generateMarginaliaImmediate({
        personId: person.id,
        personName: person.displayName,
        age: person.ages.join(' & '),
        charge: person.charge,
        date: person.date,
        location: person.location,
        essay: person.essay || person.narrative,
        previousNotes,
      })

      if (isStale()) return

      if (text) {
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(-3)
        if (lines.length > 0) {
          addNotes(person.id, lines)
          setInscriptionLines(lines)
          return
        }
      }

      // Last resort: static pre-generated inscriptions
      const staticLines = storyInscriptions[person.id] || null
      if (!isStale()) setInscriptionLines(staticLines)
    }

    fetchInscription()
  }, [person.id, person.displayName, person.charge, person.date, person.location])

  // ─── Mark return visits ────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(`unstill:returnVisit:${person.id}`, 'true')
      } catch (_) {}
    }, 500)
    return () => clearTimeout(timer)
  }, [person.id])

  // ─── Close handler ─────────────────────────────────────────────
  const isClosingRef = useRef(false)

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true

    const panel = panelRef.current
    const video = videoRef.current
    if (video) video.pause()

    if (onCloseStart) onCloseStart()

    gsap.to(panel, {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        isClosingRef.current = false
        if (onCloseComplete) onCloseComplete()
        else onClose()
      },
    })
  }, [onClose, onCloseStart, onCloseComplete])

  // Escape key + requestCloseStory event
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    const onRequestClose = () => handleClose()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('unstill:requestCloseStory', onRequestClose)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('unstill:requestCloseStory', onRequestClose)
    }
  }, [handleClose])

  // ─── Navigate to connected person ──────────────────────────────
  const handleNavigate = useCallback(
    (personId) => {
      if (onNavigate) {
        const video = videoRef.current
        if (video) video.pause()
        const panel = panelRef.current
        gsap.to(panel, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            onNavigate(personId)
            gsap.set(panel, { opacity: 1 })
          },
        })
      }
    },
    [onNavigate]
  )

  // Find connected people data
  const connectedPeople =
    person.connections && person.connections.length > 0
      ? person.connections
          .map((id) => people.find((p) => p.id === id))
          .filter(Boolean)
      : []

  // ─── Inscription JSX ──────────────────────────────────────────
  const inscriptionsJSX = inscriptionLines && inscriptionLines.length > 0 ? (
    <div className="inscriptions-container inscriptions-container--dark">
      <div className="inscription-lines">
        {inscriptionLines.map((line, i) => (
          <span
            key={i}
            className={`inscription-line inscription-line--dark${i === 0 ? ' first-line' : ''}`}
            style={{
              animationDelay: `${1.0 + i * 1.2}s`,
              color: COLORS.inscriptionColors[Math.min(i, 2)],
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  ) : null

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
        background: COLORS.bg,
      }}
      data-lenis-prevent
    >
      {/* === Magnifying Glass Presence Overlay === */}
      <div
        ref={presenceRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 51,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle 220px at var(--presence-x, -200px) var(--presence-y, -200px), rgba(232, 112, 90, 0.02) 0%, rgba(255, 248, 240, 0.01) 40%, transparent 70%)',
          mixBlendMode: 'screen',
          transition: 'none',
        }}
      />

      {/* === Persistent Back Arrow (fixed top-left) === */}
      <button
        ref={backRef}
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: '2rem',
          left: '2rem',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem 0.5rem 0.5rem 0',
          fontFamily: 'var(--font-body)',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: COLORS.backBtn,
          transition: 'color 0.3s ease',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = COLORS.accent)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = COLORS.backBtn)
        }
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>&larr;</span>
        <span>Archive</span>
      </button>

      {/* ═══════════════════════════════════════════════════
          VIDEO ZONE — pinned at top, never scrolls
          ═══════════════════════════════════════════════════ */}
      <div
        ref={videoZoneRef}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '3.5rem 2rem 0',
        }}
      >
        {/* Video + StoryLoupe + Inscriptions */}
        <div
          ref={videoWrapperRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{
            position: 'relative',
            display: 'inline-block',
            boxShadow: COLORS.videoGlow,
          }}>
            {person.animation ? (
              <StoryLoupe
                videoRef={videoRef}
                stillSrc={person.images?.color}
              >
                <video
                  ref={videoRef}
                  src={person.animation}
                  loop
                  muted
                  playsInline
                  style={{
                    width: 'min(50vw, 720px)',
                    height: 'auto',
                    display: 'block',
                  }}
                />
              </StoryLoupe>
            ) : (
              person.images?.color && (
                <img
                  src={person.images.color}
                  alt={person.displayName}
                  style={{
                    width: 'min(50vw, 720px)',
                    height: 'auto',
                    display: 'block',
                    boxShadow: COLORS.videoGlow,
                  }}
                />
              )
            )}
            {/* Inscriptions — right margin beside video */}
            {inscriptionsJSX}
          </div>
        </div>

        {/* Meta block — museum label beneath the artwork */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '1rem',
            marginBottom: '0.4rem',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: '24px',
              fontWeight: 400,
              color: COLORS.textBright,
              marginBottom: '0.3rem',
              lineHeight: 1.3,
            }}
          >
            {person.displayName}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 300,
              color: COLORS.textMuted,
              letterSpacing: '0.04em',
              lineHeight: 1.5,
            }}
          >
            {person.ages.join(' & ')} years old &mdash; {person.charge},{' '}
            {person.date}
            {person.location && `, ${person.location}`}
          </p>

          {/* Loupe hint — desktop only, fades in then out */}
          {person.animation && !('ontouchstart' in window) && (
            <p
              ref={loupeHintRef}
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '16px',
                fontWeight: 400,
                color: 'rgba(232, 228, 214, 0.8)',
                letterSpacing: '0.01em',
                marginTop: '0.8rem',
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              Hover to see what survived.
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          ESSAY ZONE — scrollable, with focus gradient mask
          ═══════════════════════════════════════════════════ */}
      <div
        ref={essayZoneRef}
        className="story-essay-zone"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {/* Inner column — centered, editorial width */}
        <div
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            padding: '2.5rem 2rem 0',
            position: 'relative',
          }}
        >
          {/* Essay paragraphs */}
          <div style={{ marginBottom: '2.5rem' }}>
            {paragraphs.map((para, i) => {
              const isLast = i === paragraphs.length - 1
              return (
              <p
                key={`${person.id}-p-${i}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '17px',
                  fontWeight: 400,
                  lineHeight: isLast ? 2.05 : 1.85,
                  color: COLORS.text,
                  marginBottom: '2rem',
                }}
                dangerouslySetInnerHTML={{
                  __html: para.replace(
                    /\*([^*]+)\*/g,
                    '<em>$1</em>'
                  ),
                }}
              />
              )
            })}
          </div>

          {/* Reframe (warm editorial italic — not interactive coral) */}
          {person.reframe && (
            <div
              style={{
                marginBottom: '2rem',
                paddingTop: '1.5rem',
                borderTop: `1px solid ${COLORS.borderSubtle}`,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
                  lineHeight: 1.7,
                  color: COLORS.reframe,
                }}
              >
                {person.reframe}
              </p>
            </div>
          )}

          {/* Connections */}
          {connectedPeople.length > 0 && (
            <div
              style={{
                marginBottom: '4rem',
                paddingTop: '1.5rem',
                borderTop: `1px solid ${COLORS.borderSubtle}`,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: COLORS.textMuted,
                  marginBottom: '1.2rem',
                }}
              >
                Connected
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                {connectedPeople.map((connected) => (
                  <button
                    key={connected.id}
                    onClick={() => handleNavigate(connected.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.6rem 0',
                      textAlign: 'left',
                      transition: 'opacity 0.3s ease',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = '0.7')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {/* Small mugshot thumbnail — rectangular, archival */}
                    <div
                      style={{
                        width: '48px',
                        height: '56px',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {connected.images?.color && (
                        <img
                          src={connected.images.color}
                          alt={connected.displayName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: '25% center',
                            filter: 'grayscale(0.3)',
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <p
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1rem',
                          color: COLORS.textBright,
                          marginBottom: '0.1rem',
                        }}
                      >
                        {connected.displayName}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.75rem',
                          color: COLORS.textMuted,
                        }}
                      >
                        Arrested {connected.date} &mdash; {connected.charge}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom spacer — room for focus gradient to fade out */}
          <div style={{ paddingBottom: '40vh' }} />
        </div>
      </div>
    </div>
  )
}
