import * as THREE from 'three'
import { ZONES, ZONE_LENGTH } from './constants'

const KEYS = ['fog', 'skyTop', 'skyHorizon', 'hemiSky', 'hemiGround', 'lamp', 'accent']
const palettes = ZONES.map((z) => Object.fromEntries(KEYS.map((k) => [k, new THREE.Color(z[k])])))

/** Current blended environment colors — read by every visual system each frame. */
export const atmo = Object.fromEntries(KEYS.map((k) => [k, palettes[0][k].clone()]))

const TRANSITION = 160 // meters of color cross-fade after entering a zone
const smooth = (t) => t * t * (3 - 2 * t)

export function updateAtmosphere(distance) {
  const zi = Math.floor(Math.max(0, distance) / ZONE_LENGTH)
  const cur = palettes[zi % ZONES.length]
  if (zi === 0) {
    for (const k of KEYS) atmo[k].copy(cur[k])
    return
  }
  const prev = palettes[(zi - 1) % ZONES.length]
  const t = smooth(Math.min(1, (distance - zi * ZONE_LENGTH) / TRANSITION))
  for (const k of KEYS) atmo[k].copy(prev[k]).lerp(cur[k], t)
}
