import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'

/**
 * ArchiveCounter — "X of 2,500"
 *
 * A quiet, persistent counter in the bottom corner.
 * Increments when faces enter the viewport for the first time.
 * Not a UI element. A fact that sits there.
 * Fades during the closing withdrawal.
 */

const TOTAL = 2500

export default function ArchiveCounter() {
  const [count, setCount] = useState(0)
  const seenRef = useRef(new Set())
  const containerRef = useRef(null)

  useEffect(() => {
    // ── Hero face (Ah Num & Ah Tom) — always the first ──
    const heroSection = document.querySelector('.scene--entry')
    if (heroSection) {
      const heroObs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !seenRef.current.has('hero')) {
            seenRef.current.add('hero')
            setCount((c) => c + 1)
          }
        },
        { threshold: 0.2 }
      )
      heroObs.observe(heroSection)
    }

    // ── Archive featured faces — count when the archive section
    //    is well into view (the planes are visible by then) ──
    const archiveSection = document.querySelector('.scene--archive')
    if (archiveSection) {
      const archiveObs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !seenRef.current.has('archive')) {
            seenRef.current.add('archive')
            // 7 featured people become visible as you scroll the archive
            setCount((c) => c + 7)
          }
        },
        { threshold: 0.15 }
      )
      archiveObs.observe(archiveSection)
    }

    // ── Horizon cards — each face counted individually ──
    const horizonCards = document.querySelectorAll('.horizon-card')
    const horizonObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = entry.target.dataset.counterIdx
            if (idx && !seenRef.current.has(idx)) {
              seenRef.current.add(idx)
              setCount((c) => c + 1)
            }
          }
        })
      },
      { threshold: 0.3 }
    )

    horizonCards.forEach((card, i) => {
      card.dataset.counterIdx = `horizon-${i}`
      horizonObs.observe(card)
    })

    // ── Withdrawal listener — counter fades during closing ──
    const onWithdrawal = (e) => {
      if (containerRef.current) {
        const p = e.detail.progress
        gsap.set(containerRef.current, { opacity: 0.3 * (1 - p) })
      }
    }
    window.addEventListener('unstill:withdrawal', onWithdrawal)

    return () => {
      horizonObs.disconnect()
      window.removeEventListener('unstill:withdrawal', onWithdrawal)
    }
  }, [])

  if (count === 0) return null

  return (
    <div
      ref={containerRef}
      className="archive-counter"
    >
      {count} of {TOTAL.toLocaleString()}
    </div>
  )
}
