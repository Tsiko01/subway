import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt))
const look = new THREE.Vector3()
const shake = new THREE.Vector3()

/**
 * Spherical camera around the runner. Every mode is just a different target
 * (angle / radius / height / look point / fov) and damping handles the cinematic moves:
 * the opening crane shot, the hero orbit in the menu and the sweep behind the runner on Play.
 */
export default function CameraRig() {
  const size = useThree((s) => s.size)
  const c = useRef({
    theta: 3.55,
    radius: 38,
    height: 21,
    look: new THREE.Vector3(0, 3, -12),
    fov: 42,
  }).current

  useFrame((state, delta) => {
    const cam = state.camera
    const dt = Math.min(delta, 1 / 20)
    const phase = useGame.getState().phase
    const p = runtime.player
    const t = state.clock.elapsedTime
    const aspect = size.width / size.height
    const portrait = aspect < 0.85

    let theta
    let radius
    let height
    let fov
    let k
    let follow = 1
    let side = 0 // screen-space offset of the subject (menu framing)

    switch (phase) {
      case 'intro':
      case 'menu': {
        const intro = phase === 'intro'
        theta = 2.45 + (intro ? 0 : Math.sin(t * 0.16) * 0.12)
        radius = portrait ? 6.8 : 4.7
        height = portrait ? 2.3 : 1.45
        look.set(0, portrait ? 0.2 : 1.05, 0)
        fov = portrait ? 56 : 36
        k = intro ? 0.75 : 1.4
        side = portrait ? 0 : Math.min(1.25, (aspect - 1) * 1.1)
        break
      }
      case 'gameover': {
        theta = 0.62 + Math.sin(t * 0.1) * 0.2
        radius = portrait ? 8.5 : 7.2
        height = portrait ? 4.2 : 3.6
        look.set(p.x, 0.4, 0.4)
        fov = portrait ? 60 : 46
        k = 1.1
        break
      }
      default: {
        // playing / paused
        const speedK = THREE.MathUtils.smoothstep(runtime.speed, 16, 40)
        theta = 0
        radius = portrait ? 7.4 : 6.3
        height = portrait ? 3.7 : 3.05
        follow = 0.55
        look.set(p.x * 0.6, portrait ? 1.0 : 1.15, -8)
        fov = (portrait ? 66 : 55) + speedK * 13 + (runtime.boostTime > 0 ? 3 : 0)
        k = 2.6
        break
      }
    }

    if (side) {
      // shift the look point along the camera's right axis so the runner sits off-center
      look.x -= Math.cos(c.theta) * side
      look.z += Math.sin(c.theta) * side
    }

    c.theta = damp(c.theta, theta, k * 0.8, dt)
    c.radius = damp(c.radius, radius, k, dt)
    c.height = damp(c.height, height, k, dt)
    c.look.x = damp(c.look.x, look.x, k * 1.6, dt)
    c.look.y = damp(c.look.y, look.y, k * 1.2, dt)
    c.look.z = damp(c.look.z, look.z, k * 1.2, dt)
    c.fov = damp(c.fov, fov, 3, dt)

    const cx = p.x * follow
    cam.position.set(cx + Math.sin(c.theta) * c.radius, c.height, Math.cos(c.theta) * c.radius)

    // subtle running bob
    if (phase === 'playing' && !runtime.crashed && p.grounded) cam.position.y += Math.sin(p.runPhase * 2) * 0.025

    // trauma-based shake (collisions, landings)
    const tr = runtime.trauma * runtime.trauma
    if (tr > 0) {
      shake.set(
        Math.sin(t * 37.1) * 0.6 + Math.sin(t * 21.3 + 1.1) * 0.4,
        Math.sin(t * 43.7 + 2.3) * 0.6 + Math.sin(t * 17.9) * 0.4,
        0,
      ).multiplyScalar(tr * 0.45)
      cam.position.add(shake)
    }

    cam.lookAt(c.look.x + shake.x * 0.3 * (tr > 0), c.look.y, c.look.z)
    cam.rotation.z += (tr > 0 ? Math.sin(t * 29) * tr * 0.04 : 0) - (phase === 'playing' ? p.lean * 0.0012 : 0)

    if (Math.abs(cam.fov - c.fov) > 0.01) {
      cam.fov = c.fov
      cam.updateProjectionMatrix()
    }
  }, -5)

  return null
}
