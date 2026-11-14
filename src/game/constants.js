// Core tuning values for NOCTURNE — The Night Run.
// All distances are in meters, times in seconds.

export const LANE_WIDTH = 2.2
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH]
export const ROAD_HALF_WIDTH = 4.2

// Speed curve
export const MENU_SPEED = 9
export const START_SPEED = 16
export const MAX_SPEED = 40
export const SPEED_RAMP_DISTANCE = 2600

// Player physics
export const GRAVITY = -50
export const JUMP_VELOCITY = 14
export const FAST_FALL_VELOCITY = -24
export const SLIDE_DURATION = 0.72
export const LANE_SWITCH_SHARPNESS = 15
export const PLAYER_HALF_WIDTH = 0.32
export const PLAYER_HALF_DEPTH = 0.3
export const PLAYER_HEIGHT = 1.75
export const PLAYER_SLIDE_HEIGHT = 0.85

// Spawning
export const SPAWN_Z = -175
export const DESPAWN_Z = 14
export const FIRST_OBSTACLE_GAP = 70

// Scenery segments
export const SEGMENT_LENGTH = 22
export const SEGMENT_COUNT = 11
export const SCENERY_START_Z = 26 // nearest edge (behind the camera)

// Zones (distance-based environment transitions)
export const ZONE_LENGTH = 900

export const ZONES = [
  {
    key: 'avenue',
    name: 'Midnight Avenue',
    sub: 'The city holds its breath',
    fog: '#0b1426',
    skyTop: '#02040b',
    skyHorizon: '#1b3158',
    hemiSky: '#5b7cc4',
    hemiGround: '#0b0e18',
    lamp: '#ffd9a3',
    accent: '#7fb0ff',
  },
  {
    key: 'bridge',
    name: 'Harbor Bridge',
    sub: 'Above the sleeping sea',
    fog: '#0d1a2e',
    skyTop: '#03060f',
    skyHorizon: '#26487a',
    hemiSky: '#6f97d8',
    hemiGround: '#081020',
    lamp: '#cfe2ff',
    accent: '#9cc8ff',
  },
  {
    key: 'glass',
    name: 'Glass District',
    sub: 'Where the towers dream in blue',
    fog: '#0a1022',
    skyTop: '#020309',
    skyHorizon: '#1d2a5e',
    hemiSky: '#6c7fe0',
    hemiGround: '#080a18',
    lamp: '#a9c6ff',
    accent: '#6f8bff',
  },
]

export const zoneIndexAt = (distance) => Math.floor(Math.max(0, distance) / ZONE_LENGTH) % ZONES.length

// Scoring
export const GEM_POINTS = 25
export const GEMS_PER_MULTIPLIER = 25
export const MAX_BASE_MULTIPLIER = 6
export const BOOST_DURATION = 9
export const MAGNET_DURATION = 9

export const STORAGE_KEYS = {
  best: 'nocturne.best.v1',
  sound: 'nocturne.sound.v1',
  quality: 'nocturne.quality.v1',
}
