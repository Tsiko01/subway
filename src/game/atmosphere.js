import * as THREE from 'three'
import { MAPS, getMap } from './maps'

const KEYS = ['fog', 'skyTop', 'skyHorizon', 'hemiSky', 'hemiGround', 'sun', 'lamp', 'accent', 'water', 'ridge']
const palettes = Object.fromEntries(MAPS.map((m) => [m.id, Object.fromEntries(KEYS.map((k) => [k, new THREE.Color(m.palette[k])]))]))
const NUMS = ['fogDensity', 'sunIntensity', 'hemiIntensity', 'clouds', 'stars', 'exposure']

/** Current blended environment — read by every visual system each frame. */
export const atmo = {
  ...Object.fromEntries(KEYS.map((k) => [k, palettes.subway[k].clone()])),
  ...Object.fromEntries(NUMS.map((k) => [k, MAPS[0][k]])),
  sunDir: new THREE.Vector3(...MAPS[0].sunDir).normalize(),
  night: 0,
  mapId: 'subway',
}

const target = new THREE.Vector3()

/** Ease the atmosphere toward the given map (instant when `snap`). */
export function updateAtmosphere(mapId, dt, snap = false) {
  const map = getMap(mapId)
  const pal = palettes[map.id]
  const k = snap ? 1 : 1 - Math.exp(-2.4 * dt)
  for (const key of KEYS) atmo[key].lerp(pal[key], k)
  for (const key of NUMS) atmo[key] += (map[key] - atmo[key]) * k
  target.set(...map.sunDir).normalize()
  atmo.sunDir.lerp(target, k).normalize()
  atmo.night += ((map.night ? 1 : 0) - atmo.night) * k
  atmo.mapId = map.id
}
