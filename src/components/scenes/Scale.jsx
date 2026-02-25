import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scale — Numbers.
 *
 * The Hartman quote has already reframed the viewer's understanding.
 * Now the numbers land with that context: 2,500 isn't a fun fact,
 * it's 2,500 people processed. Each number counts up from zero —
 * the scale builds in real time.
 */

const formatter = new Intl.NumberFormat('en-US')

const scaleData = [
  { raw: 2500, text: 'Special Photographs in the collection.' },
  { raw: 130000, text: 'glass plate negatives in the archive.' },
  { raw: 52000, text: 'searchable online. Right now.' },
]

export default function Scale() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // ── Scale numbers — count up from zero ──
    const scaleLines = section.querySelectorAll('.scale-line')
    scaleLines.forEach((line, i) => {
      const numEl = line.querySelector('.scale-num')
      const textEl = line.querySelector('.scale-text')
      const target = scaleData[i].raw

      // Start invisible, number shows "0"
      gsap.set(line, { opacity: 0, y: 30 })
      numEl.textContent = '0'
      gsap.set(textEl, { opacity: 0 })

      ScrollTrigger.create({
        trigger: line,
        start: 'top 85%',
        onEnter: () => {
          // Fade in the line container
          gsap.to(line, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: i * 0.15,
            ease: 'power3.out',
          })

          // Count up the number
          const proxy = { value: 0 }
          gsap.to(proxy, {
            value: target,
            duration: 1.8,
            delay: i * 0.15 + 0.3,
            ease: 'power2.out',
            snap: { value: 1 },
            onUpdate: () => {
              numEl.textContent = formatter.format(proxy.value)
            },
          })

          // Fade in the description text after the count lands
          gsap.to(textEl, {
            opacity: 1,
            duration: 0.8,
            delay: i * 0.15 + 1.6,
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
    <section ref={sectionRef} className="scene scene--scale">
      <div className="scale-numbers">
        {scaleData.map((item, i) => (
          <div className="scale-line" key={i}>
            <span className="scale-num">{formatter.format(item.raw)}</span>
            <span className="scale-text">{item.text}</span>
          </div>
        ))}
      </div>
      <div className="film-grain" />
    </section>
  )
}
