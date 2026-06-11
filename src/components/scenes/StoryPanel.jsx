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
  text: 'rgba(232, 228, 214, 0.92)',
  textMuted: 'rgba(232, 228, 214, 0.72)',
  textBright: 'rgba(232, 228, 214, 0.95)',
  accent: '#E8705A',
  reframe: 'rgba(214, 168, 152, 0.9)',
  backBtn: 'rgba(255, 255, 255, 0.55)',
  videoGlow: '0 0 80px rgba(232, 112, 90, 0.04)',
  inscriptionColors: [
    'rgba(255, 255, 255, 0.7)',
    'rgba(255, 255, 255, 0.7)',
    'rgba(255, 255, 255, 0.7)',
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
  const metaBlockRef = useRef(null)
  const marginNotesRef = useRef(null)

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

    const meta = metaBlockRef.current
    const essay = essayZoneRef.current
    const marginNotes = marginNotesRef.current

    // ── The portrait begins to breathe ──
    // Panel mounts at full opacity — its dark background IS the archive
    // dimming. The video/image fades in smoothly from the dark ground,
    // giving poster/media a moment to initialize and avoiding flash.
    // Text elements then develop like a photograph in chemistry.

    const videoWrapper = videoWrapperRef.current
    if (videoWrapper) {
      gsap.set(videoWrapper, { opacity: 0 })
      gsap.to(videoWrapper, {
        opacity: 1,
        duration: 0.7,
        delay: 0.05,
        ease: 'power2.out',
      })
    }

    if (video) {
      video.currentTime = 0
      video.play().catch(() => {})
    }

    // Back arrow develops quietly
    if (back) {
      gsap.set(back, { opacity: 0 })
      gsap.to(back, {
        opacity: 1,
        duration: 0.8,
        delay: 0.6,
        ease: 'power2.out',
      })
    }

    // Meta block — name and charge develop after the portrait is established
    if (meta) {
      gsap.set(meta, { opacity: 0 })
      gsap.to(meta, { opacity: 1, duration: 1.0, delay: 0.4, ease: 'power2.out' })
    }

    // Essay develops slowly — the viewer's eye is still on the portrait
    if (essay) {
      gsap.set(essay, { opacity: 0 })
      gsap.to(essay, { opacity: 1, duration: 1.2, delay: 0.8, ease: 'power2.out' })
    }

    // Margin notes develop last — like chemistry reaching the edges
    if (marginNotes) {
      gsap.set(marginNotes, { opacity: 0 })
      gsap.to(marginNotes, { opacity: 1, duration: 1.2, delay: 1.2, ease: 'power2.out' })
    }

    // Loupe hint — breathes after everything has settled
    const hint = loupeHintRef.current
    if (hint) {
      gsap.set(hint, { opacity: 0 })
      gsap.to(hint, {
        opacity: 1,
        duration: 1.2,
        delay: 2.2,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(hint, {
            opacity: 0.4,
            duration: 2.2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          })
        },
      })
    }

    // Dismiss hint on first mouse enter or touch over the video wrapper
    const wrapper = videoWrapperRef.current
    const dismissHint = () => {
      if (hint) {
        gsap.killTweensOf(hint)
        gsap.to(hint, { opacity: 0, duration: 1.0, ease: 'power2.in' })
      }
      wrapper?.removeEventListener('mouseenter', dismissHint)
      wrapper?.removeEventListener('touchstart', dismissHint)
    }
    wrapper?.addEventListener('mouseenter', dismissHint)
    wrapper?.addEventListener('touchstart', dismissHint)

    return () => {
      gsap.killTweensOf([panel, video, videoWrapper, back, hint, meta, essay, marginNotes].filter(Boolean))
      wrapper?.removeEventListener('mouseenter', dismissHint)
      wrapper?.removeEventListener('touchstart', dismissHint)
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
    const scrollZone = videoZoneRef.current
    if (scrollZone) scrollZone.scrollTop = 0
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
      duration: 0.7,
      ease: 'power2.inOut',
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

      {/* === Back to Archive (fixed top-left) === */}
      <button
        ref={backRef}
        onClick={handleClose}
        className="story-back-btn"
        style={{
          position: 'fixed',
          top: '2rem',
          left: '2rem',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem 0.5rem 0.5rem 0',
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.7)',
          transition: 'color 0.3s ease',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = COLORS.accent)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')
        }
      >
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>&larr;</span>
        <span>Archive</span>
      </button>

      {/* ═══════════════════════════════════════════════════
          SINGLE SCROLL FLOW — video, essay, inscriptions
          ═══════════════════════════════════════════════════ */}
      <div
        ref={videoZoneRef}
        className="story-video-zone"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
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
                  /* Poster is the video's extracted first frame (16:9 close-up),
                     NOT the wide archive still — and the box ratio must match the
                     video (2560x1440), or playback letterboxes and the portrait
                     visibly shifts when the video takes over from the poster. */
                  poster={`/posters/${person.id}.jpg`}
                  preload="auto"
                  className="story-media"
                  loop
                  muted
                  playsInline
                  style={{
                    height: 'auto',
                    display: 'block',
                    aspectRatio: '16 / 9',
                    objectFit: 'contain',
                    backgroundColor: COLORS.bg,
                  }}
                />
              </StoryLoupe>
            ) : (
              person.images?.color && (
                <img
                  src={person.images.color}
                  alt={person.displayName}
                  className="story-media"
                  style={{
                    height: 'auto',
                    display: 'block',
                    boxShadow: COLORS.videoGlow,
                    aspectRatio: person.dimensions ? `${person.dimensions.width} / ${person.dimensions.height}` : undefined,
                  }}
                />
              )
            )}
            {/* Inscriptions moved to after essay */}
          </div>
        </div>

        {/* Meta block — museum label beneath the artwork */}
        <div
          ref={metaBlockRef}
          className="story-meta-block"
          style={{
            textAlign: 'center',
            marginTop: '1.2rem',
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
              marginBottom: '0.6rem',
              lineHeight: 1.3,
            }}
          >
            {person.displayName}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 300,
              color: COLORS.text,
              letterSpacing: '0.02em',
              lineHeight: 1.5,
            }}
          >
            {person.charge}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 300,
              color: COLORS.textMuted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1.5,
              marginTop: '0.35rem',
            }}
          >
            {person.ages.includes('Unknown') ? 'Age unknown' : `${person.ages.join(' & ')} years old`} &mdash; {person.date}
            {person.location && `, ${person.location}`}
          </p>

          {/* Loupe hint — editorial caption tone */}
          {person.animation && (
            <p
              ref={loupeHintRef}
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '15px',
                fontWeight: 400,
                color: 'rgba(232, 228, 214, 0.8)',
                letterSpacing: '0.01em',
                marginTop: '1.2rem',
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              {'ontouchstart' in window || navigator.maxTouchPoints > 0
                ? 'Press to reveal the original.'
                : 'Hover to see what survived.'}
            </p>
          )}
        </div>

        {/* Editorial spread — essay column with margin notes */}
        <div
          ref={essayZoneRef}
          className="story-editorial-spread"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '3rem',
            maxWidth: '820px',
            margin: '0 auto',
            padding: '2.5rem 2rem 0',
            position: 'relative',
          }}
        >
          {/* ── Main essay column ── */}
          <div className="story-essay-column" style={{ maxWidth: '520px', flex: '1 1 520px' }}>
            {/* Essay paragraphs — editorial serif with drop cap */}
            <div style={{ marginBottom: '2.5rem' }}>
              {paragraphs.map((para, i) => {
                const isLast = i === paragraphs.length - 1
                const isFirst = i === 0
                const htmlContent = para.replace(/\*([^*]+)\*/g, '<em>$1</em>')

                if (isFirst) {
                  const firstChar = para.charAt(0)
                  const restHtml = para.slice(1).replace(/\*([^*]+)\*/g, '<em>$1</em>')
                  return (
                    <p
                      key={`${person.id}-p-${i}`}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '21px',
                        fontWeight: 400,
                        lineHeight: 1.7,
                        color: COLORS.textBright,
                        marginBottom: '1.4rem',
                      }}
                    >
                      <span
                        style={{
                          float: 'left',
                          fontFamily: 'var(--font-display)',
                          fontSize: '3.4rem',
                          lineHeight: 0.8,
                          marginRight: '0.08em',
                          marginTop: '0.06em',
                          color: COLORS.textBright,
                        }}
                      >
                        {firstChar}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: restHtml }} />
                    </p>
                  )
                }

                return (
                <p
                  key={`${person.id}-p-${i}`}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '21px',
                    fontWeight: 400,
                    lineHeight: 1.7,
                    color: COLORS.text,
                    marginBottom: '1.4rem',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: htmlContent,
                  }}
                />
                )
              })}
            </div>

            {/* Reframe (warm editorial italic) */}
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

            {/* Bottom spacer */}
            <div style={{ paddingBottom: '10vh' }} />
          </div>

          {/* ── Margin notes column — archival context beside the essay ── */}
          {inscriptionLines && inscriptionLines.length > 0 && (
            <aside
              ref={marginNotesRef}
              className="story-margin-notes"
              style={{
                flex: '0 0 200px',
                paddingTop: '0.5rem',
                position: 'sticky',
                top: '2rem',
                alignSelf: 'flex-start',
                borderLeft: '1px solid rgba(232, 228, 214, 0.20)',
                paddingLeft: '1.5rem',
              }}
            >
              {inscriptionLines.map((line, i) => (
                <p
                  key={i}
                  className="inscription-line inscription-line--dark"
                  style={{
                    animationDelay: `${1.0 + i * 1.2}s`,
                    color: 'rgba(232, 228, 214, 0.82)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 400,
                    lineHeight: 1.65,
                    marginBottom: '1.2rem',
                  }}
                >
                  {line}
                </p>
              ))}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
