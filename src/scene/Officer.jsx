import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHASE_CLOSE, CHASE_FAR, CHASE_INTRO, GRAVITY, LANES } from '../game/constants'
import { onReset, runtime } from '../game/runtime'
import { audio } from '../game/audio'
import { OFFICER_OUTFIT } from '../game/catalog'
import { applyPose, buildCharacter } from './character/rig'
import * as P from './character/poses'

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt))

/**
 * The transit officer chasing the runner. He stays close at the start of a run, drops back out of
 * view, then sprints in after every stumble. A second stumble while he's close means you're caught.
 */
export default function Officer() {
  const rig = useMemo(() => buildCharacter(OFFICER_OUTFIT), [])
  const group = useRef()
  useEffect(() => () => rig.dispose(), [rig])

  const s = useRef({
    pose: P.makePose(),
    tmp: P.makePose(),
    phase: 0,
    y: 0,
    vy: 0,
    lane: 1,
    slide: 0,
    whistled: false,
    actionW: 0,
    action: null,
    wSlide: 0,
    wJump: 0,
  }).current

  useEffect(
    () =>
      onReset(() => {
        const c = runtime.chase
        c.state = 'intro'
        c.intro = CHASE_INTRO
        c.dist = CHASE_CLOSE + 1.2
        c.x = 0
        s.lane = 1
        s.y = 0
        s.vy = 0
        s.whistled = false
      }),
    [s],
  )

  useFrame((state, delta) => {
    const c = runtime.chase
    const p = runtime.player
    const realDt = Math.min(delta, 1 / 20)
    const dt = runtime.dt
    const t = state.clock.elapsedTime
    const active = runtime.mode === 'playing' || runtime.mode === 'paused' || runtime.mode === 'gameover'
    if (!active) {
      group.current.visible = false
      return
    }

    // ------------------------------------------------------------ chase state machine
    let action = null
    let runSpeedK = 1
    if (c.state === 'intro') {
      if (dt > 0 && !s.whistled && runtime.time > 0.35) {
        s.whistled = true
        audio.play('whistle')
      }
      c.intro -= dt
      c.target = CHASE_CLOSE + 0.9
      action = runtime.time < 1.4 ? 'whistle' : 'point'
      if (c.intro <= 0) c.state = 'far'
    } else if (c.state === 'close') {
      c.target = CHASE_CLOSE
      action = c.whistle > 0 ? 'whistle' : 'point'
      c.whistle = Math.max(0, c.whistle - dt)
      if (c.heat <= 0) c.state = 'far'
    } else if (c.state === 'far') {
      c.target = CHASE_FAR
    } else if (c.state === 'catching') {
      c.target = 0.75
      action = 'grab'
      runSpeedK = 1.4
    } else if (c.state === 'reacting') {
      c.target = 3.4
      runSpeedK = 0.5
    }

    // approach speed: sprint in fast, fall back slowly
    const closing = c.target < c.dist
    const kDist = c.state === 'catching' ? 3.2 : c.state === 'reacting' ? 0.9 : closing ? 3.2 : 0.45
    c.dist = damp(c.dist, c.target, kDist, realDt * (runtime.mode === 'paused' ? 0 : 1))

    // ------------------------------------------------------------ lane choice & obstacle hops
    const wantLane = c.state === 'reacting' ? Math.min(2, Math.max(0, p.lane + (p.lane === 2 ? -1 : 1))) : p.lane
    if (dt > 0) {
      const aheadZ = c.dist - 1.6
      let lane = wantLane
      if (runtime.probe(LANES[lane], c.dist) === 'train' || runtime.probe(LANES[lane], aheadZ) === 'block') {
        const free = [0, 1, 2].filter((l) => runtime.probe(LANES[l], c.dist) !== 'train' && runtime.probe(LANES[l], aheadZ) !== 'block')
        if (free.length) lane = free.reduce((a, b) => (Math.abs(b - wantLane) < Math.abs(a - wantLane) ? b : a))
      }
      s.lane = lane
      const ahead = runtime.probe(LANES[s.lane], aheadZ)
      if (ahead === 'low' && s.y <= 0 && c.dist < 10) s.vy = 11
      if (ahead === 'high') s.slide = 0.6
    }
    const targetX = c.state === 'reacting' ? p.x + 0.95 : c.state === 'catching' ? p.x : LANES[s.lane]
    c.x = damp(c.x, targetX, 6, realDt)
    if (dt > 0) {
      s.vy += GRAVITY * dt
      s.y = Math.max(0, s.y + s.vy * dt)
      if (s.y <= 0) s.vy = 0
      s.slide = Math.max(0, s.slide - dt)
    }

    // ------------------------------------------------------------ animation
    const stopped = (c.state === 'reacting' && Math.abs(c.dist - c.target) < 0.3) || (c.state === 'catching' && Math.abs(c.dist - c.target) < 0.25)
    const cadence = stopped ? 0 : (2.6 + runtime.speed * 0.05 + (closing ? 1.2 : 0)) * Math.PI * runSpeedK
    if (runtime.mode !== 'paused') s.phase += cadence * realDt
    const pose = s.pose
    if (stopped) P.idlePose(pose, t)
    else P.runPose(pose, s.phase, Math.min(1.1, 0.8 + runtime.speed / 45), OFFICER_OUTFIT.style)

    s.wJump = damp(s.wJump, s.y > 0.05 ? 1 : 0, 14, realDt)
    s.wSlide = damp(s.wSlide, s.slide > 0 ? 1 : 0, 14, realDt)
    if (s.wJump > 0.01) P.blendInto(pose, P.jumpPose(s.tmp, Math.max(0, Math.min(1, s.vy / 11))), s.wJump)
    if (s.wSlide > 0.01) P.blendInto(pose, P.slidePose(s.tmp, t), s.wSlide)

    if (c.state === 'reacting' && stopped) action = 'hips'
    if (c.state === 'catching' && stopped) action = 'grab'
    s.actionW = damp(s.actionW, action ? 1 : 0, 8, realDt)
    if (action) s.action = action
    if (s.actionW > 0.01 && s.action) {
      P.copyPose(s.tmp, pose)
      P.officerAction(s.tmp, s.action, t)
      P.blendInto(pose, s.tmp, s.actionW)
    }
    applyPose(rig, pose)

    group.current.visible = c.dist < 10 || runtime.mode === 'gameover'
    group.current.position.set(c.x, s.y, c.dist)
    // face the runner when standing over them
    group.current.rotation.y = stopped && c.state === 'reacting' ? 0.5 : 0
  }, -8)

  return (
    <group ref={group} visible={false}>
      <primitive object={rig.root} />
    </group>
  )
}
