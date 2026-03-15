import { useState, useRef, useCallback, useEffect } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'
import gsap from 'gsap'
import Canvas from './Canvas'
import Entry from './scenes/Entry'
import Archive from './scenes/Archive'
import StoryPanel from './scenes/StoryPanel'
import HartmanQuote from './scenes/HartmanQuote'
import Scale from './scenes/Scale'
import Horizon from './scenes/Horizon'
import Closing from './scenes/Closing'
import Cursor from './ui/Cursor'
import LoadingScreen from './ui/LoadingScreen'
import MuteButton from './ui/MuteButton'
import CarouselDots from './ui/CarouselDots'
import AudioManager from '../engine/AudioManager'
import { INTERACTION_STATES } from '../data/sceneConfig'
import { people } from '../data/people'

const IS_DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
const IS_CALIBRATE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibrate')

// Preserve AudioManager across Vite HMR — a new module execution
// would otherwise create a fresh instance while the old AudioContext
// (with active ambient audio) gets garbage collected.
let audioManager
if (import.meta.hot && import.meta.hot.data.audioManager) {
  audioManager = import.meta.hot.data.audioManager
} else {
  audioManager = new AudioManager()
}
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.audioManager = audioManager
  })
}

export default function App() {
  const [interactionState, setInteractionState] = useState(
    INTERACTION_STATES.BROWSING
  )
  const [activePerson, setActivePerson] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [storyClosing, setStoryClosing] = useState(false) // true while panel fades out
  const [scrollSection, setScrollSection] = useState('entry')
  const [carouselState, setCarouselState] = useState({ active: false, index: 0, count: 0 })
  const closingPersonRef = useRef(null) // keep person data during exit fade
  const lenisRef = useRef(null)

  // Helper to safely access the Lenis instance from ReactLenis ref
  const getLenis = () => {
    const ref = lenisRef.current
    if (!ref) return null
    // ReactLenis ref may expose lenis instance directly or via .lenis
    if (typeof ref.stop === 'function') return ref
    if (ref.lenis && typeof ref.lenis.stop === 'function') return ref.lenis
    return null
  }

  const handleStateChange = useCallback(
    (newState, prevState, plane) => {
      setInteractionState(newState)

      // Lock scroll during STORY or DRAGGING
      if (newState === INTERACTION_STATES.STORY && plane) {
        setActivePerson(plane.personData)
        const lenis = getLenis()
        if (lenis) lenis.stop()
        audioManager.enterStory(plane.personData.id)
      }

      if (newState === INTERACTION_STATES.DRAGGING) {
        const lenis = getLenis()
        if (lenis) lenis.stop()
      }

      // Resume scroll when returning to BROWSING from STORY or DRAGGING
      if (newState === INTERACTION_STATES.BROWSING) {
        if (
          prevState === INTERACTION_STATES.STORY ||
          prevState === INTERACTION_STATES.DRAGGING
        ) {
          const lenis = getLenis()
          if (lenis) lenis.start()
        }
        // Don't clear activePerson here — storyClosing state keeps
        // the panel mounted during its exit animation. The panel's
        // onCloseComplete callback handles the final cleanup.
      }
    },
    []
  )

  // Two-phase story close for overlapping transition:
  // Phase 1 (onCloseStart): Save person data, start plane restoration + audio fade.
  //   Panel stays mounted via storyClosing flag while it fades out.
  // Phase 2 (onCloseComplete): Panel has fully faded — unmount it.
  const handleCloseStoryStart = useCallback(() => {
    closingPersonRef.current = activePerson
    setStoryClosing(true)
    audioManager.exitStory()
    window.dispatchEvent(new CustomEvent('unstill:exitStory'))
  }, [activePerson])

  const handleCloseStoryComplete = useCallback(() => {
    // Panel has fully faded — safe to unmount
    setStoryClosing(false)
    setActivePerson(null)
    closingPersonRef.current = null
  }, [])

  /**
   * Handle navigation to a connected person (lateral story transition).
   * Updates the active person in React and tells the InteractionManager to crossfade.
   */
  const handleNavigateStory = useCallback((personId) => {
    const newPerson = people.find((p) => p.id === personId)
    if (!newPerson) return

    // Update React state to re-render StoryPanel with new person
    setActivePerson(newPerson)

    // Tell the InteractionManager to crossfade the WebGL planes
    window.dispatchEvent(
      new CustomEvent('unstill:navigateConnection', {
        detail: { personId },
      })
    )

    // Update audio
    audioManager.exitStory()
    audioManager.enterStory(personId)
  }, [])

  const handleToggleMute = useCallback(() => {
    const muted = audioManager.toggleMute()
    setIsMuted(muted)
  }, [])

  const handleCarouselChange = useCallback((state) => {
    setCarouselState(state)
  }, [])

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  // Preload audio buffer during loading screen so it's ready instantly.
  useEffect(() => {
    audioManager.preload()
  }, [])

  // "Click to enter" — unlocks AudioContext and starts music.
  // Called from LoadingScreen's onClick, which is a real user gesture.
  const handleEnter = useCallback(() => {
    audioManager.init()
    audioManager.startAmbient()
  }, [])

  // ─── Demo mode: scripted loupe choreography ──────
  useEffect(() => {
    if (!IS_DEMO || !isLoaded) return

    // Auto-dismiss loading screen
    const loadingEl = document.querySelector('[style*="z-index: 10000"]')
    if (loadingEl) {
      loadingEl.style.display = 'none'
    }

    // Wait for planes to initialize, then run demo
    const startDemo = () => {
      const planes = window.__unstillPlanes
      if (!planes || planes.length === 0) {
        setTimeout(startDemo, 200)
        return
      }

      // Scroll to archive section to trigger plane visibility
      const archiveEl = document.querySelector('.scene--archive')
      if (archiveEl) {
        // Jump scroll to middle of first group
        const archiveTop = archiveEl.offsetTop
        const groupHeight = archiveEl.offsetHeight / 4
        window.scrollTo(0, archiveTop + groupHeight * 0.3)
      }

      // Wait for planes to fade in
      setTimeout(() => {
        // Find Fay Watson and Elsie Paul planes
        const fay = planes.find(p => p.id === 'fay-watson')
        const elsie = planes.find(p => p.id === 'elsie-paul')
        if (!fay) return

        // Make sure planes are visible
        ;[fay, elsie].filter(Boolean).forEach(p => {
          p.mesh.visible = true
          p.material.uniforms.uOpacity.value = 1
        })

        const tl = gsap.timeline({ repeat: -1 })

        // Phase 1: Loupe reveals on Fay (calibrated UV coordinates)
        fay.material.uniforms.uMouse.value.set(0.331, 0.469)
        tl.to(fay.material.uniforms.uRevealProgress, {
          value: 1, duration: 1.5, ease: 'power2.out',
        }, 0)
        tl.to(fay.material.uniforms.uHoverIntensity, {
          value: 1, duration: 0.4, ease: 'power2.out',
        }, 0)
        // Drift across Fay's face
        tl.to(fay.material.uniforms.uMouse.value, {
          x: 0.597, y: 0.783, duration: 5, ease: 'power1.inOut',
        }, 0.5)

        // Phase 2: Hold — let the color breathe

        // Phase 3: Fade out loupe on Fay
        tl.to(fay.material.uniforms.uRevealProgress, {
          value: 0, duration: 1.2, ease: 'power2.in',
        }, 7)
        tl.to(fay.material.uniforms.uHoverIntensity, {
          value: 0, duration: 0.6, ease: 'power2.in',
        }, 7)

        if (elsie) {
          // Phase 4: Loupe reveals on Elsie (calibrated UV coordinates)
          tl.call(() => {
            elsie.material.uniforms.uMouse.value.set(0.346, 0.396)
          }, null, 8.5)
          tl.to(elsie.material.uniforms.uRevealProgress, {
            value: 1, duration: 1.5, ease: 'power2.out',
          }, 8.7)
          tl.to(elsie.material.uniforms.uHoverIntensity, {
            value: 1, duration: 0.4, ease: 'power2.out',
          }, 8.7)
          // Drift across Elsie's face
          tl.to(elsie.material.uniforms.uMouse.value, {
            x: 0.609, y: 0.691, duration: 5, ease: 'power1.inOut',
          }, 9)

          // Phase 5: Fade out Elsie — prepare for loop
          tl.to(elsie.material.uniforms.uRevealProgress, {
            value: 0, duration: 1.5, ease: 'power2.in',
          }, 14.5)
          tl.to(elsie.material.uniforms.uHoverIntensity, {
            value: 0, duration: 0.6, ease: 'power2.in',
          }, 14.5)
        }
      }, 800)
    }

    setTimeout(startDemo, 500)
  }, [isLoaded])

  // ─── Calibrate mode: show UV coordinates on hover ──────
  const [calibrateInfo, setCalibrateInfo] = useState(null)
  useEffect(() => {
    if (!IS_CALIBRATE || !isLoaded) return

    // Auto-dismiss loading screen
    const loadingEl = document.querySelector('[style*="z-index: 10000"]')
    if (loadingEl) loadingEl.style.display = 'none'

    const waitForPlanes = () => {
      const planes = window.__unstillPlanes
      const physics = window.__unstillPhysics
      if (!planes || !physics || planes.length === 0) {
        setTimeout(waitForPlanes, 200)
        return
      }

      // Scroll to archive to make planes visible
      const archiveEl = document.querySelector('.scene--archive')
      if (archiveEl) {
        const archiveTop = archiveEl.offsetTop
        const groupHeight = archiveEl.offsetHeight / 4
        window.scrollTo(0, archiveTop + groupHeight * 0.3)
      }

      setTimeout(() => {
        // Make all planes in group 0 visible
        const fay = planes.find(p => p.id === 'fay-watson')
        const elsie = planes.find(p => p.id === 'elsie-paul')
        ;[fay, elsie].filter(Boolean).forEach(p => {
          p.mesh.visible = true
          p.material.uniforms.uOpacity.value = 1
        })

        // Mousemove handler — raycast to find UV under cursor
        const onMove = (e) => {
          const hit = physics.getPlaneAtScreenPos(e.clientX, e.clientY)
          if (hit && hit.uv) {
            const plane = hit.plane
            // Show the loupe at this position
            plane.material.uniforms.uMouse.value.copy(hit.uv)
            plane.material.uniforms.uRevealProgress.value = 1
            plane.material.uniforms.uHoverIntensity.value = 1
            setCalibrateInfo({
              id: plane.id,
              x: hit.uv.x.toFixed(3),
              y: hit.uv.y.toFixed(3),
            })
          } else {
            setCalibrateInfo(null)
          }
        }

        window.addEventListener('mousemove', onMove)
      }, 800)
    }

    setTimeout(waitForPlanes, 500)
  }, [isLoaded])

  // ─── Track which scroll section is in view (for cursor) ──────
  useEffect(() => {
    const sectionMap = [
      { selector: '.scene--closing', name: 'closing' },
      { selector: '.scene--horizon', name: 'horizon' },
      { selector: '.scene--scale', name: 'scale' },
      { selector: '.scene--hartman', name: 'hartman' },
      { selector: '.scene--entry', name: 'entry' },
    ]

    const observers = []
    sectionMap.forEach(({ selector, name }) => {
      const el = document.querySelector(selector)
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setScrollSection(name)
        },
        { threshold: 0.3 }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  // Listen for story navigation events from InteractionManager
  useEffect(() => {
    const handleNavigateFromEngine = (e) => {
      const { personId } = e.detail
      const newPerson = people.find((p) => p.id === personId)
      if (newPerson) {
        setActivePerson(newPerson)
      }
    }
    window.addEventListener('unstill:navigateStory', handleNavigateFromEngine)
    return () =>
      window.removeEventListener(
        'unstill:navigateStory',
        handleNavigateFromEngine
      )
  }, [])

  return (
    <ReactLenis
      root
      options={{ autoRaf: false, lerp: 0.055, duration: 1.6 }}
      ref={lenisRef}
    >
      {!IS_DEMO && !IS_CALIBRATE && <LoadingScreen isLoaded={isLoaded} onEnter={handleEnter} />}
      {!IS_DEMO && !IS_CALIBRATE && <Cursor interactionState={interactionState} scrollSection={scrollSection} />}

      <Canvas
        onStateChange={handleStateChange}
        onLoad={handleLoad}
        audioManager={audioManager}
        onCarouselChange={handleCarouselChange}
      />

      <main className="scroll-content" style={(IS_DEMO || IS_CALIBRATE) ? { visibility: 'hidden' } : undefined}>
        <Entry audioManager={audioManager} />
        <Archive />
        <div className="threshold threshold--archive" aria-hidden="true" />
        <HartmanQuote />
        <Scale />
        <div className="threshold" aria-hidden="true" />
        <Horizon />
        <Closing audioManager={audioManager} />
      </main>

      {/* StoryPanel stays mounted during closing phase for its exit animation.
          The panel fades out on top of the materializing archive planes. */}
      {(interactionState === INTERACTION_STATES.STORY || storyClosing) &&
        (activePerson || closingPersonRef.current) && (
        <StoryPanel
          person={activePerson || closingPersonRef.current}
          onClose={handleCloseStoryStart}
          onCloseStart={handleCloseStoryStart}
          onCloseComplete={handleCloseStoryComplete}
          onNavigate={handleNavigateStory}
        />
      )}

      {!IS_DEMO && !IS_CALIBRATE && (
        <CarouselDots
          active={carouselState.active}
          index={carouselState.index}
          count={carouselState.count}
        />
      )}

      {!IS_DEMO && !IS_CALIBRATE && <MuteButton
        isMuted={isMuted}
        onToggle={handleToggleMute}
        visible={isLoaded}
      />}

      {IS_CALIBRATE && calibrateInfo && (
        <div style={{
          position: 'fixed', top: 24, left: 24, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', color: '#0f0', padding: '16px 24px',
          fontFamily: 'monospace', fontSize: 18, borderRadius: 8, lineHeight: 1.6,
        }}>
          <div style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>{calibrateInfo.id}</div>
          <div>uv({calibrateInfo.x}, {calibrateInfo.y})</div>
        </div>
      )}
    </ReactLenis>
  )
}
