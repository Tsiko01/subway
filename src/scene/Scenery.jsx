import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENERY_START_Z, SEGMENT_COUNT, SEGMENT_LENGTH } from '../game/constants'
import { fx, onReset, runtime } from '../game/runtime'
import { atmo } from '../game/atmosphere'
import { getMap } from '../game/maps'
import { displayMapId, useGame } from '../game/store'
import { billboardAtlas, corrugatedTexture, glowTexture, graffitiAtlas, groundTexture, neonAtlas, poolTexture, signAtlas } from '../game/textures'
import { makeAtlasMaterial, makeBuildingMaterial } from './materials'

const N = SEGMENT_COUNT
const SEG = SEGMENT_LENGTH
const EDGE = 4.6 // track bed half width
const LAND_W = 110
const LAND_H = 6.2

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _e = new THREE.Euler()
const _c = new THREE.Color()

/** One instanced mesh with a fixed number of slots reserved per scenery segment. */
class Part {
  constructor(geometry, material, perSeg, { colors = false, shadow = false, tiles = false } = {}) {
    this.perSeg = perSeg
    const count = perSeg * N
    this.mesh = new THREE.InstancedMesh(geometry, material, count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = shadow
    this.mesh.receiveShadow = true
    this.localZ = new Float32Array(count)
    this.hasColors = colors
    if (colors) for (let i = 0; i < count; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1))
    if (tiles) {
      this.tiles = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
      geometry.setAttribute('aTile', this.tiles)
    }
    this.base = 0
    this.cursor = 0
    this.used = false
  }
  begin(seg) {
    this.base = seg * this.perSeg
    this.cursor = 0
  }
  /** opts: { sx, sy, sz, ry, rx, rz, color, tile } */
  add(x, y, z, o = {}) {
    if (this.cursor >= this.perSeg) return
    const i = this.base + this.cursor++
    _p.set(x, y, z)
    _q.setFromEuler(_e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0))
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)
    _m.compose(_p, _q, _s)
    this.mesh.setMatrixAt(i, _m)
    this.localZ[i] = z
    if (o.color && this.hasColors) this.mesh.setColorAt(i, o.color)
    if (this.tiles) this.tiles.setX(i, o.tile ?? 0)
  }
  end() {
    while (this.cursor < this.perSeg) {
      const i = this.base + this.cursor++
      this.mesh.setMatrixAt(i, HIDDEN)
      this.localZ[i] = 0
    }
    if (this.hasColors) this.mesh.instanceColor.needsUpdate = true
    if (this.tiles) this.tiles.needsUpdate = true
  }
  scroll(segZ) {
    const arr = this.mesh.instanceMatrix.array
    const per = this.perSeg
    for (let s = 0; s < N; s++) {
      const z = segZ[s]
      for (let k = 0; k < per; k++) {
        const i = s * per + k
        arr[i * 16 + 14] = z + this.localZ[i]
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.dispose()
  }
}

// ------------------------------------------------------------------ custom geometries
function prismGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, 0)
  shape.lineTo(0.5, 0)
  shape.lineTo(0, 1)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  return g
}

function palmTrunkGeometry() {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 2.4, 0), new THREE.Vector3(0.8, 4.8, 0), new THREE.Vector3(1.5, 6.8, 0)])
  return new THREE.TubeGeometry(curve, 24, 0.17, 8, false)
}

function palmFrondsGeometry() {
  const leaves = []
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.7, 3.2, 1, 8)
    const pos = g.attributes.position
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 1.6 // 0..3.2 along the leaf
      const x = pos.getX(k) * (1 - y / 3.6)
      pos.setXYZ(k, x, -0.12 * y * y, y)
    }
    g.rotateY((i / 9) * Math.PI * 2)
    g.rotateX(0.0)
    g.translate(1.5, 6.85, 0)
    g.computeVertexNormals()
    leaves.push(g)
  }
  const merged = mergeIndexed(leaves)
  return merged
}

function mergeIndexed(geos) {
  // tiny local merge (all inputs share attribute layout)
  let vCount = 0
  let iCount = 0
  for (const g of geos) {
    vCount += g.attributes.position.count
    iCount += g.index.count
  }
  const pos = new Float32Array(vCount * 3)
  const nor = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const idx = new Uint32Array(iCount)
  let vo = 0
  let io = 0
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3)
    nor.set(g.attributes.normal.array, vo * 3)
    uv.set(g.attributes.uv.array, vo * 2)
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo
    vo += g.attributes.position.count
    io += g.index.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  return out
}

function archGeometry() {
  return new THREE.CylinderGeometry(7.2, 7.2, SEG + 0.06, 30, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 1.6, 0)
}

// Which parts each map draws (everything else is hidden — no wasted draw calls).
const MAP_PARTS = {
  subway: ['ground', 'building', 'misc', 'metal', 'glow', 'cyl', 'graffiti', 'signs', 'arch', 'halo', 'pool'],
  city: ['ground', 'road', 'building', 'tower', 'misc', 'metal', 'glow', 'cyl', 'crown', 'billboard', 'halo'],
  industrial: ['ground', 'building', 'misc', 'metal', 'glow', 'cyl', 'prism', 'container', 'halo', 'pool'],
  beach: ['ground', 'road', 'building', 'misc', 'metal', 'glow', 'cyl', 'cone', 'prism', 'palmTrunk', 'palmFronds', 'halo'],
  night: ['ground', 'building', 'tower', 'misc', 'metal', 'glow', 'cyl', 'crown', 'neon', 'halo', 'pool'],
}

const GROUND_TINT = { subway: '#9a958f', city: '#c7c4bd', industrial: '#a39484', beach: '#efdcb4', night: '#aab2c0' }
const ROAD_KIND = { city: 'asphalt', beach: 'sand' }

function createScenery() {
  const group = new THREE.Group()

  // ---------------------------------------------------------------- materials
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 })
  // always textured so its shader program never changes between maps
  const roadMat = new THREE.MeshStandardMaterial({ map: groundTexture('asphalt'), roughness: 0.85, metalness: 0.05 })
  const concreteMat = makeBuildingMaterial({ color: '#7d7a76', warm: '#ffc47e', cool: '#a8c8ff', lit: 0.35, intensity: 0.4, shopIntensity: 0.4 })
  const towerMat = makeBuildingMaterial({ color: '#2a3c5a', roughness: 0.16, metalness: 0.8, warm: '#d6e4ff', cool: '#6f9bff', glassTint: '#20324e', lit: 0.25, intensity: 0.3, floorH: 3.6, colW: 1.8, style: 1 })
  const misc = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, metalness: 0.05 })
  const metal = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.8 })
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  const cylMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.2 })
  const coneMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide })
  const prismMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, metalness: 0.2 })
  const haloMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true })
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.95 })
  const frondMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide })
  const archMat = new THREE.MeshStandardMaterial({ color: '#5d5a57', roughness: 0.9, side: THREE.DoubleSide })
  const containerMat = new THREE.MeshStandardMaterial({ map: corrugatedTexture(), roughness: 0.65, metalness: 0.45 })
  const graffitiMat = makeAtlasMaterial({ map: graffitiAtlas(), roughness: 0.9 })
  const signsMat = makeAtlasMaterial({ map: signAtlas(), basic: true, emissive: 1, side: THREE.DoubleSide })
  const billboardMat = makeAtlasMaterial({ map: billboardAtlas(), roughness: 0.5, emissive: 0.35, side: THREE.DoubleSide })
  const neonMat = makeAtlasMaterial({ map: neonAtlas(), basic: true, emissive: 1, color: '#ffffff', side: THREE.DoubleSide })
  neonMat.color.multiplyScalar(1.8)
  const mats = [groundMat, roadMat, concreteMat, towerMat, misc, metal, glowMat, cylMat, coneMat, prismMat, haloMat, poolMat, crownMat, palmTrunkMat, frondMat, archMat, containerMat, graffitiMat, signsMat, billboardMat, neonMat]

  const centered = () => new THREE.BoxGeometry(1, 1, 1)
  const based = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const P = {
    ground: new Part(new THREE.BoxGeometry(LAND_W, LAND_H, SEG), groundMat, 2),
    road: new Part(new THREE.BoxGeometry(9.4, 0.3, SEG), roadMat, 2),
    building: new Part(based(), concreteMat, 8, { colors: true }),
    tower: new Part(based(), towerMat, 6, { colors: true }),
    misc: new Part(centered(), misc, 48, { colors: true, shadow: true }),
    metal: new Part(centered(), metal, 40, { colors: true, shadow: true }),
    glow: new Part(centered(), glowMat, 28, { colors: true }),
    cyl: new Part(new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0), cylMat, 20, { colors: true, shadow: true }),
    cone: new Part(new THREE.ConeGeometry(0.5, 1, 18, 1, true).translate(0, 0.5, 0), coneMat, 8, { colors: true, shadow: true }),
    prism: new Part(prismGeometry(), prismMat, 12, { colors: true, shadow: true }),
    halo: new Part(new THREE.PlaneGeometry(1, 1), haloMat, 10, { colors: true }),
    pool: new Part(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, 6, { colors: true }),
    crown: new Part(new THREE.IcosahedronGeometry(1.25, 1), crownMat, 6, { colors: true, shadow: true }),
    palmTrunk: new Part(palmTrunkGeometry(), palmTrunkMat, 6, { shadow: true }),
    palmFronds: new Part(palmFrondsGeometry(), frondMat, 6, { colors: true, shadow: true }),
    arch: new Part(archGeometry(), archMat, 1, { shadow: true }),
    container: new Part(new THREE.BoxGeometry(2.45, 2.6, 6.1), containerMat, 18, { colors: true, shadow: true }),
    graffiti: new Part(new THREE.PlaneGeometry(4.6, 3.0), graffitiMat, 4, { tiles: true }),
    signs: new Part(new THREE.PlaneGeometry(3.2, 1.0), signsMat, 2, { tiles: true }),
    billboard: new Part(new THREE.PlaneGeometry(8, 8), billboardMat, 2, { tiles: true }),
    neon: new Part(new THREE.PlaneGeometry(3.2, 3.2), neonMat, 6, { tiles: true }),
  }
  const parts = Object.values(P)
  parts.forEach((p) => group.add(p.mesh))

  // ---------------------------------------------------------------- movers (traffic, boats)
  const MOVERS = 22
  const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1.85, 0.75, 4.3).translate(0, 0.62, 0), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), MOVERS)
  const carCabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.62, 2.2).translate(0, 1.3, -0.2), new THREE.MeshStandardMaterial({ color: '#141a24', roughness: 0.08, metalness: 0.9 }), MOVERS)
  const carLights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, 4.36).translate(0, 0.72, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), MOVERS)
  const sail = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 3).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide }), MOVERS)
  for (const m of [carBody, carCabin, carLights, sail]) {
    m.frustumCulled = false
    m.castShadow = m !== carLights
    group.add(m)
    for (let i = 0; i < MOVERS; i++) m.setColorAt(i, _c.setRGB(1, 1, 1))
  }
  const movers = Array.from({ length: MOVERS }, () => ({ x: 0, z: 0, v: 0, kind: 'car', color: new THREE.Color() }))

  const segZ = new Float32Array(N)
  const segIndex = new Int32Array(N)
  const segType = new Array(N).fill('open')
  const chimneys = Array.from({ length: N }, () => [])
  let counter = 0
  let mapId = null
  let map = getMap('subway')
  let runType = 'open'
  let runLeft = 0

  const r = Math.random
  const col = (hex, k = 1) => _c.set(hex).multiplyScalar(k)
  const tint = (base, v = 0.12) => _c.set(base).multiplyScalar(1 - v + r() * v * 2)

  // ---------------------------------------------------------------- layout helpers
  const addLamp = (side, z, xPole, color, { height = 7, arm = 1.6, pool = true, halo = true } = {}) => {
    const x = side * xPole
    P.cyl.add(x, 0, z, { sx: 0.14, sy: height, sz: 0.14, color: col('#30343b') })
    P.metal.add(x - side * arm * 0.5, height - 0.1, z, { sx: arm, sy: 0.07, sz: 0.1, color: col('#30343b') })
    const hx = x - side * (arm - 0.2)
    const dayK = map.night ? 3.2 : 0.9
    P.glow.add(hx, height - 0.17, z, { sx: 0.8, sy: 0.06, sz: 0.26, color: col(color, dayK) })
    if (halo && map.night !== false) P.halo.add(hx, height - 0.3, z + 0.2, { sx: 2.8, sy: 2.8, color: col(color, map.night ? 1 : 0.25) })
    if (pool && map.night) P.pool.add(side * 2.6, 0.03, z, { sx: 7, sz: 9, color: col(color, 1) })
  }

  /** Fills one side with a row of buildings; returns the placed footprints. */
  const buildingRow = (part, side, { x0, wMin, wMax, dMin, dMax, hMin, hMax, gapMin = 1, gapMax = 3, tintBase = '#ffffff', tintVar = 0.12 }) => {
    const placed = []
    let z = -r() * 2
    while (z > -SEG + 3) {
      const d = Math.min(dMin + r() * (dMax - dMin), SEG + z - 0.5)
      if (d < 4) break
      const w = wMin + r() * (wMax - wMin)
      const h = hMin + r() * (hMax - hMin)
      part.add(side * (x0 + w / 2), 0, z - d / 2, { sx: w, sy: h, sz: d, color: tint(tintBase, tintVar) })
      placed.push({ x0, z: z - d / 2, d, w, h })
      z -= d + gapMin + r() * (gapMax - gapMin)
    }
    return placed
  }

  const sideGround = (y = 0.15) => {
    for (const side of [-1, 1]) P.ground.add(side * (EDGE + LAND_W / 2), y - LAND_H / 2, -SEG / 2)
  }

  const catenary = (xMast = 5.2) => {
    for (const side of [-1, 1]) P.cyl.add(side * xMast, 0, -SEG / 2, { sx: 0.24, sy: 8.3, sz: 0.24, color: col('#4a4f57') })
    P.metal.add(0, 8.1, -SEG / 2, { sx: xMast * 2, sy: 0.18, sz: 0.18, color: col('#4a4f57') })
    for (const x of [-2.5, 0, 2.5]) P.metal.add(x, 7.65, -SEG / 2, { sx: 0.05, sy: 0.75, sz: 0.05, color: col('#4a4f57') })
  }

  // ---------------------------------------------------------------- per-map layouts
  const LAYOUT = {
    subway(s, type, first, last) {
      if (type === 'tunnel') {
        P.arch.add(0, 0, -SEG / 2)
        for (const side of [-1, 1]) {
          P.misc.add(side * 7.2, 0.8, -SEG / 2, { sx: 0.6, sy: 1.6, sz: SEG, color: col('#4f4c49') })
          P.misc.add(side * 5.6, 0.2, -SEG / 2, { sx: 1.4, sy: 0.4, sz: SEG, color: col('#6a6762') })
          P.metal.add(side * 6.9, 3.0, -SEG / 2, { sx: 0.08, sy: 0.08, sz: SEG, color: col('#2a2a2a') })
          for (let k = 0; k < 4; k++) P.glow.add(side * 6.2, 5.2, -3 - k * 5.5, { sx: 0.14, sy: 0.08, sz: 1.4, color: col('#ffe2b0', 2.6) })
        }
        if (first) {
          P.misc.add(0, 10.2, 0, { sx: 32, sy: 4.4, sz: 1.2, color: col('#77736d') })
          for (const side of [-1, 1]) P.misc.add(side * 10.8, 4.4, 0, { sx: 7.2, sy: 8.8, sz: 1.2, color: col('#77736d') })
          P.glow.add(0, 8.4, 0.65, { sx: 6, sy: 0.25, sz: 0.05, color: col('#ff9d4d', 2) })
        }
        if (last) {
          P.misc.add(0, 10.2, -SEG, { sx: 32, sy: 4.4, sz: 1.2, color: col('#77736d') })
          for (const side of [-1, 1]) P.misc.add(side * 10.8, 4.4, -SEG, { sx: 7.2, sy: 8.8, sz: 1.2, color: col('#77736d') })
        }
        return
      }
      sideGround(0.15)
      catenary()
      if (type === 'station') {
        for (const side of [-1, 1]) {
          P.misc.add(side * 7.05, 0.5, -SEG / 2, { sx: 4.6, sy: 1.0, sz: SEG, color: col('#b9b4ab') })
          P.misc.add(side * 4.95, 1.01, -SEG / 2, { sx: 0.3, sy: 0.02, sz: SEG, color: col('#f2c230') })
          for (const z of [-5.5, -16.5]) P.cyl.add(side * 7.7, 1, z, { sx: 0.4, sy: 5.5, sz: 0.4, color: col('#3d5a4f') })
          P.misc.add(side * 7.3, 6.6, -SEG / 2, { sx: 5.8, sy: 0.3, sz: SEG, color: col('#2f3a36') })
          P.glow.add(side * 6.0, 6.42, -SEG / 2, { sx: 0.16, sy: 0.05, sz: SEG * 0.92, color: col('#fff1d6', 2.2) })
          P.misc.add(side * 8.8, 1.25, -11, { sx: 0.5, sy: 0.45, sz: 2.2, color: col('#8a5a3a') })
          P.misc.add(side * 9.6, 3.0, -SEG / 2, { sx: 0.4, sy: 6, sz: SEG, color: col('#e8e2d6') })
          P.signs.add(side * 6.3, 5.4, -11, { ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, tile: (segIndex[s] + (side > 0 ? 1 : 0)) % 2 })
          P.graffiti.add(side * 9.35, 2.6, -16, { ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, tile: Math.floor(r() * 4), sx: 0.8, sy: 0.8 })
        }
        return
      }
      // open cut: retaining walls covered in graffiti, city behind
      for (const side of [-1, 1]) {
        P.misc.add(side * 6.1, 1.8, -SEG / 2, { sx: 0.6, sy: 3.6, sz: SEG, color: col('#8f8a84') })
        P.misc.add(side * 6.1, 3.7, -SEG / 2, { sx: 0.85, sy: 0.22, sz: SEG, color: col('#b3ada4') })
        for (const z of [-5.5, -16.5]) P.graffiti.add(side * 5.78, 1.8, z + (r() - 0.5) * 2, { ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, tile: Math.floor(r() * 4) })
        buildingRow(P.building, side, { x0: 9 + r() * 2, wMin: 7, wMax: 12, dMin: 7, dMax: 12, hMin: 8, hMax: 24, tintBase: pick(['#b5634a', '#c9b8a0', '#8a6f5c', '#d4c3a3']) })
        buildingRow(P.building, side, { x0: 26 + r() * 8, wMin: 10, wMax: 16, dMin: 9, dMax: 16, hMin: 18, hMax: 40, gapMin: 3, gapMax: 8, tintBase: '#c8c0b4' })
        P.glow.add(side * 5.75, 3.2, -11, { sx: 0.1, sy: 0.12, sz: 0.5, color: col('#ffd08a', 1.6) })
      }
    },

    city(s) {
      sideGround(0.15)
      for (const side of [-1, 1]) {
        P.road.add(side * 9.9, 0.03, -SEG / 2)
        P.cyl.add(side * 5.0, 0, -SEG / 2, { sx: 0.2, sy: 8.2, sz: 0.2, color: col('#5b616b') })
        P.metal.add(side * 4.3, 7.9, -SEG / 2, { sx: 1.4, sy: 0.08, sz: 0.08, color: col('#5b616b') })
        const towers = r() < 0.65
        buildingRow(towers ? P.tower : P.building, side, { x0: 19.5 + r() * 3, wMin: 12, wMax: 18, dMin: 10, dMax: 16, hMin: towers ? 38 : 20, hMax: towers ? 110 : 48, gapMin: 2, gapMax: 5, tintBase: towers ? '#ffffff' : '#e6dfd2' })
        buildingRow(P.tower, side, { x0: 42 + r() * 10, wMin: 14, wMax: 22, dMin: 12, dMax: 18, hMin: 60, hMax: 140, gapMin: 4, gapMax: 9 })
        for (const z of [-5, -16]) {
          P.cyl.add(side * 15.8, 0.15, z, { sx: 0.24, sy: 2.4, sz: 0.24, color: col('#4a3a2c') })
          P.crown.add(side * 15.8, 3.3, z, { sx: 0.95, sy: 1.15, sz: 0.95, ry: r() * 6, color: tint('#4f8a3a', 0.15) })
        }
        addLamp(side, side < 0 ? -10 : -21, 14.8, '#fff3d6', { height: 7.5, pool: false })
        if (r() < 0.35) P.billboard.add(side * 19.3, 15 + r() * 8, -SEG / 2, { ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, tile: Math.floor(r() * 4) })
      }
      if (segIndex[s] % 7 === 0) {
        // overpass bridge across the tracks
        P.misc.add(0, 14.2, -SEG / 2, { sx: 70, sy: 1.1, sz: 9, color: col('#bdb7ad') })
        P.metal.add(0, 15.15, -SEG / 2 + 4.3, { sx: 70, sy: 0.8, sz: 0.12, color: col('#7c8796') })
        P.metal.add(0, 15.15, -SEG / 2 - 4.3, { sx: 70, sy: 0.8, sz: 0.12, color: col('#7c8796') })
        P.glow.add(0, 13.62, -SEG / 2 + 4.4, { sx: 60, sy: 0.08, sz: 0.08, color: col('#7fd0ff', 1.6) })
        for (const x of [-15.5, -5.9, 5.9, 15.5]) P.misc.add(x, 6.85, -SEG / 2, { sx: 1.3, sy: 13.7, sz: 1.6, color: col('#a9a399') })
      }
    },

    industrial(s) {
      sideGround(0.12)
      catenary(5.0)
      const palette = ['#b33a2b', '#2f5f8f', '#2f8f5a', '#d98a1f', '#6b6f75', '#8a2f5f']
      for (const side of [-1, 1]) {
        // fence
        for (let k = 0; k < 6; k++) P.metal.add(side * 5.9, 1.2, -1.8 - k * 3.6, { sx: 0.08, sy: 2.4, sz: 0.08, color: col('#3a3d42') })
        P.metal.add(side * 5.9, 2.35, -SEG / 2, { sx: 0.05, sy: 0.05, sz: SEG, color: col('#3a3d42') })
        P.metal.add(side * 5.9, 1.2, -SEG / 2, { sx: 0.04, sy: 0.04, sz: SEG, color: col('#3a3d42') })
        // container stacks
        let z = -1.5 - r() * 2
        while (z > -SEG + 3.5) {
          const x = side * (8.5 + r() * 12)
          const levels = 1 + Math.floor(r() * 3)
          const rot = r() < 0.7 ? 0 : Math.PI / 2
          for (let l = 0; l < levels; l++) P.container.add(x + (r() - 0.5) * 0.3, 1.42 + l * 2.6, z - 3, { ry: rot, color: _c.set(pick(palette)) })
          z -= rot ? 4.2 : 7
        }
        // factory halls with sawtooth roofs
        const halls = buildingRow(P.building, side, { x0: 28 + r() * 4, wMin: 18, wMax: 28, dMin: 12, dMax: 20, hMin: 9, hMax: 16, gapMin: 2, gapMax: 4, tintBase: '#a08a78' })
        for (const h of halls) {
          for (let k = 0; k < 3; k++) {
            const zz = h.z - h.d / 2 + (k + 0.5) * (h.d / 3)
            P.prism.add(side * (h.x0 + h.w / 2), h.h, zz, { sx: h.d / 3, sy: 2.2, sz: h.w, ry: Math.PI / 2, color: col('#6d6a66') })
          }
        }
        // sodium lamps
        addLamp(side, side < 0 ? -6 : -17, 6.6, '#ffae45', { height: 9, arm: 2.2, pool: false })
        P.cyl.add(side * 11, 0.9, -SEG / 2, { sx: 0.7, sy: SEG, sz: 0.7, rx: Math.PI / 2, color: col('#7a4a32') })
      }
      chimneys[s].length = 0
      if (segIndex[s] % 2 === 0) {
        const side = segIndex[s] % 4 === 0 ? -1 : 1
        const h = 26 + r() * 16
        const x = side * (34 + r() * 8)
        P.cyl.add(x, 0, -11, { sx: 2.6, sy: h, sz: 2.6, color: col('#8a3a2a') })
        P.cyl.add(x, h - 3, -11, { sx: 2.75, sy: 1.2, sz: 2.75, color: col('#e9e4dc') })
        chimneys[s].push({ x, y: h + 0.5, z: -11 })
      }
      if (segIndex[s] % 3 === 1) {
        const side = r() < 0.5 ? -1 : 1
        P.cyl.add(side * 48, 0, -11, { sx: 9, sy: 8 + r() * 3, sz: 9, color: col('#c9c6bf') })
      }
      if (segIndex[s] % 5 === 0) {
        // gantry crane over the container yard
        const side = r() < 0.5 ? -1 : 1
        for (const x of [8, 21]) P.metal.add(side * x, 8, -11, { sx: 0.8, sy: 16, sz: 0.8, color: col('#e3b52a') })
        P.metal.add(side * 14.5, 16, -11, { sx: 15, sy: 1.2, sz: 1.4, color: col('#e3b52a') })
        P.metal.add(side * 12, 14.6, -11, { sx: 1.6, sy: 1.6, sz: 1.6, color: col('#2c2f34') })
      }
    },

    beach(s) {
      // left: sand down to the sea · right: promenade, palms and pastel houses
      P.road.add(-(EDGE + 8.7), -0.02, -SEG / 2, { sx: 1.85 })
      P.ground.add(EDGE + LAND_W / 2, 0.12 - LAND_H / 2, -SEG / 2)
      P.misc.add(-22.1, -0.25, -SEG / 2, { sx: 0.6, sy: 0.12, sz: SEG, color: col('#ffffff', 1.1) })
      const brights = ['#ff6f61', '#ffd23f', '#3bceac', '#2ec4f1', '#ff8fb1', '#ffffff']
      for (let k = 0; k < 2; k++) {
        const x = -(8.5 + r() * 10)
        const z = -4 - k * 10 - r() * 3
        P.cyl.add(x, 0, z, { sx: 0.08, sy: 2.5, sz: 0.08, color: col('#e8e8e8') })
        P.cone.add(x, 1.95, z, { sx: 2.8, sy: 0.65, sz: 2.8, color: _c.set(pick(brights)) })
        P.misc.add(x + 1.3, 0.25, z + 0.6, { sx: 0.75, sy: 0.22, sz: 1.9, ry: 0.2, color: _c.set(pick(['#ffffff', '#2ec4f1', '#ff6f61'])) })
      }
      if (r() < 0.5) P.misc.add(-(6.8 + r() * 12), 1.1, -SEG / 2, { sx: 0.55, sy: 2.2, sz: 0.07, rz: (r() - 0.5) * 0.4, color: _c.set(pick(brights)) })
      if (segIndex[s] % 4 === 0) {
        // lifeguard tower
        for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) P.metal.add(-15 + dx, 1.3, -11 + dz, { sx: 0.12, sy: 2.6, sz: 0.12, color: col('#f2f2f2') })
        P.misc.add(-15, 3.2, -11, { sx: 2.2, sy: 1.4, sz: 2.2, color: col('#e8483f') })
        P.prism.add(-15, 3.9, -11, { sx: 2.8, sy: 1.0, sz: 2.8, color: col('#ffffff') })
      }
      for (const z of [-4, -15]) {
        const zz = z + (r() - 0.5) * 3
        const ry = Math.PI + (r() - 0.5) * 0.8
        P.palmTrunk.add(6.4, 0.1, zz, { ry, sy: 0.9 + r() * 0.25 })
        P.palmFronds.add(6.4, 0.1, zz, { ry, sy: 0.9 + r() * 0.25, color: tint('#3f9a3a', 0.15) })
      }
      if (r() < 0.55) {
        const zz = -11 + (r() - 0.5) * 8
        const ry = (r() - 0.5) * 1.5
        P.palmTrunk.add(-6.2, 0.05, zz, { ry })
        P.palmFronds.add(-6.2, 0.05, zz, { ry, color: tint('#3f9a3a', 0.15) })
      }
      const pastel = ['#f7d6a8', '#bfe6d8', '#f4b6b6', '#c8d8f2', '#f2e6a6']
      const houses = buildingRow(P.building, 1, { x0: 12 + r() * 2, wMin: 7, wMax: 11, dMin: 7, dMax: 10, hMin: 6, hMax: 13, gapMin: 2, gapMax: 4, tintBase: pick(pastel), tintVar: 0.05 })
      for (const h of houses) P.prism.add(h.x0 + h.w / 2, h.h, h.z, { sx: h.w, sy: 2.2, sz: h.d, color: col('#c8664a') })
      buildingRow(P.building, 1, { x0: 30 + r() * 6, wMin: 10, wMax: 16, dMin: 9, dMax: 14, hMin: 12, hMax: 26, gapMin: 3, gapMax: 7, tintBase: pick(pastel), tintVar: 0.06 })
      addLamp(1, -11, 5.4, '#ffffff', { height: 6, arm: 1.2, pool: false, halo: false })
    },

    night(s) {
      sideGround(0.18)
      const neonColors = ['#ff3df2', '#29e1ff']
      for (const side of [-1, 1]) {
        const front = buildingRow(P.building, side, { x0: 8.2 + r() * 1.5, wMin: 7, wMax: 12, dMin: 7, dMax: 12, hMin: 10, hMax: 34, tintBase: '#ffffff' })
        for (const b of front) {
          if (r() < 0.75) P.neon.add(side * (b.x0 - 0.06), 4.5 + r() * Math.max(1, b.h - 9), b.z, { ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, tile: Math.floor(r() * 4), sx: 0.8 + r() * 0.5, sy: 0.8 + r() * 0.5 })
          P.glow.add(side * (b.x0 - 0.04), b.h - 0.3, b.z, { sx: 0.06, sy: 0.08, sz: b.d * 0.95, color: col(neonColors[Math.floor(r() * 2)], 2.2) })
        }
        buildingRow(P.tower, side, { x0: 26 + r() * 8, wMin: 12, wMax: 18, dMin: 10, dMax: 16, hMin: 40, hMax: 110, gapMin: 3, gapMax: 8 })
        addLamp(side, side < 0 ? -3 : -14, 4.75, neonColors[(segIndex[s] + (side > 0 ? 1 : 0)) % 2])
        const tz = -8 + (r() - 0.5) * 2
        P.cyl.add(side * 6.3, 0.18, tz, { sx: 0.22, sy: 2.6, sz: 0.22, color: col('#1b1714') })
        P.crown.add(side * 6.3, 3.2, tz, { sx: 0.85, sy: 1.05, sz: 0.85, ry: r() * 6, color: col('#1d3138') })
      }
    },
  }
  const pick = (a) => a[Math.floor(r() * a.length)]

  function layout(s) {
    parts.forEach((p) => p.begin(s))
    let type = 'open'
    let first = false
    let last = false
    if (map.id === 'subway') {
      // runs of open cut / stations / tunnels, consistent across consecutive segments
      if (runLeft <= 0) {
        const roll = r()
        runType = runType !== 'open' ? 'open' : roll < 0.45 ? 'tunnel' : roll < 0.75 ? 'station' : 'open'
        runLeft = runType === 'tunnel' ? 4 + Math.floor(r() * 3) : runType === 'station' ? 3 : 3 + Math.floor(r() * 3)
        first = true
      }
      runLeft -= 1
      last = runLeft <= 0
      type = runType
    }
    segType[s] = type
    chimneys[s].length = 0
    LAYOUT[map.id](s, type, first, last)
    parts.forEach((p) => p.end())
  }

  // ---------------------------------------------------------------- map switching
  const setMap = (id) => {
    if (id === mapId) return
    mapId = id
    map = getMap(id)
    const visible = new Set(MAP_PARTS[id])
    for (const [key, part] of Object.entries(P)) part.mesh.visible = visible.has(key)
    const gt = groundTexture(map.side === 'pavers' ? 'pavers' : map.side === 'pavement' ? 'pavement' : map.side).clone()
    gt.repeat.set(map.side === 'sand' ? 16 : 22, 4)
    gt.needsUpdate = true
    groundMat.map?.dispose()
    groundMat.map = gt
    groundMat.color.set(GROUND_TINT[id])
    groundMat.needsUpdate = true
    if (ROAD_KIND[id]) {
      const rt = groundTexture(ROAD_KIND[id]).clone()
      rt.repeat.set(1, 1.8)
      rt.needsUpdate = true
      if (roadMat.map && roadMat.map !== groundTexture('asphalt')) roadMat.map.dispose()
      roadMat.map = rt
      roadMat.color.set('#ffffff')
      roadMat.needsUpdate = true
    }
    // facade tuning: lit windows only matter at night
    const night = map.night
    concreteMat.color.set(night ? '#2c3342' : id === 'industrial' ? '#8e8072' : '#9a958d')
    concreteMat.userData.uniforms.uIntensity.value = night ? 1.05 : 0.18
    concreteMat.userData.uniforms.uShop.value.set('#ffb870').multiplyScalar(night ? 0.8 : 0.25)
    concreteMat.userData.uniforms.uGlass.value.set(night ? '#0b1424' : '#33465e')
    towerMat.color.set(night ? '#0d1830' : '#3a5276')
    towerMat.userData.uniforms.uIntensity.value = night ? 1.0 : 0.12
    towerMat.userData.uniforms.uGlass.value.set(night ? '#081226' : '#5b7aa3')
    crownMat.color.set('#ffffff')
    frondMat.color.set('#ffffff')
    archMat.color.set('#5d5a57')
    // movers
    const traffic = id === 'city'
    const boats = id === 'beach'
    carBody.visible = carCabin.visible = carLights.visible = traffic
    sail.visible = boats
    movers.forEach((m, i) => {
      if (traffic) {
        const lane = i % 4
        m.x = [-7.4, -12.4, 7.4, 12.4][lane]
        m.v = (lane % 2 ? 1 : -1) * (7 + r() * 7)
        m.z = 30 - r() * 260
        m.color.set(pick(['#c62f3a', '#f2f2f2', '#1f2a3a', '#2f6fb3', '#e8b730', '#5a5f66', '#0f0f12']))
      } else {
        m.x = -(60 + r() * 160)
        m.v = (r() - 0.5) * 3
        m.z = 40 - r() * 300
        m.color.set(pick(['#ffffff', '#ff6f61', '#ffd23f', '#2ec4f1']))
      }
      carBody.setColorAt(i, m.color)
      sail.setColorAt(i, m.color)
      carLights.setColorAt(i, _c.set(m.v > 0 ? '#fff4d6' : '#ff2d2d').multiplyScalar(m.v > 0 ? 2.2 : 1.6))
    })
    carBody.instanceColor.needsUpdate = true
    carLights.instanceColor.needsUpdate = true
    sail.instanceColor.needsUpdate = true
    // the stretch around the runner always starts as open track (no tunnel over the menu shot)
    runType = 'open'
    runLeft = 8
    for (let s = 0; s < N; s++) {
      segZ[s] = SCENERY_START_Z - s * SEG
      segIndex[s] = counter++
      layout(s)
    }
  }

  // ---------------------------------------------------------------- per-frame
  let smokeTimer = 0
  const update = (dt) => {
    const dz = runtime.dz
    for (let s = 0; s < N; s++) {
      segZ[s] += dz
      if (segZ[s] - SEG > SCENERY_START_Z) {
        segZ[s] -= N * SEG
        segIndex[s] = counter++
        layout(s)
      }
    }
    for (const p of parts) if (p.mesh.visible) p.scroll(segZ)

    // tunnel darkness: is the segment just ahead of the runner a tunnel?
    let inTunnel = 0
    if (map.id === 'subway') {
      for (let s = 0; s < N; s++) {
        if (segType[s] !== 'tunnel') continue
        if (segZ[s] > -2 && segZ[s] - SEG < 4) inTunnel = 1
      }
    }
    runtime.tunnel += (inTunnel - runtime.tunnel) * (1 - Math.exp(-4 * dt))

    // movers
    if (carBody.visible || sail.visible) {
      for (let i = 0; i < MOVERS; i++) {
        const m = movers[i]
        m.z += dz + m.v * runtime.dt
        if (m.z > 40) m.z -= 270
        if (m.z < -230) m.z += 270
        _p.set(m.x, sail.visible ? -0.4 : 0.15, m.z)
        _q.setFromEuler(_e.set(0, m.v > 0 ? 0 : Math.PI, 0))
        _m.compose(_p, _q, _s.set(1, 1, 1))
        if (carBody.visible) {
          carBody.setMatrixAt(i, _m)
          carCabin.setMatrixAt(i, _m)
          carLights.setMatrixAt(i, _m)
        } else sail.setMatrixAt(i, _m)
      }
      carBody.instanceMatrix.needsUpdate = carCabin.instanceMatrix.needsUpdate = carLights.instanceMatrix.needsUpdate = true
      sail.instanceMatrix.needsUpdate = true
    }

    // chimney smoke
    if (map.id === 'industrial') {
      smokeTimer -= dt
      if (smokeTimer <= 0) {
        smokeTimer = 0.12
        for (let s = 0; s < N; s++) for (const c of chimneys[s]) {
          const z = segZ[s] + c.z
          if (z < 30 && z > -230) fx.smoke({ x: c.x + (r() - 0.5), y: c.y, z })
        }
      }
    }
    haloMat.opacity = 0.35 + atmo.night * 0.5
  }

  const dispose = () => {
    parts.forEach((p) => p.dispose())
    ;[carBody, carCabin, carLights, sail].forEach((m) => {
      m.geometry.dispose()
      m.material.dispose()
      m.dispose()
    })
    mats.forEach((m) => m.dispose())
  }

  return { group, update, setMap, dispose, current: () => mapId }
}

export default function Scenery() {
  const mapId = useGame(displayMapId)
  const sys = useMemo(() => createScenery(), [])
  useEffect(() => sys.setMap(mapId), [sys, mapId])
  useEffect(
    () =>
      onReset(() => {
        // runs always start on the selected map
        if (runtime.mapId !== sys.current()) sys.setMap(runtime.mapId)
      }),
    [sys],
  )
  useEffect(() => () => sys.dispose(), [sys])
  useFrame((_, delta) => sys.update(Math.min(delta, 0.05)), -7)
  return <primitive object={sys.group} />
}
