// Core tuning values for NOCTURNE. Distances are meters, times are seconds.

export const LANE_WIDTH = 2.5
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH]
export const TRACK_HALF_WIDTH = 4.6

// Speed curve
export const MENU_SPEED = 9
export const START_SPEED = 15
export const MAX_SPEED = 38
export const SPEED_RAMP_DISTANCE = 2800

// Player physics
export const GRAVITY = -52
export const JUMP_VELOCITY = 14.2 // apex ≈ 1.9 m
export const SNEAKER_JUMP_VELOCITY = 21.6 // apex ≈ 4.5 m — clears trains
export const FAST_FALL_VELOCITY = -26
export const SLIDE_DURATION = 0.72
export const LANE_SWITCH_SHARPNESS = 15
export const PLAYER_HALF_WIDTH = 0.32
export const PLAYER_HALF_DEPTH = 0.3
export const PLAYER_HEIGHT = 1.75
export const PLAYER_SLIDE_HEIGHT = 0.85
export const STEP_UP = 0.6 // max height difference the runner can step onto
export const JET_ALTITUDE = 9.4
export const STUMBLE_TIME = 0.55
export const INVULN_AFTER_HIT = 1.6

// Trains
export const CAR_LENGTH = 11
export const CAR_GAP = 0.8
export const TRAIN_HALF_WIDTH = 1.1
export const TRAIN_ROOF = 3.1
export const RAMP_LENGTH = 7.5
export const MOVING_TRAIN_SPEED = 11

// Spawning
export const SPAWN_Z = -185
export const DESPAWN_Z = 18
export const FIRST_OBSTACLE_GAP = 80

// Scenery segments
export const SEGMENT_LENGTH = 22
export const SEGMENT_COUNT = 16
export const SCENERY_START_Z = 130

// The chasing officer
export const CHASE_FAR = 14 // out of view behind the camera
export const CHASE_CLOSE = 2.3 // right on the runner's heels
export const CHASE_INTRO = 3.2 // seconds the officer is visible at the start of a run
export const HEAT_DURATION = 7 // seconds the officer stays close after a stumble

// Scoring
export const COIN_POINTS = 10
export const MAX_LEVEL_MULTIPLIER = 30

export const STORAGE_KEYS = {
  profile: 'nocturne.profile.v2',
  legacyBest: 'nocturne.best.v1',
  legacySound: 'nocturne.sound.v1',
  quality: 'nocturne.quality.v1',
}
