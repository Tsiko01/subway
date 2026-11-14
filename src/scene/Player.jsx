import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FAST_FALL_VELOCITY,
  GRAVITY,
  JUMP_VELOCITY,
  LANES,
  LANE_SWITCH_SHARPNESS,
  SLIDE_DURATION,
} from '../game/constants'
import { fx, runtime } from '../game/runtime'
import { audio } from '../game/audio'

// ---------------------------------------------------------------- geometry
// Limb capsules pivot at their top joint and hang downward, so rotating a joint swings the limb.
const limb = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12).translate(0, -len / 2, 0)

function torsoGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.135, 0.0],
    [0.155, 0.07],
    [0.15, 0.17],
    [0.17, 0.28],
    [0.195, 0.38],
    [0.19, 0.46],
    [0.15, 0.52],
    [0.07, 0.555],
    [0.0, 0.56],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 28)
  g.scale(1.12, 1, 0.72)
  return g
}

function shoeGeometry() {
  const g = new THREE.CapsuleGeometry(0.055, 0.17, 4, 10)
  g.rotateX(Math.PI / 2)
  g.scale(1, 0.78, 1)
  return g
}

const HIP_HEIGHT = 0.93

// ---------------------------------------------------------------- poses
const JOINTS = [
  'bodyY', 'bodyZ', 'torsoX', 'torsoY', 'torsoZ', 'headX',
  'armLX', 'armLZ', 'armRX', 'armRZ', 'elbowL', 'elbowR',
  'hipLX', 'hipRX', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
]
const makePose = () => Object.fromEntries(JOINTS.map((j) => [j, 0]))
const blendInto = (out, target, w) => {
  if (w <= 0.0001) return
  for (const j of JOINTS) out[j] += (target[j] - out[j]) * w
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const damp = (current, target, k, dt) => current + (target - current) * (1 - Math.exp(-k * dt))

function runPose(out, phase, intensity) {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const swingL = Math.max(0, Math.cos(phase - 0.35))
  const swingR = Math.max(0, Math.cos(phase + Math.PI - 0.35))
  out.bodyY = 0.065 * Math.abs(s) - 0.03
  out.bodyZ = 0
  out.torsoX = -0.2 - 0.06 * intensity
  out.torsoY = 0.16 * s
  out.torsoZ = 0.03 * c
  out.headX = 0.16
  out.hipLX = 0.15 + 0.78 * s * intensity
  out.hipRX = 0.15 - 0.78 * s * intensity
  out.kneeL = -(0.22 + 1.35 * swingL * swingL * intensity)
  out.kneeR = -(0.22 + 1.35 * swingR * swingR * intensity)
  out.ankleL = 0.25 * Math.sin(phase - 1.1)
  out.ankleR = 0.25 * Math.sin(phase + Math.PI - 1.1)
  out.armLX = -0.75 * s * intensity
  out.armRX = 0.75 * s * intensity
  out.armLZ = -0.13
  out.armRZ = 0.13
  out.elbowL = 1.35 + 0.25 * s
  out.elbowR = 1.35 - 0.25 * s
}

function jumpPose(out, vy) {
  const rise = Math.max(0, Math.min(1, vy / JUMP_VELOCITY))
  out.bodyY = 0
  out.bodyZ = 0
  out.torsoX = -0.12 - 0.12 * rise
  out.torsoY = -0.1
  out.torsoZ = 0
  out.headX = 0.1
  out.hipLX = 1.15 + 0.2 * rise
  out.kneeL = -1.55
  out.hipRX = -0.35 + 0.5 * (1 - rise)
  out.kneeR = -1.2 + 0.5 * (1 - rise)
  out.ankleL = 0.3
  out.ankleR = -0.4
  out.armLX = -0.9 + 0.4 * (1 - rise)
  out.armRX = 1.6 - 0.3 * (1 - rise)
  out.armLZ = -0.45
  out.armRZ = 0.3
  out.elbowL = 0.8
  out.elbowR = 1.0
}

function slidePose(out, t) {
  const wobble = Math.sin(t * 30) * 0.02
  out.bodyY = -0.5 + wobble
  out.bodyZ = 0.1
  out.torsoX = 0.75
  out.torsoY = 0.25
  out.torsoZ = -0.08
  out.headX = -0.5
  out.hipLX = 1.45
  out.kneeL = -0.15
  out.hipRX = 0.55
  out.kneeR = -1.95
  out.ankleL = -0.3
  out.ankleR = 0.1
  out.armLX = -0.4
  out.armLZ = -0.9
  out.armRX = 1.1
  out.armRZ = 0.55
  out.elbowL = 0.35
  out.elbowR = 0.9
}

function crashPose(out, t) {
  const flail = Math.sin(t * 14) * Math.max(0, 1 - t * 1.5)
  out.bodyY = -0.05
  out.bodyZ = 0
  out.torsoX = 0.35
  out.torsoY = 0.2
  out.torsoZ = 0.1
  out.headX = 0.35
  out.armLX = 2.5 + flail * 0.4
  out.armRX = 2.1 - flail * 0.4
  out.armLZ = -0.6
  out.armRZ = 0.7
  out.elbowL = 0.4
  out.elbowR = 0.6
  out.hipLX = 0.55
  out.kneeL = -0.7
  out.hipRX = 0.15
  out.kneeR = -0.35
  out.ankleL = 0.2
  out.ankleR = 0.1
}

// ---------------------------------------------------------------- component
export default function Player() {
  const j = useRef({}).current
  const set = (key) => (el) => {
    j[key] = el
  }

  const geo = useMemo(
    () => ({
      torso: torsoGeometry(),
      pelvis: new THREE.CapsuleGeometry(0.125, 0.16, 6, 14).rotateZ(Math.PI / 2),
      neck: new THREE.CylinderGeometry(0.048, 0.056, 0.12, 12),
      head: new THREE.SphereGeometry(0.115, 28, 20),
      hair: new THREE.SphereGeometry(0.122, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      visor: new THREE.TorusGeometry(0.108, 0.02, 8, 28, Math.PI),
      ear: new THREE.SphereGeometry(0.025, 10, 8),
      upperArm: limb(0.052, 0.25),
      foreArm: limb(0.045, 0.23),
      hand: new THREE.SphereGeometry(0.05, 14, 10),
      thigh: limb(0.08, 0.38),
      shin: limb(0.062, 0.39),
      shoe: shoeGeometry(),
      sole: new THREE.BoxGeometry(0.1, 0.025, 0.27),
      stripeV: new THREE.BoxGeometry(0.012, 0.36, 0.02),
      zipper: new THREE.BoxGeometry(0.014, 0.3, 0.01),
      band: new THREE.TorusGeometry(0.058, 0.012, 6, 18),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      suit: new THREE.MeshStandardMaterial({ color: '#1b2b4d', roughness: 0.42, metalness: 0.35, envMapIntensity: 1.4 }),
      tights: new THREE.MeshStandardMaterial({ color: '#111a30', roughness: 0.38, metalness: 0.4, envMapIntensity: 1.4 }),
      skin: new THREE.MeshStandardMaterial({ color: '#c99478', roughness: 0.6, metalness: 0.0 }),
      hair: new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.75 }),
      visor: new THREE.MeshStandardMaterial({ color: '#0a0f1d', roughness: 0.05, metalness: 1, envMapIntensity: 2 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#e9edf3', roughness: 0.4, metalness: 0.1 }),
      accent: new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fb2ff').multiplyScalar(2.4), toneMapped: false }),
      silver: new THREE.MeshStandardMaterial({ color: '#d5dce8', roughness: 0.2, metalness: 1 }),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
    },
    [geo, mat],
  )

  const anim = useRef({
    pose: makePose(),
    run: makePose(),
    jump: makePose(),
    slide: makePose(),
    crash: makePose(),
    wJump: 0,
    wSlide: 0,
    wCrash: 0,
    fall: 0,
    knock: 0,
    wasGrounded: true,
    stepCount: 0,
  }).current

  useFrame((state, delta) => {
    const p = runtime.player
    const dt = runtime.dt
    const realDt = Math.min(delta, 1 / 20)
    const playing = runtime.mode === 'playing' && !runtime.crashed

    // ---------------------------------------------------------- controls
    if (playing) {
      while (runtime.actions.length) {
        const a = runtime.actions.shift()
        if (a === 'left' && p.lane > 0) {
          p.lane--
          audio.play('swoosh')
        } else if (a === 'right' && p.lane < 2) {
          p.lane++
          audio.play('swoosh')
        } else if (a === 'up') {
          if (p.grounded) doJump(p)
          else p.jumpBuffer = 0.16
        } else if (a === 'down') {
          if (p.grounded) {
            if (p.slideTime <= 0) audio.play('slide')
            p.slideTime = SLIDE_DURATION
          } else {
            p.vy = Math.min(p.vy, FAST_FALL_VELOCITY)
            p.slideQueued = true
          }
        }
      }
    } else if (!runtime.crashed && runtime.mode !== 'paused') {
      runtime.actions.length = 0
    }

    // ---------------------------------------------------------- physics
    if (dt > 0) {
      const tx = LANES[p.lane]
      const prevX = p.x
      p.x = damp(p.x, tx, LANE_SWITCH_SHARPNESS, dt)
      p.lean = damp(p.lean, (p.x - prevX) / Math.max(dt, 1e-4), 12, dt)

      if (!p.grounded) {
        p.vy += GRAVITY * dt
        p.y += p.vy * dt
        if (p.y <= 0) {
          p.y = 0
          p.vy = 0
          p.grounded = true
          if (!runtime.crashed) {
            audio.play('land')
            fx.burst({ x: p.x, y: 0.05, z: 0.1, count: 14, color: 0x9fc2ff, speed: 2.6, up: 1.2, life: 0.5, size: 0.11, gravity: -4 })
            runtime.trauma = Math.max(runtime.trauma, 0.12)
          }
          if (p.slideQueued && playing) {
            p.slideQueued = false
            p.slideTime = SLIDE_DURATION
            audio.play('slide')
          }
          if (p.jumpBuffer > 0 && playing) doJump(p)
        }
      }
      p.jumpBuffer = Math.max(0, p.jumpBuffer - dt)
      if (p.slideTime > 0) {
        p.slideTime -= dt
        if (state.clock.elapsedTime % 0.05 < realDt && runtime.speed > 5) {
          fx.burst({ x: p.x + (Math.random() - 0.5) * 0.3, y: 0.05, z: 0.3, count: 2, color: 0xbfd6ff, speed: 1.5, up: 0.8, life: 0.35, size: 0.09, gravity: -2 })
        }
      }
    }

    // ---------------------------------------------------------- animation
    const intensity = runtime.crashed ? 0 : Math.min(1.1, 0.7 + runtime.speed / 45)
    const cadence = runtime.mode === 'gameover' ? 0 : (2.5 + runtime.speed * 0.05) * Math.PI
    if (dt > 0) p.runPhase += cadence * dt

    // footstep sounds at each contact
    const step = Math.floor((p.runPhase + Math.PI / 2) / Math.PI)
    if (step !== anim.stepCount) {
      anim.stepCount = step
      if (playing && p.grounded && p.slideTime <= 0) {
        audio.play('step')
        if (Math.random() < 0.5) {
          fx.burst({ x: p.x + (step % 2 ? 0.1 : -0.1), y: 0.03, z: 0.15, count: 2, color: 0x7fb0ff, speed: 0.8, up: 0.6, life: 0.35, size: 0.07, gravity: -1 })
        }
      }
    }

    runPose(anim.run, p.runPhase, intensity)
    jumpPose(anim.jump, p.vy)
    slidePose(anim.slide, state.clock.elapsedTime)
    if (runtime.crashed || runtime.mode === 'gameover') anim.fall = Math.min(1, anim.fall + realDt * 1.8)
    else anim.fall = Math.max(0, anim.fall - realDt * 2.5)
    crashPose(anim.crash, anim.fall)

    const k = runtime.mode === 'paused' ? 0 : 16
    anim.wJump = damp(anim.wJump, p.grounded ? 0 : 1, k, realDt)
    anim.wSlide = damp(anim.wSlide, p.slideTime > 0 && p.grounded ? 1 : 0, k * 1.2, realDt)
    anim.wCrash = damp(anim.wCrash, anim.fall > 0 ? 1 : 0, 10, realDt)

    const pose = anim.pose
    Object.assign(pose, anim.run)
    blendInto(pose, anim.jump, anim.wJump)
    blendInto(pose, anim.slide, anim.wSlide)
    blendInto(pose, anim.crash, anim.wCrash)

    // ---------------------------------------------------------- apply
    const fall = smoothstep(0, 1, anim.fall)
    anim.knock = damp(anim.knock, runtime.crashed || runtime.mode === 'gameover' ? 1.1 : 0, 5, realDt)
    j.root.position.set(p.x, p.y + fall * 0.14, anim.knock)
    j.root.rotation.x = fall * 1.42
    j.root.rotation.z = THREE.MathUtils.clamp(-p.lean * 0.022, -0.3, 0.3) * (1 - fall)
    j.root.rotation.y = THREE.MathUtils.clamp(-p.lean * 0.012, -0.25, 0.25) * (1 - fall)

    j.body.position.y = HIP_HEIGHT + pose.bodyY
    j.body.position.z = pose.bodyZ
    j.torso.rotation.set(pose.torsoX, pose.torsoY, pose.torsoZ)
    j.head.rotation.x = pose.headX
    j.hips.rotation.y = -pose.torsoY * 0.5
    j.armL.rotation.set(pose.armLX, 0, pose.armLZ)
    j.armR.rotation.set(pose.armRX, 0, pose.armRZ)
    j.elbowL.rotation.x = pose.elbowL
    j.elbowR.rotation.x = pose.elbowR
    j.hipL.rotation.x = pose.hipLX
    j.hipR.rotation.x = pose.hipRX
    j.kneeL.rotation.x = pose.kneeL
    j.kneeR.rotation.x = pose.kneeR
    j.ankleL.rotation.x = pose.ankleL
    j.ankleR.rotation.x = pose.ankleR

    // boost glow on the accents
    mat.accent.color.setHex(runtime.boostTime > 0 ? 0x9fd0ff : 0x7fb2ff).multiplyScalar(runtime.boostTime > 0 ? 4 + Math.sin(state.clock.elapsedTime * 12) : 2.4)
  }, -9)

  const cast = { castShadow: true }
  const renderArm = (side) => {
    const L = side < 0
    return (
      <group key={side} ref={set(L ? 'armL' : 'armR')} position={[side * 0.215, 0.455, 0]}>
        <mesh geometry={geo.upperArm} material={mat.suit} {...cast} />
        <mesh geometry={geo.stripeV} material={mat.accent} position={[side * 0.05, -0.13, 0]} scale={[1, 0.6, 1]} />
        <group ref={set(L ? 'elbowL' : 'elbowR')} position={[0, -0.25, 0]}>
          <mesh geometry={geo.foreArm} material={mat.suit} {...cast} />
          <mesh geometry={geo.band} material={mat.silver} position={[0, -0.2, 0]} rotation-x={Math.PI / 2} />
          <mesh geometry={geo.hand} material={mat.skin} position={[0, -0.285, -0.01]} scale={[0.85, 1.15, 1]} {...cast} />
        </group>
      </group>
    )
  }
  const renderLeg = (side) => {
    const L = side < 0
    return (
      <group key={side} ref={set(L ? 'hipL' : 'hipR')} position={[side * 0.098, -0.02, 0]}>
        <mesh geometry={geo.thigh} material={mat.tights} {...cast} />
        <mesh geometry={geo.stripeV} material={mat.accent} position={[side * 0.078, -0.2, 0]} />
        <group ref={set(L ? 'kneeL' : 'kneeR')} position={[0, -0.38, 0]}>
          <mesh geometry={geo.shin} material={mat.tights} {...cast} />
          <group ref={set(L ? 'ankleL' : 'ankleR')} position={[0, -0.415, 0]}>
            <mesh geometry={geo.shoe} material={mat.shoe} position={[0, -0.035, -0.06]} {...cast} />
            <mesh geometry={geo.sole} material={mat.accent} position={[0, -0.078, -0.06]} />
          </group>
        </group>
      </group>
    )
  }

  return (
    <group ref={set('root')}>
      <group ref={set('body')} position={[0, HIP_HEIGHT, 0]}>
        <group ref={set('hips')}>
          <mesh geometry={geo.pelvis} material={mat.tights} {...cast} />
          {renderLeg(-1)}
          {renderLeg(1)}
        </group>
        <group ref={set('torso')} position={[0, 0.04, 0]}>
          <mesh geometry={geo.torso} material={mat.suit} {...cast} />
          <mesh geometry={geo.zipper} material={mat.silver} position={[0, 0.33, -0.13]} rotation-x={-0.08} />
          <mesh geometry={geo.stripeV} material={mat.accent} position={[-0.2, 0.3, 0]} scale={[1, 0.6, 1]} />
          <mesh geometry={geo.stripeV} material={mat.accent} position={[0.2, 0.3, 0]} scale={[1, 0.6, 1]} />
          <group position={[0, 0.55, 0]}>
            <mesh geometry={geo.neck} material={mat.skin} position={[0, 0.04, 0]} />
            <group ref={set('head')} position={[0, 0.17, 0]}>
              <mesh geometry={geo.head} material={mat.skin} scale={[0.9, 1.06, 0.98]} {...cast} />
              <mesh geometry={geo.hair} material={mat.hair} position={[0, 0.012, 0.01]} rotation-x={0.32} scale={[0.93, 1.02, 1.02]} />
              <mesh geometry={geo.visor} material={mat.visor} position={[0, 0.018, 0]} rotation-x={-Math.PI / 2} scale={[1.0, 1.06, 1.25]} />
              <mesh geometry={geo.visor} material={mat.accent} position={[0, 0.043, 0]} rotation-x={-Math.PI / 2} scale={[1.01, 1.07, 0.22]} />
              <mesh geometry={geo.ear} material={mat.skin} position={[-0.104, 0.0, 0.01]} />
              <mesh geometry={geo.ear} material={mat.skin} position={[0.104, 0.0, 0.01]} />
            </group>
          </group>
          {renderArm(-1)}
          {renderArm(1)}
        </group>
      </group>
    </group>
  )
}

function doJump(p) {
  p.vy = JUMP_VELOCITY
  p.grounded = false
  p.slideTime = 0
  p.jumpBuffer = 0
  p.slideQueued = false
  audio.play('jump')
}
