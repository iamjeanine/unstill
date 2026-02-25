import * as THREE from 'three'
import gsap from 'gsap'
import mugshotVertexShader from '../shaders/mugshot/vertex.glsl'
import mugshotFragmentShader from '../shaders/mugshot/fragment.glsl'

// Generate a placeholder texture via Canvas2D
function createPlaceholderTexture(width, height, label, caseNumber) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Dark grey background
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, width, height)

  // Add noise/grain for archival texture
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 25
    data[i] += noise
    data[i + 1] += noise
    data[i + 2] += noise
  }
  ctx.putImageData(imageData, 0, 0)

  // Subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(4, 4, width - 8, height - 8)

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.font = `${Math.round(height * 0.03)}px "DM Sans", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, height / 2 - 12)
  if (caseNumber) {
    ctx.font = `${Math.round(height * 0.024)}px "DM Sans", sans-serif`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillText(caseNumber, width / 2, height / 2 + 14)
  }

  return new THREE.CanvasTexture(canvas)
}

class MugshotPlane {
  constructor({ personData, viewportScale = 1 }) {
    this.personData = personData
    this.id = personData.id

    const { width, height } = personData.dimensions
    const layout = personData.layout

    // Scale dimensions to fit in orthographic camera space
    // Larger base scale — fills more viewport, each photo is substantial
    const planeHeight = 0.55 * (layout.scale || 1) * viewportScale
    const planeWidth = planeHeight * (width / height)

    // Store plane dimensions for physics bounds
    this.planeWidth = planeWidth
    this.planeHeight = planeHeight

    this.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 32, 32)

    // Load texture (placeholder or real)
    const hasRealImage = personData.images && personData.images.color
    const texture = hasRealImage
      ? new THREE.TextureLoader().load(personData.images.color)
      : createPlaceholderTexture(
          width,
          height,
          personData.displayName,
          personData.caseNumber
        )

    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    // Store the original still texture for restoration
    this._stillTexture = texture

    // Video state
    this._videoElement = null
    this._videoTexture = null
    this._isPlayingVideo = false

    this.material = new THREE.ShaderMaterial({
      vertexShader: mugshotVertexShader,
      fragmentShader: mugshotFragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uRevealProgress: { value: 0.0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseRadius: { value: 0.25 },
        uMagnification: { value: 2.5 },
        uTime: { value: 0.0 },
        uNoiseScale: { value: 4.0 },
        uEdgeSoftness: { value: 0.08 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uOpacity: { value: 0.0 },
        uHoverIntensity: { value: 0.0 },
        uParallaxOffset: { value: new THREE.Vector2(0, 0) },
        uUvCrop: { value: new THREE.Vector4(
          ...(personData.uvCrop || [0, 0, 1, 1])
        ) },
      },
      transparent: true,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)

    // Position in scene — spread across viewport
    // Tighter multipliers (1.2, 1.0) for larger editorial planes
    const aspect = window.innerWidth / window.innerHeight
    this.basePosition = {
      x: layout.x * aspect * 1.2,
      y: layout.y * 1.0,
      z: layout.z || 0,
    }
    this.mesh.position.set(
      this.basePosition.x,
      this.basePosition.y,
      this.basePosition.z
    )
    this.mesh.rotation.z = ((layout.rotation || 0) * Math.PI) / 180

    // Set render order based on z (higher z = rendered on top)
    this.mesh.renderOrder = Math.round((layout.z || 0) * 100)

    // Store base scale for hover animation
    this.baseScale = 1.0
    this.mesh.scale.set(1, 1, 1)

    // Physics properties
    this.velocity = { x: 0, y: 0 }
    this.isDragging = false

    // Track saved z for hover restore
    this._savedZ = null
    this._savedRenderOrder = null

    // Story animation state — saved position/rotation for restoration
    this._savedStoryState = null
  }

  update(time, mouseUV) {
    if (time !== null) {
      this.material.uniforms.uTime.value = time
    }
    if (mouseUV) {
      this.material.uniforms.uMouse.value.copy(mouseUV)
    }
    // Keep video texture updated
    if (this._videoTexture && this._isPlayingVideo) {
      this._videoTexture.needsUpdate = true
    }
  }

  // --- Video crossfade methods ---

  /**
   * Preload the VEO3 animation video element (doesn't play yet)
   */
  preloadVideo() {
    if (this._videoElement || !this.personData.animation) return

    const video = document.createElement('video')
    video.src = this.personData.animation
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.load()

    this._videoElement = video
  }

  /**
   * Start playing the VEO3 animation — crossfade from still to video texture.
   * Returns a promise that resolves when the video is playing.
   */
  startVideo() {
    return new Promise((resolve) => {
      if (!this.personData.animation) {
        resolve()
        return
      }

      // Preload if not already
      if (!this._videoElement) {
        this.preloadVideo()
      }

      const video = this._videoElement

      const onCanPlay = () => {
        video.removeEventListener('canplaythrough', onCanPlay)

        // Create VideoTexture
        const videoTexture = new THREE.VideoTexture(video)
        videoTexture.minFilter = THREE.LinearFilter
        videoTexture.magFilter = THREE.LinearFilter
        videoTexture.format = THREE.RGBAFormat
        this._videoTexture = videoTexture

        // Play the video
        video.play().then(() => {
          // Swap the texture on the shader
          this.material.uniforms.uTexture.value = videoTexture
          this._isPlayingVideo = true
          resolve()
        }).catch(() => {
          // Autoplay blocked — still resolve, just stay on still
          resolve()
        })
      }

      if (video.readyState >= 4) {
        onCanPlay()
      } else {
        video.addEventListener('canplaythrough', onCanPlay)
        // Fallback timeout — don't block the transition forever
        setTimeout(() => {
          video.removeEventListener('canplaythrough', onCanPlay)
          if (!this._isPlayingVideo) {
            onCanPlay()
          }
        }, 3000)
      }
    })
  }

  /**
   * Stop the video and crossfade back to the still texture.
   */
  stopVideo() {
    if (this._videoElement) {
      this._videoElement.pause()
      this._videoElement.currentTime = 0
    }
    this._isPlayingVideo = false

    // Restore the still texture
    this.material.uniforms.uTexture.value = this._stillTexture
  }

  // --- Story transition animation methods ---

  /**
   * Animate the mugshot into "story mode" — lift, center, straighten, enlarge.
   * Saves current state for restoration.
   */
  animateToStory() {
    // Save current state
    this._savedStoryState = {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
      rotation: this.mesh.rotation.z,
      scaleX: this.mesh.scale.x,
      scaleY: this.mesh.scale.y,
      renderOrder: this.mesh.renderOrder,
    }

    // Bring to absolute front
    this.mesh.renderOrder = 999

    const tl = gsap.timeline()

    // Lift, center, straighten, and scale up
    tl.to(this.mesh.position, {
      x: 0,
      y: 0.25, // Upper portion of screen
      z: 10,
      duration: 1.0,
      ease: 'power3.inOut',
    }, 0)

    tl.to(this.mesh.rotation, {
      z: 0, // Straighten
      duration: 1.0,
      ease: 'power3.inOut',
    }, 0)

    tl.to(this.mesh.scale, {
      x: 1.6,
      y: 1.6,
      duration: 1.0,
      ease: 'power3.inOut',
    }, 0)

    // Ensure full reveal (full color, no B&W)
    tl.to(this.material.uniforms.uRevealProgress, {
      value: 1.0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0)

    // Disable loupe magnification — show straight color
    tl.to(this.material.uniforms.uMagnification, {
      value: 1.0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0)

    tl.to(this.material.uniforms.uMouseRadius, {
      value: 5.0, // Large enough to cover entire image
      duration: 0.6,
      ease: 'power2.out',
    }, 0)

    return tl
  }

  /**
   * Animate back from story mode to the saved archive position.
   */
  animateFromStory() {
    if (!this._savedStoryState) return gsap.timeline()

    const saved = this._savedStoryState
    const tl = gsap.timeline()

    tl.to(this.mesh.position, {
      x: saved.x,
      y: saved.y,
      z: saved.z,
      duration: 0.9,
      ease: 'power3.inOut',
    }, 0)

    tl.to(this.mesh.rotation, {
      z: saved.rotation,
      duration: 0.9,
      ease: 'power3.inOut',
    }, 0)

    tl.to(this.mesh.scale, {
      x: saved.scaleX,
      y: saved.scaleY,
      duration: 0.9,
      ease: 'power3.inOut',
    }, 0)

    // Restore loupe settings
    tl.to(this.material.uniforms.uRevealProgress, {
      value: 0,
      duration: 0.6,
      ease: 'power2.in',
    }, 0.2)

    tl.to(this.material.uniforms.uMagnification, {
      value: 2.5,
      duration: 0.6,
      ease: 'power2.in',
    }, 0.2)

    tl.to(this.material.uniforms.uMouseRadius, {
      value: 0.25,
      duration: 0.6,
      ease: 'power2.in',
    }, 0.2)

    tl.add(() => {
      this.mesh.renderOrder = saved.renderOrder
      this._savedStoryState = null
    })

    return tl
  }

  // Set world position directly (used by physics and dragging)
  setWorldPosition(x, y) {
    this.mesh.position.x = x
    this.mesh.position.y = y
  }

  // Set z-index for stacking order
  setZIndex(z) {
    this.mesh.position.z = z
    this.mesh.renderOrder = Math.round(z * 100)
  }

  // Get AABB bounds from current mesh position and dimensions (accounting for current scale)
  getBounds() {
    const scale = this.mesh.scale.x
    const hw = (this.planeWidth * scale) / 2
    const hh = (this.planeHeight * scale) / 2
    return {
      left: this.mesh.position.x - hw,
      right: this.mesh.position.x + hw,
      top: this.mesh.position.y + hh,
      bottom: this.mesh.position.y - hh,
    }
  }

  // Rise to front on hover (save previous z to restore later)
  riseToFront(maxZ) {
    this._savedZ = this.mesh.position.z
    this._savedRenderOrder = this.mesh.renderOrder
    this.setZIndex(maxZ + 0.5)
  }

  // Restore z after hover
  restoreZ() {
    if (this._savedZ !== null) {
      this.setZIndex(this._savedZ)
      this._savedZ = null
      this._savedRenderOrder = null
    }
  }

  animateReveal(progress, duration = 1.2) {
    gsap.to(this.material.uniforms.uRevealProgress, {
      value: progress,
      duration,
      ease: 'power2.out',
    })
  }

  animateHover(intensity, duration = 0.4) {
    gsap.to(this.material.uniforms.uHoverIntensity, {
      value: intensity,
      duration,
      ease: intensity > 0 ? 'power2.out' : 'power2.in',
    })
  }

  fadeIn(delay = 0) {
    // Kill any running opacity tween to prevent race conditions
    gsap.killTweensOf(this.material.uniforms.uOpacity)
    this.mesh.visible = true
    // Reset position immediately so planes always start from their layout spot
    this.mesh.position.x = this.basePosition.x
    this.mesh.position.y = this.basePosition.y
    this.velocity.x = 0
    this.velocity.y = 0
    gsap.to(this.material.uniforms.uOpacity, {
      value: 1,
      duration: 1.2,
      delay,
      ease: 'power2.out',
    })
  }

  fadeOut(duration = 0.6) {
    // Kill any running opacity tween to prevent race conditions
    gsap.killTweensOf(this.material.uniforms.uOpacity)
    gsap.to(this.material.uniforms.uOpacity, {
      value: 0,
      duration,
      ease: 'power2.in',
      onComplete: () => {
        this.mesh.visible = false
        // Reset to base position — clears any drag displacement
        this.mesh.position.x = this.basePosition.x
        this.mesh.position.y = this.basePosition.y
        this.velocity.x = 0
        this.velocity.y = 0
      },
    })
  }

  dim(opacity = 0.1, duration = 0.6) {
    gsap.to(this.material.uniforms.uOpacity, {
      value: opacity,
      duration,
      ease: 'power2.out',
    })
  }

  restore(duration = 0.6) {
    gsap.to(this.material.uniforms.uOpacity, {
      value: 1,
      duration,
      ease: 'power2.out',
    })
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    if (this._stillTexture) {
      this._stillTexture.dispose()
    }
    if (this._videoTexture) {
      this._videoTexture.dispose()
    }
    if (this._videoElement) {
      this._videoElement.pause()
      this._videoElement.src = ''
      this._videoElement.load()
    }
  }
}

export default MugshotPlane
