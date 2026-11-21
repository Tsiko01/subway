import { CHASE_CLOSE, HEAT_DURATION, INVULN_AFTER_HIT, JET_ALTITUDE, STUMBLE_TIME } from './constants'
import { events, fx, runtime } from './runtime'
import { audio } from './audio'

// Central gameplay rules shared by the spawner, the player controller and the officer.

const POWER_TOASTS = {
  magnet: { title: 'Coin Magnet', sub: 'Coins fly straight to you' },
  sneakers: { title: 'Spring Sneakers', sub: 'Jump clean over trains' },
  jetpack: { title: 'Jetpack', sub: 'Take to the sky' },
  double: { title: '2× Score', sub: 'Every point counts twice' },
  board: { title: 'Shield Board', sub: 'Absorbs one crash' },
}

export function activatePower(type, { free = true, toast = true } = {}) {
  const p = runtime.player
  runtime.power[type] = runtime.powerMax[type]
  if (type === 'board') {
    runtime.boardFree = free
    runtime.stats.boards += 1
  }
  if (type === 'jetpack') {
    runtime.stats.jetpacks += 1
    p.grounded = false
    p.vy = 0
    p.slideTime = 0
    p.flip = -1
    runtime.trauma = Math.max(runtime.trauma, 0.25)
    fx.burst({ x: p.x, y: p.y + 0.6, z: 0.3, count: 40, color: 0xffa040, speed: 6, up: -1, life: 0.7, size: 0.18, gravity: -4 })
  }
  audio.play(type === 'board' ? 'boardon' : 'power', { type })
  if (toast) events.emit('toast', { kind: 'power', power: type, ...POWER_TOASTS[type] })
}

/** Leaving jetpack flight: a protected glide back down. */
export function endJetpack() {
  runtime.invuln = Math.max(runtime.invuln, 1.4)
  runtime.player.vy = -2
  runtime.player.descending = true
}

export function breakBoard() {
  const p = runtime.player
  runtime.power.board = 0
  runtime.invuln = INVULN_AFTER_HIT
  runtime.trauma = Math.max(runtime.trauma, 0.55)
  audio.play('boardbreak')
  fx.burst({ x: p.x, y: p.y + 0.2, z: 0, count: 36, color: 0xd9a25a, speed: 6, up: 2.5, life: 0.9, size: 0.14, gravity: -12 })
  fx.burst({ x: p.x, y: p.y + 0.5, z: 0, count: 24, color: 0xffffff, speed: 4, up: 1.5, life: 0.5, size: 0.1, gravity: -4 })
  events.emit('toast', { kind: 'power', power: 'board', title: 'Board destroyed', sub: 'It took the hit for you' })
}

function crash() {
  const p = runtime.player
  runtime.crashed = true
  runtime.crashKind = 'crash'
  runtime.crashTime = 0
  runtime.trauma = 1
  runtime.actions.length = 0
  runtime.chase.state = 'reacting'
  audio.play('crash')
  fx.burst({ x: p.x, y: p.y + 1.0, z: -0.4, count: 70, color: 0xffffff, speed: 8, up: 3, life: 1.1, size: 0.13, gravity: -9 })
  fx.burst({ x: p.x, y: p.y + 0.8, z: -0.4, count: 40, color: 0xffb35c, speed: 5, up: 2, life: 1.3, size: 0.16, gravity: -6 })
  events.emit('crash', 'crash')
}

function caught() {
  runtime.crashed = true
  runtime.crashKind = 'caught'
  runtime.crashTime = 0
  runtime.trauma = 0.6
  runtime.actions.length = 0
  runtime.chase.state = 'catching'
  audio.play('stumble')
  audio.play('caught')
  events.emit('crash', 'caught')
}

function stumble(side) {
  const p = runtime.player
  const c = runtime.chase
  runtime.stats.stumbles += 1
  runtime.cleanStart = runtime.distance
  if (c.heat > 0) {
    // second mistake while the officer is right behind: game over
    caught()
    return 'caught'
  }
  p.stumbleTime = STUMBLE_TIME
  runtime.speedMul = 0.72
  runtime.trauma = Math.max(runtime.trauma, 0.6)
  runtime.invuln = Math.max(runtime.invuln, 0.5)
  if (side) {
    p.lane = p.prevLane
  }
  c.heat = HEAT_DURATION
  c.state = 'close'
  c.dist = Math.min(c.dist, 7)
  c.target = CHASE_CLOSE
  c.whistle = 1.3
  audio.play('stumble')
  setTimeout(() => runtime.mode === 'playing' && !runtime.crashed && audio.play('whistle'), 180)
  fx.burst({ x: p.x, y: p.y + 0.4, z: 0, count: 22, color: 0xcfc2a8, speed: 3.5, up: 1.6, life: 0.6, size: 0.12, gravity: -6 })
  events.emit('toast', { kind: 'officer', title: 'Watch it!', sub: 'The officer is right behind you' })
  return 'stumble'
}

/**
 * Resolve a collision. `fatal` hits (head-on into a train or wall) end the run; everything else
 * is a stumble that brings the officer closer. A skateboard absorbs either kind once.
 */
export function hit({ fatal = false, side = false } = {}) {
  if (runtime.crashed || runtime.invuln > 0 || runtime.power.jetpack > 0) return 'ignored'
  if (import.meta.env.DEV && runtime.god) return 'ignored' // automated testing only
  if (runtime.power.board > 0) {
    breakBoard()
    if (side) runtime.player.lane = runtime.player.prevLane
    return 'board'
  }
  if (fatal && !side) {
    crash()
    return 'crash'
  }
  return stumble(side)
}

export const JET_Y = JET_ALTITUDE
