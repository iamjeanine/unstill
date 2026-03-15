import { useRef, useEffect } from 'react'
import { useLenis } from 'lenis/react'
import WebGLEngine from '../engine/WebGLEngine'
import AnimationLoop, { gsap, ScrollTrigger } from '../engine/AnimationLoop'
import MugshotPlane from '../engine/MugshotPlane'
import InteractionManager from '../engine/InteractionManager'
import PhysicsManager from '../engine/PhysicsManager'
import { people, archiveGroups } from '../data/people'

function isMobilePortrait() {
  return window.innerWidth <= 480
}

export default function Canvas({ onStateChange, onLoad, audioManager, onCarouselChange }) {
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const loopRef = useRef(null)
  const planesRef = useRef([])
  const interactionRef = useRef(null)
  const physicsRef = useRef(null)
  const carouselRef = useRef({
    isMobile: false,
    activeGroupIndex: -1,
    personIndex: 0,
    groupMemberCount: 0,
  })

  const lenis = useLenis()

  // Initialize Three.js engine, planes, physics, and interaction
  useEffect(() => {
    const engine = new WebGLEngine()
    engineRef.current = engine
    engine.mount(containerRef.current)

    // Create mugshot planes — use group layouts and viewportScale
    const planes = people.map((person) => {
      const group = archiveGroups.find((g) => g.members.includes(person.id))
      const groupLayout = group?.layouts?.[person.id]
      const mergedPerson = groupLayout
        ? { ...person, layout: { ...person.layout, ...groupLayout } }
        : person

      const plane = new MugshotPlane({
        personData: mergedPerson,
        viewportScale: group?.viewportScale || 1,
      })

      // Tag with group index for tracking
      plane._groupIndex = group ? archiveGroups.indexOf(group) : -1

      // All planes start hidden — groups reveal them via ScrollTrigger
      plane.mesh.visible = false

      engine.scene.add(plane.mesh)
      return plane
    })
    planesRef.current = planes

    // Create physics manager
    const physics = new PhysicsManager(planes, engine.camera)
    physicsRef.current = physics

    // Set up interaction manager
    const interaction = new InteractionManager({
      camera: engine.camera,
      planes,
      onStateChange,
    })
    interaction.physicsManager = physics
    interactionRef.current = interaction

    // Expose planes for demo/calibrate mode
    const params = new URLSearchParams(window.location.search)
    if (params.has('demo') || params.has('calibrate')) {
      window.__unstillPlanes = planes
      window.__unstillPhysics = physics
      window.__unstillInteraction = interaction
    }

    // Signal loaded
    if (onLoad) {
      requestAnimationFrame(() => onLoad())
    }

    return () => {
      interaction.dispose()
      physics.dispose()
      planes.forEach((p) => {
        engine.scene.remove(p.mesh)
        p.dispose()
      })
      engine.dispose()
    }
  }, [onStateChange, onLoad])

  // Set up animation loop once lenis is available
  useEffect(() => {
    if (!lenis || !engineRef.current) return

    const loop = new AnimationLoop({ lenis, engine: engineRef.current })
    loopRef.current = loop

    let lastTime = 0

    // Update shader time + physics on every frame
    const removeTick = loop.onTick((time) => {
      const dt = lastTime ? time - lastTime : 0.016
      lastTime = time

      // Update physics simulation
      const physics = physicsRef.current
      if (physics) {
        physics.update(dt)
      }

      // Update shader uniforms (time + parallax)
      const interaction = interactionRef.current
      const mx = interaction ? interaction.normalizedMouse.x : 0
      const my = interaction ? interaction.normalizedMouse.y : 0

      planesRef.current.forEach((plane) => {
        plane.update(time, null)

        // Subtle parallax — each plane shifts slightly based on mouse position
        // Depth (z) determines parallax strength: closer planes move more
        const depth = (plane.mesh.position.z + 1) * 0.008 // ~0.004–0.016
        const target = plane.material.uniforms.uParallaxOffset.value
        const destX = mx * depth
        const destY = -my * depth // invert Y for natural feel
        // Smooth lerp so parallax drifts, doesn't snap
        target.x += (destX - target.x) * 0.06
        target.y += (destY - target.y) * 0.06
      })
    })

    loop.start()

    return () => {
      removeTick()
      loop.dispose()
    }
  }, [lenis])

  // Set up a single progress-based ScrollTrigger for sequential groups
  useEffect(() => {
    const planes = planesRef.current
    const interaction = interactionRef.current
    const engine = engineRef.current
    if (planes.length === 0 || !interaction || !engine) return

    const archiveSection = document.querySelector('.scene--archive')
    if (!archiveSection) return

    // Pre-compute group → planes mapping
    const groupPlaneMap = archiveGroups.map((group) =>
      planes.filter((p) => group.members.includes(p.id))
    )

    // Track which group is currently showing (-1 = none)
    let activeGroupIndex = -1
    const carousel = carouselRef.current

    // ── Carousel navigation (called by InteractionManager on swipe) ──
    const navigateCarousel = (direction) => {
      if (!carousel.isMobile) return

      const groupPlanes = groupPlaneMap[carousel.activeGroupIndex]
      if (!groupPlanes) return

      const oldIndex = carousel.personIndex
      const newIdx = oldIndex + direction
      if (newIdx < 0 || newIdx >= groupPlanes.length) return

      const oldPlane = groupPlanes[oldIndex]
      const newPlane = groupPlanes[newIdx]

      // Old plane slides out opposite to swipe direction
      gsap.to(oldPlane.mesh.position, {
        x: -direction * 0.5,
        duration: 0.35,
        ease: 'power2.in',
      })
      gsap.to(oldPlane.material.uniforms.uOpacity, {
        value: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => { oldPlane.mesh.visible = false },
      })

      // New plane slides in from swipe direction
      newPlane.mesh.visible = true
      newPlane.mesh.position.x = direction * 0.5
      newPlane.mesh.position.y = newPlane.basePosition.y
      gsap.to(newPlane.mesh.position, {
        x: 0,
        duration: 0.4,
        ease: 'power2.out',
      })
      gsap.to(newPlane.material.uniforms.uOpacity, {
        value: 1,
        duration: 0.4,
        ease: 'power2.out',
      })

      carousel.personIndex = newIdx

      if (onCarouselChange) {
        onCarouselChange({
          active: true,
          index: newIdx,
          count: groupPlanes.length,
          groupIndex: carousel.activeGroupIndex,
        })
      }
    }

    // Wire carousel into InteractionManager
    interaction.carouselRef = carouselRef
    interaction.navigateCarousel = navigateCarousel

    const transitionTo = (newIndex) => {
      if (newIndex === activeGroupIndex) return

      const mobile = isMobilePortrait()

      // Hide the current group
      if (activeGroupIndex >= 0) {
        groupPlaneMap[activeGroupIndex].forEach((p) => p.fadeOut(0.4))
      }

      // Show the new group
      if (newIndex >= 0) {
        const groupPlanes = groupPlaneMap[newIndex]

        if (mobile && groupPlanes.length > 1) {
          // CAROUSEL MODE: show only first person, centered
          carousel.isMobile = true
          carousel.activeGroupIndex = newIndex
          carousel.personIndex = 0
          carousel.groupMemberCount = groupPlanes.length

          groupPlanes.forEach((p, i) => {
            if (i === 0) {
              p.fadeIn(0.15, 0) // overrideX = 0 (centered)
            } else {
              p.mesh.visible = false
              p.material.uniforms.uOpacity.value = 0
            }
          })

          if (onCarouselChange) {
            onCarouselChange({
              active: true,
              index: 0,
              count: groupPlanes.length,
              groupIndex: newIndex,
            })
          }
        } else {
          // Normal layout (desktop or solo groups)
          carousel.isMobile = false
          groupPlanes.forEach((p, i) => p.fadeIn(0.15 + i * 0.12))

          if (onCarouselChange) {
            onCarouselChange({ active: false })
          }
        }

        interaction.enable()
        engine.canvas.style.pointerEvents = 'auto'
      } else {
        interaction.disable()
        engine.canvas.style.pointerEvents = 'none'
        carousel.isMobile = false

        if (onCarouselChange) {
          onCarouselChange({ active: false })
        }
      }

      activeGroupIndex = newIndex
      carousel.activeGroupIndex = newIndex
    }

    // Handle resize — re-evaluate carousel mode
    const handleResize = () => {
      const mobile = isMobilePortrait()
      if (carousel.isMobile && !mobile) {
        const idx = activeGroupIndex
        activeGroupIndex = -1
        transitionTo(idx)
      } else if (!carousel.isMobile && mobile && activeGroupIndex >= 0) {
        const groupPlanes = groupPlaneMap[activeGroupIndex]
        if (groupPlanes && groupPlanes.length > 1) {
          const idx = activeGroupIndex
          activeGroupIndex = -1
          transitionTo(idx)
        }
      }
    }
    window.addEventListener('resize', handleResize)

    // Single ScrollTrigger spanning the entire archive section.
    // start/end at center of viewport → total range = exactly 400vh
    // Each group gets 100vh of comfortable viewing.
    const trigger = ScrollTrigger.create({
      trigger: archiveSection,
      start: 'top center',
      end: 'bottom center',
      onUpdate: (self) => {
        const progress = self.progress // 0 → 1
        const groupCount = archiveGroups.length
        const rawIndex = Math.floor(progress * groupCount)
        const groupIndex = Math.min(rawIndex, groupCount - 1)
        transitionTo(groupIndex)
      },
      onLeave: () => transitionTo(-1),
      onLeaveBack: () => transitionTo(-1),
    })

    return () => {
      trigger.kill()
      window.removeEventListener('resize', handleResize)
    }
  }, [audioManager, onCarouselChange])

  // Listen for exitStory events from StoryPanel
  useEffect(() => {
    const handleExitStory = () => {
      if (interactionRef.current) {
        interactionRef.current.exitStory()
      }
    }
    window.addEventListener('unstill:exitStory', handleExitStory)
    return () =>
      window.removeEventListener('unstill:exitStory', handleExitStory)
  }, [])

  // Listen for navigateConnection events (lateral story transitions)
  useEffect(() => {
    const handleNavigateConnection = (e) => {
      const { personId } = e.detail
      if (interactionRef.current) {
        interactionRef.current.navigateToConnection(personId)
      }
    }
    window.addEventListener(
      'unstill:navigateConnection',
      handleNavigateConnection
    )
    return () =>
      window.removeEventListener(
        'unstill:navigateConnection',
        handleNavigateConnection
      )
  }, [])

  return <div ref={containerRef} />
}
