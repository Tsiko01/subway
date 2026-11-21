import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAR_GAP,
  CAR_LENGTH,
  COIN_POINTS,
  DESPAWN_Z,
  FIRST_OBSTACLE_GAP,
  LANES,
  MOVING_TRAIN_SPEED,
  PLAYER_HALF_DEPTH,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_SLIDE_HEIGHT,
  RAMP_LENGTH,
  SPAWN_Z,
  STEP_UP,
  TRAIN_HALF_WIDTH,
  TRAIN_ROOF,
} from '../game/constants'
import { events, fx, onReset, runtime } from '../game/runtime'
import { audio } from '../game/audio'
import { activatePower, hit } from '../game/rules'
import { getMap, jetAltitude } from '../game/maps'
import { useGame } from '../game/store'
import { OBSTACLE_INFO, beacon, coinGeometry, coinMaterial, obstacle, pickup, ramp, trainCar } from './prefabs'

const POWER_TYPES = ['magnet', 'sneakers', 'double', 'jetpack', 'board']
const POWER_WEIGHTS = [26, 20, 20, 16, 12]
const COIN_COUNT = 300
const PICKUP_KEYS = POWER_TYPES.map((t) => `pu-${t}`)

const rand = Math.random
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const shuffle = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1))
    ;[a[i], a[k]] = [a[k], a[i]]
  }
  return a
}
const one = (code) => {
  const l = [0, 0, 0]
  l[Math.floor(rand() * 3)] = code
  return l
}
const weighted = (items, weights) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[0]
}

// Row patterns use category codes: L = jump over, H = slide under, B = must dodge.
const ROWS = [
  { min: 0, w: 3, make: () => [{ off: 0, lanes: one(pick(['B', 'L', 'H'])) }] },
  { min: 0, w: 2.2, make: () => [{ off: 0, lanes: shuffle(['B', 'B', 0]) }] },
  { min: 0, w: 1.4, make: () => [{ off: 0, lanes: shuffle(['B', 'L', 0]) }] },
  { min: 0.05, w: 1.5, make: () => [{ off: 0, lanes: ['L', 'L', 'L'] }] },
  { min: 0.05, w: 1.3, make: () => [{ off: 0, lanes: ['H', 'H', 'H'] }] },
  { min: 0.12, w: 1.5, make: () => [{ off: 0, lanes: shuffle(['B', 'L', 'H']) }] },
  { min: 0.18, w: 1.1, make: () => [{ off: 0, lanes: shuffle(['H', 'H', 'B']) }] },
  {
    min: 0.25,
    w: 1,
    make: (speed) => [
      { off: 0, lanes: ['L', 'L', 'L'] },
      { off: Math.max(12, speed * 0.62), lanes: ['H', 'H', 'H'] },
    ],
  },
  {
    min: 0.4,
    w: 0.9,
    make: (speed) => {
      const dir = rand() < 0.5
      return [
        { off: 0, lanes: dir ? ['B', 'B', 0] : [0, 'B', 'B'] },
        { off: Math.max(13, speed * 0.62), lanes: dir ? [0, 'B', 'B'] : ['B', 'B', 0] },
      ]
    },
  },
]

function createSpawner(map) {
  const root = new THREE.Group()
  const style = map.train
  const kinds = map.obstacles
  const pools = {}
  const all = []
  const trainItems = []

  const make = (key, count, factory, extra = {}) => {
    pools[key] = Array.from({ length: count }, (_, i) => {
      const group = factory(i).clone()
      group.visible = false
      root.add(group)
      const it = { key, group, active: false, x: 0, z: 0, lane: 1, hw: 1, hd: 1, y0: 0, y1: 1, speed: 0, trainId: -1, knocked: false, kt: 0, prevZ: 0, ...extra }
      if (extra.cat === 'pickup') it.halo = group.children.find((c) => c.material?.blending === THREE.AdditiveBlending)
      all.push(it)
      if (extra.cat === 'train' || extra.cat === 'ramp') trainItems.push(it)
      return it
    })
  }
  make('car', 26, (i) => trainCar(style, { variant: i }), { cat: 'train' })
  make('carFront', 8, (i) => trainCar(style, { front: true, variant: i }), { cat: 'train' })
  make('carMoving', 4, (i) => trainCar(style, { front: true, moving: true, variant: i }), { cat: 'train' })
  make('ramp', 6, () => ramp(), { cat: 'ramp' })
  const kindList = [...new Set([...kinds.low, ...kinds.high, ...kinds.block])]
  for (const kind of kindList) make(kind, kind === 'container' ? 6 : 9, (i) => obstacle(kind, i), { cat: OBSTACLE_INFO[kind].cat, kind })
  for (const t of POWER_TYPES) make(`pu-${t}`, 2, () => pickup(t), { cat: 'pickup', power: t })

  // ---------------------------------------------------------------- coins (instanced)
  const coins = Array.from({ length: COIN_COUNT }, () => ({ active: false, x: 0, y: 0, z: 0, spin: 0, pulled: false, sky: false }))
  const coinMesh = new THREE.InstancedMesh(coinGeometry(), coinMaterial(), COIN_COUNT)
  coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  coinMesh.frustumCulled = false
  coinMesh.castShadow = false
  root.add(coinMesh)

  const st = { cursorZ: -FIRST_OBSTACLE_GAP, prevOpen: [0, 1, 2], reserve: -1, reserveRows: 0, trainId: 0, combo: 0, lastCoin: -10, skyZ: 0, skyPhase: 0, lastRoofId: -1 }

  // ---------------------------------------------------------------- pool helpers
  const spawn = (key, lane, z, props = {}) => {
    const it = pools[key]?.find((o) => !o.active)
    if (!it) return null
    it.active = true
    it.lane = lane
    it.x = LANES[lane]
    it.z = z
    it.prevZ = z
    it.knocked = false
    it.kt = 0
    it.passed = false
    it.honked = false
    it.speed = 0
    it.trainId = -1
    Object.assign(it, props)
    it.group.visible = true
    it.group.position.set(it.x, props.y ?? 0, z)
    it.group.rotation.set(0, 0, 0)
    return it
  }
  const despawn = (it) => {
    it.active = false
    it.group.visible = false
  }
  const spawnObstacle = (kind, lane, z) => {
    const info = OBSTACLE_INFO[kind]
    return spawn(kind, lane, z, { ...info })
  }
  const kindFor = (code) => (code === 'L' ? pick(kinds.low) : code === 'H' ? pick(kinds.high) : pick(kinds.block))

  /** A consist of `cars` coupled cars whose nearest end sits at zFront. Returns its length. */
  const spawnTrain = (lane, zFront, cars, moving) => {
    const id = ++st.trainId
    for (let i = 0; i < cars; i++) {
      const key = i === 0 ? (moving ? 'carMoving' : 'carFront') : 'car'
      const zc = zFront - CAR_LENGTH / 2 - i * (CAR_LENGTH + CAR_GAP)
      spawn(key, lane, zc, { cat: 'train', hw: TRAIN_HALF_WIDTH, hd: CAR_LENGTH / 2, y0: 0, y1: TRAIN_ROOF, speed: moving ? MOVING_TRAIN_SPEED : 0, trainId: id, lead: i === 0 })
    }
    return cars * CAR_LENGTH + (cars - 1) * CAR_GAP
  }
  const spawnRamp = (lane, zTrainFront) => spawn('ramp', lane, zTrainFront + RAMP_LENGTH / 2, { cat: 'ramp', hw: TRAIN_HALF_WIDTH, hd: RAMP_LENGTH / 2, trainId: st.trainId + 1 })
  const rampHeight = (it) => TRAIN_ROOF * Math.min(1, Math.max(0, (it.z + RAMP_LENGTH / 2) / RAMP_LENGTH))

  const addCoin = (x, y, z, sky = false) => {
    const c = coins.find((o) => !o.active)
    if (!c) return
    c.active = true
    c.x = x
    c.y = y
    c.z = z
    c.spin = rand() * Math.PI * 2
    c.pulled = false
    c.sky = sky
  }
  const coinLine = (lane, zStart, n, y = 0.9, step = 2.4) => {
    for (let i = 0; i < n; i++) addCoin(LANES[lane], y, zStart - i * step)
  }
  const coinArc = (lane, z, speed) => {
    const half = Math.max(4.5, speed * 0.26)
    for (let i = -3; i <= 3; i++) {
      const off = (i / 3) * half
      addCoin(LANES[lane], 0.8 + 1.5 * (1 - (off / half) ** 2), z - off)
    }
  }

  // ---------------------------------------------------------------- section plans
  const planRow = (d, speed, blocked) => {
    const avail = ROWS.filter((r) => d >= r.min)
    const pattern = weighted(avail, avail.map((r) => r.w))
    const rows = pattern.make(speed)
    if (blocked >= 0) rows.forEach((r) => (r.lanes[blocked] = 0))
    return {
      start: rows[0].lanes.map((c) => (c === 'B' ? 'B' : 'P')),
      endOpen: [0, 1, 2].filter((l) => rows[rows.length - 1].lanes[l] !== 'B'),
      length: Math.max(...rows.map((r) => r.off)),
      run: (z) => {
        for (const row of rows) row.lanes.forEach((code, lane) => code && spawnObstacle(kindFor(code), lane, z - row.off))
        const first = rows[0].lanes
        const open = [0, 1, 2].filter((l) => first[l] !== 'B' && l !== blocked)
        if (open.length && rand() < 0.75) {
          const lane = pick(open)
          if (first[lane] === 'L') coinArc(lane, z, speed)
          else if (first[lane] === 'H') coinLine(lane, z + 3.5, 4, 0.45, 2.2)
          else coinLine(lane, z + 3, 6)
        }
        return open
      },
    }
  }

  const planTrains = (d, speed, blocked, mixed) => {
    const lanes = shuffle([0, 1, 2].filter((l) => l !== blocked))
    const nTrains = mixed ? 1 : Math.min(lanes.length - 1, d > 0.2 && rand() < 0.45 ? 2 : 1)
    const trainLanes = lanes.slice(0, Math.max(1, nTrains))
    const freeLanes = [0, 1, 2].filter((l) => !trainLanes.includes(l))
    const rampLane = !mixed && rand() < 0.6 ? pick(trainLanes) : -1
    const trains = trainLanes.map((lane) => ({ lane, cars: 1 + Math.floor(rand() * (1.6 + d * 1.6)), ramp: lane === rampLane }))
    const lengthOf = (t) => t.cars * CAR_LENGTH + (t.cars - 1) * CAR_GAP + (t.ramp ? RAMP_LENGTH : 0)
    const length = Math.max(...trains.map(lengthOf))
    // mixed: a row of obstacles beside the train (always leaving a passable lane)
    let rowCodes = null
    if (mixed) {
      const others = freeLanes.filter((l) => l !== blocked)
      rowCodes = [0, 0, 0]
      const codes = shuffle(others.length > 1 ? [pick(['L', 'H', 'B']), pick(['L', 'H', 0])] : [pick(['L', 'H', 0])])
      others.forEach((l, i) => (rowCodes[l] = codes[i] ?? 0))
      if (others.every((l) => rowCodes[l] === 'B')) rowCodes[others[0]] = 'L'
    }
    const start = [0, 1, 2].map((l) => (trainLanes.includes(l) && l !== rampLane ? 'B' : rowCodes?.[l] === 'B' ? 'B' : 'P'))
    if (!start.includes('P')) return null
    return {
      start,
      endOpen: [0, 1, 2],
      length,
      run: (z) => {
        for (const t of trains) {
          const front = t.ramp ? z - RAMP_LENGTH : z
          const len = spawnTrain(t.lane, front, t.cars, false)
          if (t.ramp) {
            spawnRamp(t.lane, front)
            // coins up the ramp and along the roof
            for (let k = 0; k < 4; k++) addCoin(LANES[t.lane], TRAIN_ROOF * ((k + 0.5) / 4) + 0.85, z - (k + 0.5) * (RAMP_LENGTH / 4))
            coinLine(t.lane, front - 1.5, Math.floor(len / 2.6), TRAIN_ROOF + 0.9, 2.6)
            if (rand() < 0.22) placePower(t.lane, front - len * 0.6, TRAIN_ROOF + 1.1)
          }
        }
        if (rowCodes) rowCodes.forEach((code, lane) => code && spawnObstacle(kindFor(code), lane, z))
        const inner = freeLanes.filter((l) => l !== blocked && !(rowCodes && rowCodes[l]))
        for (const l of inner) {
          if (length > 18 && rand() < 0.55) spawnObstacle(kindFor(pick(['L', 'H'])), l, z - length * 0.55)
        }
        if (inner.length && rand() < 0.6) coinLine(pick(inner), z + 2, 5)
        return [0, 1, 2].filter((l) => start[l] === 'P')
      },
    }
  }

  const placePower = (lane, z, y = 1.1) => {
    const type = weighted(POWER_TYPES, POWER_WEIGHTS)
    if (runtime.power[type] > 0) return
    if (PICKUP_KEYS.some((k) => pools[k].some((o) => o.active))) return
    spawn(`pu-${type}`, lane, z, { cat: 'pickup', power: type, y, baseY: y, hw: 0.9, hd: 0.9 })
  }

  const generate = () => {
    const speed = runtime.speed
    const d = Math.min(1, runtime.distance / 3400)
    const tGap = 1.45 - 0.7 * d + rand() * (0.45 - 0.2 * d)
    const gap = Math.max(14, tGap * speed)
    st.cursorZ -= gap
    const z = st.cursorZ
    const fast = gap / speed < 0.8

    // an oncoming train reserves its lane long enough that nothing else sits in its path
    let blocked = -1
    if (st.reserve >= 0) {
      blocked = st.reserve
      st.reserveRows -= 1
      if (st.reserveRows <= 0) {
        st.reserve = -1
        const cars = 1 + Math.floor(rand() * (1 + d * 2.2))
        spawnTrain(blocked, z, cars, true)
        const others = [0, 1, 2].filter((l) => l !== blocked)
        if (rand() < 0.55) spawnObstacle(kindFor(pick(['L', 'H'])), pick(others), z)
        st.prevOpen = others
        return
      }
    } else if (runtime.distance > 260 && rand() < 0.045 + d * 0.06) {
      st.reserve = Math.floor(rand() * 3)
      st.reserveRows = Math.ceil((Math.abs(SPAWN_Z) + 30) / gap) + 1
      blocked = st.reserve
    }

    let plan = null
    for (let attempt = 0; attempt < 6 && !plan; attempt++) {
      const r = rand()
      const trainW = runtime.distance < 120 ? 0 : 0.42
      const candidate = r < trainW ? planTrains(d, speed, blocked, r < trainW * 0.35 && d > 0.12) : planRow(d, speed, blocked)
      if (!candidate) continue
      const open = [0, 1, 2].filter((l) => candidate.start[l] === 'P')
      if (!open.length) continue
      if (fast && !open.some((l) => st.prevOpen.some((p) => Math.abs(p - l) <= 1))) continue
      plan = candidate
    }
    if (!plan) plan = planRow(0, speed, blocked)

    const open = plan.run(z)
    st.cursorZ -= plan.length
    st.prevOpen = plan.endOpen

    if (runtime.distance > 150 && rand() < 0.075) {
      const lanes = open.filter((l) => l !== blocked)
      if (lanes.length) placePower(pick(lanes), z + 8)
    }
  }

  // ---------------------------------------------------------------- services for other systems
  const surface = { h: 0, kind: null, id: -1 }
  const surfaceAt = (x, y) => {
    surface.h = 0
    surface.kind = null
    surface.id = -1
    for (const it of trainItems) {
      if (!it.active || it.knocked) continue
      if (Math.abs(it.x - x) > it.hw + 0.25) continue
      let h
      if (it.cat === 'train') {
        if (Math.abs(it.z) > it.hd + CAR_GAP / 2 + 0.1) continue
        h = TRAIN_ROOF
      } else {
        if (Math.abs(it.z) > it.hd) continue
        h = rampHeight(it)
      }
      if (y >= h - STEP_UP && h > surface.h) {
        surface.h = h
        surface.kind = it.cat
        surface.id = it.trainId
      }
    }
    return surface
  }
  const probe = (x, z) => {
    for (const it of all) {
      if (!it.active || it.knocked || it.cat === 'pickup') continue
      if (Math.abs(it.x - x) < it.hw + 0.3 && Math.abs(it.z - z) < it.hd + 0.9) return it.cat
    }
    return null
  }

  const reset = () => {
    for (const it of all) despawn(it)
    for (const c of coins) c.active = false
    Object.assign(st, { cursorZ: -FIRST_OBSTACLE_GAP, prevOpen: [0, 1, 2], reserve: -1, reserveRows: 0, combo: 0, skyZ: 0, lastRoofId: -1 })
  }

  // ---------------------------------------------------------------- per-frame update
  const _m = new THREE.Matrix4()
  const _q = new THREE.Quaternion()
  const _e = new THREE.Euler()
  const _p = new THREE.Vector3()
  const _s = new THREE.Vector3(1, 1, 1)

  const collectCoin = (c) => {
    c.active = false
    const now = runtime.time
    st.combo = now - st.lastCoin < 0.45 ? st.combo + 1 : 0
    st.lastCoin = now
    runtime.coins += 1
    runtime.stats.coins += 1
    if (c.pulled && runtime.power.magnet > 0) runtime.stats.magnetCoins += 1
    runtime.score += COIN_POINTS * runtime.multiplier
    audio.play('coin', { combo: st.combo })
    fx.burst({ x: c.x, y: c.y, z: c.z, count: 8, color: 0xffd34d, speed: 2.8, up: 0.6, life: 0.45, size: 0.09, gravity: 0 })
    events.emit('coin')
  }

  const update = (t) => {
    const dz = runtime.dz
    const dt = runtime.dt
    const p = runtime.player
    const playing = runtime.mode === 'playing' && !runtime.crashed

    if (playing) {
      st.cursorZ += dz
      let guard = 0
      while (st.cursorZ > SPAWN_Z && guard++ < 4) generate()
      // jetpack: a trail of sky coins along the flight path
      if (runtime.power.jetpack > 1.2) {
        st.skyZ += dz
        while (st.skyZ > -95) {
          st.skyPhase += 0.22
          const lane = Math.round(1 + Math.sin(st.skyPhase))
          addCoin(LANES[lane], jetAltitude(runtime.mapId) + 0.6, st.skyZ - 6, true)
          st.skyZ -= 3.2
        }
      } else st.skyZ = -12
    }

    const sliding = p.slideTime > 0 && p.grounded
    const pTop = p.y + (sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT)
    let collided = false

    for (const it of all) {
      if (!it.active) continue
      const move = dz + (it.speed && !runtime.crashed ? it.speed * dt : 0)
      it.prevZ = it.z
      it.z += move

      if (it.knocked) {
        it.kt += dt
        it.z += it.kvz * dt
        it.group.position.y += it.kvy * dt
        it.kvy -= 18 * dt
        it.group.rotation.x += it.kvr * dt
        if (it.kt > 1.4) despawn(it)
      }
      if (it.cat === 'pickup') {
        it.group.rotation.y = t * 2
        it.group.position.y = it.baseY + Math.sin(t * 3 + it.z * 0.1) * 0.12
        if (it.halo) it.halo.rotation.y = -it.group.rotation.y
      }
      it.group.position.x = it.x
      it.group.position.z = it.z

      if (it.z - it.hd > DESPAWN_Z) {
        despawn(it)
        continue
      }
      if (it.speed && it.lead && !it.honked && it.z > -45 && playing) {
        it.honked = true
        audio.play('trainpass')
      }

      if (!playing || it.knocked) continue

      // stats: obstacles cleared by jumping or sliding
      if (!it.passed && it.prevZ < 0 && it.z >= 0 && (it.cat === 'low' || it.cat === 'high') && Math.abs(it.x - p.x) < it.hw) {
        it.passed = true
        if (it.cat === 'low' && p.y > 0.25) runtime.stats.jumpsOver += 1
        if (it.cat === 'high' && sliding) runtime.stats.slidesUnder += 1
      }

      if (Math.abs(it.z) > it.hd + 2.5 || collided) continue

      if (it.cat === 'pickup') {
        if (Math.abs(it.z) < 1 && Math.abs(it.x - p.x) < 1.1 && Math.abs(it.baseY - (p.y + 0.9)) < 1.5) {
          despawn(it)
          runtime.stats.powerups += 1
          activatePower(it.power, { free: true })
          fx.burst({ x: it.x, y: it.baseY, z: it.z, count: 40, color: 0xffffff, speed: 4.5, up: 1, life: 0.8, size: 0.14, gravity: 0 })
        }
        continue
      }

      const zOv = Math.abs(it.z) < it.hd + PLAYER_HALF_DEPTH
      const xOv = Math.abs(it.x - p.x) < it.hw + PLAYER_HALF_WIDTH - 0.04
      if (!zOv || !xOv) continue
      const wasAlongside = Math.abs(it.prevZ) < it.hd + PLAYER_HALF_DEPTH

      if (it.cat === 'train') {
        if (p.y >= TRAIN_ROOF - STEP_UP) continue
        if (runtime.invuln > 0 || runtime.power.jetpack > 0) {
          // protected runners ghost through instead of getting stuck inside a car
          runtime.invuln = Math.max(runtime.invuln, 0.2)
          continue
        }
        collided = true
        hit({ fatal: !wasAlongside, side: wasAlongside })
      } else if (it.cat === 'ramp') {
        if (p.y >= rampHeight(it) - STEP_UP) continue
        collided = true
        hit({ fatal: false, side: true })
      } else {
        if (!(p.y < it.y1 && pTop > it.y0)) continue
        collided = true
        const r = hit({ fatal: it.cat === 'block', side: wasAlongside })
        if ((r === 'stumble' || r === 'board' || r === 'caught') && it.cat !== 'block' && !wasAlongside) {
          // knock the obstacle flying
          it.knocked = true
          it.kt = 0
          it.kvz = -runtime.speed * 0.35
          it.kvy = 5
          it.kvr = -6 - rand() * 4
        }
      }
    }

    // roofs visited (mission stat)
    if (p.grounded && p.surface === 'train' && p.surfaceId !== st.lastRoofId) {
      st.lastRoofId = p.surfaceId
      runtime.stats.roofs += 1
    }

    // ---- coins
    const magnet = playing && (runtime.power.magnet > 0 || runtime.power.jetpack > 0)
    const k = 1 - Math.exp(-12 * dt)
    let drawn = 0
    for (let i = 0; i < COIN_COUNT; i++) {
      const c = coins[i]
      if (!c.active) continue
      c.z += dz
      if (magnet && !c.pulled && c.z > -18 && c.z < 2 && Math.abs(c.x - p.x) < 4.2 && (runtime.power.jetpack > 0 ? c.sky || c.y > 2 : true)) c.pulled = true
      if (c.pulled && playing) {
        c.x += (p.x - c.x) * k
        c.y += (p.y + 1 - c.y) * k
        c.z += (0 - c.z) * k
      }
      if (c.z > 4) {
        c.active = false
        continue
      }
      if (playing && Math.abs(c.z) < 0.8 && Math.abs(c.x - p.x) < 0.8 && c.y > p.y - 0.4 && c.y < pTop + 0.45) {
        collectCoin(c)
        continue
      }
      if (c.z < -150) continue // beyond the fog: don't draw
      _p.set(c.x, c.y + Math.sin(t * 3 + c.spin) * 0.06, c.z)
      _q.setFromEuler(_e.set(0, t * 3.2 + c.spin, 0))
      _m.compose(_p, _q, _s)
      coinMesh.setMatrixAt(drawn++, _m)
    }
    coinMesh.count = drawn
    coinMesh.instanceMatrix.needsUpdate = true

    beacon.color.setHex(0xffae42).multiplyScalar(Math.sin(t * 7) > 0 ? 3.2 : 0.4)
  }

  const dispose = () => {
    root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose()
    })
  }

  return { root, update, reset, surfaceAt, probe, dispose, pools }
}

export default function Spawner() {
  const mapId = useGame((s) => s.profile.map)
  const sys = useMemo(() => createSpawner(getMap(mapId)), [mapId])

  useEffect(() => {
    runtime.surfaceAt = sys.surfaceAt
    runtime.probe = sys.probe
    const off = onReset(sys.reset)
    if (import.meta.env.DEV && window.__nocturne) window.__nocturne.pools = sys.pools
    return () => {
      off()
      sys.dispose()
    }
  }, [sys])

  useFrame((state) => sys.update(state.clock.elapsedTime), -8)
  return <primitive object={sys.root} />
}
