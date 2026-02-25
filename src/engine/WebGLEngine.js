import * as THREE from 'three'

class WebGLEngine {
  constructor() {
    this.scene = new THREE.Scene()

    // Orthographic camera — 2D planes, no perspective
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1,
      -1,
      0.1,
      100
    )
    this.camera.position.z = 5

    // Transparent renderer — HTML shows through
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x000000, 0)

    this.canvas = this.renderer.domElement
    this.canvas.classList.add('webgl-canvas')

    this._onResize = this._onResize.bind(this)
    window.addEventListener('resize', this._onResize)
  }

  _onResize() {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height

    this.camera.left = -aspect
    this.camera.right = aspect
    this.camera.top = 1
    this.camera.bottom = -1
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  mount(container) {
    container.appendChild(this.canvas)
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
    this.renderer.dispose()
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
  }
}

export default WebGLEngine
