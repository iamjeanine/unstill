import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLenis } from 'lenis/react'
import horizonInscriptions from '../../data/horizonInscriptions.json'
import HorizonLoupe from '../ui/HorizonLoupe'

gsap.registerPlugin(ScrollTrigger)

/**
 * Horizon — The Light Table.
 *
 * Flex-column masonry layout. Cards distributed round-robin into 3
 * explicit columns. Each photograph gets exactly the height it needs.
 *
 * Every image sits in an elevated glass card — frosted surface, inset
 * top-edge highlight, multi-layered shadow, coral glow on hover.
 * Catalog metadata beneath each plate in monospace.
 *
 * Click opens a minimal inscription panel — historically researched
 * facts about each person. Two random facts shown per click, cycling
 * through the pool without repeats within a session.
 *
 * Staggered entrance animation. Ambient drift on desktop.
 */

const horizonFaces = [
  // Curated order for column flow — alternating formats creates rhythm
  { file: 'Sidney Kelly.jpg',  name: 'Sidney Kelly',     catalog: '1266',     date: '26.6.24',  location: 'Sydney' },
  { file: 'D Ligores.jpg',    name: 'D. Ligores',       catalog: 'S.P.',     date: 'c. 1925',  location: 'Sydney' },
  { file: 'Edna Edgar.jpg',   name: 'Edna Edgar',       catalog: '158A',     date: '28.12.26', location: 'Sydney' },
  { file: 'V Lowe.jpg',       name: 'V. Lowe',          catalog: '764',      date: '15.2.22',  location: 'Sydney' },
  { file: 'D. Poole.jpg',     name: 'D. Poole',         catalog: '639 L.B.', date: '31.7.24',  location: 'Sydney' },
  { file: 'F. Schmidt.jpg',   name: 'F. Schmidt',       catalog: '410',      date: '18.6.23',  location: 'Sydney' },
  { file: 'AH Chong.jpg',     name: 'Ah Chong',         catalog: 'D62',      date: '11.7.28',  location: 'Sydney' },
  { file: 'S.J. Hay.jpg',     name: 'S. J. Hay',        catalog: '167',      date: 'c. 1922',  location: 'Sydney' },
  { file: 'May Russel.jpg',   name: 'May Russel',       catalog: '936',      date: '31.1.22',  location: 'Sydney' },
  { file: 'E. Falleni.jpg',   name: 'E. Falleni',       catalog: '756',      date: 'c. 1920',  location: 'Sydney' },
  { file: 'G Lowe.jpg',       name: 'G. Lowe',          catalog: 'D10',      date: '28.9.28',  location: 'Sydney' },
  { file: 'Neville McQuade and Lewis Stanley.jpg', name: 'N. McQuade & L. Stanley', catalog: 'S.P.', date: 'c. 1930', location: 'Sydney' },
  { file: 'Patrick Riley.jpg', name: 'Patrick Riley',    catalog: '1098',     date: '17.8.26',  location: 'Sydney' },
  { file: 'V Stander.jpg',    name: 'V. Stander',       catalog: 'S.P.',     date: 'c. 1925',  location: 'Sydney' },
  { file: 'P. Hume.jpg',      name: 'P. Hume',          catalog: 'S15 L.B.', date: '1.6.21',   location: 'Sydney' },
  { file: 'E. Park.jpg',      name: 'E. Park',          catalog: 'K. Don',   date: '20.29',    location: 'Sydney' },
  { file: 'William Stanley Moore.jpg', name: 'William Stanley Moore', catalog: '1299', date: '1.8.25', location: 'Sydney' },
]

// Session-seeded shuffle — different each page load, stable within session
const sessionSeed = Date.now()
function seededShuffle(arr, seed) {
  const shuffled = [...arr]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = ((s >>> 0) % (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function Horizon() {
  const sectionRef = useRef(null)
  const shuffledFaces = useMemo(() => seededShuffle(horizonFaces, sessionSeed), [])

  // Distribute cards into 3 columns (round-robin) for flex layout
  const columns = useMemo(() => {
    const cols = [[], [], []]
    shuffledFaces.forEach((face, i) => cols[i % 3].push({ face, index: i }))
    return cols
  }, [shuffledFaces])

  // ─── Inscription panel state ─────────────────────────────────
  const [selectedFace, setSelectedFace] = useState(null)
  const [inscription, setInscription] = useState(null)
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  // ─── Ensure WebGL canvas doesn't block Horizon interaction ───
  // The archive section enables pointer-events on the fixed canvas.
  // Use a ScrollTrigger that continuously enforces pointer-events: none
  // while any part of the Horizon section is in view. This is more
  // robust than an IntersectionObserver which only fires on threshold
  // crossings and can miss late toggles from other ScrollTriggers.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const canvas = document.querySelector('.webgl-canvas')
    if (!canvas) return

    const guard = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',   // as soon as section enters viewport
      end: 'bottom top',     // until section fully leaves
      onUpdate: () => {
        if (canvas.style.pointerEvents !== 'none') {
          canvas.style.pointerEvents = 'none'
        }
      },
      onEnter: () => { canvas.style.pointerEvents = 'none' },
      onEnterBack: () => { canvas.style.pointerEvents = 'none' },
    })

    return () => guard.kill()
  }, [])

  // ─── Staggered entrance + ambient drift ──────────────────────
  const driftTweens = useRef([])
  const masonryRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const cards = section.querySelectorAll('.horizon-card')
    const masonryEl = masonryRef.current || section.querySelector('.horizon-masonry')

    // Staggered entrance — reveal by column for an architectural feel.
    // Cards are in explicit column divs, so derive col/row from DOM.
    const colEls = masonryEl.querySelectorAll('.horizon-column')
    cards.forEach((card) => {
      const colEl = card.closest('.horizon-column')
      const col = Array.from(colEls).indexOf(colEl)
      const row = Array.from(colEl.querySelectorAll('.horizon-card')).indexOf(card)
      const columnDelay = col * 0.2
      const intraDelay = row * 0.06
      const i = col * 10 + row // unique index for drift variation

      gsap.set(card, { opacity: 0, y: 28 })
      ScrollTrigger.create({
        trigger: masonryEl,
        start: 'top 75%',
        onEnter: () => {
          gsap.to(card, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            delay: columnDelay + intraDelay,
            ease: 'power2.out',
            onComplete: () => {
              // Release inline opacity so CSS hover isolation works equally
              card.style.removeProperty('opacity')
              // Skip drift on small screens (no hover either)
              if (window.innerWidth <= 480) return
              // Ambient drift — animate the inner frame rather than the
              // card itself so the click target stays perfectly stable.
              // Different duration + delay per card so they never sync.
              const frame = card.querySelector('.horizon-frame')
              if (!frame) return
              const duration = 3.5 + (i % 5) * 0.7   // 3.5s–6.3s
              const delay = (i % 7) * 0.4              // phase offset
              const drift = gsap.to(frame, {
                y: -1,
                duration,
                delay,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
              })
              driftTweens.current.push(drift)
            },
          })
        },
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger && section.contains(t.trigger)) t.kill()
      })
      driftTweens.current.forEach((t) => t.kill())
      driftTweens.current = []
    }
  }, [])

  // Note: removed mouse-reactive tilt on the whole masonry grid.
  // The perspective transform (rotateX/rotateY) caused hit-test
  // misalignment on cards far from the origin — bottom cards became
  // unclickable. Individual card drift + hover lift is sufficient.

  // ─── Helper: derive personId from face name ─────────────────
  const getPersonId = useCallback((face) => {
    return face.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
  }, [])

  // ─── Hover lift — animate the inner frame, not the card itself ──
  // The card div is the click target and must stay positionally stable.
  // All visual movement (drift + hover lift) targets .horizon-frame
  // inside the card so pointer events always land reliably.
  const handleCardEnter = useCallback((e) => {
    const frame = e.currentTarget.querySelector('.horizon-frame')
    if (!frame) return
    // Pause this card's drift tween while hovered
    const drift = driftTweens.current.find((t) => t.targets().includes(frame))
    if (drift) drift.pause()
    gsap.to(frame, { y: -3, duration: 0.25, ease: 'power2.out', overwrite: true })
  }, [])
  const handleCardLeave = useCallback((e) => {
    const frame = e.currentTarget.querySelector('.horizon-frame')
    if (!frame) return
    const drift = driftTweens.current.find((t) => t.targets().includes(frame))
    gsap.to(frame, {
      y: 0,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => { if (drift) drift.resume() },
    })
  }, [])

  // ─── Lenis scroll lock — prevent page scroll behind panel ────
  const lenis = useLenis()

  // Track which lines have been shown per person so repeats are avoided
  const shownRef = useRef({})

  // ─── Click handler ───────────────────────────────────────────
  // Picks 2 random lines from the pool, avoiding previously shown pairs.
  // Static data — no API calls, no cost.
  const handleCardClick = useCallback((face) => {
    const personId = getPersonId(face)
    const allLines = horizonInscriptions[personId]
    if (!allLines || allLines.length === 0) {
      setSelectedFace(face)
      setInscription(null)
      if (lenis) lenis.stop()
      return
    }

    // Build a set of indices we haven't shown yet for this person
    if (!shownRef.current[personId]) shownRef.current[personId] = []
    const shown = shownRef.current[personId]

    // Get available indices (not yet shown)
    let available = allLines.map((_, i) => i).filter((i) => !shown.includes(i))

    // If we've exhausted the pool, reset and start fresh
    if (available.length < 2) {
      shownRef.current[personId] = []
      available = allLines.map((_, i) => i)
    }

    // Pick 2 random indices from available
    const shuffled = available.sort(() => Math.random() - 0.5)
    const picked = [shuffled[0], shuffled[1]]
    picked.forEach((i) => shownRef.current[personId].push(i))

    setSelectedFace(face)
    setInscription(picked.map((i) => allLines[i]))
    if (lenis) lenis.stop()
  }, [getPersonId, lenis])

  // ─── Close handler (GSAP fade-out, then clear state) ────────
  const handleClose = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      setSelectedFace(null)
      if (lenis) lenis.start()
      return
    }
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        setSelectedFace(null)
        setInscription(null)
        if (lenis) lenis.start()
      },
    })
  }, [lenis])

  // ─── Escape key ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFace) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedFace, handleClose])

  // ─── GSAP entrance animation for overlay + panel ─────────────
  useEffect(() => {
    if (!selectedFace) return
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay || !panel) return

    gsap.set(overlay, { opacity: 0 })
    gsap.set(panel, { scale: 0.92, opacity: 0 })
    gsap.to(overlay, { opacity: 1, duration: 0.35, ease: 'power2.out' })
    gsap.to(panel, { scale: 1, opacity: 1, duration: 0.5, delay: 0.05, ease: 'power3.out' })
  }, [selectedFace])

  return (
    <section ref={sectionRef} className="scene scene--horizon">
      <div className="horizon-stage">
        <div ref={masonryRef} className="horizon-masonry">
          {columns.map((col, colIdx) => (
            <div className="horizon-column" key={colIdx}>
              {col.map(({ face, index }) => (
                <div
                  className="horizon-card"
                  key={index}
                  onClick={() => handleCardClick(face)}
                  onMouseEnter={handleCardEnter}
                  onMouseLeave={handleCardLeave}
                >
                  {/* Glass frame with magnifying loupe */}
                  <HorizonLoupe src={`/horizon/${encodeURIComponent(face.file)}`}>
                    <div className="horizon-frame">
                      <img
                        src={`/horizon/${encodeURIComponent(face.file)}`}
                        alt={face.name}
                      />
                      <div className="horizon-vignette" />
                    </div>
                  </HorizonLoupe>

                  {/* Catalog label */}
                  <div className="horizon-label">
                    <span className="horizon-label__name">{face.name}</span>
                    <span className="horizon-label__meta">{face.catalog} &middot; {face.date}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Inscription panel overlay ── */}
      {selectedFace && (
        <div
          ref={overlayRef}
          className="horizon-overlay"
          onClick={handleClose}
          data-lenis-prevent
        >
          <div
            ref={panelRef}
            className="horizon-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button className="horizon-panel__close" onClick={handleClose}>
              &times;
            </button>

            {/* Photograph */}
            <img
              src={`/horizon/${encodeURIComponent(selectedFace.file)}`}
              alt={selectedFace.name}
              className="horizon-panel__photo"
            />

            {/* Name */}
            <h3 className="horizon-panel__name">{selectedFace.name}</h3>

            {/* Catalog + date */}
            <p className="horizon-panel__meta">
              {selectedFace.catalog} &middot; {selectedFace.date}
            </p>

            {/* Inscription zone */}
            <div className="horizon-panel__inscription-zone">
              {inscription && inscription.length > 0 ? (
                inscription.map((line, i) => (
                  <p
                    className="horizon-panel__inscription"
                    key={`${selectedFace.file}-${i}`}
                    style={{ animationDelay: `${0.3 + i * 0.8}s` }}
                  >
                    {line}
                  </p>
                ))
              ) : (
                <p className="horizon-panel__inscription-fallback">
                  inscription unavailable
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photographic grain */}
      <div className="horizon-grain" />
    </section>
  )
}
