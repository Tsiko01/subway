import { create } from 'zustand'
import { STORAGE_KEYS } from './constants'
import { resetRun, runtime } from './runtime'
import { audio } from './audio'

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — ignore */
  }
}

export const QUALITY_TIERS = ['high', 'medium', 'low']

// Pick a starting tier from the device: phones/tablets and integrated GPUs start lower.
const detectQuality = () => {
  if (typeof window === 'undefined') return 'high'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  if (coarse || small) return 'low'
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? ''
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    if (/swiftshader|llvmpipe|software/i.test(name)) return 'low'
    if (/intel|iris|uhd|hd graphics|mali|adreno|powervr|apple gpu/i.test(name)) return 'medium'
  } catch {
    /* no WebGL info — fall through */
  }
  return 'high'
}

const storedQuality = read(STORAGE_KEYS.quality, null)

const initialBest = read(STORAGE_KEYS.best, { score: 0, distance: 0, gems: 0 })

const blurFocus = () => {
  if (typeof document !== 'undefined') document.activeElement?.blur?.()
}

/**
 * UI-level state only. Per-frame simulation values live in `runtime`
 * (a plain mutable object) so the 3D loop never triggers React renders.
 */
export const useGame = create((set, get) => ({
  phase: 'intro', // intro | menu | playing | paused | gameover
  runId: 0,
  soundOn: read(STORAGE_KEYS.sound, true),
  quality: QUALITY_TIERS.includes(storedQuality) ? storedQuality : detectQuality(),
  qualityLocked: QUALITY_TIERS.includes(storedQuality), // a manual choice disables auto-tuning
  best: initialBest,
  lastRun: null,

  finishIntro: () => {
    if (get().phase === 'intro') set({ phase: 'menu' })
  },

  startGame: () => {
    blurFocus()
    audio.unlock()
    audio.play('start')
    resetRun()
    runtime.mode = 'playing'
    audio.setMusicMode('run')
    set((s) => ({ phase: 'playing', runId: s.runId + 1, lastRun: null }))
  },

  pause: () => {
    if (get().phase !== 'playing' || runtime.crashed) return
    runtime.mode = 'paused'
    audio.setMusicMode('pause')
    set({ phase: 'paused' })
  },

  resume: () => {
    if (get().phase !== 'paused') return
    blurFocus()
    runtime.mode = 'playing'
    audio.setMusicMode('run')
    set({ phase: 'playing' })
  },

  toMenu: () => {
    resetRun()
    runtime.mode = 'menu'
    audio.setMusicMode('menu')
    set({ phase: 'menu', lastRun: null })
  },

  endGame: () => {
    const { best } = get()
    const run = {
      score: Math.floor(runtime.score),
      distance: Math.floor(runtime.distance),
      gems: runtime.gems,
      maxMultiplier: runtime.maxMultiplier,
    }
    const newBest = run.score > (best?.score ?? 0)
    const nextBest = newBest ? { score: run.score, distance: run.distance, gems: run.gems } : best
    if (newBest) write(STORAGE_KEYS.best, nextBest)
    runtime.mode = 'gameover'
    audio.setMusicMode('menu')
    set({ phase: 'gameover', lastRun: { ...run, newBest }, best: nextBest })
  },

  toggleSound: () => {
    const soundOn = !get().soundOn
    write(STORAGE_KEYS.sound, soundOn)
    audio.unlock()
    audio.setEnabled(soundOn)
    if (soundOn) audio.play('click')
    set({ soundOn })
  },

  /** Manual choice from the UI: remembered and never auto-adjusted afterwards. */
  setQuality: (quality) => {
    write(STORAGE_KEYS.quality, quality)
    set({ quality, qualityLocked: true })
  },

  cycleQuality: () => {
    const i = QUALITY_TIERS.indexOf(get().quality)
    get().setQuality(QUALITY_TIERS[(i + 1) % QUALITY_TIERS.length])
  },

  /** Automatic step-down when the frame rate can't keep up. Returns true if it changed. */
  degradeQuality: () => {
    const { quality, qualityLocked } = get()
    const i = QUALITY_TIERS.indexOf(quality)
    if (qualityLocked || i >= QUALITY_TIERS.length - 1) return false
    set({ quality: QUALITY_TIERS[i + 1] })
    return true
  },
}))

audio.setEnabled(useGame.getState().soundOn)
