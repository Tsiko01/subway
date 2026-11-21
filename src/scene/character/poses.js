// Procedural animation: each function writes joint angles into a pose table.
// Poses are blended by weight in the controllers, so transitions are always smooth.
//
// Conventions (character faces -z): positive X rotation on a limb swings it forward,
// negative knee rotation bends the shin back, bodyPitch rotates the whole body around the hips.

export const JOINTS = [
  'rootYaw', 'bodyY', 'bodyZ', 'bodyPitch',
  'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY',
  'armLX', 'armLY', 'armLZ', 'armRX', 'armRY', 'armRZ', 'elbowL', 'elbowR',
  'hipLX', 'hipLZ', 'hipRX', 'hipRZ', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
]

export const makePose = () => Object.fromEntries(JOINTS.map((j) => [j, 0]))
export const copyPose = (out, src) => {
  for (const j of JOINTS) out[j] = src[j]
  return out
}
export const blendInto = (out, target, w) => {
  if (w <= 0.0005) return
  if (w >= 0.9995) return copyPose(out, target)
  for (const j of JOINTS) out[j] += (target[j] - out[j]) * w
}
const clear = (o) => {
  for (const j of JOINTS) o[j] = 0
  return o
}

export function runPose(o, phase, intensity, st) {
  clear(o)
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const swingL = Math.max(0, Math.cos(phase - 0.35))
  const swingR = Math.max(0, Math.cos(phase + Math.PI - 0.35))
  const k = intensity
  o.bodyY = st.bounce * Math.abs(s) - st.bounce * 0.45
  o.torsoX = st.lean - 0.06 * k
  o.torsoY = st.twist * s
  o.torsoZ = 0.03 * c
  o.headX = -st.lean * 0.7
  o.hipLX = 0.15 + st.stride * s * k
  o.hipRX = 0.15 - st.stride * s * k
  o.kneeL = -(0.22 + 1.35 * swingL * swingL * k)
  o.kneeR = -(0.22 + 1.35 * swingR * swingR * k)
  o.ankleL = 0.25 * Math.sin(phase - 1.1)
  o.ankleR = 0.25 * Math.sin(phase + Math.PI - 1.1)
  o.armLX = -st.arm * s * k
  o.armRX = st.arm * s * k
  o.armLZ = -0.13
  o.armRZ = 0.13
  o.elbowL = st.elbow + 0.25 * s
  o.elbowR = st.elbow - 0.25 * s
  return o
}

export function idlePose(o, t) {
  clear(o)
  const b = Math.sin(t * 1.6)
  o.bodyY = -0.01 + b * 0.008
  o.torsoX = 0.02 + b * 0.015
  o.torsoZ = Math.sin(t * 0.5) * 0.02
  o.headX = 0.02 - b * 0.01
  o.headY = Math.sin(t * 0.4) * 0.12
  o.armLZ = -0.1 - b * 0.02
  o.armRZ = 0.1 + b * 0.02
  o.armLX = 0.05
  o.armRX = 0.05
  o.elbowL = 0.18
  o.elbowR = 0.18
  o.hipLZ = -0.04
  o.hipRZ = 0.04
  o.kneeL = -0.04
  o.kneeR = -0.06
  return o
}

export function jumpPose(o, rise) {
  clear(o)
  o.torsoX = -0.12 - 0.12 * rise
  o.torsoY = -0.1
  o.headX = 0.12
  o.hipLX = 1.15 + 0.2 * rise
  o.kneeL = -1.55
  o.hipRX = -0.35 + 0.5 * (1 - rise)
  o.kneeR = -1.2 + 0.5 * (1 - rise)
  o.ankleL = 0.3
  o.ankleR = -0.4
  o.armLX = -0.9 + 0.4 * (1 - rise)
  o.armRX = 1.6 - 0.3 * (1 - rise)
  o.armLZ = -0.45
  o.armRZ = 0.3
  o.elbowL = 0.8
  o.elbowR = 1.0
  return o
}

/** Spring Sneakers: a tucked front flip over the course of the jump. */
export function flipPose(o, progress) {
  clear(o)
  const tuck = Math.sin(Math.min(1, progress) * Math.PI)
  o.bodyPitch = -Math.PI * 2 * smooth(progress)
  o.bodyY = 0.1 * tuck
  o.torsoX = -0.4 * tuck
  o.headX = -0.3 * tuck
  o.hipLX = 0.6 + 1.2 * tuck
  o.hipRX = 0.6 + 1.2 * tuck
  o.kneeL = -0.4 - 1.9 * tuck
  o.kneeR = -0.4 - 1.9 * tuck
  o.armLX = 0.6 + 0.6 * tuck
  o.armRX = 0.6 + 0.6 * tuck
  o.armLZ = -0.5
  o.armRZ = 0.5
  o.elbowL = 1.6 * tuck + 0.3
  o.elbowR = 1.6 * tuck + 0.3
  return o
}
const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export function slidePose(o, t) {
  clear(o)
  const wobble = Math.sin(t * 30) * 0.02
  o.bodyY = -0.5 + wobble
  o.bodyZ = 0.1
  o.torsoX = 0.75
  o.torsoY = 0.25
  o.torsoZ = -0.08
  o.headX = -0.5
  o.hipLX = 1.45
  o.kneeL = -0.15
  o.hipRX = 0.55
  o.kneeR = -1.95
  o.ankleL = -0.3
  o.ankleR = 0.1
  o.armLX = -0.4
  o.armLZ = -0.9
  o.armRX = 1.1
  o.armRZ = 0.55
  o.elbowL = 0.35
  o.elbowR = 0.9
  return o
}

/** Tripped: pitch forward, arms windmilling. */
export function stumblePose(o, t) {
  clear(o)
  const k = Math.sin(Math.min(1, t) * Math.PI)
  o.bodyY = -0.12 * k
  o.bodyPitch = -0.35 * k
  o.torsoX = -0.35 * k
  o.headX = 0.4 * k
  o.armLX = 1.8 * k + Math.sin(t * 22) * 0.6 * k
  o.armRX = 1.4 * k - Math.sin(t * 22) * 0.6 * k
  o.armLZ = -0.8 * k
  o.armRZ = 0.8 * k
  o.elbowL = 0.4
  o.elbowR = 0.4
  o.hipLX = 0.7 * k
  o.kneeL = -1.0 * k
  o.hipRX = -0.3 * k
  o.kneeR = -0.6 * k
  return o
}

export function crashPose(o, t) {
  clear(o)
  const flail = Math.sin(t * 14) * Math.max(0, 1 - t * 1.5)
  o.bodyY = -0.05
  o.torsoX = 0.35
  o.torsoY = 0.2
  o.torsoZ = 0.1
  o.headX = 0.35
  o.armLX = 2.5 + flail * 0.4
  o.armRX = 2.1 - flail * 0.4
  o.armLZ = -0.6
  o.armRZ = 0.7
  o.elbowL = 0.4
  o.elbowR = 0.6
  o.hipLX = 0.55
  o.kneeL = -0.7
  o.hipRX = 0.15
  o.kneeR = -0.35
  o.ankleL = 0.2
  o.ankleR = 0.1
  return o
}

/** Caught by the officer: hands up, shoulders slumped. */
export function caughtPose(o, t) {
  clear(o)
  o.bodyY = -0.02
  o.torsoX = 0.08
  o.headX = 0.25 + Math.sin(t * 2) * 0.03
  o.armLZ = -2.5
  o.armRZ = 2.5
  o.armLX = 0.2
  o.armRX = 0.2
  o.elbowL = 1.3
  o.elbowR = 1.3
  o.kneeL = -0.08
  o.kneeR = -0.08
  return o
}

/** Skateboard stance: body sideways, knees bent, arms out for balance. */
export function boardPose(o, t, air, lean) {
  clear(o)
  const sway = Math.sin(t * 2.2) * 0.05
  const crouch = air > 0 ? 0.35 + air * 0.4 : 0.25
  o.rootYaw = 1.2
  o.bodyY = -0.12 - crouch * 0.25
  o.torsoX = -0.18 - crouch * 0.4
  o.torsoZ = sway + lean * 0.04
  o.headY = -1.05
  o.headX = 0.1
  o.hipLZ = -0.28
  o.hipRZ = 0.28
  o.hipLX = 0.35 + crouch * 0.9
  o.hipRX = 0.35 + crouch * 0.9
  o.kneeL = -0.65 - crouch * 1.4
  o.kneeR = -0.65 - crouch * 1.4
  o.ankleL = 0.3 + crouch * 0.4
  o.ankleR = 0.3 + crouch * 0.4
  o.armLZ = -1.05 + sway
  o.armRZ = 0.95 + sway
  o.armLX = 0.25
  o.armRX = -0.15
  o.elbowL = 0.35
  o.elbowR = 0.3
  return o
}

/** Jetpack flight: body laid forward, legs trailing, arms gripping the straps. */
export function jetPose(o, t) {
  clear(o)
  const s = Math.sin(t * 3)
  o.bodyPitch = -1.0
  o.bodyY = 0.05
  o.headX = 0.85
  o.hipLX = -0.15 + s * 0.12
  o.hipRX = -0.25 - s * 0.12
  o.kneeL = -0.5 - s * 0.15
  o.kneeR = -0.4 + s * 0.15
  o.ankleL = -0.4
  o.ankleR = -0.4
  o.armLX = 0.55
  o.armRX = 0.55
  o.armLZ = -0.35
  o.armRZ = 0.35
  o.elbowL = 1.7
  o.elbowR = 1.7
  return o
}

/** Short celebratory moves shown when a skin is previewed or equipped. */
export function emotePose(o, name, t) {
  idlePose(o, t)
  const w = Math.sin(t * 10)
  switch (name) {
    case 'wave':
      o.armRZ = 2.6 + w * 0.25
      o.armRX = 0.2
      o.elbowR = 0.5 + w * 0.3
      o.headY = 0.2
      o.torsoZ = -0.05
      break
    case 'flex':
      o.armLX = 1.4
      o.armRX = 1.4
      o.armLZ = -0.75
      o.armRZ = 0.75
      o.elbowL = 2.1 + Math.sin(t * 6) * 0.1
      o.elbowR = 2.1 - Math.sin(t * 6) * 0.1
      o.torsoX = -0.08
      o.bodyY = -0.05
      o.kneeL = -0.2
      o.kneeR = -0.2
      o.hipLZ = -0.12
      o.hipRZ = 0.12
      break
    case 'salute':
      o.armRX = 2.0
      o.armRZ = 0.95
      o.elbowR = 2.35
      o.torsoX = -0.04
      o.headX = -0.05
      break
    case 'spin':
      o.rootYaw = Math.min(1, t / 0.9) * Math.PI * 2
      o.armLZ = -1.3
      o.armRZ = 1.3
      o.elbowL = 0.2
      o.elbowR = 0.2
      o.bodyY = 0.04 * Math.sin(t * 7)
      break
    case 'fistpump':
      o.armRX = 2.7 + Math.max(0, w) * 0.3
      o.armRZ = 0.3
      o.elbowR = 0.6 + Math.max(0, w) * 0.9
      o.armLX = 0.4
      o.elbowL = 1.2
      o.bodyY = -0.03 + Math.max(0, w) * 0.03
      break
    case 'stretch':
      o.armLX = 3.0
      o.armRX = 3.0
      o.armLZ = -0.2
      o.armRZ = 0.2
      o.elbowL = 0.2
      o.elbowR = 0.2
      o.torsoZ = Math.sin(t * 2) * 0.22
      break
    case 'peace':
      o.armRX = 1.9
      o.armRZ = 0.25
      o.elbowR = 1.3
      o.torsoZ = -0.08
      o.headX = -0.06
      o.headY = 0.1
      o.hipRZ = 0.12
      o.kneeL = -0.15
      break
    default:
      break
  }
  return o
}

// ---------------------------------------------------------------- officer actions (applied on top of a run/idle)
export function officerAction(o, action, t) {
  switch (action) {
    case 'whistle':
      o.armRX = 2.3
      o.armRZ = 0.35
      o.elbowR = 2.45
      o.headX = -0.05
      break
    case 'point':
      o.armRX = 1.65
      o.armRZ = 0.12
      o.elbowR = 0.08
      break
    case 'grab':
      o.armLX = 1.45
      o.armRX = 1.45
      o.armLZ = -0.12
      o.armRZ = 0.12
      o.elbowL = 0.35
      o.elbowR = 0.35
      o.torsoX = -0.18
      break
    case 'hips':
      o.armLZ = -0.75
      o.armRZ = 0.75
      o.armLX = -0.25
      o.armRX = -0.25
      o.elbowL = 1.9
      o.elbowR = 1.9
      o.armLY = 0.6
      o.armRY = -0.6
      o.headY = Math.sin(t * 5) * 0.35 * Math.max(0, Math.sin(t * 0.7))
      break
    default:
      break
  }
  return o
}
