import { useState, useRef, useCallback, useEffect } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'
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
import ArchiveCounter from './ui/ArchiveCounter'
import AudioManager from '../engine/AudioManager'
import { INTERACTION_STATES } from '../data/sceneConfig'
import { people } from '../data/people'

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
      <LoadingScreen isLoaded={isLoaded} onEnter={handleEnter} />
      <Cursor interactionState={interactionState} scrollSection={scrollSection} />

      <Canvas
        onStateChange={handleStateChange}
        onLoad={handleLoad}
        audioManager={audioManager}
      />

      <main className="scroll-content">
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

      <ArchiveCounter />

      <MuteButton
        isMuted={isMuted}
        onToggle={handleToggleMute}
        visible={isLoaded}
      />
    </ReactLenis>
  )
}
