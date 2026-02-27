import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * HartmanQuote — The Threshold.
 *
 * Full-viewport standalone section. The Saidiya Hartman quote
 * reframes everything that follows. It tells the viewer how to
 * look at the archive: what you're about to see was created by
 * a system, not by the people in the photographs.
 *
 * Sits between the featured stories and the stats section so
 * the numbers land differently — 2,500 special photographs
 * becomes 2,500 people processed.
 *
 * Design: Museum wall quote. Large italic serif. Generous
 * whitespace. The quote resolves as you scroll into it —
 * a slow fade with gentle upward drift. Restrained motion;
 * the words do the work.
 */

export default function HartmanQuote() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const quote = section.querySelector('.hartman-quote__text')
    const cite = section.querySelector('.hartman-quote__cite')

    if (quote) {
      gsap.set(quote, { opacity: 0, y: 40 })
      ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        onEnter: () => {
          gsap.to(quote, {
            opacity: 1,
            y: 0,
            duration: 2.0,
            ease: 'power2.out',
          })
        },
      })
    }

    if (cite) {
      gsap.set(cite, { opacity: 0 })
      ScrollTrigger.create({
        trigger: section,
        start: 'top 50%',
        onEnter: () => {
          gsap.to(cite, {
            opacity: 1,
            duration: 1.6,
            delay: 0.8,
            ease: 'power2.out',
          })
        },
      })
    }

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger && section.contains(t.trigger)) t.kill()
      })
    }
  }, [])

  return (
    <section ref={sectionRef} className="scene scene--hartman">
      <div className="hartman-quote">
        <blockquote className="hartman-quote__block">
          <p className="hartman-quote__text">
            &ldquo;The archive is a record of power, not of truth.&rdquo;
          </p>
          <cite className="hartman-quote__cite">
            Saidiya Hartman
          </cite>
        </blockquote>
      </div>
      <div className="film-grain" />
    </section>
  )
}
