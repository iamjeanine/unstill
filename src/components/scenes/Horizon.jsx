import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { generateMarginalia } from '../../engine/MarginaliaAPI'
import { getPreviousNotes, addNotes, setPrefetch, hasPrefetch, consumePrefetch, clearPrefetch } from '../../engine/marginaliaSessionStore'
import HorizonLoupe from '../ui/HorizonLoupe'

gsap.registerPlugin(ScrollTrigger)

/**
 * Horizon — The Light Table.
 *
 * CSS multi-column masonry layout. Images flow down columns and pack
 * tightly regardless of aspect ratio — no forced row alignment, no
 * cropping, no wasted space. Each photograph gets exactly the height
 * it needs.
 *
 * Every image sits in an elevated glass card — frosted surface, inset
 * top-edge highlight, multi-layered shadow, coral glow on hover.
 * Catalog metadata beneath each plate in monospace.
 *
 * Click opens a minimal inscription panel — one AI-generated sentence
 * about the world this person existed in. A museum moment.
 *
 * Order is curated: alternating landscape and portrait creates visual
 * rhythm across the columns. Staggered entrance animation.
 */

const horizonFaces = [
  // Curated order for column flow — alternating formats creates rhythm
  { file: 'Sidney Kelly.png',  name: 'Sidney Kelly',     catalog: '1266',     date: '26.6.24',  location: 'Sydney' },
  { file: 'D Ligores.png',    name: 'D. Ligores',       catalog: 'S.P.',     date: 'c. 1925',  location: 'Sydney' },
  { file: 'Edna Edgar.png',   name: 'Edna Edgar',       catalog: '158A',     date: '28.12.26', location: 'Sydney' },
  { file: 'V Lowe.png',       name: 'V. Lowe',          catalog: '764',      date: '15.2.22',  location: 'Sydney' },
  { file: 'D. Poole.png',     name: 'D. Poole',         catalog: '639 L.B.', date: '31.7.24',  location: 'Sydney' },
  { file: 'F. Schmidt.png',   name: 'F. Schmidt',       catalog: '410',      date: '18.6.23',  location: 'Sydney' },
  { file: 'AH Chong.png',     name: 'Ah Chong',         catalog: 'D62',      date: '11.7.28',  location: 'Sydney' },
  { file: 'S.J. Hay.png',     name: 'S. J. Hay',        catalog: '167',      date: 'c. 1922',  location: 'Sydney' },
  { file: 'May Russel.png',   name: 'May Russel',       catalog: '936',      date: '31.1.22',  location: 'Sydney' },
  { file: 'E. Falleni.png',   name: 'E. Falleni',       catalog: '756',      date: 'c. 1920',  location: 'Sydney' },
  { file: 'G Lowe.png',       name: 'G. Lowe',          catalog: 'D10',      date: '28.9.28',  location: 'Sydney' },
  { file: 'Neville McQuade and Lewis Stanley.jpg', name: 'N. McQuade & L. Stanley', catalog: 'S.P.', date: 'c. 1930', location: 'Sydney' },
  { file: 'Patrick Riley.png', name: 'Patrick Riley',    catalog: '1098',     date: '17.8.26',  location: 'Sydney' },
  { file: 'V Stander.png',    name: 'V. Stander',       catalog: 'S.P.',     date: 'c. 1925',  location: 'Sydney' },
  { file: 'P. Hume.jpg',      name: 'P. Hume',          catalog: 'S15 L.B.', date: '1.6.21',   location: 'Sydney' },
  { file: 'E. Park.jpg',      name: 'E. Park',          catalog: 'K. Don',   date: '20.29',    location: 'Sydney' },
  { file: 'William Stanley Moore.png', name: 'William Stanley Moore', catalog: '1299', date: '1.8.25', location: 'Sydney' },
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

  // ─── Inscription panel state ─────────────────────────────────
  const [selectedFace, setSelectedFace] = useState(null)
  const [inscription, setInscription] = useState(null)
  // inscriptionLoading removed — batch prefetch means inscriptions arrive near-instantly
  const overlayRef = useRef(null)
  const panelRef = useRef(null)
  const activeFetchRef = useRef(null) // guards against stale API responses

  // ─── One-time hover hint ───────────────────────────────────


  // ─── Staggered entrance animation ────────────────────────────
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const cards = section.querySelectorAll('.horizon-card')
    const masonryEl = section.querySelector('.horizon-masonry')

    // Staggered entrance — reveal by column for an architectural feel.
    // CSS multi-column flows cards top-to-bottom across columns, so we
    // compute column index from DOM position and stagger by column group.
    const columnCount = parseInt(getComputedStyle(masonryEl).columnCount) || 3
    cards.forEach((card, i) => {
      // In CSS multi-column, items flow down columns. Approximate column
      // assignment: items fill columns roughly evenly top-to-bottom.
      const col = i % columnCount
      const row = Math.floor(i / columnCount)
      const columnDelay = col * 0.2        // 0.2s between columns
      const intraDelay = row * 0.06        // 0.06s between cards within a column

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
          })
        },
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger && section.contains(t.trigger)) t.kill()
      })
    }
  }, [])

  // ─── Batch prefetch: sequential API calls, one at a time ────────────
  // Fires when the Hartman quote section enters viewport (well before Horizon).
  // Strictly sequential to avoid API rate limits — each call completes
  // before the next starts. The API now retries on 429, so calls that
  // would have silently failed now succeed after a brief backoff.
  // By the time someone scrolls through HartmanQuote + Scale, several are ready.
  const batchPrefetchedRef = useRef(false)
  useEffect(() => {
    if (batchPrefetchedRef.current) return

    // Find the Hartman section to trigger prefetch earlier — gives more lead time
    const hartmanSection = document.querySelector('.scene--hartman')
    const triggerEl = hartmanSection || sectionRef.current
    if (!triggerEl) return

    const trigger = ScrollTrigger.create({
      trigger: triggerEl,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        if (batchPrefetchedRef.current) return
        batchPrefetchedRef.current = true

        // Process one at a time — the API queue in MarginaliaAPI.js
        // handles rate-limit pacing (1.5s between calls). Small extra
        // cooldown here gives the queue breathing room.
        const BATCH_COOLDOWN = 500
        const processQueue = async () => {
          for (let idx = 0; idx < shuffledFaces.length; idx++) {
            const face = shuffledFaces[idx]
            const personId = face.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
            if (hasPrefetch(personId)) continue

            const promise = (async () => {
              try {
                const previousNotes = getPreviousNotes(personId)
                const text = await generateMarginalia({
                  personId,
                  personName: face.name,
                  age: '',
                  charge: face.charge || '',
                  date: face.date,
                  location: face.location || 'Sydney',
                  essay: '',
                  previousNotes,
                })
                if (!text) return null
                const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(-3)
                if (lines.length === 0) return null
                const twoLines = lines.slice(0, 2)
                addNotes(personId, twoLines)
                return twoLines
              } catch (_) {
                return null
              }
            })()

            setPrefetch(personId, promise)
            await promise // Wait for this one to finish before starting next
            // Cooldown between batch requests to avoid 429 rate limits
            if (idx < shuffledFaces.length - 1) {
              await new Promise((r) => setTimeout(r, BATCH_COOLDOWN))
            }
          }
        }

        processQueue()
      },
    })

    return () => trigger.kill()
  }, [])

  // ─── Helper: derive personId from face name ─────────────────
  const getPersonId = useCallback((face) => {
    return face.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
  }, [])


  // ─── Prefetch inscription on hover (fires API before click) ─
  const handleCardHover = useCallback((face) => {
    const personId = getPersonId(face)
    if (hasPrefetch(personId)) return // already in flight

    const promise = (async () => {
      try {
        const previousNotes = getPreviousNotes(personId)
        const text = await generateMarginalia({
          personId,
          personName: face.name,
          age: '',
          charge: face.charge || '',
          date: face.date,
          location: face.location || 'Sydney',
          essay: '',
          previousNotes,
        })
        if (!text) return null
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(-3)
        if (lines.length === 0) return null
        const twoLines = lines.slice(0, 2)
        addNotes(personId, twoLines)
        return twoLines
      } catch (_) {
        return null
      }
    })()

    setPrefetch(personId, promise)
  }, [getPersonId])

  // ─── Fetch inscription — consumes prefetch if available ─────
  const fetchInscription = useCallback(async (face) => {
    const fetchId = face.file
    activeFetchRef.current = fetchId
    const personId = getPersonId(face)

    // Try prefetch first (non-destructive read — safe across re-mounts)
    const prefetchPromise = consumePrefetch(personId)
    if (prefetchPromise) {
      try {
        const result = await prefetchPromise
        if (activeFetchRef.current !== fetchId) return
        if (result) {
          setInscription(Array.isArray(result) ? result : [result])
          clearPrefetch(personId)
          return
        }
      } catch (_) {
        // Prefetch failed — fall through to fresh call
      }
    }

    // Fallback: fresh API call (no hover, or prefetch failed)
    const previousNotes = getPreviousNotes(personId)
    try {
      const text = await generateMarginalia({
        personId,
        personName: face.name,
        age: '',
        charge: face.charge || '',
        date: face.date,
        location: face.location || 'Sydney',
        essay: '',
        previousNotes,
      })

      if (activeFetchRef.current !== fetchId) return

      if (text) {
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(-3)
        const twoLines = lines.slice(0, 2)
        if (twoLines.length > 0) {
          addNotes(personId, twoLines)
          setInscription(twoLines)
        }
      }
    } catch (_) {
      // Inscription is optional — fail silently
    }
  }, [getPersonId])

  // ─── Click handler ───────────────────────────────────────────
  // Try to resolve the prefetch synchronously so inscription appears
  // with the panel — no layout shift, no waiting. If prefetch isn't
  // ready, open the panel and fetch in the background.
  const handleCardClick = useCallback(async (face) => {
    const personId = getPersonId(face)
    const prefetchPromise = consumePrefetch(personId)

    // If we have a prefetch, try to get it immediately
    let immediateInscription = null
    if (prefetchPromise) {
      try {
        // Give it 50ms — if it's already resolved this returns instantly
        const result = await Promise.race([
          prefetchPromise,
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 50)),
        ])
        if (result) {
          const lines = Array.isArray(result) ? result : [result]
          immediateInscription = lines
          clearPrefetch(personId)
          addNotes(personId, lines)
        }
      } catch (_) {
        // Not ready yet — open without inscription, fetch below
      }
    }

    setSelectedFace(face)
    setInscription(immediateInscription)

    // If no immediate inscription, fetch in the background
    if (!immediateInscription) {
      fetchInscription(face)
    }
  }, [getPersonId, fetchInscription])

  // ─── Close handler (GSAP fade-out, then clear state) ────────
  const handleClose = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      setSelectedFace(null)
      return
    }
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        setSelectedFace(null)
        setInscription(null)
      },
    })
  }, [])

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
      <div className="horizon-masonry">
        {shuffledFaces.map((face, i) => (
          <div
            className="horizon-card"
            key={i}
            onClick={() => handleCardClick(face)}
            onMouseEnter={() => handleCardHover(face)}
          >
            {/* Glass frame with magnifying loupe */}
            <HorizonLoupe src={`/horizon/${encodeURIComponent(face.file)}`}>
              <div className="horizon-frame">
                <img
                  src={`/horizon/${encodeURIComponent(face.file)}`}
                  alt={face.name}
                  loading="lazy"
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

            {/* Inscription zone — always present to avoid layout shift */}
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
