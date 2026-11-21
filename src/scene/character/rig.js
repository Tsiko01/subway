import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { vestTextTexture } from '../../game/textures'

// Procedural humanoid. Every outfit is assembled from primitives that are then merged per joint
// and per material, so a fully dressed character costs ~30 draw calls instead of ~120.

export const HIP_HEIGHT = 0.93

const capsule = (r, len, cap = 4, radial = 12) => new THREE.CapsuleGeometry(r, len, cap, radial)
// limb pivots at its top joint and hangs downward
const limb = (r, len) => capsule(r, len).translate(0, -len / 2, 0)
const sphere = (r, w = 16, h = 12, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open)
const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc)

function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  )
}

const TORSO_PROFILE = [
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
]
const torsoGeo = (bulk = 1, top = 0.56) =>
  lathe(TORSO_PROFILE.filter(([, y]) => y <= top).map(([x, y]) => [x * bulk, y])).scale(1.12, 1, 0.74)

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

class Materials {
  constructor() {
    this.cache = new Map()
    this.list = []
  }
  std(color, { rough = 0.6, metal = 0.05, env = 1 } = {}) {
    const key = `s|${color}|${rough}|${metal}`
    if (!this.cache.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: env })
      this.cache.set(key, m)
      this.list.push(m)
    }
    return this.cache.get(key)
  }
  glow(color, k = 2.6) {
    const key = `g|${color}|${k}`
    if (!this.cache.has(key)) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })
      m.userData.baseColor = new THREE.Color(color)
      this.cache.set(key, m)
      this.list.push(m)
    }
    return this.cache.get(key)
  }
  textured(map, key) {
    if (!this.cache.has(key)) {
      const m = new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.05 })
      this.cache.set(key, m)
      this.list.push(m)
    }
    return this.cache.get(key)
  }
  dispose() {
    this.list.forEach((m) => m.dispose())
  }
}

/**
 * Builds a character from an outfit (see catalog.js). Returns { root, joints, materials, dispose }.
 * Joint groups: root → body → hips → hipL/R → kneeL/R → ankleL/R
 *                             → torso → head, armL/R → elbowL/R
 */
export function buildCharacter(outfit, { shadows = true } = {}) {
  const o = outfit
  const H = o.body?.height ?? 1
  const B = o.body?.build ?? 1
  const mats = new Materials()

  const skinTone = o.body?.skin ?? '#c99478'
  const metalTop = o.top?.metal
  const metalBottom = o.bottom?.metal
  const skin = mats.std(skinTone, { rough: 0.55 })
  const hairM = mats.std(o.hair?.color ?? '#222', { rough: 0.7 })
  const topM = mats.std(o.top.color, metalTop ? { rough: 0.25, metal: 0.9, env: 1.6 } : { rough: 0.62 })
  const top2 = o.glow ? mats.glow(o.top.color2) : mats.std(o.top.color2, metalTop ? { rough: 0.2, metal: 0.95 } : { rough: 0.5 })
  const botM = mats.std(o.bottom.color, metalBottom ? { rough: 0.25, metal: 0.9, env: 1.6 } : { rough: 0.7 })
  const bot2 = o.glow ? mats.glow(o.bottom.color2) : mats.std(o.bottom.color2, { rough: 0.55 })
  const shoeM = mats.std(o.shoes.color, o.shoes.metal ? { rough: 0.22, metal: 0.95, env: 1.6 } : { rough: 0.45 })
  const soleM = o.glow ? mats.glow(o.shoes.sole, 2.2) : mats.std(o.shoes.sole, { rough: 0.5 })
  const accentM = o.glow ? mats.glow(o.shoes.accent ?? o.glow) : mats.std(o.shoes.accent ?? '#ffffff', { rough: 0.45 })
  const darkM = mats.std('#14161b', { rough: 0.5, metal: 0.3 })
  const silverM = mats.std('#d9dee8', { rough: 0.2, metal: 1 })
  const goldM = mats.std('#f2c14e', { rough: 0.22, metal: 1, env: 1.6 })
  const eyeWhite = mats.std('#f4f1ec', { rough: 0.3 })
  const irisM = mats.std('#1b1410', { rough: 0.2 })
  const lipM = mats.std(new THREE.Color(skinTone).multiplyScalar(0.72).getStyle(), { rough: 0.5 })
  const handM = o.extras?.includes('gloves') ? mats.std('#16171c', { rough: 0.6 }) : skin

  // ------------------------------------------------------------ skeleton
  const joints = {}
  const parts = new Map() // joint name → [{geo, mat}]
  const mk = (name, parent, pos = [0, 0, 0]) => {
    const g = new THREE.Group()
    g.position.set(...pos)
    joints[name] = g
    parent?.add(g)
    parts.set(name, [])
    return g
  }
  const root = mk('root')
  root.scale.setScalar(H)
  const body = mk('body', root, [0, HIP_HEIGHT, 0])
  const hips = mk('hips', body)
  const torso = mk('torso', body, [0, 0.04, 0])
  const head = mk('head', torso, [0, 0.72, 0])
  const sideX = 0.215 * B
  mk('armL', torso, [-sideX, 0.455, 0])
  mk('armR', torso, [sideX, 0.455, 0])
  mk('elbowL', joints.armL, [0, -0.25, 0])
  mk('elbowR', joints.armR, [0, -0.25, 0])
  mk('hipL', hips, [-0.098 * B, -0.02, 0])
  mk('hipR', hips, [0.098 * B, -0.02, 0])
  mk('kneeL', joints.hipL, [0, -0.38, 0])
  mk('kneeR', joints.hipR, [0, -0.38, 0])
  mk('ankleL', joints.kneeL, [0, -0.415, 0])
  mk('ankleR', joints.kneeR, [0, -0.415, 0])

  const add = (joint, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => {
    _p.set(...pos)
    _q.setFromEuler(_e.set(...rot))
    _s.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl))
    _m.compose(_p, _q, _s)
    geo.applyMatrix4(_m)
    parts.get(joint).push({ geo, mat })
  }
  const both = (fn) => {
    fn('L', -1)
    fn('R', 1)
  }

  // ------------------------------------------------------------ head & face
  const hairStyle = o.hair?.style ?? 'short'
  add('torso', cyl(0.048 * B, 0.058 * B, 0.14, 14), skin, [0, 0.6, 0])
  add('head', sphere(0.115, 28, 20), skin, [0, 0, 0], [0, 0, 0], [0.9, 1.06, 0.98])
  add('head', sphere(0.085, 20, 14), skin, [0, -0.055, -0.03], [0, 0, 0], [0.95, 0.8, 0.95]) // jaw
  add('head', capsule(0.016, 0.03, 4, 8), skin, [0, -0.008, -0.112], [-0.35, 0, 0]) // nose
  both((s, k) => {
    add('head', sphere(0.026, 10, 8), skin, [k * 0.104, 0, 0.01], [0, 0, 0], [0.6, 1, 0.9]) // ears
    const hideEyes = o.face?.glasses === 'visor' || o.head?.item === 'helmet'
    if (!hideEyes) {
      add('head', sphere(0.019, 12, 10), eyeWhite, [k * 0.04, 0.022, -0.095], [0, 0, 0], [1.2, 0.9, 0.6])
      add('head', sphere(0.0105, 10, 8), o.face?.glow && o.face?.mask ? mats.glow(o.face.glow, 3) : irisM, [k * 0.04, 0.022, -0.106])
      add('head', box(0.042, 0.009, 0.012), hairM, [k * 0.042, 0.052, -0.1], [0.1, 0, -k * 0.12]) // brows
    }
  })
  add('head', box(0.038, 0.008, 0.01), lipM, [0, -0.062, -0.1])

  if (o.face?.mustache) add('head', capsule(0.012, 0.05, 4, 8), mats.std(o.face.mustache, { rough: 0.8 }), [0, -0.043, -0.104], [0, 0, Math.PI / 2], [1, 1, 0.8])
  if (o.face?.mask) add('head', sphere(0.112, 24, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.4), mats.std(o.face.mask, { rough: 0.8 }), [0, -0.005, 0], [0, Math.PI, 0], [0.96, 1.08, 1.02])
  if (o.face?.glasses === 'shades') {
    const lens = mats.std(o.face.color ?? '#111', { rough: 0.05, metal: 0.9, env: 2 })
    both((s, k) => add('head', sphere(0.024, 14, 10), lens, [k * 0.04, 0.022, -0.103], [0, 0, 0], [1.25, 0.8, 0.45]))
    add('head', box(0.2, 0.01, 0.01), darkM, [0, 0.03, -0.098])
  }
  if (o.face?.glasses === 'visor') {
    add('head', torus(0.108, 0.02, 8, 28, Math.PI), mats.std(o.face.color ?? '#0a0f1d', { rough: 0.05, metal: 1, env: 2 }), [0, 0.018, 0], [-Math.PI / 2, 0, 0], [1, 1.06, 1.25])
    add('head', torus(0.108, 0.02, 8, 28, Math.PI), mats.glow(o.face.glow ?? '#7fb2ff'), [0, 0.043, 0], [-Math.PI / 2, 0, 0], [1.01, 1.07, 0.22])
  }

  // hair
  const hairCap = (theta = 0.56, tilt = 0.32, scale = [0.93, 1.02, 1.02]) =>
    add('head', sphere(0.122, 28, 16, 0, Math.PI * 2, 0, Math.PI * theta), hairM, [0, 0.012, 0.01], [tilt, 0, 0], scale)
  const covered = ['helmet', 'hood'].includes(o.head?.item)
  if (!covered) {
    switch (hairStyle) {
      case 'short':
        hairCap()
        break
      case 'buzz':
        hairCap(0.5, 0.28, [0.92, 0.98, 0.99])
        break
      case 'curly':
        hairCap(0.52, 0.3)
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2
          const ring = i % 2 ? 0.075 : 0.05
          add('head', sphere(0.042, 10, 8), hairM, [Math.cos(a) * ring, 0.085 + (i % 3) * 0.012, Math.sin(a) * ring + 0.015])
        }
        break
      case 'ponytail':
        hairCap(0.58, 0.3)
        add('head', capsule(0.035, 0.16, 4, 10), hairM, [0, -0.03, 0.15], [-0.5, 0, 0])
        add('head', torus(0.03, 0.01, 6, 12), mats.std('#d23a4a'), [0, 0.06, 0.12], [1.1, 0, 0])
        break
      case 'bun':
        hairCap(0.58, 0.3)
        add('head', sphere(0.055, 14, 10), hairM, [0, 0.12, 0.06])
        break
      case 'mohawk':
        hairCap(0.5, 0.28, [0.92, 0.98, 0.99])
        for (let i = 0; i < 6; i++) add('head', box(0.022, 0.07, 0.04), hairM, [0, 0.12 - Math.abs(i - 2.5) * 0.008, -0.07 + i * 0.03], [0.2 - i * 0.12, 0, 0])
        break
      default:
        break
    }
  }

  // headwear
  const hw = o.head?.item ?? 'none'
  const hc = o.head?.color ?? '#222'
  const hc2 = o.head?.color2 ?? '#ddd'
  const hatM = mats.std(hc, { rough: 0.6 })
  if (hw === 'cap' || hw === 'capBack') {
    const back = hw === 'capBack'
    add('head', sphere(0.124, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hatM, [0, 0.028, 0.005], [0, 0, 0], [0.95, 0.85, 1.02])
    add('head', cyl(0.11, 0.11, 0.012, 20), hatM, [0, 0.03, back ? 0.13 : -0.13], [back ? -0.15 : 0.15, 0, 0], [0.8, 1, 0.6])
    add('head', sphere(0.012, 8, 6), mats.std(hc2), [0, 0.135, 0.005])
    if (!back) add('head', box(0.04, 0.03, 0.01), goldM, [0, 0.07, -0.12])
  } else if (hw === 'officerCap') {
    add('head', cyl(0.135, 0.118, 0.07, 24), hatM, [0, 0.085, 0.005])
    add('head', cyl(0.118, 0.118, 0.025, 24), mats.std('#0b0d12', { rough: 0.4 }), [0, 0.06, 0.005])
    add('head', cyl(0.1, 0.1, 0.01, 20), mats.std('#07080b', { rough: 0.1, metal: 0.6 }), [0, 0.05, -0.1], [0.32, 0, 0], [1, 1, 0.65])
    add('head', box(0.04, 0.035, 0.012), goldM, [0, 0.09, -0.13], [-0.12, 0, 0])
  } else if (hw === 'beanie') {
    add('head', sphere(0.128, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hatM, [0, 0.025, 0.008], [0.12, 0, 0], [0.95, 1.05, 1.03])
    add('head', torus(0.118, 0.022, 8, 24), hatM, [0, 0.03, 0.01], [Math.PI / 2 + 0.12, 0, 0], [0.95, 1.03, 1])
  } else if (hw === 'headband') {
    add('head', torus(0.112, 0.016, 8, 26), hatM, [0, 0.05, 0.008], [Math.PI / 2 + 0.15, 0, 0], [0.93, 1.02, 1])
  } else if (hw === 'headphones') {
    add('head', torus(0.125, 0.012, 6, 24, Math.PI), hatM, [0, 0.0, 0.01], [0, 0, 0], [1, 1.08, 1])
    both((s, k) => {
      add('head', cyl(0.042, 0.042, 0.03, 16), hatM, [k * 0.11, -0.005, 0.01], [0, 0, Math.PI / 2])
      add('head', cyl(0.03, 0.03, 0.032, 14), mats.std(hc2, { rough: 0.4 }), [k * 0.122, -0.005, 0.01], [0, 0, Math.PI / 2])
    })
  } else if (hw === 'helmet') {
    add('head', sphere(0.142, 28, 18), mats.std(hc, { rough: 0.25, metal: 0.4 }), [0, 0.012, 0.005], [0, 0, 0], [0.95, 1.02, 1.05])
    add('head', sphere(0.135, 24, 12, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.32), mats.std('#07090f', { rough: 0.02, metal: 1, env: 2.4 }), [0, 0.005, -0.012], [0, 0, 0], [1, 1, 1.05])
    add('head', torus(0.138, 0.006, 6, 30, Math.PI), mats.glow(hc2, 3), [0, 0.062, 0], [-Math.PI / 2, 0, 0], [0.96, 1.06, 1])
  } else if (hw === 'hood') {
    add('head', sphere(0.15, 24, 16, Math.PI * 1.77, Math.PI * 1.46, 0, Math.PI * 0.75), mats.std(o.top.color, { rough: 0.7 }), [0, 0.02, 0.02], [0, 0, 0], [0.98, 1.06, 1.05])
  }

  // ------------------------------------------------------------ torso / top
  const topType = o.top.type
  const bulky = topType === 'hoodie' || topType === 'jacket' || topType === 'uniform' || topType === 'armor'
  add('torso', torsoGeo((bulky ? 1.07 : 1.0) * B), topType === 'singlet' ? topM : topM)
  if (topType === 'singlet') {
    both((s, k) => add('torso', torus(0.06, 0.012, 6, 14), top2, [k * 0.175 * B, 0.45, 0], [0, 0, Math.PI / 2]))
    add('torso', torus(0.08 * B, 0.012, 6, 18), top2, [0, 0.535, 0], [Math.PI / 2, 0, 0], [1.25, 0.75, 1])
    add('torso', box(0.15, 0.13, 0.01), mats.std('#ffffff', { rough: 0.5 }), [0, 0.27, -0.135 * B]) // race bib
  }
  if (topType === 'hoodie') {
    if (!o.top.hoodUp) add('torso', sphere(0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), topM, [0, 0.56, 0.08], [1.6, 0, 0], [1.25, 0.9, 0.7]) // hood down
    add('torso', box(0.22 * B, 0.1, 0.03), topM, [0, 0.13, -0.122 * B], [-0.08, 0, 0]) // pocket
    both((s, k) => add('torso', cyl(0.005, 0.005, 0.12, 6), top2, [k * 0.035, 0.46, -0.142 * B], [-0.1, 0, 0]))
    add('torso', torus(0.15 * B, 0.022, 6, 22), topM, [0, 0.02, 0], [Math.PI / 2, 0, 0], [1.12, 0.74, 1]) // waistband
  }
  if (topType === 'jacket' || topType === 'track' || topType === 'uniform' || topType === 'armor') {
    add('torso', box(0.012, 0.42, 0.012), topType === 'track' || topType === 'armor' ? top2 : silverM, [0, 0.27, -0.14 * B], [-0.1, 0, 0]) // zipper
    add('torso', torus(0.075 * B, 0.022, 8, 20, Math.PI * 1.6), topType === 'track' ? top2 : topM, [0, 0.545, 0.0], [Math.PI / 2, 0, -Math.PI * 0.3]) // collar
    add('torso', torus(0.15 * B, 0.018, 6, 22), top2, [0, 0.025, 0], [Math.PI / 2, 0, 0], [1.12, 0.74, 1])
  }
  if (topType === 'track') both((s, k) => add('torso', box(0.014, 0.4, 0.03), top2, [k * 0.188 * B, 0.27, 0]))
  if (topType === 'uniform') {
    both((s, k) => {
      add('torso', box(0.07, 0.06, 0.02), topM, [k * 0.09, 0.38, -0.142 * B]) // chest pockets
      add('torso', box(0.09, 0.02, 0.06), top2, [k * 0.17 * B, 0.52, 0], [0, 0, k * -0.2]) // epaulettes
    })
    add('torso', box(0.035, 0.045, 0.01), goldM, [-0.09, 0.44, -0.153 * B]) // badge
  }
  if (o.top.vest) {
    const vestM = mats.std(o.top.vest, { rough: 0.55 })
    add('torso', torsoGeo(1.13 * B, 0.5), vestM, [0, 0.03, 0])
    both((s, k) => add('torso', box(0.1, 0.022, 0.01), silverM, [k * 0.1, 0.22, -0.158 * B]))
    add('torso', torus(0.2 * B, 0.008, 6, 28), mats.std('#c9ced6', { rough: 0.3, metal: 0.7 }), [0, 0.33, 0], [Math.PI / 2, 0, 0], [1.1, 0.76, 1])
    if (o.top.vestText) add('torso', new THREE.PlaneGeometry(0.26, 0.13), mats.textured(vestTextTexture(), 'vestText'), [0, 0.32, 0.162 * B], [0, 0, 0])
  }
  if (topType === 'armor') {
    add('torso', box(0.26 * B, 0.16, 0.05), topM, [0, 0.36, -0.12 * B], [-0.12, 0, 0])
    add('torso', box(0.2, 0.012, 0.012), top2, [0, 0.29, -0.148 * B])
    both((s, k) => add('torso', sphere(0.075, 14, 10), topM, [k * 0.2 * B, 0.47, 0], [0, 0, 0], [1.1, 0.8, 1]))
  }

  // ------------------------------------------------------------ arms
  const sleeves = o.top.sleeves ?? 'long'
  both((s, k) => {
    const arm = `arm${s}`
    const elbow = `elbow${s}`
    const upperM = sleeves === 'none' ? skin : topM
    add(arm, limb(0.055 * B, 0.25), upperM)
    if (sleeves === 'long') {
      add(elbow, limb(0.048 * B, 0.21), topM)
      add(elbow, torus(0.045 * B, 0.013, 6, 14), top2, [0, -0.23, 0], [Math.PI / 2, 0, 0])
      add(elbow, limb(0.036, 0.04), skin, [0, -0.23, 0])
      if (topType === 'track' || topType === 'armor') add(arm, box(0.012, 0.22, 0.02), top2, [k * 0.054 * B, -0.12, 0])
    } else {
      add(elbow, limb(0.044 * B, 0.23), skin)
    }
    add(elbow, sphere(0.05, 14, 10), handM, [0, -0.285, -0.01], [0, 0, 0], [0.82, 1.12, 1])
    add(elbow, capsule(0.016, 0.03, 4, 8), handM, [k * -0.035, -0.27, -0.03], [0.6, 0, k * 0.5]) // thumb
    if (topType === 'uniform' || topType === 'armor') add(arm, sphere(0.062 * B, 14, 10), topType === 'armor' ? topM : topM, [0, -0.01, 0], [0, 0, 0], [1.1, 0.8, 1])
  })
  if (o.extras?.includes('watch')) add('elbowL', torus(0.042, 0.012, 6, 14), darkM, [0, -0.215, 0], [Math.PI / 2, 0, 0])

  // ------------------------------------------------------------ hips & legs
  add('hips', capsule(0.128 * B, 0.16 * B, 6, 16), botM, [0, 0, 0], [0, 0, Math.PI / 2])
  if (o.extras?.includes('belt')) {
    add('hips', torus(0.15 * B, 0.024, 6, 22), mats.std('#151517', { rough: 0.45 }), [0, 0.07, 0], [Math.PI / 2, 0, 0], [1.12, 0.78, 1])
    add('hips', box(0.04, 0.03, 0.012), silverM, [0, 0.07, -0.122 * B])
    both((s, k) => add('hips', box(0.05, 0.07, 0.05), mats.std('#151517', { rough: 0.5 }), [k * 0.15 * B, 0.04, -0.04]))
  }
  const btype = o.bottom.type
  both((s, k) => {
    const hip = `hip${s}`
    const knee = `knee${s}`
    const ankle = `ankle${s}`
    if (btype === 'shorts') {
      add(hip, limb(0.088 * B, 0.2), botM)
      add(hip, limb(0.074, 0.36), skin)
      add(knee, limb(0.058, 0.39), skin)
      add(hip, box(0.012, 0.22, 0.03), bot2, [k * 0.088 * B, -0.12, 0])
    } else {
      const loose = btype === 'cargo' || btype === 'pants'
      add(hip, limb((loose ? 0.086 : 0.08) * B, 0.38), botM)
      add(knee, limb((loose ? 0.068 : 0.062) * B, 0.38), botM)
      if (btype === 'leggings' || o.glow) add(hip, box(0.012, 0.36, 0.022), bot2, [k * 0.08 * B, -0.2, 0])
      if (btype === 'cargo') add(hip, box(0.04, 0.11, 0.09), bot2, [k * 0.088 * B, -0.22, 0])
      if (btype === 'armor') {
        add(knee, sphere(0.07, 12, 10), topM, [0, 0.0, -0.02], [0, 0, 0], [1, 1, 0.9])
        add(knee, box(0.012, 0.25, 0.02), top2, [0, -0.2, -0.065])
      }
      if (loose) add(knee, torus(0.066 * B, 0.014, 6, 14), bot2, [0, -0.39, 0], [Math.PI / 2, 0, 0])
    }
    // shoes
    const boot = o.shoes.type === 'boot'
    if (boot) add(ankle, cyl(0.068, 0.072, 0.14, 14), shoeM, [0, 0.02, 0])
    add(ankle, capsule(0.058, 0.17, 4, 12), shoeM, [0, -0.035, -0.06], [Math.PI / 2, 0, 0], [1, 0.78, 1])
    add(ankle, box(0.112, boot ? 0.04 : 0.03, 0.29), soleM, [0, -0.078, -0.06])
    add(ankle, box(0.115, 0.012, 0.12), accentM, [0, -0.04, -0.03])
    add(ankle, box(0.04, 0.03, 0.06), boot ? shoeM : mats.std('#ffffff', { rough: 0.5 }), [0, 0.0, -0.13]) // tongue / laces
  })

  // ------------------------------------------------------------ extras
  if (o.extras?.includes('chain')) add('torso', torus(0.085, 0.009, 6, 24), goldM, [0, 0.48, -0.085], [1.25, 0, 0], [1.1, 1.25, 1])
  if (o.extras?.includes('backpack')) {
    const packM = mats.std(o.extraColor ?? '#c4672d', { rough: 0.7 })
    add('torso', box(0.28 * B, 0.32, 0.13), packM, [0, 0.3, 0.17 * B])
    add('torso', box(0.24 * B, 0.08, 0.04), packM, [0, 0.21, 0.24 * B])
    both((s, k) => add('torso', box(0.035, 0.36, 0.02), darkM, [k * 0.09, 0.32, -0.14 * B], [-0.1, 0, 0]))
  }
  if (o.extras?.includes('radio')) {
    add('torso', box(0.05, 0.08, 0.03), darkM, [-0.12, 0.43, -0.15 * B], [-0.15, 0, 0])
    add('torso', cyl(0.004, 0.004, 0.08, 4), darkM, [-0.135, 0.5, -0.15 * B])
  }

  // ------------------------------------------------------------ merge per joint & material
  const meshes = []
  for (const [name, list] of parts) {
    const byMat = new Map()
    for (const { geo, mat } of list) {
      if (!byMat.has(mat)) byMat.set(mat, [])
      byMat.get(mat).push(geo)
    }
    for (const [mat, geos] of byMat) {
      // normalize attribute sets so every primitive can be merged
      for (const g of geos) {
        for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key)
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
        if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()])
      }
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = shadows && !(mat instanceof THREE.MeshBasicMaterial)
      joints[name].add(mesh)
      meshes.push(mesh)
    }
  }

  const glowMats = mats.list.filter((m) => m.userData.baseColor)
  return {
    root,
    joints,
    meshes,
    glowMats,
    dispose: () => {
      meshes.forEach((m) => m.geometry.dispose())
      mats.dispose()
    },
  }
}

/** Apply a pose (joint angle table) to a rig. */
export function applyPose(rig, p) {
  const j = rig.joints
  j.body.position.y = HIP_HEIGHT + p.bodyY
  j.body.position.z = p.bodyZ
  j.body.rotation.set(p.bodyPitch, 0, 0)
  j.hips.rotation.y = -p.torsoY * 0.5
  j.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ)
  j.head.rotation.set(p.headX, p.headY, 0)
  j.armL.rotation.set(p.armLX, p.armLY, p.armLZ)
  j.armR.rotation.set(p.armRX, p.armRY, p.armRZ)
  j.elbowL.rotation.x = p.elbowL
  j.elbowR.rotation.x = p.elbowR
  j.hipL.rotation.set(p.hipLX, 0, p.hipLZ)
  j.hipR.rotation.set(p.hipRX, 0, p.hipRZ)
  j.kneeL.rotation.x = p.kneeL
  j.kneeR.rotation.x = p.kneeR
  j.ankleL.rotation.x = p.ankleL
  j.ankleR.rotation.x = p.ankleR
}
