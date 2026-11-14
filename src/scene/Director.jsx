import { useFrame } from '@react-three/fiber'
import {
  GEMS_PER_MULTIPLIER,
  MAX_BASE_MULTIPLIER,
  MAX_SPEED,
  MENU_SPEED,
  SPEED_RAMP_DISTANCE,
  START_SPEED,
  ZONES,
  zoneIndexAt,
} from '../game/constants'
import { events, runtime } from '../game/runtime'
import { updateAtmosphere } from '../game/atmosphere'
import { useGame } from '../game/store'
import { audio } from '../game/audio'

/**
 * Runs first every frame: advances the simulation clock, world speed, score,
 * difficulty, milestones and the crash → game-over sequence.
 */
export default function Director() {
  useFrame((_, delta) => {
    const r = runtime
    const realDt = Math.min(delta, 1 / 20)

    if (r.mode === 'paused') {
      r.dt = 0
      r.dz = 0
      return
    }

    let ts = 1
    if (r.crashed) {
      r.crashTime += realDt
      // dramatic slow motion that eases back to real time
      ts = r.crashTime < 1.0 ? 0.3 + r.crashTime * 0.5 : 1
      r.speed *= Math.exp(-22 * realDt)
      if (r.crashTime > 1.45 && r.mode === 'playing') {
        audio.play('gameover')
        useGame.getState().endGame()
      }
    } else if (r.mode === 'playing') {
      r.speed = START_SPEED + (MAX_SPEED - START_SPEED) * (1 - Math.exp(-r.distance / SPEED_RAMP_DISTANCE))
    } else if (r.mode === 'menu') {
      r.speed += (MENU_SPEED - r.speed) * (1 - Math.exp(-2 * realDt))
    } else {
      r.speed *= Math.exp(-3 * realDt)
    }

    r.timeScale = ts
    const dt = realDt * ts
    r.dt = dt
    r.time += dt
    r.dz = r.speed * dt

    if (r.mode === 'playing' && !r.crashed) {
      r.distance += r.dz
      r.boostTime = Math.max(0, r.boostTime - dt)
      r.magnetTime = Math.max(0, r.magnetTime - dt)

      const base = Math.min(MAX_BASE_MULTIPLIER, 1 + Math.floor(r.gems / GEMS_PER_MULTIPLIER))
      if (base > r.baseMultiplier) {
        r.baseMultiplier = base
        events.emit('toast', { kind: 'mult', title: `×${base} Multiplier`, sub: `${r.gems} azure drops collected` })
        audio.play('milestone')
      }
      const mult = base * (r.boostTime > 0 ? 2 : 1)
      r.multiplier = mult
      r.maxMultiplier = Math.max(r.maxMultiplier, mult)
      r.score += r.dz * mult

      if (r.distance >= r.nextMilestone) {
        events.emit('toast', { kind: 'milestone', title: `${r.nextMilestone.toLocaleString('en-US')} m`, sub: 'Keep running' })
        audio.play('milestone')
        r.nextMilestone += 500
      }

      const zi = zoneIndexAt(r.distance)
      if (zi !== r.zone) {
        r.zone = zi
        const z = ZONES[zi]
        events.emit('toast', { kind: 'zone', title: z.name, sub: z.sub })
      }
    }

    r.trauma = Math.max(0, r.trauma - realDt * 1.3)
    updateAtmosphere(r.mode === 'menu' ? 0 : r.distance)
  }, -10)

  return null
}
