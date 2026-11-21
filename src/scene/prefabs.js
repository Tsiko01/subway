import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { CAR_LENGTH, RAMP_LENGTH, TRAIN_ROOF } from '../game/constants'
import { corrugatedTexture, deckTexture, glowTexture, poolTexture, signAtlas, stripeTexture, trainWindowTexture } from '../game/textures'

// Procedural prefabs: trains, ramps, obstacles, pickups, coins, skateboards and the jetpack.
// Each prefab is assembled from primitives and merged per material into a handful of meshes.

// ------------------------------------------------------------------ shared materials
const MAT = new Map()
const std = (color, rough = 0.6, metal = 0.1, extra = {}) => {
  const key = `s|${color}|${rough}|${metal}|${extra.map?.uuid ?? ''}|${extra.env ?? ''}`
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: extra.env ?? 1, map: extra.map ?? null }))
  return MAT.get(key)
}
const glow = (color, k = 3) => {
  const key = `g|${color}|${k}`
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }))
  return MAT.get(key)
}
const additive = (color, map, opacity = 0.8, key2 = '') => {
  const key = `a|${color}|${opacity}|${key2}`
  if (!MAT.has(key))
    MAT.set(
      key,
      new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    )
  return MAT.get(key)
}
const glass = (color = '#0b1018') => std(color, 0.05, 0.9, { env: 2 })

/** Shared blinking material for warning beacons (driven by the spawner). */
export const beacon = glow('#ffae42', 3)

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export class Builder {
  constructor() {
    this.parts = new Map()
    this.extra = []
  }
  add(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
    _p.set(...pos)
    _q.setFromEuler(_e.set(...rot))
    _s.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl))
    _m.compose(_p, _q, _s)
    geo.applyMatrix4(_m)
    if (!this.parts.has(mat)) this.parts.set(mat, [])
    this.parts.get(mat).push(geo)
    return this
  }
  /** Non-merged child (e.g. something animated separately). */
  child(obj) {
    this.extra.push(obj)
    return this
  }
  build({ shadows = true } = {}) {
    const group = new THREE.Group()
    for (const [mat, geos] of this.parts) {
      for (const g of geos) {
        for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key)
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
        if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()])
        g.clearGroups()
      }
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      const mesh = new THREE.Mesh(merged, mat)
      const lit = !(mat instanceof THREE.MeshBasicMaterial)
      mesh.castShadow = shadows && lit
      mesh.receiveShadow = lit
      group.add(mesh)
    }
    this.extra.forEach((o) => group.add(o))
    return group
  }
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)
const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h)

const TEMPLATES = new Map()
const template = (key, make) => {
  if (!TEMPLATES.has(key)) TEMPLATES.set(key, make())
  return TEMPLATES.get(key)
}

const tiledTexture = (base, tile) => {
  const t = base.clone()
  t.repeat.set(0.5, 0.5)
  t.offset.set((tile % 2) * 0.5, Math.floor(tile / 2) * 0.5)
  t.needsUpdate = true
  return t
}

// ------------------------------------------------------------------ trains
export const TRAIN_STYLES = {
  metro: { bodies: ['#c9ced6'], stripe: '#e8483f', skirt: '#2b3a55', front: '#2b3a55', roof: '#8f959e', metal: 0.55, windows: true, sign: '#ffb347' },
  tram: { bodies: ['#f3f5f7'], stripe: '#2f9bff', skirt: '#1d2c44', front: '#1d2c44', roof: '#9aa0a8', metal: 0.2, windows: true, pantograph: true, sign: '#7fd0ff' },
  freight: { bodies: ['#8b3a2b', '#2f4f6f', '#5f6b3a', '#6b4a2f'], loco: '#f2b233', stripe: '#1a1a1a', skirt: '#2a2a2a', roof: '#4a4a4a', metal: 0.3, windows: false, sign: '#ffcf5a' },
  beachtram: { bodies: ['#7fd6c2', '#ffb3a1', '#ffd96b'], stripe: '#ffffff', skirt: '#3b6b7a', front: '#3b6b7a', roof: '#f2f2ee', metal: 0.1, windows: true, sign: '#ffffff' },
  neon: { bodies: ['#14141e'], stripe: '#29e1ff', skirt: '#0b0b12', front: '#0b0b12', roof: '#1c1c28', metal: 0.6, windows: true, neon: true, sign: '#ff3df2' },
}

function windowMaterial(style) {
  const tex = trainWindowTexture().clone()
  tex.repeat.set(2, 1)
  tex.needsUpdate = true
  const key = `win-${style}`
  if (!MAT.has(key)) {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, metalness: 0.6, envMapIntensity: 1.6 })
    if (style === 'neon') {
      m.emissive = new THREE.Color('#29e1ff')
      m.emissiveMap = tex
      m.emissiveIntensity = 0.6
    }
    MAT.set(key, m)
  }
  return MAT.get(key)
}

/** One train car (11 m). `front` cars carry the cab facing the player; moving cars have lights on. */
export function trainCar(style, { front = false, moving = false, variant = 0 } = {}) {
  return template(`car|${style}|${front}|${moving}|${variant}`, () => {
    const S = TRAIN_STYLES[style] ?? TRAIN_STYLES.metro
    const L = CAR_LENGTH
    const W = 2.2
    const b = new Builder()
    const dark = std('#1b1d22', 0.6, 0.6)
    const steel = std('#6d727c', 0.35, 0.9)
    const isLoco = style === 'freight' && front
    const isTank = style === 'freight' && !front && variant % 3 === 2
    const bodyColor = isLoco ? S.loco : S.bodies[variant % S.bodies.length]

    // running gear
    b.add(box(1.9, 0.42, L - 1.2), dark, [0, 0.52, 0])
    for (const z of [-3.6, 3.6]) {
      b.add(box(2.0, 0.34, 2.5), dark, [0, 0.36, z])
      for (const zz of [-0.65, 0.65]) for (const x of [-0.84, 0.84]) b.add(cyl(0.34, 0.34, 0.12, 18), steel, [x, 0.34, z + zz], [0, 0, Math.PI / 2])
    }
    for (const z of [-L / 2, L / 2]) b.add(box(0.5, 0.28, 0.6), dark, [0, 0.74, z])

    if (isTank) {
      const tankM = std(bodyColor, 0.45, 0.5)
      b.add(cyl(1.2, 1.2, L - 1.2, 28), tankM, [0, TRAIN_ROOF - 1.2, 0], [Math.PI / 2, 0, 0])
      for (const z of [-(L - 1.2) / 2, (L - 1.2) / 2]) b.add(sph(1.2, 24, 12), tankM, [0, TRAIN_ROOF - 1.2, z], [0, 0, 0], [1, 1, 0.25])
      b.add(box(0.9, 0.06, L - 2), std('#2a2a2a', 0.8, 0.6), [0, TRAIN_ROOF + 0.01, 0])
      b.add(cyl(0.35, 0.35, 0.25, 16), steel, [0, TRAIN_ROOF + 0.05, 0])
      b.add(box(2.1, 0.12, L - 1), dark, [0, 0.82, 0])
      return b.build()
    }

    const bodyMat = style === 'freight' && !front ? std(bodyColor, 0.7, 0.35, { map: corrugatedTexture() }) : std(bodyColor, 0.35, S.metal, { env: 1.3 })
    b.add(new RoundedBoxGeometry(W, 2.45, L - 0.2, 3, 0.16), bodyMat, [0, 0.65 + 1.225, 0])

    if (S.windows || isLoco) {
      const win = windowMaterial(style)
      if (!isLoco) b.add(box(W + 0.03, 0.82, L - 1.8), win, [0, 2.15, 0])
      // doors
      const doorM = std(new THREE.Color(bodyColor).multiplyScalar(0.8).getStyle(), 0.4, S.metal)
      for (const sx of [-1, 1]) for (const z of [-2.6, 2.6]) {
        b.add(box(0.04, 2.0, 1.3), doorM, [sx * (W / 2 + 0.01), 1.72, z])
        b.add(box(0.05, 0.7, 0.42), glass(), [sx * (W / 2 + 0.02), 2.2, z - 0.3])
        b.add(box(0.05, 0.7, 0.42), glass(), [sx * (W / 2 + 0.02), 2.2, z + 0.3])
      }
    } else {
      // freight boxcar: door frame + ribs
      const rib = std(new THREE.Color(bodyColor).multiplyScalar(0.7).getStyle(), 0.7, 0.4)
      for (const sx of [-1, 1]) {
        b.add(box(0.05, 2.1, 2.6), rib, [sx * (W / 2 + 0.01), 1.75, 0])
        for (const z of [-4.2, -2.6, 2.6, 4.2]) b.add(box(0.05, 2.3, 0.08), rib, [sx * (W / 2 + 0.02), 1.85, z])
      }
    }

    b.add(box(W + 0.035, 0.16, L - 0.5), S.neon ? glow(S.stripe, 2.6) : std(S.stripe, 0.4, 0.2), [0, 1.3, 0])
    b.add(box(W + 0.01, 0.24, L - 0.5), std(S.skirt, 0.6, 0.4), [0, 0.8, 0])
    if (S.neon) {
      b.add(box(W + 0.05, 0.05, L - 0.4), glow('#ff3df2', 2.6), [0, 3.02, 0])
      b.add(box(W + 0.05, 0.05, L - 0.4), glow('#29e1ff', 2), [0, 0.68, 0])
    }

    // roof equipment kept low so the runner can sprint across it
    const roofM = std(S.roof, 0.6, 0.5)
    for (const z of [-2.8, 2.8]) b.add(box(1.25, 0.12, 2.2), roofM, [0, TRAIN_ROOF + 0.06, z])
    if (S.pantograph && !front) {
      for (const sx of [-1, 1]) b.add(box(0.04, 0.95, 0.04), dark, [sx * 0.28, TRAIN_ROOF + 0.42, 0], [0, 0, sx * 0.55])
      b.add(box(1.3, 0.04, 0.06), steel, [0, TRAIN_ROOF + 0.82, 0])
    }
    if (isLoco) {
      b.add(box(W - 0.3, 0.2, 3.2), roofM, [0, TRAIN_ROOF + 0.1, -2])
      for (const z of [-3, -1]) b.add(cyl(0.45, 0.45, 0.12, 18), dark, [0, TRAIN_ROOF + 0.24, z])
    }

    if (front) {
      const z = (L - 0.2) / 2 + 0.02
      const faceM = isLoco ? std('#ffffff', 0.5, 0.2, { map: stripeTexture('#f2b233', '#1a1a1a') }) : std(S.front ?? S.skirt, 0.35, 0.4)
      b.add(box(2.0, 1.05, 0.05), faceM, [0, 1.25, z])
      b.add(box(1.86, 0.95, 0.06), glass('#0a0e14'), [0, 2.32, z + 0.005])
      b.add(box(1.6, 0.3, 0.3), dark, [0, 0.72, z + 0.1])
      const lamp = moving ? glow('#ffffff', 4) : std('#d8dde5', 0.2, 0.4)
      for (const sx of [-1, 1]) b.add(box(0.34, 0.15, 0.05), lamp, [sx * 0.62, 1.05, z + 0.03])
      b.add(box(1.3, 0.2, 0.05), moving ? glow(S.sign, 2.2) : std('#2a2d33', 0.4, 0.3), [0, 2.95, z + 0.01])
      if (moving) {
        b.child(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 14).rotateX(-Math.PI / 2), additive('#e6efff', poolTexture(), 0.55, 'beam')))
        b.extra[b.extra.length - 1].position.set(0, 0.04, z + 7.5)
        for (const sx of [-1, 1]) {
          const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), additive('#fff4dc', glowTexture(), 0.9, 'lamp'))
          halo.position.set(sx * 0.62, 1.05, z + 0.12)
          b.child(halo)
        }
      }
    }
    return b.build()
  })
}

// ------------------------------------------------------------------ ramp
export function ramp() {
  return template('ramp', () => {
    const L = RAMP_LENGTH
    const Hh = TRAIN_ROOF
    const b = new Builder()
    const slope = Math.sqrt(L * L + Hh * Hh)
    const a = Math.atan2(Hh, L)
    const deck = std('#ffffff', 0.55, 0.6, { map: stripeTexture('#4a4f58', '#3a3e46') })
    b.add(box(2.2, 0.1, slope), deck, [0, Hh / 2, 0], [a, 0, 0])
    for (let i = 1; i < 9; i++) {
      const t = i / 9
      b.add(box(2.1, 0.03, 0.08), std('#c9ced6', 0.4, 0.8), [0, Hh * t + 0.06, L / 2 - L * t], [a, 0, 0])
    }
    const tri = new THREE.Shape()
    tri.moveTo(-L / 2, 0)
    tri.lineTo(L / 2, 0)
    tri.lineTo(L / 2, Hh)
    tri.closePath()
    const sideM = std('#ffffff', 0.6, 0.2, { map: stripeTexture('#f2c230', '#151515') })
    for (const sx of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(tri, { depth: 0.07, bevelEnabled: false })
      g.rotateY(Math.PI / 2)
      g.scale(1, 1, 1)
      b.add(g, sideM, [sx * 1.1 - (sx > 0 ? 0.07 : 0), 0, 0], [0, 0, 0], [1, 1, 1])
    }
    b.add(box(2.2, Hh, 0.18), std('#30343b', 0.6, 0.6), [0, Hh / 2, -L / 2 + 0.09])
    return b.build()
  })
}

// ------------------------------------------------------------------ obstacles
const signMat = (tile) => {
  const key = `sign-${tile}`
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ map: tiledTexture(signAtlas(), tile), roughness: 0.5, emissive: '#ffffff', emissiveMap: tiledTexture(signAtlas(), tile), emissiveIntensity: 0.15 }))
  return MAT.get(key)
}

export const OBSTACLE_INFO = {
  rail: { cat: 'low', hw: 1.1, hd: 0.12, y0: 0, y1: 0.95 },
  construction: { cat: 'low', hw: 1.1, hd: 0.3, y0: 0, y1: 1.0 },
  roadblock: { cat: 'low', hw: 1.05, hd: 0.32, y0: 0, y1: 1.0 },
  cones: { cat: 'low', hw: 1.0, hd: 0.25, y0: 0, y1: 0.8 },
  sign: { cat: 'high', hw: 1.15, hd: 0.12, y0: 1.28, y1: 3.4 },
  gantry: { cat: 'high', hw: 1.15, hd: 0.2, y0: 1.28, y1: 3.4 },
  pipes: { cat: 'high', hw: 1.15, hd: 0.25, y0: 1.28, y1: 3.4 },
  neongate: { cat: 'high', hw: 1.15, hd: 0.15, y0: 1.28, y1: 3.4 },
  ebox: { cat: 'block', hw: 0.95, hd: 0.45, y0: 0, y1: 2.6 },
  wall: { cat: 'block', hw: 1.15, hd: 0.15, y0: 0, y1: 2.7 },
  container: { cat: 'block', hw: 1.18, hd: 3.0, y0: 0, y1: 2.6 },
}

export function obstacle(kind, variant = 0) {
  const v = kind === 'container' ? variant % 4 : 0
  return template(`obs|${kind}|${v}`, () => {
    const b = new Builder()
    const white = std('#e9ecef', 0.5, 0.2)
    const dark = std('#24272d', 0.6, 0.5)
    const steel = std('#b7bec8', 0.3, 0.9)
    switch (kind) {
      case 'rail': {
        for (const sx of [-1, 1]) {
          b.add(cyl(0.06, 0.07, 1.05, 12), white, [sx * 1.04, 0.525, 0])
          b.add(box(0.3, 0.06, 0.4), dark, [sx * 1.04, 0.03, 0])
          b.add(new THREE.CircleGeometry(0.07, 16), glow('#ff3b3b', 3), [sx * 0.95, 0.82, 0.05])
        }
        const stripes = std('#ffffff', 0.45, 0.1, { map: stripeTexture('#f4f4f4', '#d6232f') })
        b.add(box(2.2, 0.24, 0.07), stripes, [0, 0.82, 0])
        b.add(box(2.1, 0.14, 0.05), stripes, [0, 0.42, 0])
        break
      }
      case 'construction': {
        const stripes = std('#ffffff', 0.45, 0.1, { map: stripeTexture('#f4f4f4', '#ff7a1a') })
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) b.add(box(0.06, 1.15, 0.06), std('#ff8a1f', 0.5, 0.2), [sx * 0.95, 0.55, sz * 0.18], [sz * 0.32, 0, 0])
        }
        b.add(box(2.15, 0.22, 0.05), stripes, [0, 0.86, -0.02])
        b.add(box(2.15, 0.18, 0.05), stripes, [0, 0.46, -0.02])
        for (const sx of [-1, 1]) {
          b.add(cyl(0.07, 0.07, 0.1, 12), dark, [sx * 0.95, 1.03, 0])
          b.add(cyl(0.08, 0.08, 0.1, 12), beacon, [sx * 0.95, 1.12, 0])
        }
        break
      }
      case 'roadblock': {
        const jersey = new THREE.Shape()
        ;[
          [-0.3, 0],
          [0.3, 0],
          [0.3, 0.08],
          [0.13, 0.3],
          [0.09, 1.0],
          [-0.09, 1.0],
          [-0.13, 0.3],
          [-0.3, 0.08],
        ].forEach(([x, y], i) => (i ? jersey.lineTo(x, y) : jersey.moveTo(x, y)))
        const g = new THREE.ExtrudeGeometry(jersey, { depth: 2.1, bevelEnabled: false })
        g.rotateY(Math.PI / 2)
        g.translate(-1.05, 0, 0)
        b.add(g, std('#c8c4bb', 0.85, 0.05))
        const band = std('#ffffff', 0.45, 0.1, { map: stripeTexture('#f4f4f4', '#d6232f') })
        for (const sz of [-1, 1]) b.add(box(2.12, 0.16, 0.012), band, [0, 0.62, sz * 0.12], [sz * -0.05, 0, 0])
        break
      }
      case 'cones': {
        const orange = std('#ff6a13', 0.55, 0.05)
        for (const x of [-0.72, 0, 0.72]) {
          b.add(new THREE.ConeGeometry(0.2, 0.72, 20), orange, [x, 0.4, 0])
          b.add(cyl(0.135, 0.165, 0.09, 20), white, [x, 0.42, 0])
          b.add(cyl(0.085, 0.11, 0.07, 20), white, [x, 0.6, 0])
          b.add(box(0.42, 0.05, 0.42), dark, [x, 0.025, 0])
        }
        b.add(box(1.6, 0.05, 0.05), std('#ffffff', 0.4, 0.1, { map: stripeTexture('#f4f4f4', '#ff6a13') }), [0, 0.55, 0])
        break
      }
      case 'sign': {
        for (const sx of [-1, 1]) b.add(box(0.12, 3.3, 0.12), std('#4b5260', 0.5, 0.7), [sx * 1.2, 1.65, 0])
        b.add(box(2.3, 1.15, 0.08), signMat(2), [0, 1.95, 0])
        b.add(box(2.4, 0.08, 0.14), dark, [0, 2.57, 0])
        b.add(box(2.3, 0.08, 0.14), glow('#ffb000', 2.4), [0, 1.33, 0])
        break
      }
      case 'gantry': {
        const yellow = std('#f2c230', 0.45, 0.5)
        for (const sx of [-1, 1]) b.add(box(0.14, 3.3, 0.14), dark, [sx * 1.22, 1.65, 0])
        for (const y of [1.45, 2.05]) b.add(cyl(0.06, 0.06, 2.5, 10), yellow, [0, y, 0], [0, 0, Math.PI / 2])
        for (let i = -2; i <= 2; i++) b.add(box(0.04, 0.7, 0.04), yellow, [i * 0.45, 1.75, 0], [0, 0, i % 2 ? 0.6 : -0.6])
        b.add(box(0.9, 0.42, 0.04), signMat(2), [0, 1.75, 0.08])
        b.add(box(2.4, 0.06, 0.12), glow('#ff6a13', 2.4), [0, 1.36, 0])
        break
      }
      case 'pipes': {
        for (const sx of [-1, 1]) {
          b.add(box(0.16, 2.6, 0.16), std('#5a4f45', 0.7, 0.6), [sx * 1.22, 1.3, 0])
          b.add(box(0.5, 0.06, 0.5), dark, [sx * 1.22, 0.03, 0])
        }
        const cols = ['#b5402f', '#8f969e', '#d9a520']
        ;[1.5, 1.86, 2.2].forEach((y, i) => {
          b.add(cyl(0.17, 0.17, 2.6, 18), std(cols[i], 0.45, 0.6), [0, y, 0], [0, 0, Math.PI / 2])
          b.add(cyl(0.2, 0.2, 0.08, 18), steel, [0.6 - i * 0.4, y, 0], [0, 0, Math.PI / 2])
        })
        b.add(box(2.5, 0.05, 0.4), glow('#ffb000', 2), [0, 1.31, 0])
        break
      }
      case 'neongate': {
        for (const sx of [-1, 1]) b.add(box(0.1, 3.3, 0.12), dark, [sx * 1.2, 1.65, 0])
        b.add(box(2.3, 1.5, 0.2), std('#0e121b', 0.45, 0.6), [0, 2.1, 0])
        b.add(box(2.34, 0.07, 0.26), glow('#29e1ff', 2.6), [0, 1.33, 0])
        b.add(box(2.34, 0.05, 0.24), glow('#ff3df2', 2.6), [0, 2.88, 0])
        for (const dy of [0, 0.38]) for (const sx of [-1, 1]) b.add(box(0.55, 0.045, 0.01), glow('#ff3df2', 2.6), [sx * 0.22, 2.35 - dy, 0.11], [0, 0, sx * 0.5])
        break
      }
      case 'ebox': {
        const body = std('#6f7f73', 0.55, 0.5)
        b.add(box(1.7, 2.3, 0.85), body, [0, 1.25, 0])
        b.add(box(1.85, 0.12, 1.0), std('#4f5b52', 0.5, 0.5), [0, 2.45, 0])
        b.add(box(1.9, 0.12, 1.0), std('#7d7d78', 0.9, 0.05), [0, 0.06, 0])
        b.add(box(0.012, 2.0, 0.01), dark, [0, 1.25, 0.43])
        for (let i = 0; i < 6; i++) b.add(box(0.5, 0.03, 0.01), dark, [0.45, 1.9 - i * 0.07, 0.43])
        const warn = new THREE.Shape()
        warn.moveTo(0, 0.28)
        warn.lineTo(0.25, -0.16)
        warn.lineTo(-0.25, -0.16)
        warn.closePath()
        b.add(new THREE.ShapeGeometry(warn), std('#f2c230', 0.4, 0.1), [-0.4, 1.55, 0.432])
        b.add(new THREE.CircleGeometry(0.04, 10), dark, [-0.4, 1.5, 0.436])
        for (const sx of [-0.6, 0.6]) b.add(cyl(0.06, 0.06, 0.3, 10), dark, [sx, 0.15, -0.2])
        b.add(box(0.1, 0.1, 0.02), glow('#46ff7a', 2.4), [0.6, 2.2, 0.43])
        break
      }
      case 'wall': {
        const panel = std('#ffffff', 0.55, 0.1, { map: stripeTexture('#f4f4f4', '#ff6a13') })
        b.add(box(2.35, 1.0, 0.12), panel, [0, 0.62, 0])
        b.add(box(2.35, 1.3, 0.12), std('#2f6fb3', 0.6, 0.2), [0, 1.8, 0])
        b.add(box(1.2, 0.5, 0.02), signMat(3), [0, 1.85, 0.07])
        for (const sx of [-1, 1]) b.add(box(0.12, 2.7, 0.3), dark, [sx * 1.14, 1.35, 0])
        b.add(cyl(0.08, 0.08, 0.12, 12), beacon, [0, 2.6, 0])
        break
      }
      case 'container': {
        const colors = ['#b33a2b', '#2f5f8f', '#2f8f5a', '#d98a1f']
        const c = colors[v]
        const body = std(c, 0.6, 0.45, { map: corrugatedTexture() })
        b.add(box(2.35, 2.55, 6), body, [0, 1.28, 0])
        for (let i = -2; i <= 2; i++) if (i !== 0) b.add(cyl(0.025, 0.025, 2.4, 6), steel, [i * 0.42, 1.28, 3.02])
        b.add(box(2.4, 0.1, 6.05), std('#3a3d42', 0.6, 0.6), [0, 0.05, 0])
        break
      }
      default:
        b.add(box(2, 1, 0.3), white, [0, 0.5, 0])
    }
    return b.build()
  })
}

// ------------------------------------------------------------------ coins
export function coinGeometry() {
  return template('coinGeo', () => {
    const pts = [
      [0, -0.02],
      [0.19, -0.02],
      [0.205, -0.036],
      [0.27, -0.036],
      [0.3, -0.018],
      [0.3, 0.018],
      [0.27, 0.036],
      [0.205, 0.036],
      [0.19, 0.02],
      [0, 0.02],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(pts, 28)
    g.rotateX(Math.PI / 2)
    return g
  })
}
export function coinMaterial() {
  return template('coinMat', () => new THREE.MeshStandardMaterial({ color: '#ffc93c', metalness: 1, roughness: 0.22, emissive: '#7a4a00', emissiveIntensity: 0.55, envMapIntensity: 1.8 }))
}

// ------------------------------------------------------------------ power-up pickups
export const POWER_COLORS = { magnet: '#ff4d5e', sneakers: '#7dff5a', jetpack: '#ff9a3c', double: '#ffd23f', board: '#5ad7ff' }

function twoXTexture() {
  return template('twoX', () => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#ffd23f'
    g.font = '900 104px "Arial Black", Impact, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 12
    g.strokeStyle = '#6b3d00'
    g.strokeText('2×', 128, 68)
    g.fillText('2×', 128, 68)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

function helix(radius = 0.05, height = 0.13, turns = 4, tube = 0.008) {
  const pts = []
  for (let i = 0; i <= turns * 16; i++) {
    const a = (i / 16) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, (i / (turns * 16)) * height, Math.sin(a) * radius))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, tube, 6, false)
}

export function pickup(type) {
  return template(`pickup|${type}`, () => {
    const b = new Builder()
    const col = POWER_COLORS[type]
    switch (type) {
      case 'magnet':
        b.add(new THREE.TorusGeometry(0.24, 0.085, 12, 28, Math.PI), std('#e0283c', 0.35, 0.4), [0, 0.04, 0], [0, 0, Math.PI])
        for (const sx of [-1, 1]) b.add(box(0.17, 0.12, 0.17), std('#e8edf3', 0.2, 1), [sx * 0.24, -0.03, 0])
        break
      case 'sneakers': {
        const shoe = new THREE.CapsuleGeometry(0.1, 0.3, 4, 12)
        shoe.rotateX(Math.PI / 2)
        b.add(shoe, std('#59e83c', 0.4, 0.2), [0, 0.06, 0], [0, 0, 0], [1, 0.75, 1])
        b.add(box(0.2, 0.05, 0.5), std('#ffffff', 0.5, 0.1), [0, -0.03, 0])
        b.add(box(0.21, 0.03, 0.2), glow('#7dff5a', 2.5), [0, 0.04, 0.05])
        b.add(helix(0.07, 0.2, 4, 0.012), std('#d9dee8', 0.2, 1), [0, -0.26, 0])
        break
      }
      case 'jetpack': {
        const red = std('#d8342c', 0.3, 0.6)
        for (const sx of [-1, 1]) {
          b.add(new THREE.CapsuleGeometry(0.1, 0.32, 6, 14), red, [sx * 0.12, 0.05, 0])
          b.add(new THREE.ConeGeometry(0.08, 0.14, 14), std('#c9ced6', 0.2, 1), [sx * 0.12, -0.27, 0], [Math.PI, 0, 0])
          b.add(new THREE.ConeGeometry(0.07, 0.22, 12), glow('#ffb347', 3), [sx * 0.12, -0.42, 0], [Math.PI, 0, 0])
        }
        b.add(box(0.16, 0.36, 0.12), std('#2a2d33', 0.5, 0.6), [0, 0.05, 0.03])
        break
      }
      case 'double': {
        b.add(new THREE.TorusGeometry(0.3, 0.035, 10, 40), std('#ffcc33', 0.2, 1, { env: 1.8 }), [0, 0, 0])
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: twoXTexture(), transparent: true, side: THREE.DoubleSide, toneMapped: false }))
        b.child(plate)
        break
      }
      case 'board': {
        b.add(box(0.2, 0.025, 0.66), std('#ffd76a', 0.25, 0.9, { env: 1.8 }), [0, 0, 0])
        for (const z of [-0.22, 0.22]) for (const sx of [-1, 1]) b.add(cyl(0.035, 0.035, 0.03, 12), glow('#5ad7ff', 2.6), [sx * 0.09, -0.05, z], [0, 0, Math.PI / 2])
        break
      }
      default:
        break
    }
    const bubble = new THREE.Mesh(sph(0.55, 24, 16), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.16, roughness: 0, metalness: 1, depthWrite: false }))
    b.child(bubble)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(col, glowTexture(), 0.75, `halo-${type}`))
    b.child(halo)
    const g = b.build({ shadows: false })
    g.userData.spinner = true
    return g
  })
}

// ------------------------------------------------------------------ skateboard
function bendDeck(geo, len) {
  const pos = geo.attributes.position
  const tail = len / 2 - 0.13
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    const az = Math.abs(z)
    if (az > tail) {
      const k = (az - tail) / 0.13
      pos.setY(i, pos.getY(i) + k * k * 0.06)
    }
    if (az > len / 2 - 0.1) {
      const k = (az - (len / 2 - 0.1)) / 0.1
      pos.setX(i, pos.getX(i) * Math.max(0.35, Math.sqrt(Math.max(0, 1 - k * k))))
    }
  }
  geo.computeVertexNormals()
  return geo
}

/** Builds a skateboard; the deck top sits at y = 0 so the rider stands on the group origin. */
export function buildBoard(board) {
  const len = board.long ? 1.0 : 0.86
  const group = new THREE.Group()
  const grip = new THREE.MeshStandardMaterial({ color: '#1d1e22', roughness: 0.95 })
  const art = new THREE.MeshStandardMaterial({
    map: deckTexture(board),
    roughness: board.metal ? 0.25 : 0.55,
    metalness: board.metal ? 0.9 : 0.05,
    envMapIntensity: board.metal ? 1.8 : 1,
  })
  const wood = new THREE.MeshStandardMaterial({ color: '#c8a77a', roughness: 0.7 })
  const metal = new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.25, metalness: 1 })
  const wheelMat = board.glow
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color(board.wheels).multiplyScalar(2.4), toneMapped: false })
    : new THREE.MeshStandardMaterial({ color: board.wheels, roughness: 0.45 })
  const mats = [grip, art, wood, metal, wheelMat]

  const top = bendDeck(new THREE.BoxGeometry(0.24, 0.006, len, 1, 1, 24), len)
  const core = bendDeck(new THREE.BoxGeometry(0.24, 0.016, len, 1, 1, 24), len)
  const bottom = bendDeck(new THREE.BoxGeometry(0.24, 0.006, len, 1, 1, 24), len)
  const meshes = [
    new THREE.Mesh(top, grip),
    new THREE.Mesh(core, wood),
    new THREE.Mesh(bottom, art),
  ]
  meshes[0].position.y = -0.003
  meshes[1].position.y = -0.014
  meshes[2].position.y = -0.025
  meshes.forEach((m) => {
    m.castShadow = true
    group.add(m)
  })
  const wheels = []
  for (const z of [-len * 0.32, len * 0.32]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.05), metal)
    truck.position.set(0, -0.05, z)
    truck.castShadow = true
    group.add(truck)
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6).rotateZ(Math.PI / 2), metal)
    axle.position.set(0, -0.07, z)
    group.add(axle)
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.032, 16).rotateZ(Math.PI / 2), wheelMat)
      w.position.set(sx * 0.115, -0.07, z)
      w.castShadow = true
      group.add(w)
      wheels.push(w)
    }
  }
  return {
    group,
    wheels,
    length: len,
    dispose: () => {
      group.traverse((o) => o.geometry?.dispose())
      mats.forEach((m) => m.dispose())
    },
  }
}

// ------------------------------------------------------------------ jetpack & spring coils
export function buildJetpack() {
  const group = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: '#d8342c', roughness: 0.3, metalness: 0.6 })
  const silver = new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.2, metalness: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.5, metalness: 0.6 })
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const flames = []
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 6, 14), red)
    tank.position.set(sx * 0.09, 0, 0)
    tank.castShadow = true
    group.add(tank)
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 14).rotateX(Math.PI), silver)
    nozzle.position.set(sx * 0.09, -0.24, 0)
    group.add(nozzle)
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.5, 12, 1, true).rotateX(Math.PI).translate(0, -0.25, 0), flameMat)
    flame.position.set(sx * 0.09, -0.29, 0)
    group.add(flame)
    flames.push(flame)
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), dark)
  frame.position.set(0, 0, -0.03)
  group.add(frame)
  return {
    group,
    flames,
    dispose: () => {
      group.traverse((o) => o.geometry?.dispose())
      ;[red, silver, dark, flameMat].forEach((m) => m.dispose())
    },
  }
}

export function buildCoils() {
  const mat = new THREE.MeshStandardMaterial({ color: '#d9e6f2', roughness: 0.2, metalness: 1, emissive: '#3dff6a', emissiveIntensity: 0.4 })
  const geo = helix(0.045, 0.12, 4, 0.009)
  const make = () => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(0, -0.215, -0.06)
    return m
  }
  return { left: make(), right: make(), dispose: () => (geo.dispose(), mat.dispose()) }
}
