import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FAST_FALL_VELOCITY,
  GRAVITY,
  JUMP_VELOCITY,
  LANES,
  LANE_SWITCH_SHARPNESS,
  SLIDE_DURATION,
  SNEAKER_JUMP_VELOCITY,
} from '../game/constants'
import { events, fx, runtime } from '../game/runtime'
import { audio } from '../game/audio'
import { useGame } from '../game/store'
import { endJetpack } from '../game/rules'
import { getBoard, getSkin } from '../game/catalog'
import { jetAltitude } from '../game/maps'
import { applyPose, buildCharacter } from './character/rig'
import * as P from './character/poses'
import { buildBoard, buildCoils, buildJetpack } from './prefabs'

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt))
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const _v = new THREE.Vector3()
const _c = new THREE.Color()

export default function Player() {
  const skinId = useGame((s) => s.preview.skin ?? s.profile.skin)
  const boardId = useGame((s) => s.preview.board ?? s.profile.board)
  const skin = getSkin(skinId)

  const rig = useMemo(() => buildCharacter(skin), [skin])
  const board = useMemo(() => buildBoard(getBoard(boardId)), [boardId])
  const jet = useMemo(() => buildJetpack(), [])
  const coils = useMemo(() => buildCoils(), [])
  const holder = useRef()
  const yaw = useRef()

  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => () => board.dispose(), [board])
  useEffect(
    () => () => {
      jet.dispose()
      coils.dispose()
    },
    [jet, coils],
  )
  useEffect(() => {
    rig.joints.torso.add(jet.group)
    jet.group.position.set(0, 0.3, 0.19)
    rig.joints.ankleL.add(coils.left)
    rig.joints.ankleR.add(coils.right)
    return () => {
      rig.joints.torso.remove(jet.group)
      rig.joints.ankleL.remove(coils.left)
      rig.joints.ankleR.remove(coils.right)
    }
  }, [rig, jet, coils])

  const anim = useRef({
    pose: P.makePose(),
    base: P.makePose(),
    tmp: P.makePose(),
    w: { jump: 0, flip: 0, slide: 0, stumble: 0, board: 0, jet: 0, crash: 0, caught: 0, idle: 0 },
    fall: 0,
    knock: 0,
    stepCount: 0,
    emote: null,
    emoteT: 99,
    wasJetting: false,
  }).current

  // play the skin's emote whenever it's previewed or equipped in the menus
  useEffect(() => {
    anim.emote = skin.emote
    anim.emoteT = 0
  }, [skin, anim])

  useFrame((state, delta) => {
    const p = runtime.player
    const dt = runtime.dt
    const realDt = Math.min(delta, 1 / 20)
    const t = state.clock.elapsedTime
    const playing = runtime.mode === 'playing' && !runtime.crashed
    const jetting = runtime.power.jetpack > 0
    const sneakers = runtime.power.sneakers > 0
    const { screen, shopTab, phase } = useGame.getState()
    const menuIdle = runtime.mode === 'menu' && phase === 'menu' && screen !== 'home'
    const previewBoard = menuIdle && screen === 'shop' && shopTab === 'boards'
    const boarding = runtime.power.board > 0 || previewBoard

    // ------------------------------------------------------------ controls
    if (playing) {
      while (runtime.actions.length) {
        const a = runtime.actions.shift()
        if (a === 'left' || a === 'right') {
          const nl = p.lane + (a === 'left' ? -1 : 1)
          if (nl >= 0 && nl <= 2) {
            p.prevLane = p.lane
            p.lane = nl
            runtime.stats.laneChanges += 1
            audio.play('swoosh')
          }
        } else if (a === 'up') {
          if (jetting) continue
          if (p.grounded) doJump(p, sneakers, boarding)
          else p.jumpBuffer = 0.16
        } else if (a === 'down') {
          if (jetting) continue
          if (p.grounded) {
            if (p.slideTime <= 0) audio.play('slide')
            p.slideTime = SLIDE_DURATION
          } else {
            p.vy = Math.min(p.vy, FAST_FALL_VELOCITY)
            p.slideQueued = true
            p.flip = -1
          }
        } else if (a === 'board') {
          if (runtime.power.board <= 0 && !useGame.getState().useBoard()) {
            audio.play('error')
            events.emit('toast', { kind: 'info', title: 'No skateboards left', sub: 'Pick some up in the shop' })
          }
        } else if (a === 'jet') {
          if (runtime.power.jetpack <= 0 && !useGame.getState().useJet()) {
            audio.play('error')
            events.emit('toast', { kind: 'info', title: 'No jet launches', sub: 'Buy them in the shop' })
          }
        }
      }
    } else if (!runtime.crashed && runtime.mode !== 'paused') {
      runtime.actions.length = 0
    }

    // ------------------------------------------------------------ physics
    if (dt > 0) {
      const prevX = p.x
      p.x = damp(p.x, LANES[p.lane], LANE_SWITCH_SHARPNESS, dt)
      p.lean = damp(p.lean, (p.x - prevX) / Math.max(dt, 1e-4), 12, dt)

      if (jetting) {
        p.y = damp(p.y, jetAltitude(runtime.mapId), 2.6, dt)
        p.vy = 0
        p.grounded = false
        p.surface = null
        p.slideTime = 0
        p.flip = -1
        anim.wasJetting = true
      } else {
        if (anim.wasJetting) {
          anim.wasJetting = false
          endJetpack()
        }
        let g = runtime.surfaceAt(p.x, p.y)
        if (p.grounded) {
          if (g.h < p.y - 0.05) {
            p.grounded = false
            p.vy = 0
            p.jumpTime = 0
            p.airTime = 1
          } else {
            p.y = g.h
            p.surface = g.kind
            p.surfaceId = g.id
          }
        }
        if (!p.grounded) {
          const grav = p.descending ? GRAVITY * 0.45 : GRAVITY
          p.vy += grav * dt
          if (p.descending) p.vy = Math.max(p.vy, -9)
          p.y += p.vy * dt
          p.jumpTime += dt
          g = runtime.surfaceAt(p.x, Math.max(p.y, p.y - p.vy * dt))
          if (p.y <= g.h) land(p, g, boarding, playing)
        }
      }
      p.jumpBuffer = Math.max(0, p.jumpBuffer - dt)
      p.stumbleTime = Math.max(0, p.stumbleTime - dt)
      if (p.slideTime > 0) {
        p.slideTime -= dt
        if (playing && Math.random() < 0.35) fx.burst({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + 0.05, z: 0.3, count: 1, color: 0xd8cbb2, speed: 1.5, up: 0.8, life: 0.35, size: 0.09, gravity: -2 })
      }
      if (p.flip >= 0) p.flip = Math.min(1, p.jumpTime / Math.max(0.2, p.airTime))
    }

    // ------------------------------------------------------------ animation
    const st = skin.style
    const intensity = runtime.crashed ? 0 : Math.min(1.1, 0.7 + runtime.speed / 45)
    const cadence = runtime.mode === 'gameover' || menuIdle ? 0 : (2.5 + runtime.speed * 0.05) * Math.PI * st.cadence
    if (dt > 0 || runtime.mode === 'menu') p.runPhase += cadence * (dt || realDt)

    const step = Math.floor((p.runPhase + Math.PI / 2) / Math.PI)
    if (step !== anim.stepCount) {
      anim.stepCount = step
      if (playing && p.grounded && p.slideTime <= 0 && !boarding) {
        audio.play('step', { surface: p.surface })
        if (skin.glow || Math.random() < 0.4) {
          fx.burst({ x: p.x + (step % 2 ? 0.1 : -0.1), y: p.y + 0.03, z: 0.15, count: skin.glow ? 4 : 2, color: skin.glow ? _c.set(skin.glow).getHex() : 0xc9bfae, speed: 0.8, up: 0.6, life: skin.glow ? 0.6 : 0.35, size: 0.07, gravity: -1 })
        }
      }
    }

    // base: run, or idle (+emote) while browsing menus
    anim.emoteT += realDt
    if (menuIdle && !previewBoard) {
      if (anim.emoteT < 2.6 && anim.emote) {
        P.emotePose(anim.tmp, anim.emote, anim.emoteT)
        P.idlePose(anim.base, t)
        P.blendInto(anim.base, anim.tmp, smoothstep(0, 0.25, anim.emoteT) * (1 - smoothstep(2.2, 2.6, anim.emoteT)))
      } else P.idlePose(anim.base, t)
    } else P.runPose(anim.base, p.runPhase, intensity, st)

    const sliding = p.slideTime > 0 && p.grounded
    const crashed = runtime.crashed || runtime.mode === 'gameover'
    const caught = crashed && runtime.crashKind === 'caught'
    if (crashed && !caught) anim.fall = Math.min(1, anim.fall + realDt * 1.8)
    else anim.fall = Math.max(0, anim.fall - realDt * 2.5)

    const k = runtime.mode === 'paused' ? 0 : 1
    const W = anim.w
    W.jump = damp(W.jump, !p.grounded && !jetting && !boarding && p.flip < 0 ? 1 : 0, 16 * k, realDt)
    W.flip = damp(W.flip, p.flip >= 0 && !p.grounded ? 1 : 0, 20 * k, realDt)
    W.slide = damp(W.slide, sliding && !boarding ? 1 : 0, 19 * k, realDt)
    W.stumble = damp(W.stumble, p.stumbleTime > 0 ? 1 : 0, 14 * k, realDt)
    W.board = damp(W.board, boarding && !jetting && !crashed ? 1 : 0, 10 * k, realDt)
    W.jet = damp(W.jet, jetting ? 1 : 0, 6 * k, realDt)
    W.crash = damp(W.crash, anim.fall > 0 ? 1 : 0, 10, realDt)
    W.caught = damp(W.caught, caught ? 1 : 0, 6, realDt)

    const pose = P.copyPose(anim.pose, anim.base)
    if (W.jump > 0.001) P.blendInto(pose, P.jumpPose(anim.tmp, Math.max(0, Math.min(1, p.vy / JUMP_VELOCITY))), W.jump)
    if (W.flip > 0.001) P.blendInto(pose, P.flipPose(anim.tmp, Math.max(0, p.flip)), W.flip)
    if (W.slide > 0.001) P.blendInto(pose, P.slidePose(anim.tmp, t), W.slide)
    if (W.stumble > 0.001) P.blendInto(pose, P.stumblePose(anim.tmp, 1 - p.stumbleTime / 0.55), W.stumble)
    if (W.board > 0.001) {
      const air = !p.grounded ? Math.sin(Math.min(1, p.jumpTime / Math.max(0.2, p.airTime)) * Math.PI) : sliding ? 0.6 : 0
      P.blendInto(pose, P.boardPose(anim.tmp, t, air, p.lean), W.board)
    }
    if (W.jet > 0.001) P.blendInto(pose, P.jetPose(anim.tmp, t), W.jet)
    if (W.crash > 0.001) P.blendInto(pose, P.crashPose(anim.tmp, anim.fall), W.crash)
    if (W.caught > 0.001) P.blendInto(pose, P.caughtPose(anim.tmp, t), W.caught)
    applyPose(rig, pose)

    // ------------------------------------------------------------ placement
    const fall = smoothstep(0, 1, anim.fall)
    anim.knock = damp(anim.knock, crashed && !caught ? 1.1 : 0, 5, realDt)
    holder.current.position.set(p.x, p.y + fall * 0.14, anim.knock)
    holder.current.rotation.x = fall * 1.42
    holder.current.rotation.z = THREE.MathUtils.clamp(-p.lean * (boarding ? 0.03 : 0.022), -0.35, 0.35) * (1 - fall)
    yaw.current.rotation.y = pose.rootYaw + THREE.MathUtils.clamp(-p.lean * 0.012, -0.25, 0.25) * (1 - fall) * (1 - W.board)
    rig.root.position.y = W.board * 0.1

    // skateboard: visible while riding, kickflips on jumps
    board.group.visible = W.board > 0.05
    if (board.group.visible) {
      const progress = Math.min(1, p.jumpTime / Math.max(0.2, p.airTime))
      board.group.position.set(0, 0.075 + (p.grounded ? Math.sin(t * 18) * 0.004 : 0.05), 0)
      board.group.rotation.z = !p.grounded && p.boardJump ? smoothstep(0.05, 0.8, progress) * Math.PI * 2 : 0
      board.group.rotation.x = !p.grounded ? Math.sin(progress * Math.PI) * -0.25 : 0
      const spin = (runtime.speed * (dt || 0)) / 0.034
      for (const w of board.wheels) w.rotation.x += spin
    }

    // jetpack and spring coils
    jet.group.visible = W.jet > 0.05
    if (jet.group.visible) {
      for (const f of jet.flames) f.scale.set(1, 0.7 + Math.random() * 0.6, 1)
      if (playing && dt > 0) {
        for (const sx of [-0.09, 0.09]) {
          jet.group.localToWorld(_v.set(sx, -0.42, 0))
          fx.burst({ x: _v.x, y: _v.y, z: _v.z, count: 2, color: Math.random() < 0.5 ? 0xffa040 : 0xffe08a, speed: 1.2, up: -2, life: 0.35, size: 0.14, gravity: -3 })
        }
      }
    }
    coils.left.visible = coils.right.visible = sneakers && !jetting

    // invulnerability blink
    rig.root.visible = !(runtime.invuln > 0 && playing && !jetting && Math.floor(t * 14) % 2 === 0)

    // glow accents pulse during 2× score
    const boost = runtime.power.double > 0
    for (const m of rig.glowMats) m.color.copy(m.userData.baseColor).multiplyScalar(boost ? 3.4 + Math.sin(t * 12) : 2.6)

    // looping sounds
    if (playing && boarding && p.grounded && !jetting) {
      audio.startLoop('skate')
      audio.setLoop('skate', { vol: 0.05 + runtime.speed * 0.0025, freq: 380 + runtime.speed * 9 })
    } else audio.stopLoop('skate')
    if (playing && jetting) audio.startLoop('jet')
    else audio.stopLoop('jet')
  }, -9)

  return (
    <group ref={holder}>
      <group ref={yaw}>
        <primitive object={rig.root} />
      </group>
      <primitive object={board.group} />
    </group>
  )
}

function doJump(p, sneakers, boarding) {
  const v = sneakers ? SNEAKER_JUMP_VELOCITY : JUMP_VELOCITY
  p.vy = v
  p.grounded = false
  p.slideTime = 0
  p.jumpBuffer = 0
  p.slideQueued = false
  p.jumpTime = 0
  p.airTime = (2 * v) / -GRAVITY
  p.flip = sneakers && !boarding ? 0 : -1
  p.boardJump = boarding
  audio.play(sneakers ? 'superjump' : boarding ? 'ollie' : 'jump')
  if (sneakers) fx.burst({ x: p.x, y: p.y + 0.05, z: 0.1, count: 18, color: 0x7dff5a, speed: 3, up: 1, life: 0.5, size: 0.11, gravity: -4 })
}

function land(p, g, boarding, playing) {
  const impact = p.vy
  p.y = g.h
  p.vy = 0
  p.grounded = true
  p.surface = g.kind
  p.surfaceId = g.id
  p.flip = -1
  p.descending = false
  if (playing) {
    audio.play(boarding ? 'boardland' : g.kind === 'train' ? 'roof' : 'land')
    const color = boarding ? 0xffd08a : g.kind === 'train' ? 0xdfe6f0 : 0xd8cbb2
    fx.burst({ x: p.x, y: p.y + 0.05, z: 0.1, count: boarding ? 22 : 14, color, speed: boarding ? 3.4 : 2.6, up: 1.2, life: 0.5, size: 0.11, gravity: -4 })
    runtime.trauma = Math.max(runtime.trauma, Math.min(0.35, -impact * 0.012))
    if (p.slideQueued) {
      p.slideQueued = false
      p.slideTime = SLIDE_DURATION
      audio.play('slide')
    }
    if (p.jumpBuffer > 0) doJump(p, runtime.power.sneakers > 0, boarding)
  }
}
