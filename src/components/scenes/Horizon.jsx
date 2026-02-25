import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { generateMarginalia } from '../../engine/MarginaliaAPI'
import { getPreviousNotes, addNotes, setPrefetch, hasPrefetch, consumePrefetch, clearPrefetch } from '../../engine/marginaliaSessionStore'

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
  // crop: transform-origin for push-in on images with watermark stars.
  // The star sits near bottom-right (or bottom-left for Falleni).
  // Scale(1.08) inside overflow:hidden clips corners; transform-origin
  // biases toward the face so the star edge gets cropped away.
  { file: 'Sidney Kelly.png',  name: 'Sidney Kelly',     catalog: '1266',     date: '26.6.24',  crop: '40% 35%', location: 'Sydney' },
  { file: 'D Ligores.png',    name: 'D. Ligores',       catalog: 'S.P.',     date: 'c. 1925',  location: 'Sydney' },
  { file: 'Edna Edgar.png',   name: 'Edna Edgar',       catalog: '158A',     date: '28.12.26', crop: '40% 25%', location: 'Sydney' },
  { file: 'V Lowe.png',       name: 'V. Lowe',          catalog: '764',      date: '15.2.22',  location: 'Sydney' },
  { file: 'D. Poole.png',     name: 'D. Poole',         catalog: '639 L.B.', date: '31.7.24',  crop: '40% 30%', location: 'Sydney' },
  { file: 'F. Schmidt.png',   name: 'F. Schmidt',       catalog: '410',      date: '18.6.23',  crop: '50% 30%', location: 'Sydney' },
  { file: 'AH Chong.png',     name: 'Ah Chong',         catalog: 'D62',      date: '11.7.28',  crop: '40% 35%', location: 'Sydney' },
  { file: 'S.J. Hay.png',     name: 'S. J. Hay',        catalog: '167',      date: 'c. 1922',  crop: '50% 20%', location: 'Sydney' },
  { file: 'May Russel.png',   name: 'May Russel',       catalog: '936',      date: '31.1.22',  location: 'Sydney' },
  { file: 'E. Falleni.png',   name: 'E. Falleni',       catalog: '756',      date: 'c. 1920',  crop: '55% 20%', location: 'Sydney' },
  { file: 'G Lowe.png',       name: 'G. Lowe',          catalog: 'D10',      date: '28.9.28',  crop: '40% 35%', location: 'Sydney' },
  { file: 'Neville McQuade and Lewis Stanley.jpg', name: 'N. McQuade & L. Stanley', catalog: 'S.P.', date: 'c. 1930', crop: '50% 30%', location: 'Sydney' },
  { file: 'Patrick Riley.png', name: 'Patrick Riley',    catalog: '1098',     date: '17.8.26',  location: 'Sydney' },
  { file: 'V Stander.png',    name: 'V. Stander',       catalog: 'S.P.',     date: 'c. 1925',  crop: '40% 35%', location: 'Sydney' },
  { file: 'P. Hume.jpg',      name: 'P. Hume',          catalog: 'S15 L.B.', date: '1.6.21',   crop: '45% 20%', location: 'Sydney' },
  { file: 'E. Park.jpg',      name: 'E. Park',          catalog: 'K. Don',   date: '20.29',    crop: '40% 30%', location: 'Sydney' },
  { file: 'William Stanley Moore.png', name: 'William Stanley Moore', catalog: '1299', date: '1.8.25', crop: '40% 35%', location: 'Sydney' },
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
  const hintRef = useRef(null)
  const hintShownRef = useRef(false)

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

        // Process one at a time with cooldown to stay under rate limits.
        // 30k input tokens/min ≈ ~14 calls before the rolling window bites.
        // 6s gap keeps us safely under the ceiling (~10 calls/min).
        const BATCH_COOLDOWN = 6000
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

  // ─── Show hint on first hover ───────────────────────────────
  const showHintOnce = useCallback(() => {
    if (hintShownRef.current) return
    hintShownRef.current = true
    const hint = hintRef.current
    if (!hint) return
    gsap.to(hint, { opacity: 1, duration: 0.8, ease: 'power2.out' })
    gsap.to(hint, {
      opacity: 0,
      duration: 0.8,
      delay: 4,
      ease: 'power2.in',
    })
  }, [])

  // ─── Prefetch inscription on hover (fires API before click) ─
  const handleCardHover = useCallback((face) => {
    showHintOnce()
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
  }, [getPersonId, showHintOnce])

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
  const handleCardClick = useCallback((face) => {
    setSelectedFace(face)
    setInscription(null)
    fetchInscription(face)
  }, [fetchInscription])

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
            {/* Glass frame */}
            <div className="horizon-frame">
              <img
                src={`/horizon/${encodeURIComponent(face.file)}`}
                alt={face.name}
                loading="lazy"
                className={face.crop ? 'horizon-img--cropped' : undefined}
                style={face.crop ? { transformOrigin: face.crop } : undefined}
              />
              <div className="horizon-vignette" />
            </div>

            {/* Catalog label */}
            <div className="horizon-label">
              <span className="horizon-label__name">{face.name}</span>
              <span className="horizon-label__meta">{face.catalog} &middot; {face.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Discovery hint — appears once on first hover ── */}
      <p ref={hintRef} className="horizon-hint" style={{ opacity: 0 }}>
        Click to see what remains
      </p>

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
              <p className="inscription-label">The Photograph Resists</p>
              {inscription && inscription.map((line, i) => (
                <p
                  className="horizon-panel__inscription"
                  key={`${selectedFace.file}-${i}`}
                  style={{ animationDelay: `${0.3 + i * 0.8}s` }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Photographic grain */}
      <div className="horizon-grain" />
    </section>
  )
}
