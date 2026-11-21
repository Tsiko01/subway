import { useFrame } from '@react-three/fiber'
import { MAX_SPEED, MENU_SPEED, SPEED_RAMP_DISTANCE, START_SPEED } from '../game/constants'
import { POWER_KEYS, events, runtime } from '../game/runtime'
import { updateAtmosphere } from '../game/atmosphere'
import { displayMapId, useGame } from '../game/store'
import { audio } from '../game/audio'

let missionClock = 0
let first = true

/**
 * Runs first every frame: advances the simulation clock, world speed, power-up timers,
 * score, the chase, milestones, mission checks and the crash → game-over sequence.
 */
export default function Director() {
  useFrame((_, delta) => {
    const r = runtime
    const realDt = Math.min(delta, 1 / 20)
    const state = useGame.getState()

    updateAtmosphere(displayMapId(state), realDt, first)
    first = false

    if (r.mode === 'paused') {
      r.dt = 0
      r.dz = 0
      return
    }

    let ts = 1
    if (r.crashed) {
      r.crashTime += realDt
      ts = r.crashTime < 1.0 ? 0.3 + r.crashTime * 0.5 : 1
      r.speed *= Math.exp(-(r.crashKind === 'caught' ? 6 : 22) * realDt)
      const wait = r.crashKind === 'caught' ? 1.9 : 1.45
      if (r.crashTime > wait && r.mode === 'playing') {
        audio.play('gameover')
        state.endGame()
      }
    } else if (r.mode === 'playing') {
      r.speedMul += (1 - r.speedMul) * (1 - Math.exp(-0.9 * realDt))
      r.speed = (START_SPEED + (MAX_SPEED - START_SPEED) * (1 - Math.exp(-r.distance / SPEED_RAMP_DISTANCE))) * r.speedMul
    } else if (r.mode === 'menu') {
      // the world pauses while browsing the shop/maps so the runner can idle and show off
      const target = state.screen === 'home' ? MENU_SPEED : 0
      r.speed += (target - r.speed) * (1 - Math.exp(-2.5 * realDt))
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
      r.stats.distance = Math.floor(r.distance)
      r.stats.cleanDistance = Math.max(r.stats.cleanDistance, Math.floor(r.distance - r.cleanStart))

      for (const k of POWER_KEYS) {
        if (r.power[k] <= 0) continue
        r.power[k] = Math.max(0, r.power[k] - dt)
        if (r.power[k] === 0 && k === 'board') {
          audio.play('swoosh')
          events.emit('toast', { kind: 'info', title: 'Board ride over', sub: 'Press E for another' })
        }
      }
      r.invuln = Math.max(0, r.invuln - dt)
      r.chase.heat = Math.max(0, r.chase.heat - dt)

      const mult = r.levelMultiplier * (r.power.double > 0 ? 2 : 1)
      r.multiplier = mult
      r.maxMultiplier = Math.max(r.maxMultiplier, mult)
      r.score += r.dz * mult
      r.stats.score = Math.floor(r.score)

      if (r.distance >= r.nextMilestone) {
        events.emit('toast', { kind: 'milestone', title: `${r.nextMilestone.toLocaleString('en-US')} m`, sub: 'Keep running' })
        audio.play('milestone')
        r.nextMilestone += 500
      }

      missionClock += realDt
      if (missionClock > 0.4) {
        missionClock = 0
        state.checkMissions()
      }
    }

    r.trauma = Math.max(0, r.trauma - realDt * 1.3)
  }, -10)

  return null
}
