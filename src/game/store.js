import { create } from 'zustand'
import { MAX_LEVEL_MULTIPLIER, STORAGE_KEYS } from './constants'
import { resetRun, runtime, events } from './runtime'
import { audio } from './audio'
import { activatePower } from './rules'
import { BOARD_BY_ID, ITEMS, SKIN_BY_ID, UPGRADES, UPGRADE_COSTS, upgradeDuration } from './catalog'
import { MAPS, MAP_BY_ID } from './maps'
import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  INITIAL_MISSIONS,
  TEMPLATE_BY_ID,
  dayDiff,
  levelReward,
  makeMission,
  missionProgress,
  missionReward,
  missionTarget,
  missionText,
  pickNextMission,
  todayKey,
  xpForLevel,
} from './progression'

// ------------------------------------------------------------------ storage
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
    /* storage unavailable — progress lives for this session only */
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

const defaultProfile = () => {
  const legacy = read(STORAGE_KEYS.legacyBest, null)
  const legacySound = read(STORAGE_KEYS.legacySound, true)
  return {
    version: 2,
    coins: 250,
    boards: 3,
    jets: 1,
    level: 1,
    xp: 0,
    bestScore: legacy?.score ?? 0,
    bestDistance: legacy?.distance ?? 0,
    ownedSkins: ['nova'],
    skin: 'nova',
    ownedBoards: ['classic'],
    board: 'classic',
    unlockedMaps: ['subway'],
    map: 'subway',
    upgrades: { magnet: 0, sneakers: 0, jetpack: 0, double: 0, board: 0 },
    missions: INITIAL_MISSIONS.map(([id, tier]) => makeMission(id, tier)),
    missionTiers: Object.fromEntries(INITIAL_MISSIONS.map(([id, tier]) => [id, tier + 1])),
    missionQueue: 0,
    achievements: {},
    stats: { runs: 0, totalCoins: 0, totalDistance: 0, jetpacks: 0, boards: 0, roofs: 0, bestClean: 0, missionsDone: 0 },
    daily: { last: null, streak: 0 },
    settings: { music: legacySound !== false, sfx: legacySound !== false, shake: true },
  }
}

const loadProfile = () => {
  const saved = read(STORAGE_KEYS.profile, null)
  const base = defaultProfile()
  if (!saved || saved.version !== 2) return base
  // merge so newly added fields always exist
  return {
    ...base,
    ...saved,
    upgrades: { ...base.upgrades, ...saved.upgrades },
    stats: { ...base.stats, ...saved.stats },
    daily: { ...base.daily, ...saved.daily },
    settings: { ...base.settings, ...saved.settings },
  }
}

export const isMapUnlocked = (profile, id) => {
  const m = MAP_BY_ID[id]
  return !!m && (profile.unlockedMaps.includes(id) || profile.level >= m.unlock.level)
}

export const achievementValue = (profile, stat) => {
  switch (stat) {
    case 'skinsOwned':
      return profile.ownedSkins.length
    case 'mapsUnlocked':
      return MAPS.filter((m) => isMapUnlocked(profile, m.id)).length
    case 'level':
      return profile.level
    case 'bestScore':
      return profile.bestScore
    default:
      return profile.stats[stat] ?? 0
  }
}

/** The map the 3D world should currently show (menu previews included). */
export const displayMapId = (s) => (s.phase === 'menu' || s.phase === 'intro' ? (s.preview.map ?? s.profile.map) : runtime.mapId)

export const dailyAvailable = (profile) => profile.daily.last !== todayKey()
export const dailyIndex = (profile) => {
  // which day of the 7-day cycle the next claim will be
  const { last, streak } = profile.daily
  if (!last) return 0
  const gap = dayDiff(last, todayKey())
  if (gap === 0) return (streak - 1) % DAILY_REWARDS.length
  return gap === 1 ? streak % DAILY_REWARDS.length : 0
}

const blurFocus = () => {
  if (typeof document !== 'undefined') document.activeElement?.blur?.()
}

const storedQuality = read(STORAGE_KEYS.quality, null)

const applyGrant = (p, give = {}) => {
  if (give.coins) p.coins += give.coins
  if (give.boards) p.boards += give.boards
  if (give.jets) p.jets += give.jets
}

/**
 * UI-level state and the persistent player profile. Per-frame simulation values live in
 * `runtime` (a plain mutable object) so the 3D loop never triggers React renders.
 */
export const useGame = create((set, get) => {
  const save = (profile) => {
    write(STORAGE_KEYS.profile, profile)
    set({ profile })
  }
  const mutate = (fn) => {
    const p = structuredClone(get().profile)
    const result = fn(p)
    if (result === false) return false
    save(p)
    return true
  }
  const fail = () => {
    audio.play('error')
    return false
  }

  return {
    phase: 'intro', // intro | menu | playing | paused | gameover
    screen: 'home', // home | shop | maps | missions | settings
    shopTab: 'characters',
    runId: 0,
    profile: loadProfile(),
    preview: { skin: null, board: null, map: null },
    quality: QUALITY_TIERS.includes(storedQuality) ? storedQuality : detectQuality(),
    qualityLocked: QUALITY_TIERS.includes(storedQuality),
    lastRun: null,
    runMissions: [], // missions completed during the current run
    worldReady: false, // shaders precompiled and the world is visible
    setWorldReady: () => set({ worldReady: true }),

    // ------------------------------------------------------------ navigation
    finishIntro: () => {
      if (get().phase === 'intro') set({ phase: 'menu' })
    },

    openScreen: (screen, shopTab) => {
      runtime.view = screen
      const preview = { skin: null, board: null, map: null }
      set((s) => ({ screen, shopTab: shopTab ?? s.shopTab, preview }))
      audio.setMusicPreset(MAP_BY_ID[get().profile.map]?.music)
    },

    setShopTab: (shopTab) => set({ shopTab, preview: { skin: null, board: null, map: null } }),

    setPreview: (kind, id) => {
      set((s) => ({ preview: { ...s.preview, [kind]: id } }))
      if (kind === 'map') audio.setMusicPreset(MAP_BY_ID[id ?? get().profile.map]?.music)
    },

    // ------------------------------------------------------------ run lifecycle
    startGame: () => {
      if (!get().worldReady) return
      blurFocus()
      const { profile } = get()
      audio.unlock()
      audio.play('start')
      runtime.mapId = isMapUnlocked(profile, profile.map) ? profile.map : 'subway'
      runtime.view = 'run'
      resetRun({ levelMultiplier: Math.min(MAX_LEVEL_MULTIPLIER, profile.level) })
      for (const u of UPGRADES) runtime.powerMax[u.id] = upgradeDuration(u.id, profile.upgrades[u.id])
      runtime.mode = 'playing'
      audio.setMusicPreset(MAP_BY_ID[runtime.mapId].music)
      audio.setMusicMode('run')
      set((s) => ({ phase: 'playing', screen: 'home', runId: s.runId + 1, lastRun: null, runMissions: [], preview: { skin: null, board: null, map: null } }))
    },

    pause: () => {
      if (get().phase !== 'playing' || runtime.crashed) return
      runtime.mode = 'paused'
      audio.setMusicMode('pause')
      audio.stopLoops()
      set({ phase: 'paused' })
    },

    resume: () => {
      if (get().phase !== 'paused') return
      blurFocus()
      runtime.mode = 'playing'
      audio.setMusicMode('run')
      set({ phase: 'playing' })
    },

    /** Leaving a run early (pause → restart / menu) still banks what was earned. */
    quitRun: (restart = false) => {
      if (get().phase === 'paused' || get().phase === 'playing') get().finalizeRun()
      if (restart) get().startGame()
      else get().toMenu()
    },

    toMenu: () => {
      runtime.mapId = get().profile.map
      runtime.view = 'home'
      resetRun()
      runtime.mode = 'menu'
      audio.stopLoops()
      audio.setMusicPreset(MAP_BY_ID[runtime.mapId].music)
      audio.setMusicMode('menu')
      set({ phase: 'menu', screen: 'home', lastRun: null })
    },

    endGame: () => {
      const result = get().finalizeRun()
      runtime.mode = 'gameover'
      audio.stopLoops()
      audio.setMusicMode('menu')
      set({ phase: 'gameover', lastRun: result })
    },

    finalizeRun: () => {
      const stats = runtime.stats
      const score = Math.floor(runtime.score)
      const distance = Math.floor(runtime.distance)
      const coins = runtime.coins
      let result = null
      mutate((p) => {
        p.coins += coins
        p.stats.runs += 1
        p.stats.totalCoins += coins
        p.stats.totalDistance += distance
        p.stats.jetpacks += stats.jetpacks
        p.stats.boards += stats.boards
        p.stats.roofs += stats.roofs
        p.stats.bestClean = Math.max(p.stats.bestClean, stats.cleanDistance)
        // commit mission progress (total-scope accumulates, run-scope resets)
        for (const m of p.missions) {
          const t = TEMPLATE_BY_ID[m.id]
          if (t.scope === 'total') m.progress += Math.max(0, (stats[t.stat] ?? 0) - (m.offset ?? 0))
          m.offset = 0
        }
        const newBest = score > p.bestScore
        p.bestScore = Math.max(p.bestScore, score)
        p.bestDistance = Math.max(p.bestDistance, distance)
        // experience and level-ups
        const xpGained = Math.floor(distance / 5 + coins * 0.6)
        p.xp += xpGained
        const levelUps = []
        while (p.xp >= xpForLevel(p.level)) {
          p.xp -= xpForLevel(p.level)
          p.level += 1
          const reward = levelReward(p.level)
          applyGrant(p, reward)
          levelUps.push({ level: p.level, ...reward })
        }
        result = {
          score,
          distance,
          coins,
          xpGained,
          levelUps,
          newBest,
          kind: runtime.crashKind,
          maxMultiplier: runtime.maxMultiplier,
          missions: get().runMissions,
        }
      })
      if (result?.levelUps.length) audio.play('levelup')
      return result
    },

    /** Called a few times a second during a run; completes missions as soon as they're done. */
    checkMissions: () => {
      const { profile } = get()
      const done = profile.missions.filter((m) => missionProgress(m, runtime.stats) >= missionTarget(m))
      if (!done.length) return
      const completed = []
      mutate((p) => {
        for (const d of done) {
          const idx = p.missions.findIndex((m) => m.id === d.id)
          if (idx < 0) continue
          const m = p.missions[idx]
          const reward = missionReward(m)
          p.coins += reward.coins
          p.xp += reward.xp
          p.stats.missionsDone += 1
          completed.push({ text: missionText(m), ...reward })
          p.missionTiers[m.id] = Math.min(TEMPLATE_BY_ID[m.id].tiers.length - 1, m.tier + 1)
          const next = pickNextMission(
            p.missions.filter((_, i) => i !== idx),
            p.missionTiers,
            p.missionQueue,
          )
          p.missionQueue += 1
          const stat = TEMPLATE_BY_ID[next.id].stat
          p.missions[idx] = makeMission(next.id, next.tier, runtime.stats[stat] ?? 0)
        }
      })
      if (completed.length) {
        set((s) => ({ runMissions: [...s.runMissions, ...completed] }))
        completed.forEach((c, i) =>
          setTimeout(() => {
            audio.play('mission')
            events.emit('toast', { kind: 'mission', title: 'Mission complete', sub: c.text, reward: c.coins })
          }, i * 900),
        )
      }
    },

    // ------------------------------------------------------------ in-run consumables
    useBoard: () => {
      if (runtime.mode !== 'playing' || runtime.crashed || runtime.power.board > 0) return false
      const ok = mutate((p) => {
        if (p.boards <= 0) return false
        p.boards -= 1
      })
      if (!ok) return false
      activatePower('board', { free: false, toast: false })
      return true
    },

    useJet: () => {
      if (runtime.mode !== 'playing' || runtime.crashed || runtime.power.jetpack > 0) return false
      const ok = mutate((p) => {
        if (p.jets <= 0) return false
        p.jets -= 1
      })
      if (!ok) return false
      activatePower('jetpack')
      return true
    },

    // ------------------------------------------------------------ shop
    buySkin: (id) => {
      const skin = SKIN_BY_ID[id]
      const p = get().profile
      if (!skin || p.ownedSkins.includes(id)) return false
      if (p.coins < skin.price) return fail()
      mutate((q) => {
        q.coins -= skin.price
        q.ownedSkins.push(id)
        q.skin = id
      })
      audio.play('purchase')
      return true
    },
    equipSkin: (id) => mutate((p) => (p.ownedSkins.includes(id) ? void (p.skin = id) : false)),

    buyBoardDesign: (id) => {
      const board = BOARD_BY_ID[id]
      const p = get().profile
      if (!board || p.ownedBoards.includes(id)) return false
      if (p.coins < board.price) return fail()
      mutate((q) => {
        q.coins -= board.price
        q.ownedBoards.push(id)
        q.board = id
      })
      audio.play('purchase')
      return true
    },
    equipBoard: (id) => mutate((p) => (p.ownedBoards.includes(id) ? void (p.board = id) : false)),

    buyItem: (id) => {
      const item = ITEMS.find((i) => i.id === id)
      if (!item) return false
      if (get().profile.coins < item.price) return fail()
      mutate((p) => {
        p.coins -= item.price
        applyGrant(p, item.give)
      })
      audio.play('purchase')
      return true
    },

    buyUpgrade: (id) => {
      const lvl = get().profile.upgrades[id] ?? 0
      if (lvl >= UPGRADE_COSTS.length) return false
      const cost = UPGRADE_COSTS[lvl]
      if (get().profile.coins < cost) return fail()
      mutate((p) => {
        p.coins -= cost
        p.upgrades[id] = lvl + 1
      })
      audio.play('purchase')
      return true
    },

    // ------------------------------------------------------------ maps
    unlockMap: (id) => {
      const m = MAP_BY_ID[id]
      const p = get().profile
      if (!m || isMapUnlocked(p, id)) return false
      if (p.coins < m.unlock.price) return fail()
      mutate((q) => {
        q.coins -= m.unlock.price
        q.unlockedMaps.push(id)
        q.map = id
      })
      audio.play('purchase')
      runtime.mapId = id
      return true
    },
    selectMap: (id) => {
      if (!isMapUnlocked(get().profile, id)) return false
      mutate((p) => void (p.map = id))
      runtime.mapId = id
      audio.setMusicPreset(MAP_BY_ID[id].music)
      return true
    },

    // ------------------------------------------------------------ rewards
    claimDaily: () => {
      const p = get().profile
      if (!dailyAvailable(p)) return null
      const idx = dailyIndex(p)
      const reward = DAILY_REWARDS[idx]
      mutate((q) => {
        const today = todayKey()
        const continued = q.daily.last && dayDiff(q.daily.last, today) === 1
        q.daily.streak = continued ? q.daily.streak + 1 : 1
        q.daily.last = today
        applyGrant(q, reward)
      })
      audio.play('reward')
      return reward
    },

    claimAchievement: (id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id)
      const p = get().profile
      if (!a || p.achievements[id] || achievementValue(p, a.stat) < a.goal) return false
      mutate((q) => {
        q.achievements[id] = true
        q.coins += a.reward
      })
      audio.play('reward')
      return true
    },

    // ------------------------------------------------------------ settings
    toggleMusic: () => {
      mutate((p) => void (p.settings.music = !p.settings.music))
      audio.unlock()
      audio.setMusicEnabled(get().profile.settings.music)
    },
    toggleSfx: () => {
      mutate((p) => void (p.settings.sfx = !p.settings.sfx))
      audio.unlock()
      audio.setSfxEnabled(get().profile.settings.sfx)
      audio.play('click')
    },
    toggleShake: () => mutate((p) => void (p.settings.shake = !p.settings.shake)),

    resetProgress: () => {
      const fresh = defaultProfile()
      fresh.bestScore = 0
      fresh.bestDistance = 0
      save(fresh)
      runtime.mapId = fresh.map
      audio.setMusicEnabled(true)
      audio.setSfxEnabled(true)
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
  }
})

// apply persisted settings to the audio engine and world
{
  const { profile } = useGame.getState()
  audio.setMusicEnabled(profile.settings.music)
  audio.setSfxEnabled(profile.settings.sfx)
  audio.setMusicPreset(MAP_BY_ID[profile.map]?.music ?? 'subway')
  runtime.mapId = isMapUnlocked(profile, profile.map) ? profile.map : 'subway'
}
