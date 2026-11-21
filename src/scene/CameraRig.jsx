import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { getMap } from '../game/maps'

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt))
const look = new THREE.Vector3()
const shake = new THREE.Vector3()

/**
 * Spherical camera around the runner. Every mode is just a different target
 * (angle / radius / height / look point / fov) and damping handles the cinematic moves:
 * the opening crane shot, menu framings, the sweep behind the runner on Play and the chase cam.
 */
export default function CameraRig() {
  const size = useThree((s) => s.size)
  const c = useRef({ theta: 3.55, radius: 38, height: 21, look: new THREE.Vector3(0, 3, -12), fov: 42, y: 0, standY: 0 }).current

  useFrame((state, delta) => {
    const cam = state.camera
    const dt = Math.min(delta, 1 / 20)
    const { phase, screen, profile } = useGame.getState()
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
    let side = 0
    let followY = 0

    if (phase === 'intro' || phase === 'menu') {
      const intro = phase === 'intro'
      k = intro ? 0.75 : 1.5
      if (screen === 'shop') {
        theta = 2.3 + Math.sin(t * 0.2) * 0.05
        radius = portrait ? 5.2 : 3.5
        height = portrait ? 1.7 : 1.3
        look.set(0, portrait ? 0.35 : 0.95, 0)
        fov = portrait ? 52 : 36
        side = portrait ? 0 : Math.min(1.25, (aspect - 1) * 1.8)
      } else if (screen === 'maps') {
        // high establishing shot down the line so the whole environment reads
        theta = 0.5 + Math.sin(t * 0.1) * 0.08
        radius = portrait ? 20 : 16
        height = portrait ? 16 : 12.5
        look.set(portrait ? 0 : -6, 1, -40)
        fov = portrait ? 62 : 50
      } else if (screen === 'missions' || screen === 'settings') {
        theta = 2.85
        radius = portrait ? 6.4 : 4.6
        height = portrait ? 2.1 : 1.55
        look.set(0, portrait ? 0.3 : 1.0, 0)
        fov = portrait ? 54 : 38
        side = portrait ? 0 : Math.min(1.4, (aspect - 1) * 1.9)
      } else {
        theta = 2.45 + (intro ? 0 : Math.sin(t * 0.16) * 0.12)
        radius = portrait ? 7.4 : 4.7
        height = portrait ? 2.9 : 1.45
        look.set(0, portrait ? -1.1 : 1.05, 0)
        fov = portrait ? 56 : 36
        side = portrait ? 0 : Math.min(1.25, (aspect - 1) * 1.1)
      }
    } else if (phase === 'gameover') {
      const caught = runtime.crashKind === 'caught'
      theta = (caught ? 2.3 : 0.62) + Math.sin(t * 0.1) * 0.2
      radius = portrait ? 8.5 : caught ? 5.6 : 7.2
      height = portrait ? 4.2 : caught ? 2.4 : 3.6
      look.set(p.x, caught ? 1.0 : 0.4, caught ? 0.6 : 0.4)
      fov = portrait ? 60 : 46
      k = 1.1
      followY = p.y
    } else {
      const speedK = THREE.MathUtils.smoothstep(runtime.speed, 15, 38)
      const jet = runtime.power.jetpack > 0
      theta = 0
      radius = (portrait ? 7.6 : 6.6) + (jet ? 1.5 : 0)
      height = (portrait ? 3.8 : 3.15) + (jet ? 1.2 : 0)
      follow = 0.55
      if (p.grounded || jet) c.standY = p.y
      followY = (jet ? p.y : c.standY) * 0.85
      look.set(p.x * 0.6, (portrait ? 1.0 : 1.15) + followY * 0.95, -8)
      fov = (portrait ? 66 : 55) + speedK * 12 + (runtime.power.double > 0 ? 2 : 0) + (jet ? 4 : 0)
      k = 2.6
    }

    if (side) {
      look.x -= Math.cos(c.theta) * side
      look.z += Math.sin(c.theta) * side
    }

    c.theta = damp(c.theta, theta, k * 0.8, dt)
    c.radius = damp(c.radius, radius, k, dt)
    c.height = damp(c.height, height, k, dt)
    const ceiling = phase === 'playing' || phase === 'paused' ? (getMap(runtime.mapId).cameraCeiling ?? 99) - c.height : 99
    c.y = damp(c.y, Math.min(followY, ceiling), 4, dt)
    c.look.x = damp(c.look.x, look.x, k * 1.6, dt)
    c.look.y = damp(c.look.y, look.y, k * 1.2, dt)
    c.look.z = damp(c.look.z, look.z, k * 1.2, dt)
    c.fov = damp(c.fov, fov, 3, dt)

    cam.position.set(p.x * follow + Math.sin(c.theta) * c.radius, c.height + c.y, Math.cos(c.theta) * c.radius)
    if (cam.position.y < 6.5 && phase !== 'intro' && !(phase === 'menu' && screen !== 'home')) cam.position.x = THREE.MathUtils.clamp(cam.position.x, -4.3, 4.3)
    if (phase === 'playing' && !runtime.crashed && p.grounded && runtime.power.board <= 0) cam.position.y += Math.sin(p.runPhase * 2) * 0.025

    const tr = profile.settings.shake ? runtime.trauma * runtime.trauma : 0
    if (tr > 0) {
      shake
        .set(Math.sin(t * 37.1) * 0.6 + Math.sin(t * 21.3 + 1.1) * 0.4, Math.sin(t * 43.7 + 2.3) * 0.6 + Math.sin(t * 17.9) * 0.4, 0)
        .multiplyScalar(tr * 0.45)
      cam.position.add(shake)
    } else shake.set(0, 0, 0)

    cam.lookAt(c.look.x + shake.x * 0.3, c.look.y, c.look.z)
    cam.rotation.z += (tr > 0 ? Math.sin(t * 29) * tr * 0.04 : 0) - (phase === 'playing' ? p.lean * 0.0012 : 0)

    if (Math.abs(cam.fov - c.fov) > 0.01) {
      cam.fov = c.fov
      cam.updateProjectionMatrix()
    }
  }, -5)

  return null
}
