import { LANES, START_SPEED } from './constants'

/**
 * Mutable per-frame simulation state shared by every system.
 * Never put this in React state — it changes 60+ times per second.
 */
export const runtime = {
  mode: 'menu', // mirrors store phase for the render loop: menu | playing | paused | gameover

  // world motion
  speed: START_SPEED,
  dt: 0, // simulation delta for this frame (already time-scaled)
  dz: 0, // how far the world moved toward the camera this frame
  time: 0, // accumulated simulation time
  timeScale: 1,

  // run stats
  distance: 0,
  score: 0,
  gems: 0,
  multiplier: 1,
  baseMultiplier: 1,
  maxMultiplier: 1,
  boostTime: 0,
  magnetTime: 0,
  nextMilestone: 500,

  // crash
  crashed: false,
  crashTime: 0,

  // camera
  trauma: 0,

  // environment
  zone: 0,
  zoneBlend: 0, // 0..1 transition toward the next zone

  // input queue: 'left' | 'right' | 'up' | 'down'
  actions: [],

  player: {
    lane: 1,
    x: LANES[1],
    y: 0,
    vy: 0,
    grounded: true,
    slideTime: 0,
    slideQueued: false,
    jumpBuffer: 0,
    runPhase: 0,
    lastStep: 0,
    lean: 0,
  },
}

const resetHandlers = new Set()
/** Systems register a callback that wipes their state when a run (re)starts. */
export const onReset = (fn) => {
  resetHandlers.add(fn)
  return () => resetHandlers.delete(fn)
}

export function resetRun() {
  runtime.speed = START_SPEED
  runtime.time = 0
  runtime.timeScale = 1
  runtime.distance = 0
  runtime.score = 0
  runtime.gems = 0
  runtime.multiplier = 1
  runtime.baseMultiplier = 1
  runtime.maxMultiplier = 1
  runtime.boostTime = 0
  runtime.magnetTime = 0
  runtime.nextMilestone = 500
  runtime.crashed = false
  runtime.crashTime = 0
  runtime.trauma = 0
  runtime.zone = 0
  runtime.zoneBlend = 0
  runtime.actions.length = 0
  const p = runtime.player
  p.lane = 1
  p.x = LANES[1]
  p.y = 0
  p.vy = 0
  p.grounded = true
  p.slideTime = 0
  p.slideQueued = false
  p.jumpBuffer = 0
  p.lean = 0
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

// Particle emitter hook-up (assigned by the Particles system once mounted)
export const fx = {
  burst: () => {},
}
