import * as THREE from 'three'

const FRICTION = 0.94
const VELOCITY_THRESHOLD = 0.0003
const PUSH_FORCE = 0.12
const EDGE_MARGIN = 0.05

class PhysicsManager {
  constructor(planes, camera) {
    this.planes = planes
    this.camera = camera
    this.raycaster = new THREE.Raycaster()
    this.maxZIndex = 1.0

    // Initialize max z from existing planes
    planes.forEach((plane) => {
      if (plane.mesh.position.z > this.maxZIndex) {
        this.maxZIndex = plane.mesh.position.z + 0.1
      }
    })
  }

  // Run one physics step — integrate velocity, apply friction, clamp to viewport
  update(dt) {
    // Cap dt to avoid huge jumps
    const cappedDt = Math.min(dt, 0.05)

    const aspect = this.camera.right // orthographic camera right = aspect

    this.planes.forEach((plane) => {
      if (plane.isDragging || !plane.mesh.visible) return

      // Skip if basically stopped
      const speed = Math.abs(plane.velocity.x) + Math.abs(plane.velocity.y)
      if (speed < VELOCITY_THRESHOLD) {
        plane.velocity.x = 0
        plane.velocity.y = 0
        return
      }

      // Integrate velocity
      plane.mesh.position.x += plane.velocity.x
      plane.mesh.position.y += plane.velocity.y

      // Apply friction
      plane.velocity.x *= FRICTION
      plane.velocity.y *= FRICTION

      // Clamp to viewport bounds
      this._clampToViewport(plane, aspect)
    })
  }

  // Keep plane within camera frustum
  _clampToViewport(plane, aspect) {
    const hw = plane.planeWidth / 2
    const hh = plane.planeHeight / 2
    const minX = -aspect + hw + EDGE_MARGIN
    const maxX = aspect - hw - EDGE_MARGIN
    const minY = -1 + hh + EDGE_MARGIN
    const maxY = 1 - hh - EDGE_MARGIN

    if (plane.mesh.position.x < minX) {
      plane.mesh.position.x = minX
      plane.velocity.x *= -0.15 // Soft bounce
    }
    if (plane.mesh.position.x > maxX) {
      plane.mesh.position.x = maxX
      plane.velocity.x *= -0.15
    }
    if (plane.mesh.position.y < minY) {
      plane.mesh.position.y = minY
      plane.velocity.y *= -0.15
    }
    if (plane.mesh.position.y > maxY) {
      plane.mesh.position.y = maxY
      plane.velocity.y *= -0.15
    }
  }

  // Apply an impulse force to a plane
  applyForce(plane, fx, fy) {
    plane.velocity.x += fx
    plane.velocity.y += fy
  }

  // Set position directly (during drag)
  setPosition(plane, x, y) {
    plane.setWorldPosition(x, y)
  }

  // Push any planes overlapping the dragged plane away from it
  pushOverlapping(draggedPlane) {
    const dragBounds = draggedPlane.getBounds()
    const dragCenterX = draggedPlane.mesh.position.x
    const dragCenterY = draggedPlane.mesh.position.y

    this.planes.forEach((plane) => {
      if (plane === draggedPlane || plane.isDragging || !plane.mesh.visible) return

      const bounds = plane.getBounds()

      // AABB overlap check
      const overlapX = Math.min(dragBounds.right, bounds.right) - Math.max(dragBounds.left, bounds.left)
      const overlapY = Math.min(dragBounds.top, bounds.top) - Math.max(dragBounds.bottom, bounds.bottom)

      if (overlapX > 0 && overlapY > 0) {
        // Compute push direction — away from dragged plane center
        const dx = plane.mesh.position.x - dragCenterX
        const dy = plane.mesh.position.y - dragCenterY
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01

        // Force proportional to overlap area
        const overlapArea = overlapX * overlapY
        const force = PUSH_FORCE * Math.min(overlapArea * 4, 1.0)

        this.applyForce(plane, (dx / dist) * force, (dy / dist) * force)
      }
    })
  }

  // Bring a plane to the front of the pile
  bringToFront(plane) {
    this.maxZIndex += 0.1
    plane.setZIndex(this.maxZIndex)
  }

  // Find the frontmost plane at a screen position using raycaster
  getPlaneAtScreenPos(screenX, screenY) {
    const mouse = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    )

    this.raycaster.setFromCamera(mouse, this.camera)
    // Only raycast against visible planes with meaningful opacity
    const activePlanes = this.planes.filter(
      (p) => p.mesh.visible && p.material.uniforms.uOpacity.value > 0.15
    )
    const meshes = activePlanes.map((p) => p.mesh)
    const intersects = this.raycaster.intersectObjects(meshes)

    if (intersects.length > 0) {
      // Find the hit with highest renderOrder (frontmost in pile)
      let bestHit = intersects[0]
      for (let i = 1; i < intersects.length; i++) {
        if (intersects[i].object.renderOrder > bestHit.object.renderOrder) {
          bestHit = intersects[i]
        }
      }
      const plane = activePlanes.find((p) => p.mesh === bestHit.object)
      return { plane, uv: bestHit.uv }
    }

    return null
  }

  // Get UV coordinates on a specific plane from screen position (for touch loupe)
  getUVAtScreenPos(plane, screenX, screenY) {
    const mouse = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    )
    this.raycaster.setFromCamera(mouse, this.camera)
    const intersects = this.raycaster.intersectObject(plane.mesh)
    return intersects.length > 0 ? intersects[0].uv : null
  }

  // Convert screen coords to orthographic world coords
  screenToWorld(clientX, clientY) {
    const aspect = this.camera.right
    const worldX = (clientX / window.innerWidth) * 2 * aspect - aspect
    const worldY = -(clientY / window.innerHeight) * 2 + 1
    return { x: worldX, y: worldY }
  }

  dispose() {
    this.planes = []
  }
}

export default PhysicsManager
