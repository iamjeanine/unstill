import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Closing — The Final Frame.
 *
 * The ending works like the last page of a book: the words arrive,
 * the room goes quiet, and you sit with what you've seen.
 *
 * The "lights going down" is the audio fading to silence — not the
 * text dimming. Every word stays readable. The silence is the gesture.
 */

export default function Closing({ audioManager }) {
  const sectionRef = useRef(null)
  const audioFadeStarted = useRef(false)
  const audioSilenceStarted = useRef(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const voidEl = section.querySelector('.closing-void')
    const statementEl = section.querySelector('.closing-statement')
    const dividerEl = section.querySelector('.invitation-divider')
    const nameEl = section.querySelector('.invitation-name')
    const dedicationEl = section.querySelector('.invitation-dedication')
    const emailEl = section.querySelector('.invitation-email')

    // Everything starts invisible
    const developEls = [statementEl, dividerEl, nameEl, dedicationEl, emailEl]
    developEls.forEach((el) => {
      if (el) gsap.set(el, { opacity: 0 })
    })

    // ── Void passage: the room gets quieter ──
    const voidTrigger = ScrollTrigger.create({
      trigger: voidEl,
      start: 'top 80%',
      onEnter: () => {
        if (audioFadeStarted.current) return
        audioFadeStarted.current = true
        if (audioManager) {
          audioManager._fadeAmbient(0.18, 4000)
        }
      },
    })

    // ── The closing line arrives — slow, monumental ──
    const statementTrigger = ScrollTrigger.create({
      trigger: statementEl,
      start: 'top 88%',
      onEnter: () => {
        gsap.set(statementEl, { clearProps: 'opacity' })
        statementEl.classList.add('closing-develop')
      },
    })

    // ── Credit block: divider triggers the stagger, audio fades to silence ──
    const dividerTrigger = ScrollTrigger.create({
      trigger: dividerEl,
      start: 'top 92%',
      onEnter: () => {
        // Divider fades in gently (no blur — it's just a line)
        gsap.to(dividerEl, {
          opacity: 1,
          duration: 1.6,
          ease: 'power2.out',
        })

        // Audio begins its final fade — the room goes silent
        if (!audioSilenceStarted.current) {
          audioSilenceStarted.current = true
          if (audioManager) {
            audioManager.fadeToSilence(6000)
          }
        }

        // Name — +1.0s, develops like a photograph
        gsap.delayedCall(1.0, () => {
          gsap.set(nameEl, { clearProps: 'opacity' })
          nameEl.classList.add('closing-develop')
        })

        // Dedication — +2.2s, the emotional last note
        gsap.delayedCall(2.2, () => {
          gsap.set(dedicationEl, { clearProps: 'opacity' })
          dedicationEl.classList.add('closing-develop')
        })

        // Email — +3.6s, quiet and functional
        gsap.delayedCall(3.6, () => {
          gsap.to(emailEl, {
            opacity: 1,
            duration: 2.0,
            ease: 'power2.out',
          })
        })
      },
    })

    return () => {
      voidTrigger.kill()
      statementTrigger.kill()
      dividerTrigger.kill()
    }
  }, [audioManager])

  return (
    <section ref={sectionRef} className="scene scene--closing">
      <div className="closing-void" />

      <div className="closing-content">
        <p className="closing-statement">
          The archive kept records.<br />
          You just kept company.
        </p>

        <div className="invitation-block">
          <div className="invitation-divider" />

          <p className="invitation-name">Jeanine Cornillot</p>
          <p className="invitation-dedication">
            For the ones the archive couldn&rsquo;t hold.
          </p>

          <a
            className="invitation-email"
            href="mailto:iamjeanine@me.com"
          >
            iamjeanine@me.com
          </a>
        </div>
      </div>

      <div className="film-grain" />
    </section>
  )
}
