import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { archiveGroups } from '../../data/people'

gsap.registerPlugin(ScrollTrigger)

export default function Archive() {
  const sectionRef = useRef(null)
  const hintRef = useRef(null)
  const hintPhase = useRef(0) // 0 = show hover, 1 = hover done, 2 = show click, 3 = done
  const hoverTimerRef = useRef(null)

  // Ref for the pair annotation rendered via portal (above the canvas layer)
  const pairAnnotationRef = useRef(null)
  const pairVisibleRef = useRef(false)

  useEffect(() => {
    const section = sectionRef.current
    const hint = hintRef.current

    // Fade in all annotations when they enter the viewport
    const annotations = section.querySelectorAll('.archive-annotation')
    annotations.forEach((el) => {
      gsap.set(el, { opacity: 0, y: 15 })
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' })
        },
        onLeaveBack: () => {
          gsap.to(el, { opacity: 0, y: 15, duration: 0.4, ease: 'power2.in' })
        },
      })
    })

    // ── Pair annotation (portal'd above canvas) ──
    // Drive its vertical position from the section's bounding rect so it
    // scrolls naturally — as if it were absolutely positioned at top: 15%
    // inside the archive section — but rendered above the WebGL canvas.
    const pairEl = pairAnnotationRef.current
    if (pairEl) {
      gsap.set(pairEl, { opacity: 0 })

      const pairTrigger = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: () => {
          // Mirror the position of an element at top: 15% inside the section
          const rect = section.getBoundingClientRect()
          const y = rect.top + section.offsetHeight * 0.15
          pairEl.style.top = `${y}px`

          // Fade in/out when scrolling into and out of the viewport
          const vh = window.innerHeight
          const inView = y > -60 && y < vh - 40
          if (inView && !pairVisibleRef.current) {
            pairVisibleRef.current = true
            gsap.to(pairEl, { opacity: 1, duration: 1.1, ease: 'power3.out' })
          } else if (!inView && pairVisibleRef.current) {
            pairVisibleRef.current = false
            gsap.killTweensOf(pairEl)
            gsap.to(pairEl, { opacity: 0, duration: 0.4, ease: 'power2.in' })
          }
        },
        onLeave: () => {
          pairVisibleRef.current = false
          gsap.killTweensOf(pairEl)
          gsap.set(pairEl, { opacity: 0 })
        },
        onLeaveBack: () => {
          pairVisibleRef.current = false
          gsap.killTweensOf(pairEl)
          gsap.set(pairEl, { opacity: 0 })
        },
      })

      pairEl._scrollTrigger = pairTrigger
    }

    if (!hint) return

    // ── Single hint element, two phases ──
    // Phase 0: "Hover to look closer" — visible until user hovers a mugshot
    // Phase 1: transitioning to click hint (1s timer running)
    // Phase 2: "Click to enter their story" — shown, auto-fades
    // Phase 3: done — no more hints

    gsap.set(hint, { opacity: 0 })
    hint.textContent = 'Hover to look closer'

    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      onEnter: () => {
        if (hintPhase.current === 0) {
          gsap.to(hint, { opacity: 1, duration: 0.8, delay: 0.8, ease: 'power2.out' })
        }
      },
      onLeave: () => {
        gsap.killTweensOf(hint)
        gsap.to(hint, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      },
      onLeaveBack: () => {
        gsap.killTweensOf(hint)
        gsap.to(hint, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      },
    })

    // hoverStart = user hovered a mugshot (they've discovered the loupe)
    // Phase 0 → 1: dismiss hover hint, start 1s timer for click hint
    const onHoverStart = () => {
      if (hintPhase.current === 0) {
        hintPhase.current = 1
        gsap.killTweensOf(hint)
        gsap.to(hint, { opacity: 0, duration: 0.4, ease: 'power2.in' })

        // After 1s, show the click hint
        hoverTimerRef.current = setTimeout(() => {
          hintPhase.current = 2
          hint.textContent = 'Click to enter their story'
          gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' })
          // Auto-fade after 3 seconds
          gsap.to(hint, {
            opacity: 0, duration: 0.8, delay: 3.0, ease: 'power2.in',
            onComplete: () => { hintPhase.current = 3 },
          })
        }, 1000)
      }
    }

    // hoverEnd = user left the mugshot — clear the 1s timer if still pending
    const onHoverEnd = () => {
      if (hoverTimerRef.current && hintPhase.current === 1) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
        // Return to phase 0 so the hover hint can re-show on next hover
        hintPhase.current = 0
      }
    }

    window.addEventListener('unstill:hoverStart', onHoverStart)
    window.addEventListener('unstill:hoverEnd', onHoverEnd)

    return () => {
      window.removeEventListener('unstill:hoverStart', onHoverStart)
      window.removeEventListener('unstill:hoverEnd', onHoverEnd)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (pairEl?._scrollTrigger) pairEl._scrollTrigger.kill()
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger && section.contains(t.trigger)) t.kill()
      })
    }
  }, [])

  return (
    <>
      <section ref={sectionRef} className="scene scene--archive">
        {/* Persistent archive header — enters with first group */}
        <p
          className="archive-annotation"
          style={{
            position: 'absolute',
            top: '6vh',
            left: '8vw',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 2vw, 1.6rem)',
            color: 'var(--color-text)',
            opacity: 0,
            maxWidth: '280px',
            lineHeight: 1.5,
          }}
        >
          Sydney Police Photographs
          <br />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75em',
              color: 'var(--color-text-muted)',
              fontStyle: 'normal',
            }}
          >
            1920s &mdash; Museums of History NSW
          </span>
        </p>

        {/* Per-group scene-setting fragments (skip first group — handled via portal) */}
        {archiveGroups.map((group, i) => {
          if (i === 0) return null
          return (
            <div
              key={group.id}
              className="archive-annotation"
              style={{
                position: 'absolute',
                top: `${i * 25 + 15}%`,
                right: '8vw',
                textAlign: 'right',
                opacity: 0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 300,
                  fontStyle: 'normal',
                  fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.6,
                  maxWidth: '320px',
                }}
              >
                {group.label}
              </p>
            </div>
          )
        })}

        {/* Onboarding hint — single element, text swaps between phases */}
        <p
          ref={hintRef}
          style={{
            position: 'fixed',
            bottom: '15vh',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            fontWeight: 300,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0,
          }}
        />
      </section>

      {/* First group annotation — rendered via portal to document.body
          so it sits ABOVE the WebGL canvas (z-index 3 > canvas z-index 2).
          Position is driven by scroll via getBoundingClientRect so it
          moves naturally with the page, just like the other annotations. */}
      {createPortal(
        <div
          ref={pairAnnotationRef}
          style={{
            position: 'fixed',
            right: '8vw',
            textAlign: 'right',
            zIndex: 3,
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}
          >
            Raids on house parties<br />
            in Darlinghurst.
          </p>
        </div>,
        document.body
      )}
    </>
  )
}
