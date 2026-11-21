import { CHASE_CLOSE, LANES, START_SPEED } from './constants'

const freshStats = () => ({
  coins: 0,
  distance: 0,
  score: 0,
  jumpsOver: 0,
  slidesUnder: 0,
  boards: 0,
  powerups: 0,
  roofs: 0,
  jetpacks: 0,
  laneChanges: 0,
  cleanDistance: 0,
  magnetCoins: 0,
  stumbles: 0,
})

export const POWER_KEYS = ['magnet', 'sneakers', 'jetpack', 'double', 'board']

/**
 * Mutable per-frame simulation state shared by every system.
 * Never put this in React state — it changes 60+ times per second.
 */
export const runtime = {
  mode: 'menu', // menu | playing | paused | gameover
  view: 'home', // menu sub-view, drives camera framing and idle poses
  mapId: 'subway',

  // world motion
  speed: START_SPEED,
  speedMul: 1, // stumble penalty, recovers to 1
  dt: 0,
  dz: 0,
  time: 0,
  timeScale: 1,

  // run stats
  distance: 0,
  score: 0,
  coins: 0,
  multiplier: 1,
  levelMultiplier: 1,
  maxMultiplier: 1,
  nextMilestone: 500,
  cleanStart: 0, // distance at the last stumble

  // power-ups: seconds remaining / full duration (for HUD bars)
  power: { magnet: 0, sneakers: 0, jetpack: 0, double: 0, board: 0 },
  powerMax: { magnet: 1, sneakers: 1, jetpack: 1, double: 1, board: 1 },
  boardFree: false, // the active board came from a Shield Board pickup (doesn't use inventory)
  invuln: 0,

  // crash / caught
  crashed: false,
  crashKind: 'crash', // crash | caught
  crashTime: 0,
  trauma: 0,
  tunnel: 0, // 0..1 how far inside a tunnel the runner is

  chase: { dist: CHASE_CLOSE, target: CHASE_CLOSE, heat: 0, intro: 0, state: 'idle', x: 0, whistle: 0 },

  stats: freshStats(),
  actions: [],

  player: {
    lane: 1,
    prevLane: 1,
    x: LANES[1],
    y: 0,
    vy: 0,
    grounded: true,
    ground: 0,
    surface: null, // null | 'train' | 'ramp'
    surfaceId: -1,
    slideTime: 0,
    slideQueued: false,
    jumpBuffer: 0,
    runPhase: 0,
    lean: 0,
    stumbleTime: 0,
    flip: -1, // 0..1 progress of a sneaker flip, -1 when not flipping
    jumpTime: 0,
    airTime: 1,
    boardJump: false,
    descending: false,
  },

  // services registered by the Spawner
  surfaceAt: () => ({ h: 0, kind: null, id: -1 }),
  probe: () => null,
}

const resetHandlers = new Set()
/** Systems register a callback that wipes their state when a run (re)starts. */
export const onReset = (fn) => {
  resetHandlers.add(fn)
  return () => resetHandlers.delete(fn)
}

export function resetRun({ levelMultiplier = 1 } = {}) {
  runtime.speed = START_SPEED
  runtime.speedMul = 1
  runtime.time = 0
  runtime.timeScale = 1
  runtime.distance = 0
  runtime.score = 0
  runtime.coins = 0
  runtime.levelMultiplier = levelMultiplier
  runtime.multiplier = levelMultiplier
  runtime.maxMultiplier = levelMultiplier
  runtime.nextMilestone = 500
  runtime.cleanStart = 0
  for (const k of Object.keys(runtime.power)) runtime.power[k] = 0
  runtime.boardFree = false
  runtime.invuln = 0
  runtime.crashed = false
  runtime.crashKind = 'crash'
  runtime.crashTime = 0
  runtime.trauma = 0
  runtime.tunnel = 0
  Object.assign(runtime.chase, { dist: CHASE_CLOSE + 0.6, target: CHASE_CLOSE, heat: 0, intro: 0, state: 'idle', x: 0, whistle: 0 })
  runtime.stats = freshStats()
  runtime.actions.length = 0
  const p = runtime.player
  Object.assign(p, {
    lane: 1,
    prevLane: 1,
    x: LANES[1],
    y: 0,
    vy: 0,
    grounded: true,
    ground: 0,
    surface: null,
    surfaceId: -1,
    slideTime: 0,
    slideQueued: false,
    jumpBuffer: 0,
    lean: 0,
    stumbleTime: 0,
    flip: -1,
    jumpTime: 0,
    airTime: 1,
    boardJump: false,
    descending: false,
  })
  resetHandlers.forEach((fn) => fn())
}

// Tiny event bus for rare UI events (toasts, pickups) — keeps React out of the hot path.
const listeners = new Map()
export const events = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(fn)
    return () => listeners.get(type)?.delete(fn)
  },
  emit(type, payload) {
    listeners.get(type)?.forEach((fn) => fn(payload))
  },
}

// Effect emitters (assigned by the particle systems once mounted)
export const fx = {
  burst: () => {},
  smoke: () => {},
}
