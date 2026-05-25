import * as THREE from 'three'
import gsap from 'gsap'
import { INTERACTION_STATES } from '../data/sceneConfig'
import { generateMarginalia } from './MarginaliaAPI'
import { getPreviousNotes, addNotes, setPrefetch, hasPrefetch } from './marginaliaSessionStore'

const DRAG_THRESHOLD = 3 // pixels — movement beyond this = drag, not click

class InteractionManager {
  constructor({ camera, planes, onStateChange }) {
    this.camera = camera
    this.planes = planes
    this.onStateChange = onStateChange || (() => {})
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.normalizedMouse = { x: 0, y: 0 }

    this.state = INTERACTION_STATES.BROWSING
    this.hoveredPlane = null
    this.activePlane = null
    this.enabled = false

    // Story transition timeline (for cleanup)
    this._storyTimeline = null
    this._isTransitioning = false

    // Drag state
    this.physicsManager = null // Set externally after construction
    this.isDragging = false
    this.dragPlane = null
    this.dragStart = { x: 0, y: 0 }
    this.dragOffset = { x: 0, y: 0 }
    this.dragMoved = false
    this.lastDragWorld = { x: 0, y: 0 }
    this.prevDragWorld = { x: 0, y: 0 }

    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)

    // Touch support — press-and-hold reveals loupe, tap enters story
    this._onTouchStart = this._onTouchStart.bind(this)
    this._onTouchMove = this._onTouchMove.bind(this)
    this._onTouchEnd = this._onTouchEnd.bind(this)
    this._touchLoupeTimer = null
    this._touchLoupeActive = false
    this._touchStartPos = { x: 0, y: 0 }
    this._touchPlane = null

    // Carousel swipe detection (set externally by Canvas.jsx)
    this.carouselRef = null
    this.navigateCarousel = null
    this._swipeDetected = false
  }

  enable() {
    if (this.enabled) return
    this.enabled = true
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('mousedown', this._onMouseDown)
    window.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('touchstart', this._onTouchStart, { passive: false })
    window.addEventListener('touchmove', this._onTouchMove, { passive: false })
    window.addEventListener('touchend', this._onTouchEnd)
  }

  disable() {
    this.enabled = false
    this._endDrag()
    this._endTouchLoupe()
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('mousedown', this._onMouseDown)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('touchstart', this._onTouchStart)
    window.removeEventListener('touchmove', this._onTouchMove)
    window.removeEventListener('touchend', this._onTouchEnd)
  }

  _onMouseDown(event) {
    if (this.state === INTERACTION_STATES.STORY || this._isTransitioning) return
    if (!this.physicsManager) return

    // Store screen start for drag threshold
    this.dragStart.x = event.clientX
    this.dragStart.y = event.clientY
    this.dragMoved = false

    // Check what plane is under cursor
    const hit = this.physicsManager.getPlaneAtScreenPos(event.clientX, event.clientY)
    if (hit) {
      this.dragPlane = hit.plane

      // Compute offset from plane center to grab point in world space
      const worldPos = this.physicsManager.screenToWorld(event.clientX, event.clientY)
      this.dragOffset.x = this.dragPlane.mesh.position.x - worldPos.x
      this.dragOffset.y = this.dragPlane.mesh.position.y - worldPos.y
      this.lastDragWorld.x = worldPos.x
      this.lastDragWorld.y = worldPos.y
      this.prevDragWorld.x = worldPos.x
      this.prevDragWorld.y = worldPos.y

      // Bring to front immediately
      this.physicsManager.bringToFront(this.dragPlane)
      this.dragPlane.isDragging = true
      this.dragPlane.velocity.x = 0
      this.dragPlane.velocity.y = 0
    }
  }

  _onMouseMove(event) {
    // Normalized device coordinates (for raycaster)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    // Normalized 0-1 range
    this.normalizedMouse.x = event.clientX / window.innerWidth - 0.5
    this.normalizedMouse.y = event.clientY / window.innerHeight - 0.5

    // Handle active drag
    if (this.dragPlane && this.physicsManager) {
      const dx = event.clientX - this.dragStart.x
      const dy = event.clientY - this.dragStart.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > DRAG_THRESHOLD) {
        this.dragMoved = true
      }

      if (this.dragMoved) {
        // Convert to world coordinates
        const worldPos = this.physicsManager.screenToWorld(event.clientX, event.clientY)

        // Store previous for velocity calculation
        this.prevDragWorld.x = this.lastDragWorld.x
        this.prevDragWorld.y = this.lastDragWorld.y
        this.lastDragWorld.x = worldPos.x
        this.lastDragWorld.y = worldPos.y

        // Move plane to cursor + offset
        this.physicsManager.setPosition(
          this.dragPlane,
          worldPos.x + this.dragOffset.x,
          worldPos.y + this.dragOffset.y
        )

        // Push overlapping planes aside
        this.physicsManager.pushOverlapping(this.dragPlane)

        // Enter DRAGGING state if not already
        if (this.state !== INTERACTION_STATES.DRAGGING) {
          // Clear any hover state (fade loupe, restore z)
          if (this.hoveredPlane) {
            this.hoveredPlane.animateReveal(0, 0.3)
            this.hoveredPlane.animateHover(0, 0.3)
            this.hoveredPlane.restoreZ()
            this.hoveredPlane = null
          }
          this._setState(INTERACTION_STATES.DRAGGING)
        }

        return // Skip hover check during drag
      }
    }

    // Hover detection — only when not dragging and not in story mode
    if (
      !this.dragMoved &&
      !this._isTransitioning &&
      (this.state === INTERACTION_STATES.BROWSING ||
        this.state === INTERACTION_STATES.HOVERING)
    ) {
      this._checkHover()
    }
  }

  _onMouseUp(event) {
    if (!this.dragPlane) return

    if (this.dragMoved) {
      // Release with momentum — use last movement as velocity impulse
      const vx = (this.lastDragWorld.x - this.prevDragWorld.x) * 1.2
      const vy = (this.lastDragWorld.y - this.prevDragWorld.y) * 1.2
      this.dragPlane.velocity.x = vx
      this.dragPlane.velocity.y = vy
      this.dragPlane.isDragging = false
      this.dragPlane = null
      this.isDragging = false
      this._setState(INTERACTION_STATES.BROWSING)
    } else {
      // No drag — treat as click
      this.dragPlane.isDragging = false
      const clickedPlane = this.dragPlane
      this.dragPlane = null
      this.isDragging = false

      // Enter story for the clicked plane
      if (this.hoveredPlane === clickedPlane || clickedPlane) {
        if (this.hoveredPlane !== clickedPlane) {
          if (this.hoveredPlane) {
            this.hoveredPlane.animateReveal(0, 0.3)
            this.hoveredPlane.animateHover(0, 0.3)
            this.hoveredPlane.restoreZ()
          }
          this.hoveredPlane = clickedPlane
        }
        this._enterStory(clickedPlane)
      }
    }
  }

  _endDrag() {
    if (this.dragPlane) {
      this.dragPlane.isDragging = false
      this.dragPlane = null
    }
    this.isDragging = false
    this.dragMoved = false
  }

  // ─── Touch handlers — press-and-hold loupe, tap to enter story ──

  _onTouchStart(event) {
    if (this.state === INTERACTION_STATES.STORY || this._isTransitioning) return
    if (!this.physicsManager || event.touches.length !== 1) return

    const touch = event.touches[0]
    this._touchStartPos.x = touch.clientX
    this._touchStartPos.y = touch.clientY
    this.dragMoved = false
    this._swipeDetected = false

    // Check if touching a plane
    const hit = this.physicsManager.getPlaneAtScreenPos(touch.clientX, touch.clientY)
    if (!hit) {
      this._touchPlane = null
      return
    }

    this._touchPlane = hit.plane
    this._touchStartUV = hit.uv || null

    // In carousel mode: skip drag setup, only allow loupe + swipe + tap
    const carousel = this.carouselRef?.current
    if (carousel?.isMobile) {
      clearTimeout(this._touchLoupeTimer)
      this._touchLoupeTimer = setTimeout(() => {
        if (!this._touchPlane || this.dragMoved || this._swipeDetected) return
        this._touchLoupeActive = true
        this._touchPlane.animateReveal(1.0, 1.5)
        this._touchPlane.animateHover(1)
        if (this._touchStartUV) this._touchPlane.update(null, this._touchStartUV)
      }, 400)
      return
    }

    // Desktop / non-carousel: set up drag offset
    this.dragPlane = hit.plane
    const worldPos = this.physicsManager.screenToWorld(touch.clientX, touch.clientY)
    this.dragOffset.x = this.dragPlane.mesh.position.x - worldPos.x
    this.dragOffset.y = this.dragPlane.mesh.position.y - worldPos.y
    this.lastDragWorld.x = worldPos.x
    this.lastDragWorld.y = worldPos.y
    this.prevDragWorld.x = worldPos.x
    this.prevDragWorld.y = worldPos.y
    this.physicsManager.bringToFront(this.dragPlane)
    this.dragPlane.isDragging = true
    this.dragPlane.velocity.x = 0
    this.dragPlane.velocity.y = 0

    // Start press-and-hold timer — after 400ms, activate loupe
    clearTimeout(this._touchLoupeTimer)
    this._touchLoupeTimer = setTimeout(() => {
      if (!this._touchPlane || this.dragMoved) return
      this._touchLoupeActive = true
      this._touchPlane.animateReveal(1.0, 1.5)
      this._touchPlane.animateHover(1)
      if (this._touchStartUV) this._touchPlane.update(null, this._touchStartUV)
    }, 400)
  }

  _onTouchMove(event) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]

    const dx = touch.clientX - this._touchStartPos.x
    const dy = touch.clientY - this._touchStartPos.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (this._touchLoupeActive) {
      // Loupe mode — move the reveal circle with the finger
      event.preventDefault()
      if (this._touchPlane) {
        const uv = this.physicsManager.getUVAtScreenPos(this._touchPlane, touch.clientX, touch.clientY)
        if (uv) this._touchPlane.update(null, uv)
      }
      return
    }

    // Carousel mode: detect horizontal swipe
    const carousel = this.carouselRef?.current
    if (carousel?.isMobile && dist > DRAG_THRESHOLD) {
      clearTimeout(this._touchLoupeTimer)

      if (!this._swipeDetected && absDx > 50 && absDx > absDy * 1.5) {
        this._swipeDetected = true
        event.preventDefault()
        const direction = dx < 0 ? 1 : -1 // swipe left = next
        if (this.navigateCarousel) {
          this.navigateCarousel(direction)
        }
      }
      return
    }

    // Non-carousel: standard drag detection
    if (!this._touchPlane) return

    if (dist > DRAG_THRESHOLD) {
      this.dragMoved = true
      clearTimeout(this._touchLoupeTimer)
    }

    if (this.dragMoved && this.dragPlane && this.physicsManager) {
      const worldPos = this.physicsManager.screenToWorld(touch.clientX, touch.clientY)
      this.prevDragWorld.x = this.lastDragWorld.x
      this.prevDragWorld.y = this.lastDragWorld.y
      this.lastDragWorld.x = worldPos.x
      this.lastDragWorld.y = worldPos.y
      this.physicsManager.setPosition(
        this.dragPlane,
        worldPos.x + this.dragOffset.x,
        worldPos.y + this.dragOffset.y
      )
      this.physicsManager.pushOverlapping(this.dragPlane)

      if (this.state !== INTERACTION_STATES.DRAGGING) {
        this._setState(INTERACTION_STATES.DRAGGING)
      }
    }
  }

  _onTouchEnd() {
    clearTimeout(this._touchLoupeTimer)

    if (this._touchLoupeActive) {
      // Was using loupe — just dismiss it, don't enter story
      this._endTouchLoupe()
      this._endDrag()
      return
    }

    // Carousel swipe was handled in touchMove — just clean up
    if (this._swipeDetected) {
      this._swipeDetected = false
      this._endDrag()
      this._touchPlane = null
      return
    }

    if (this.dragMoved) {
      // Was dragging — release with momentum
      if (this.dragPlane) {
        const vx = (this.lastDragWorld.x - this.prevDragWorld.x) * 1.2
        const vy = (this.lastDragWorld.y - this.prevDragWorld.y) * 1.2
        this.dragPlane.velocity.x = vx
        this.dragPlane.velocity.y = vy
      }
      this._endDrag()
      this._setState(INTERACTION_STATES.BROWSING)
      return
    }

    // Quick tap — enter story
    const tappedPlane = this._touchPlane
    this._endDrag()
    this._touchPlane = null
    if (tappedPlane) {
      this.hoveredPlane = tappedPlane
      this._enterStory(tappedPlane)
    }
  }

  _endTouchLoupe() {
    clearTimeout(this._touchLoupeTimer)
    if (this._touchLoupeActive && this._touchPlane) {
      this._touchPlane.animateReveal(0, 0.6)
      this._touchPlane.animateHover(0, 0.6)
      this._touchPlane.restoreZ()
    }
    this._touchLoupeActive = false
    this._touchPlane = null
  }

  _onKeyDown(event) {
    if (event.key === 'Escape' && this.state === INTERACTION_STATES.STORY) {
      // Dispatch event so App.jsx can trigger the proper two-phase close
      // (which keeps the StoryPanel mounted during its exit animation)
      window.dispatchEvent(new CustomEvent('unstill:requestCloseStory'))
    }
  }

  _checkHover() {
    if (!this.physicsManager) return

    const hit = this.physicsManager.getPlaneAtScreenPos(
      (this.mouse.x + 1) / 2 * window.innerWidth,
      (1 - this.mouse.y) / 2 * window.innerHeight
    )

    if (hit) {
      const plane = hit.plane

      // Update mouse UV on the hovered plane's shader
      if (hit.uv) {
        plane.update(null, hit.uv)
      }

      if (this.hoveredPlane !== plane) {
        // Leaving previous plane — fade loupe, restore z
        if (this.hoveredPlane) {
          this.hoveredPlane.animateReveal(0, 0.6)
          this.hoveredPlane.animateHover(0, 0.6)
          this.hoveredPlane.restoreZ()
        }

        // Entering new plane — activate loupe, rise to front
        this.hoveredPlane = plane
        plane.animateReveal(1.0, 1.5)
        plane.animateHover(1)

        // Rise above all others so it's never obscured
        const maxZ = this.physicsManager.maxZIndex
        plane.riseToFront(maxZ)

        // Preload this person's video on hover (so it's ready on click)
        plane.preloadVideo()

        // Prefetch marginalia on hover (so inscriptions are instant on click)
        this._prefetchMarginalia(plane.personData)

        this._setState(INTERACTION_STATES.HOVERING)
        window.dispatchEvent(new CustomEvent('unstill:hoverStart', {
          detail: { person: plane.personData },
        }))
      }
    } else if (this.hoveredPlane) {
      // Mouse left all planes — fade loupe, restore z
      this.hoveredPlane.animateReveal(0, 0.6)
      this.hoveredPlane.animateHover(0, 0.6)
      this.hoveredPlane.restoreZ()
      this.hoveredPlane = null
      this._setState(INTERACTION_STATES.BROWSING)
      window.dispatchEvent(new CustomEvent('unstill:hoverEnd'))
    }
  }

  /**
   * Prefetch marginalia inscription lines on hover so they're
   * ready instantly when the StoryPanel opens on click.
   */
  _prefetchMarginalia(personData) {
    if (!personData || hasPrefetch(personData.id)) return

    const promise = (async () => {
      try {
        const previousNotes = getPreviousNotes(personData.id)
        const text = await generateMarginalia({
          personId: personData.id,
          personName: personData.displayName,
          age: personData.ages.join(' & '),
          charge: personData.charge,
          date: personData.date,
          location: personData.location,
          essay: personData.essay || personData.narrative,
          previousNotes,
        })
        if (!text) return null
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(-3)
        if (lines.length === 0) return null
        addNotes(personData.id, lines)
        return lines
      } catch (_) {
        return null
      }
    })()

    setPrefetch(personData.id, promise)
  }

  /**
   * Enter story mode — overlapping transition:
   * 1. Dim other mugshots + fade clicked plane
   * 2. Simultaneously mount StoryPanel (which fades itself in over 0.8s)
   *
   * The StoryPanel begins appearing at 0.2s — while the planes are still
   * dissolving — so there's never a blank screen. The overlap creates a
   * seamless handoff from archive to story.
   */
  _enterStory(plane) {
    if (this._isTransitioning) return
    this._isTransitioning = true
    this.activePlane = plane

    // Kill any existing story timeline
    if (this._storyTimeline) {
      this._storyTimeline.kill()
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this._isTransitioning = false
      },
    })
    this._storyTimeline = tl

    // Track which planes are visible so exitStory only restores this group
    this._storyGroupPlanes = this.planes.filter((p) => p.mesh.visible)

    // Mount StoryPanel immediately — it handles the visual transition.
    // The panel's dark background IS the dimming of the archive.
    tl.add(() => {
      this._setState(INTERACTION_STATES.STORY)
    }, 0)

    // Fade the planes out underneath the panel (cleanup, not the visual transition)
    this._storyGroupPlanes.forEach((p) => {
      p.dim(0.0, 0.6)
    })
  }

  /**
   * Exit story mode — overlapping restoration:
   * Called *before* StoryPanel has fully faded out, so the archive planes
   * materialize underneath the dissolving panel. No blank screen.
   */
  exitStory() {
    if (!this.activePlane || this._isTransitioning) return
    this._isTransitioning = true

    const plane = this.activePlane

    // Kill any existing story timeline
    if (this._storyTimeline) {
      this._storyTimeline.kill()
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this._isTransitioning = false
        this.activePlane = null
        this.hoveredPlane = null
      },
    })
    this._storyTimeline = tl

    // Reset hover state on the clicked plane (loupe, etc.)
    plane.animateReveal(0, 0.3)
    plane.animateHover(0, 0.3)
    plane.restoreZ()

    // Start restoring only the group's planes — they fade in underneath
    // the dissolving StoryPanel (which takes 0.7s to exit)
    tl.add(() => {
      const groupPlanes = this._storyGroupPlanes || this.planes
      groupPlanes.forEach((p) => {
        p.restore(0.9) // gentle emergence under dissolving panel
      })
      this._storyGroupPlanes = null
    }, 0.1)

    // Return to browsing after planes have begun materializing
    tl.add(() => {
      this._setState(INTERACTION_STATES.BROWSING)
    }, 0.3)
  }

  /**
   * Navigate to a connected person's story (lateral transition).
   * The StoryPanel handles its own video/content — we just update tracking.
   */
  navigateToConnection(personId) {
    const targetPlane = this.planes.find((p) => p.id === personId)
    if (!targetPlane) return

    this.activePlane = targetPlane
  }

  _setState(newState) {
    if (this.state === newState) return
    const prevState = this.state
    this.state = newState
    this.onStateChange(newState, prevState, this.activePlane)
  }

  getActivePerson() {
    return this.activePlane ? this.activePlane.personData : null
  }

  dispose() {
    this.disable()
    if (this._storyTimeline) {
      this._storyTimeline.kill()
    }
    this.planes = []
  }
}

export default InteractionManager
