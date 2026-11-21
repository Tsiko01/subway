// Missions, achievements, levels and daily rewards.

const fmt = (n) => n.toLocaleString('en-US')

export const MISSION_TEMPLATES = [
  { id: 'coins_run', stat: 'coins', scope: 'run', tiers: [50, 100, 200, 350, 500, 800], text: (n) => `Collect ${fmt(n)} coins in one run` },
  { id: 'distance_run', stat: 'distance', scope: 'run', tiers: [500, 1000, 2000, 3000, 4500, 6000], text: (n) => `Run ${fmt(n)} m in one run` },
  { id: 'score_run', stat: 'score', scope: 'run', tiers: [2000, 5000, 10000, 20000, 40000, 75000], text: (n) => `Score ${fmt(n)} points in one run` },
  { id: 'jumps', stat: 'jumpsOver', scope: 'total', tiers: [10, 20, 40, 70, 120, 200], text: (n) => `Jump over ${fmt(n)} obstacles` },
  { id: 'slides', stat: 'slidesUnder', scope: 'total', tiers: [5, 15, 30, 60, 100], text: (n) => `Slide under ${fmt(n)} obstacles` },
  { id: 'boards', stat: 'boards', scope: 'total', tiers: [1, 3, 5, 10, 20], text: (n) => `Use a skateboard ${fmt(n)} time${n > 1 ? 's' : ''}` },
  { id: 'powerups', stat: 'powerups', scope: 'total', tiers: [3, 6, 12, 20, 35], text: (n) => `Collect ${fmt(n)} power-ups` },
  { id: 'powerups_run', stat: 'powerups', scope: 'run', tiers: [2, 3, 5, 7], text: (n) => `Collect ${fmt(n)} power-ups in one run` },
  { id: 'roofs', stat: 'roofs', scope: 'total', tiers: [3, 8, 15, 30], text: (n) => `Run on ${fmt(n)} train roofs` },
  { id: 'jetpacks', stat: 'jetpacks', scope: 'total', tiers: [1, 3, 6, 10], text: (n) => `Fly with a jetpack ${fmt(n)} time${n > 1 ? 's' : ''}` },
  { id: 'lanes_run', stat: 'laneChanges', scope: 'run', tiers: [40, 80, 150, 250], text: (n) => `Change lanes ${fmt(n)} times in one run` },
  { id: 'clean_run', stat: 'cleanDistance', scope: 'run', tiers: [400, 800, 1500, 2500, 4000], text: (n) => `Run ${fmt(n)} m without stumbling` },
  { id: 'magnet_coins', stat: 'magnetCoins', scope: 'total', tiers: [30, 80, 150, 300], text: (n) => `Collect ${fmt(n)} coins with the magnet` },
]
export const TEMPLATE_BY_ID = Object.fromEntries(MISSION_TEMPLATES.map((t) => [t.id, t]))

// The first five missions are hand-picked; after that they're drawn at random.
export const INITIAL_MISSIONS = [
  ['coins_run', 1],
  ['jumps', 1],
  ['powerups', 0],
]
export const MISSION_QUEUE = [
  ['distance_run', 2],
  ['boards', 2],
]

export const missionTarget = (m) => TEMPLATE_BY_ID[m.id].tiers[m.tier]
export const missionText = (m) => TEMPLATE_BY_ID[m.id].text(missionTarget(m))
export const missionReward = (m) => ({ coins: 60 + m.tier * 70, xp: 140 + m.tier * 90 })

export const makeMission = (id, tier, offset = 0) => ({ id, tier, progress: 0, offset })

/** Progress = committed progress (total scope) + this run's counter since the mission was assigned. */
export function missionProgress(m, runStats) {
  const t = TEMPLATE_BY_ID[m.id]
  const live = Math.max(0, (runStats?.[t.stat] ?? 0) - (m.offset ?? 0))
  return t.scope === 'run' ? live : m.progress + live
}

export function pickNextMission(active, tiers, queueIndex) {
  if (queueIndex < MISSION_QUEUE.length) {
    const [id, tier] = MISSION_QUEUE[queueIndex]
    if (!active.some((m) => m.id === id)) return { id, tier: Math.max(tier, tiers[id] ?? 0) }
  }
  const pool = MISSION_TEMPLATES.filter((t) => !active.some((m) => m.id === t.id))
  const t = pool[Math.floor(Math.random() * pool.length)]
  return { id: t.id, tier: Math.min(t.tiers.length - 1, tiers[t.id] ?? 0) }
}

export const ACHIEVEMENTS = [
  { id: 'first_run', name: 'First Steps', desc: 'Finish your first run', stat: 'runs', goal: 1, reward: 100 },
  { id: 'coins_1k', name: 'Coin Collector', desc: 'Collect 1,000 coins in total', stat: 'totalCoins', goal: 1000, reward: 300 },
  { id: 'coins_10k', name: 'Treasure Hunter', desc: 'Collect 10,000 coins in total', stat: 'totalCoins', goal: 10000, reward: 1500 },
  { id: 'dist_10k', name: 'Marathoner', desc: 'Run 10 km in total', stat: 'totalDistance', goal: 10000, reward: 500 },
  { id: 'dist_50k', name: 'Ultra Runner', desc: 'Run 50 km in total', stat: 'totalDistance', goal: 50000, reward: 2000 },
  { id: 'jet_10', name: 'High Flyer', desc: 'Fly with a jetpack 10 times', stat: 'jetpacks', goal: 10, reward: 400 },
  { id: 'board_25', name: 'Board Master', desc: 'Ride a skateboard 25 times', stat: 'boards', goal: 25, reward: 600 },
  { id: 'roofs_50', name: 'Roof Runner', desc: 'Run on 50 train roofs', stat: 'roofs', goal: 50, reward: 700 },
  { id: 'skins_3', name: 'Stylist', desc: 'Own 3 characters', stat: 'skinsOwned', goal: 3, reward: 300 },
  { id: 'skins_8', name: 'Wardrobe', desc: 'Own 8 characters', stat: 'skinsOwned', goal: 8, reward: 1500 },
  { id: 'maps_all', name: 'Explorer', desc: 'Unlock every map', stat: 'mapsUnlocked', goal: 5, reward: 1500 },
  { id: 'clean_3k', name: 'Untouchable', desc: 'Run 3,000 m in one run without stumbling', stat: 'bestClean', goal: 3000, reward: 800 },
  { id: 'missions_25', name: 'Mission Ace', desc: 'Complete 25 missions', stat: 'missionsDone', goal: 25, reward: 1000 },
  { id: 'level_10', name: 'Veteran', desc: 'Reach level 10', stat: 'level', goal: 10, reward: 1000 },
  { id: 'score_50k', name: 'High Roller', desc: 'Score 50,000 in one run', stat: 'bestScore', goal: 50000, reward: 1200 },
]

export const xpForLevel = (level) => 300 + 220 * (level - 1)
export const levelReward = (level) => ({ coins: 150 + 50 * level, boards: level % 3 === 0 ? 1 : 0 })

export const DAILY_REWARDS = [
  { coins: 100 },
  { coins: 200 },
  { boards: 1 },
  { coins: 350 },
  { jets: 1 },
  { coins: 600 },
  { coins: 1200, boards: 2 },
]

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
