import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENERY_START_Z, SEGMENT_COUNT, SEGMENT_LENGTH, ZONES, zoneIndexAt } from '../game/constants'
import { onReset, runtime } from '../game/runtime'
import { atmo } from '../game/atmosphere'
import { paverTexture } from '../game/textures'
import { getMaterials, makeBuildingMaterial } from './materials'

const N = SEGMENT_COUNT
const SEG = SEGMENT_LENGTH
const LAND_W = 110
const LAND_H = 6.2
const SIDEWALK_Y = 0.18

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _e = new THREE.Euler()
const _c = new THREE.Color()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** One instanced mesh with a fixed number of slots reserved per scenery segment. */
class Part {
  constructor(geometry, material, perSeg, { colors = false, shadow = false } = {}) {
    this.perSeg = perSeg
    this.mesh = new THREE.InstancedMesh(geometry, material, perSeg * N)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = shadow
    this.mesh.receiveShadow = false
    this.localZ = new Float32Array(perSeg * N)
    this.hasColors = colors
    if (colors) {
      for (let i = 0; i < perSeg * N; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1))
    }
    this.base = 0
    this.cursor = 0
  }
  begin(seg) {
    this.base = seg * this.perSeg
    this.cursor = 0
  }
  add(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, color = null, quat = null) {
    if (this.cursor >= this.perSeg) return
    const i = this.base + this.cursor++
    _p.set(x, y, z)
    if (quat) _q.copy(quat)
    else _q.setFromEuler(_e.set(0, ry, 0))
    _s.set(sx, sy, sz)
    _m.compose(_p, _q, _s)
    this.mesh.setMatrixAt(i, _m)
    this.localZ[i] = z
    if (color && this.hasColors) this.mesh.setColorAt(i, color)
  }
  end() {
    while (this.cursor < this.perSeg) {
      const i = this.base + this.cursor++
      this.mesh.setMatrixAt(i, HIDDEN)
      this.localZ[i] = 0
    }
    if (this.hasColors) this.mesh.instanceColor.needsUpdate = true
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

function createScenery() {
  const M = getMaterials()
  const group = new THREE.Group()

  const paver = paverTexture().clone()
  paver.repeat.set(44, 9)
  paver.needsUpdate = true
  const landMat = new THREE.MeshStandardMaterial({ map: paver, color: '#b4bccb', roughness: 0.78, metalness: 0.1 })

  const concreteMat = makeBuildingMaterial({
    color: '#2c3342',
    warm: '#ffc47e',
    cool: '#a8c8ff',
    lit: 0.38,
    intensity: 1.05,
    shopIntensity: 0.8,
  })
  const towerMat = makeBuildingMaterial({
    color: '#0d1830',
    roughness: 0.18,
    metalness: 0.85,
    warm: '#d6e4ff',
    cool: '#6f9bff',
    glassTint: '#081226',
    lit: 0.3,
    intensity: 1.0,
    floorH: 3.6,
    colW: 1.8,
    style: 1,
  })
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1d3138', roughness: 0.9, flatShading: true })
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#1b1714', roughness: 0.95 })
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a3'), toneMapped: false })
  const poolMat = M.pool.clone()
  const haloMat = M.haloWarm.clone()
  haloMat.side = THREE.DoubleSide
  const railLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9cc8ff'), toneMapped: false })
  const cableMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9d2ff').multiplyScalar(1.15), toneMapped: false })
  const railGlassMat = new THREE.MeshStandardMaterial({
    color: '#8fb4ff',
    transparent: true,
    opacity: 0.12,
    metalness: 0.9,
    roughness: 0.05,
    depthWrite: false,
  })
  const pylonMat = new THREE.MeshStandardMaterial({ color: '#4b5466', roughness: 0.7, metalness: 0.3 })

  const box = (w, h, d, baseAtZero = false) => {
    const g = new THREE.BoxGeometry(w, h, d)
    if (baseAtZero) g.translate(0, h / 2, 0)
    return g
  }

  const P = {
    land: new Part(box(LAND_W, LAND_H, SEG), landMat, 2),
    building: new Part(box(1, 1, 1, true), concreteMat, 8, { colors: true }),
    tower: new Part(box(1, 1, 1, true), towerMat, 6, { colors: true }),
    pole: new Part(new THREE.CylinderGeometry(0.06, 0.09, 7, 8).translate(0, 3.5, 0), M.darkMetal, 2, { shadow: true }),
    arm: new Part(box(1.7, 0.07, 0.1), M.darkMetal, 2),
    head: new Part(box(0.8, 0.06, 0.26), lampHeadMat, 2),
    halo: new Part(new THREE.PlaneGeometry(2.8, 2.8), haloMat, 2),
    pool: new Part(new THREE.PlaneGeometry(7.5, 9).rotateX(-Math.PI / 2), poolMat, 2),
    trunk: new Part(new THREE.CylinderGeometry(0.09, 0.14, 2.6, 6).translate(0, 1.3, 0), trunkMat, 4),
    crown: new Part(new THREE.IcosahedronGeometry(1.25, 1), treeMat, 4),
    planter: new Part(box(1.4, 0.55, 5, true), M.graphite, 2),
    railTop: new Part(box(0.09, 0.07, SEG), railLightMat, 2),
    railGlass: new Part(box(0.03, 1.0, SEG), railGlassMat, 2),
    pylon: new Part(box(1, 1, 1, true), pylonMat, 4),
    cable: new Part(new THREE.CylinderGeometry(0.035, 0.035, 1, 4).translate(0, 0.5, 0), cableMat, 12),
  }
  const parts = Object.values(P)
  parts.forEach((p) => group.add(p.mesh))

  const segZ = new Float32Array(N)
  const segIndex = new Int32Array(N) // absolute index — used for periodic features like pylons
  let counter = 0

  const r = Math.random
  const tint = () => _c.setRGB(0.82 + r() * 0.18, 0.82 + r() * 0.18, 0.86 + r() * 0.14)

  const addLamps = (xPole) => {
    for (const side of [-1, 1]) {
      const z = side < 0 ? -3 : -3 - SEG / 2
      const xp = side * xPole
      P.pole.add(xp, 0, z)
      P.arm.add(xp - side * 0.85, 6.95, z)
      P.head.add(xp - side * 1.45, 6.88, z)
      P.halo.add(xp - side * 1.45, 6.75, z + 0.2)
      P.pool.add(side * 2.7, 0.025, z)
    }
  }

  const addBuildingRow = (part, side, { x0, wMin, wMax, dMin, dMax, hMin, hMax, gapMin = 1, gapMax = 3 }) => {
    let z = -r() * 2
    while (z > -SEG + 3) {
      const d = Math.min(dMin + r() * (dMax - dMin), SEG + z - 0.5)
      if (d < 4) break
      const w = wMin + r() * (wMax - wMin)
      const h = hMin + r() * (hMax - hMin)
      part.add(side * (x0 + w / 2), 0, z - d / 2, w, h, d, 0, tint())
      z -= d + gapMin + r() * (gapMax - gapMin)
    }
  }

  function layout(s) {
    const zone = ZONES[zoneIndexAt(runtime.distance - (segZ[s] - SEG / 2))].key
    const abs = segIndex[s]
    parts.forEach((p) => p.begin(s))

    if (zone === 'avenue' || zone === 'glass') {
      for (const side of [-1, 1]) P.land.add(side * (4.2 + LAND_W / 2), SIDEWALK_Y - LAND_H / 2, -SEG / 2)
      addLamps(4.75)
    }

    if (zone === 'avenue') {
      for (const side of [-1, 1]) {
        addBuildingRow(P.building, side, { x0: 8.2 + r() * 1.5, wMin: 7, wMax: 12, dMin: 7, dMax: 12, hMin: 9, hMax: 30 })
        addBuildingRow(P.building, side, {
          x0: 24 + r() * 8,
          wMin: 10,
          wMax: 16,
          dMin: 9,
          dMax: 16,
          hMin: 22,
          hMax: 52,
          gapMin: 3,
          gapMax: 8,
        })
        for (const z of [-8, -16.5]) {
          const tz = z + (r() - 0.5) * 1.5
          P.trunk.add(side * 6.3, SIDEWALK_Y, tz)
          const k = 0.72 + r() * 0.3
          P.crown.add(side * 6.3, SIDEWALK_Y + 3.3 * k, tz, k, k * 1.25, k, r() * 6)
        }
      }
    } else if (zone === 'glass') {
      for (const side of [-1, 1]) {
        addBuildingRow(P.tower, side, { x0: 10 + r() * 2, wMin: 10, wMax: 16, dMin: 10, dMax: 16, hMin: 32, hMax: 90, gapMin: 2, gapMax: 5 })
        addBuildingRow(P.tower, side, { x0: 34 + r() * 10, wMin: 12, wMax: 20, dMin: 12, dMax: 18, hMin: 55, hMax: 130, gapMin: 4, gapMax: 9 })
        const pz = -SEG * 0.5 + (side < 0 ? 0 : 4)
        P.planter.add(side * 6.6, SIDEWALK_Y, pz)
        const k = 0.6 + r() * 0.2
        P.trunk.add(side * 6.6, SIDEWALK_Y + 0.5, pz, 0.8, 0.8, 0.8)
        P.crown.add(side * 6.6, SIDEWALK_Y + 0.5 + 2.7 * k, pz, k, k * 1.3, k, r() * 6)
      }
    } else {
      // Harbor Bridge — deck railings, pylons, fan cables, a distant skyline across the water
      for (const side of [-1, 1]) {
        P.railTop.add(side * 4.42, 1.12, -SEG / 2)
        P.railGlass.add(side * 4.42, 0.6, -SEG / 2)
        addBuildingRow(P.building, side, {
          x0: 75 + r() * 40,
          wMin: 12,
          wMax: 24,
          dMin: 10,
          dMax: 18,
          hMin: 16,
          hMax: 60,
          gapMin: 2,
          gapMax: 6,
        })
      }
      addLamps(4.55)
      if (abs % 4 === 0) {
        const zp = -SEG / 2
        for (const side of [-1, 1]) P.pylon.add(side * 6.4, -9, zp, 1.1, 41, 1.6)
        P.pylon.add(0, 29.5, zp, 14, 1.3, 1.4)
        P.pylon.add(0, 13, zp, 13.4, 0.9, 1.2)
        for (const side of [-1, 1]) {
          for (const off of [-7, -13, -19, 7, 13, 19]) {
            _a.set(side * 6.2, 29, zp)
            _b.set(side * 4.45, 1.15, zp + off)
            const len = _a.distanceTo(_b)
            _q.setFromUnitVectors(UP, _a.sub(_b).normalize())
            P.cable.add(_b.x, _b.y, _b.z, 1, len, 1, 0, null, _q)
          }
        }
      }
    }
    parts.forEach((p) => p.end())
  }

  for (let s = 0; s < N; s++) {
    segZ[s] = SCENERY_START_Z - s * SEG
    segIndex[s] = counter++
    layout(s)
  }

  const relayoutAll = () => {
    for (let s = 0; s < N; s++) layout(s)
  }

  const update = () => {
    const dz = runtime.dz
    for (let s = 0; s < N; s++) {
      segZ[s] += dz
      if (segZ[s] - SEG > SCENERY_START_Z) {
        segZ[s] -= N * SEG
        segIndex[s] = counter++
        layout(s)
      }
    }
    for (const p of parts) p.scroll(segZ)
    lampHeadMat.color.copy(atmo.lamp).multiplyScalar(3.4)
    haloMat.color.copy(atmo.lamp)
    poolMat.color.copy(atmo.lamp)
    railLightMat.color.copy(atmo.accent).multiplyScalar(2.4)
  }

  const dispose = () => {
    parts.forEach((p) => p.dispose())
    ;[landMat, concreteMat, towerMat, treeMat, trunkMat, lampHeadMat, poolMat, haloMat, railLightMat, cableMat, railGlassMat, pylonMat].forEach(
      (m) => m.dispose(),
    )
    paver.dispose()
  }

  return { group, update, relayoutAll, dispose }
}

export default function Scenery() {
  const sys = useMemo(() => createScenery(), [])
  useEffect(() => onReset(() => sys.relayoutAll()), [sys])
  useEffect(() => () => sys.dispose(), [sys])
  useFrame(() => sys.update(), -7)
  return <primitive object={sys.group} />
}
