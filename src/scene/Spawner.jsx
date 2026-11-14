import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BOOST_DURATION,
  DESPAWN_Z,
  FIRST_OBSTACLE_GAP,
  GEM_POINTS,
  LANES,
  MAGNET_DURATION,
  PLAYER_HALF_DEPTH,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_SLIDE_HEIGHT,
  SPAWN_Z,
} from '../game/constants'
import { events, fx, onReset, runtime } from '../game/runtime'
import { audio } from '../game/audio'
import { glowTexture } from '../game/textures'
import { Barrier, BoostPickup, Gate, Hurdle, MagnetPickup, Roadblock, Roller, Vehicle, beaconMaterial } from './Obstacles'

// Collider boxes relative to the obstacle origin (half width, y range, half depth)
const COLLIDERS = {
  barrier: { hw: 0.94, y0: 0, y1: 2.55, hd: 0.2 },
  hurdle: { hw: 0.95, y0: 0, y1: 0.95, hd: 0.08 },
  roadblock: { hw: 0.95, y0: 0, y1: 1.0, hd: 0.3 },
  gate: { hw: 1.0, y0: 1.28, y1: 3.4, hd: 0.12 },
  vehicle: { hw: 0.86, y0: 0, y1: 1.3, hd: 2.0 },
  roller: { hw: 0.7, y0: 0, y1: 1.52, hd: 0.7 },
}
const POOL_SIZES = { barrier: 14, hurdle: 10, gate: 10, roadblock: 10, vehicle: 3, roller: 3, magnet: 2, boost: 2 }
const CODE_TYPE = { B: 'barrier', H: 'hurdle', R: 'roadblock', G: 'gate' }
const GEM_COUNT = 150
const VEHICLE_SPEED = 9

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

// ----------------------------------------------------------------- patterns
// Each pattern returns rows: [{ off, lanes }] where off = extra distance further away.
const PATTERNS = [
  { min: 0, w: 3, make: () => [{ off: 0, lanes: one(pick(['B', 'H', 'R', 'G'])) }] },
  { min: 0, w: 2.5, make: () => [{ off: 0, lanes: shuffle(['B', 'B', 0]) }] },
  { min: 0, w: 1.4, make: () => [{ off: 0, lanes: shuffle(['B', 'H', 0]) }] },
  { min: 0.06, w: 1.6, make: () => [{ off: 0, lanes: ['H', 'H', 'H'] }] },
  { min: 0.06, w: 1.4, make: () => [{ off: 0, lanes: ['G', 'G', 'G'] }] },
  { min: 0.1, w: 1.2, make: () => [{ off: 0, lanes: shuffle(['R', 'R', 'B']) }] },
  { min: 0.12, w: 1.6, make: () => [{ off: 0, lanes: shuffle(['B', 'H', 'G']) }] },
  { min: 0.18, w: 1.2, make: () => [{ off: 0, lanes: shuffle(['G', 'G', 'B']) }] },
  {
    // jump, then slide
    min: 0.25,
    w: 1.1,
    make: (speed) => [
      { off: 0, lanes: ['H', 'H', 'H'] },
      { off: Math.max(11, speed * 0.62), lanes: ['G', 'G', 'G'] },
    ],
  },
  {
    // barrier corridor: commit to a lane
    min: 0.3,
    w: 1,
    make: () => {
      const open = Math.floor(rand() * 3)
      const lanes = ['B', 'B', 'B']
      lanes[open] = 0
      return [0, 7, 14].map((off, i) => {
        const l = lanes.slice()
        if (i === 1) l[open] = pick([0, 'H', 'G'])
        return { off, lanes: l }
      })
    },
  },
  {
    // zig-zag
    min: 0.4,
    w: 1,
    make: (speed) => {
      const dir = rand() < 0.5
      return [
        { off: 0, lanes: dir ? ['B', 'B', 0] : [0, 'B', 'B'] },
        { off: Math.max(12, speed * 0.6), lanes: dir ? [0, 'B', 'B'] : ['B', 'B', 0] },
      ]
    },
  },
]

function choosePattern(d) {
  const avail = PATTERNS.filter((p) => d >= p.min)
  const total = avail.reduce((s, p) => s + p.w, 0)
  let r = rand() * total
  for (const p of avail) {
    r -= p.w
    if (r <= 0) return p
  }
  return avail[0]
}

const tmpColor = new THREE.Color()

export default function Spawner() {
  const pools = useRef(null)
  if (!pools.current) {
    pools.current = Object.fromEntries(
      Object.entries(POOL_SIZES).map(([type, n]) => [
        type,
        Array.from({ length: n }, () => ({ active: false, group: null, inner: null, x: 0, z: 0, lane: 1, t: 0, w: 0, ph: 0 })),
      ]),
    )
  }
  const gems = useRef(
    Array.from({ length: GEM_COUNT }, () => ({ active: false, x: 0, y: 0, z: 0, spin: 0, pulled: false })),
  ).current
  const st = useRef({ cursorZ: -FIRST_OBSTACLE_GAP, prevOpen: [0, 1, 2], reserve: -1, reserveRows: 0, combo: 0, lastCollect: -10 }).current

  const gemMesh = useRef()
  const haloMesh = useRef()

  const gemGeo = useMemo(() => new THREE.OctahedronGeometry(0.24, 0).scale(1, 1.4, 1), [])
  const gemMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8fc0ff',
        emissive: '#3f7dff',
        emissiveIntensity: 2.4,
        metalness: 0.6,
        roughness: 0.12,
        flatShading: true,
      }),
    [],
  )
  const haloGeo = useMemo(() => new THREE.PlaneGeometry(1.15, 1.15), [])
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: '#5c96ff',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      gemGeo.dispose()
      gemMat.dispose()
      haloGeo.dispose()
      haloMat.dispose()
    },
    [gemGeo, gemMat, haloGeo, haloMat],
  )

  // ----------------------------------------------------------- pool helpers
  const hideAll = () => {
    for (const list of Object.values(pools.current)) {
      for (const it of list) {
        it.active = false
        if (it.group) it.group.visible = false
      }
    }
    for (const g of gems) g.active = false
    st.cursorZ = -FIRST_OBSTACLE_GAP
    st.prevOpen = [0, 1, 2]
    st.reserve = -1
    st.reserveRows = 0
    st.combo = 0
  }

  useEffect(() => onReset(hideAll), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (import.meta.env.DEV && window.__nocturne) window.__nocturne.pools = pools.current
  }, [])

  const spawn = (type, lane, z, extra) => {
    const it = pools.current[type].find((o) => !o.active)
    if (!it || !it.group) return null
    it.active = true
    it.lane = lane
    it.x = LANES[lane]
    it.z = z
    it.t = 0
    it.passed = false
    if (extra) Object.assign(it, extra)
    it.group.visible = true
    it.group.position.set(it.x, 0, it.z)
    return it
  }

  const addGem = (x, y, z) => {
    const g = gems.find((o) => !o.active)
    if (!g) return
    g.active = true
    g.x = x
    g.y = y
    g.z = z
    g.spin = rand() * Math.PI * 2
    g.pulled = false
  }

  const placeGems = (lane, code, z, speed) => {
    const x = LANES[lane]
    if (code === 'H' || code === 'R') {
      const half = Math.max(4.5, speed * 0.27)
      for (let i = -2; i <= 2; i++) {
        const off = (i / 2) * half
        addGem(x, 0.8 + 1.55 * (1 - (off / half) ** 2), z - off)
      }
    } else if (code === 'G') {
      for (let i = 0; i < 4; i++) addGem(x, 0.45, z + 3 - i * 2)
    } else {
      for (let i = 0; i < 5; i++) addGem(x, 0.95, z + 2.5 + i * 2.2)
    }
  }

  const generate = () => {
    const speed = runtime.speed
    const d = Math.min(1, runtime.distance / 3200)
    const tGap = 1.6 - 0.85 * d + rand() * (0.5 - 0.25 * d)
    const gap = Math.max(13, tGap * speed)
    st.cursorZ -= gap
    let z = st.cursorZ

    // --- oncoming vehicle: reserve its lane long enough that nothing else sits in its path
    let blocked = st.reserve
    if (st.reserve >= 0) {
      st.reserveRows--
      if (st.reserveRows <= 0) {
        const lane = st.reserve
        st.reserve = -1
        const car = spawn('vehicle', lane, z - 6)
        if (car) {
          // the other lanes get light obstacles at most
          const other = [0, 1, 2].filter((l) => l !== lane)
          const l = pick(other)
          if (rand() < 0.5) spawn(CODE_TYPE[pick(['H', 'G', 'R'])], l, z)
          st.prevOpen = [0, 1, 2]
          return
        }
      }
    } else if (d > 0.1 && rand() < 0.05 + d * 0.06 && pools.current.vehicle.some((v) => !v.active)) {
      st.reserve = Math.floor(rand() * 3)
      st.reserveRows = Math.ceil((Math.abs(SPAWN_Z) + 20) / gap) + 1
      blocked = st.reserve
    }

    // --- rolling chrome sphere sweeping across all lanes
    if (blocked < 0 && d > 0.18 && rand() < 0.08) {
      const ball = spawn('roller', 1, z, { w: 1.3 + rand() * 0.9 * (0.5 + d), ph: rand() * Math.PI * 2 })
      if (ball) {
        ball.x = LANES[1] + Math.sin(ball.ph) * LANES[2]
        st.prevOpen = [0, 1, 2]
        return
      }
    }

    // --- regular pattern
    let rows = null
    for (let attempt = 0; attempt < 6 && !rows; attempt++) {
      const candidate = choosePattern(d).make(speed)
      if (blocked >= 0) candidate.forEach((r) => (r.lanes[blocked] = 0))
      const first = candidate[0].lanes
      const open = [0, 1, 2].filter((l) => first[l] !== 'B')
      if (!open.length) continue
      // fairness: if rows are close, the new open lane must be reachable from a previous one
      if (gap / speed < 0.75) {
        const reachable = open.some((l) => st.prevOpen.some((p) => Math.abs(p - l) <= 1))
        if (!reachable) continue
      }
      rows = candidate
    }
    if (!rows) rows = [{ off: 0, lanes: one('H') }]

    let maxOff = 0
    for (const row of rows) {
      const rz = z - row.off
      maxOff = Math.max(maxOff, row.off)
      row.lanes.forEach((code, lane) => {
        if (code) spawn(CODE_TYPE[code], lane, rz)
      })
    }
    st.cursorZ -= maxOff

    const last = rows[rows.length - 1].lanes
    st.prevOpen = [0, 1, 2].filter((l) => last[l] !== 'B')

    // --- collectibles
    const first = rows[0].lanes
    const openLanes = [0, 1, 2].filter((l) => first[l] !== 'B' && l !== blocked)
    if (openLanes.length && rand() < 0.72) {
      const lane = pick(openLanes)
      placeGems(lane, first[lane], z, speed)
    }
    // --- power-ups
    const emptyLanes = [0, 1, 2].filter((l) => !first[l] && l !== blocked)
    if (emptyLanes.length && runtime.distance > 220 && rand() < 0.05) {
      const type = rand() < 0.5 ? 'magnet' : 'boost'
      const anyActive = pools.current.magnet.some((o) => o.active) || pools.current.boost.some((o) => o.active)
      if (!anyActive) {
        const pu = spawn(type, pick(emptyLanes), z + 7)
        if (pu) pu.group.position.y = 1.05
      }
    }
  }

  const crash = () => {
    const p = runtime.player
    runtime.crashed = true
    runtime.crashTime = 0
    runtime.trauma = 1
    runtime.actions.length = 0
    audio.play('crash')
    fx.burst({ x: p.x, y: 1.0, z: -0.4, count: 70, color: 0xffffff, speed: 8, up: 3, life: 1.1, size: 0.13, gravity: -9 })
    fx.burst({ x: p.x, y: 0.8, z: -0.4, count: 50, color: 0x5d9bff, speed: 5, up: 2, life: 1.4, size: 0.18, gravity: -5 })
    events.emit('crash')
  }

  const collect = (g) => {
    g.active = false
    const now = runtime.time
    st.combo = now - st.lastCollect < 0.7 ? st.combo + 1 : 0
    st.lastCollect = now
    runtime.gems++
    runtime.score += GEM_POINTS * runtime.multiplier
    audio.play('collect', { combo: st.combo })
    fx.burst({ x: g.x, y: g.y, z: g.z, count: 12, color: 0x8fc0ff, speed: 3.2, up: 0.5, life: 0.55, size: 0.1, gravity: 0 })
    events.emit('gem')
  }

  const activatePower = (type, it) => {
    if (type === 'magnet') runtime.magnetTime = MAGNET_DURATION
    else runtime.boostTime = BOOST_DURATION
    audio.play('power')
    fx.burst({ x: it.x, y: 1.0, z: it.z, count: 40, color: 0xbcd6ff, speed: 4.5, up: 1, life: 0.8, size: 0.14, gravity: 0 })
    events.emit('toast', type === 'magnet' ? { kind: 'power', title: 'Magnet', sub: 'Drops are drawn to you' } : { kind: 'power', title: 'Double Score', sub: 'Every point counts twice' })
  }

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _e = useMemo(() => new THREE.Euler(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  const _s = useMemo(() => new THREE.Vector3(), [])
  const HIDDEN = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])

  useFrame((state) => {
    const dz = runtime.dz
    const dt = runtime.dt
    const p = runtime.player
    const playing = runtime.mode === 'playing' && !runtime.crashed
    const t = state.clock.elapsedTime

    // ---- spawning
    if (playing) {
      st.cursorZ += dz
      let guard = 0
      while (st.cursorZ > SPAWN_Z && guard++ < 4) generate()
    }

    const pTop = p.y + (p.slideTime > 0 && p.grounded ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT)
    let hit = false

    // ---- obstacles
    for (const [type, list] of Object.entries(pools.current)) {
      const col = COLLIDERS[type]
      for (const it of list) {
        if (!it.active) continue
        it.z += dz
        if (type === 'vehicle' && !runtime.crashed) {
          it.z += VEHICLE_SPEED * dt
          if (it.inner) it.inner.children.forEach((w) => (w.rotation.x += (runtime.speed + VEHICLE_SPEED) * dt / 0.34))
          if (!it.passed && it.z > 0) {
            it.passed = true
            if (playing) audio.play('swoosh')
          }
        } else if (type === 'roller' && !runtime.crashed) {
          it.t += dt
          const nx = Math.sin(it.t * it.w + it.ph) * LANES[2]
          if (it.inner) it.inner.rotation.z -= (nx - it.x) / 0.8
          it.x = nx
        } else if (type === 'magnet' || type === 'boost') {
          it.group.rotation.y = t * 1.8
          it.group.position.y = 1.05 + Math.sin(t * 3 + it.z * 0.1) * 0.1
        }
        it.group.position.x = it.x
        it.group.position.z = it.z

        if (it.z > DESPAWN_Z) {
          it.active = false
          it.group.visible = false
          continue
        }

        if (!playing || Math.abs(it.z) > 4) continue

        if (col) {
          if (
            Math.abs(it.z) < col.hd + PLAYER_HALF_DEPTH &&
            Math.abs(it.x - p.x) < col.hw + PLAYER_HALF_WIDTH &&
            p.y < col.y1 &&
            pTop > col.y0
          ) {
            hit = true
          }
        } else if (Math.abs(it.z) < 0.9 && Math.abs(it.x - p.x) < 1.0 && p.y < 2.0) {
          // power-up pickup
          it.active = false
          it.group.visible = false
          activatePower(type, it)
        }
      }
    }
    if (hit && playing && !(import.meta.env.DEV && runtime.god)) crash()

    // ---- gems (instanced)
    const gm = gemMesh.current
    const hm = haloMesh.current
    const magnet = runtime.magnetTime > 0 && playing
    for (let i = 0; i < GEM_COUNT; i++) {
      const g = gems[i]
      if (!g.active) {
        gm.setMatrixAt(i, HIDDEN)
        hm.setMatrixAt(i, HIDDEN)
        continue
      }
      g.z += dz
      if (magnet && g.z > -16 && g.z < 2) g.pulled = true
      if (g.pulled && playing) {
        const k = 1 - Math.exp(-11 * dt)
        g.x += (p.x - g.x) * k
        g.y += (p.y + 1.0 - g.y) * k
        g.z += (0 - g.z) * k
      }
      if (g.z > 3) {
        g.active = false
        gm.setMatrixAt(i, HIDDEN)
        hm.setMatrixAt(i, HIDDEN)
        continue
      }
      if (
        playing &&
        Math.abs(g.z) < 0.75 &&
        Math.abs(g.x - p.x) < 0.75 &&
        g.y > p.y - 0.35 &&
        g.y < pTop + 0.35
      ) {
        collect(g)
        gm.setMatrixAt(i, HIDDEN)
        hm.setMatrixAt(i, HIDDEN)
        continue
      }
      const bob = Math.sin(t * 3 + g.spin) * 0.08
      _p.set(g.x, g.y + bob, g.z)
      _q.setFromEuler(_e.set(0, t * 2.4 + g.spin, 0))
      _s.set(1, 1, 1)
      _m.compose(_p, _q, _s)
      gm.setMatrixAt(i, _m)
      _q.identity()
      const pulse = 1 + Math.sin(t * 5 + g.spin) * 0.12
      _s.set(pulse, pulse, 1)
      _m.compose(_p, _q, _s)
      hm.setMatrixAt(i, _m)
    }
    gm.instanceMatrix.needsUpdate = true
    hm.instanceMatrix.needsUpdate = true

    // beacons blink, gems glow brighter during boost
    beaconMaterial().color.setHex(0xffae42).multiplyScalar(Math.sin(t * 7) > 0 ? 3.2 : 0.5)
    gemMat.emissiveIntensity = runtime.boostTime > 0 ? 3.4 : 2.4
    haloMat.color.copy(tmpColor.setHex(runtime.boostTime > 0 ? 0x8fb8ff : 0x5c96ff))
  }, -8)

  const VIS = { barrier: Barrier, hurdle: Hurdle, gate: Gate, roadblock: Roadblock, magnet: MagnetPickup, boost: BoostPickup }

  return (
    <group>
      {Object.entries(pools.current).map(([type, list]) =>
        list.map((it, i) => {
          const Comp = VIS[type]
          return (
            <group
              key={`${type}-${i}`}
              visible={false}
              ref={(el) => {
                it.group = el
              }}
            >
              {type === 'vehicle' ? (
                <Vehicle wheelsRef={(el) => (it.inner = el)} />
              ) : type === 'roller' ? (
                <Roller ballRef={(el) => (it.inner = el)} />
              ) : (
                <Comp />
              )}
            </group>
          )
        }),
      )}
      <instancedMesh ref={gemMesh} args={[gemGeo, gemMat, GEM_COUNT]} frustumCulled={false} castShadow />
      <instancedMesh ref={haloMesh} args={[haloGeo, haloMat, GEM_COUNT]} frustumCulled={false} />
    </group>
  )
}
