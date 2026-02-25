import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Closing — The landing.
 *
 * "The archive kept records. You just kept company."
 *
 * After the full arc — stories, Hartman, scale, faces without stories —
 * this line lands the experience. Then silence, a divider, and the
 * name behind it.
 */

export default function Closing() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const items = section.querySelectorAll('.invite-animate')
    items.forEach((item, i) => {
      gsap.set(item, { opacity: 0, y: 20 })
      ScrollTrigger.create({
        trigger: item,
        start: 'top 88%',
        onEnter: () => {
          gsap.to(item, {
            opacity: 1,
            y: 0,
            duration: 1.0,
            delay: i * 0.2,
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

  return (
    <section ref={sectionRef} className="scene scene--closing">
      <p className="closing-statement invite-animate">
        The archive kept records. You just kept company.
      </p>

      <div className="invitation-block">
        <div className="invitation-divider invite-animate" />

        <p className="invitation-name invite-animate">Jeanine Cornillot</p>
        <p className="invitation-role invite-animate">
          Executive Producer &middot; Applied AI
        </p>

        <a
          className="invitation-email invite-animate"
          href="mailto:iamjeanine@me.com"
        >
          iamjeanine@me.com
        </a>
      </div>
      <div className="film-grain" />
    </section>
  )
}
