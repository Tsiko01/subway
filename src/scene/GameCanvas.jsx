import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from '../game/store'
import Director from './Director'
import { Lights, Reflections, Sky, Track, Water } from './World'
import Scenery from './Scenery'
import Player from './Player'
import Officer from './Officer'
import Spawner from './Spawner'
import CameraRig from './CameraRig'
import PostFX from './PostFX'
import { Motes, Particles, Smoke, SpeedLines } from './Effects3D'

// Dev-only profiling switches, e.g. ?off=post,shadow
const OFF = new Set(import.meta.env.DEV ? (new URLSearchParams(location.search).get('off') ?? '').split(',') : [])

const MAX_DPR = { high: 1.75, medium: 1.5, low: 1.25 }

/** Without the post stack the renderer has to tone-map on its own. */
function RendererTone({ post }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.1
  }, [gl, post])
  return null
}

/**
 * Keeps the world hidden until every shader program (including pooled trains, pickups,
 * the officer and other maps' scenery) has been compiled in parallel. This avoids multi-second
 * hitches the first time something new appears on screen. Re-runs in the background when
 * the spawner rebuilds for another map.
 */
function Warmup({ post, children }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const group = useRef()
  const mapId = useGame((s) => s.profile.map)
  const ready = useGame((s) => s.worldReady)
  const setReady = useGame((s) => s.setWorldReady)
  const rt = useRef(null)

  const compile = () => {
    // match the render target the scene is really drawn into (post stack = linear HDR buffer)
    if (post && !rt.current) rt.current = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(post ? rt.current : null)
    let p
    try {
      p = gl.compileAsync(scene, camera)
    } finally {
      gl.setRenderTarget(prev)
    }
    return p
  }

  /**
   * One hidden render with every object forced visible: uploads all textures and vertex buffers and
   * compiles the shadow-pass programs, so nothing stalls the first time it appears in a run.
   */
  const warmRender = () => {
    const hidden = []
    const culled = []
    group.current.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
      if (o.frustumCulled) {
        culled.push(o)
        o.frustumCulled = false
      }
    })
    // draw into the same kind of target as real frames so the cached programs match:
    // the post stack's HDR buffer, or (Performance tier) the screen through a tiny viewport
    const target = post ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
    const prev = gl.getRenderTarget()
    const vp = new THREE.Vector4()
    gl.getViewport(vp)
    try {
      gl.setRenderTarget(target)
      if (!target) gl.setViewport(0, 0, 8, 8)
      gl.render(scene, camera)
    } catch {
      /* warming is best-effort */
    } finally {
      if (!target) gl.setViewport(vp)
      gl.setRenderTarget(prev)
      target?.dispose()
      hidden.forEach((o) => (o.visible = false))
      culled.forEach((o) => (o.frustumCulled = true))
    }
  }

  useEffect(() => {
    let cancelled = false
    // wait a couple of frames so lights, fog and the environment map exist before compiling
    let frames = 0
    let raf = requestAnimationFrame(function tick() {
      if (++frames < 3) {
        raf = requestAnimationFrame(tick)
        return
      }
      const t0 = performance.now()
      compile()
        .catch(() => {})
        .then(() => {
          if (cancelled) return
          warmRender()
          if (import.meta.env.DEV) console.info(`[warmup] shaders ready in ${Math.round(performance.now() - t0)} ms`)
          group.current.visible = true
          setReady()
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return
    // a new map rebuilds the spawner pools: compile, then upload them in the background
    const id = setTimeout(() => compile().catch(() => {}).then(() => group.current && warmRender()), 50)
    return () => clearTimeout(id)
  }, [mapId, post]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => rt.current?.dispose(), [])

  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  )
}

export default function GameCanvas() {
  const quality = useGame((s) => s.quality)
  const degradeQuality = useGame((s) => s.degradeQuality)
  const [dprFactor, setDprFactor] = useState(1)
  const mountedAt = useRef(performance.now())
  const ready = useGame((s) => s.worldReady)

  const post = quality !== 'low' && !OFF.has('post')
  const dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, MAX_DPR[quality]) * dprFactor)

  // Adaptive performance: first lower the tier (unless the player chose one), then resolution.
  const onDecline = () => {
    if (!ready || performance.now() - mountedAt.current < 9000) return // ignore start-up hitches
    if (!degradeQuality()) setDprFactor((f) => Math.max(0.7, +(f - 0.1).toFixed(2)))
  }

  return (
    <Canvas
      className="!absolute inset-0"
      shadows={!OFF.has('shadow')}
      dpr={dpr}
      gl={{ antialias: !post, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 42, near: 0.1, far: 1400, position: [12, 20, -30] }}
      onCreated={(state) => {
        const { gl } = state
        if (import.meta.env.DEV && window.__nocturne) Object.assign(window.__nocturne, { gl, scene: state.scene, camera: state.camera })
        gl.shadowMap.type = THREE.PCFShadowMap
      }}
    >
      <PerformanceMonitor onDecline={onDecline} onIncline={() => setDprFactor((f) => Math.min(1, +(f + 0.1).toFixed(2)))} />
      <RendererTone post={post} />
      <Director />
      <Suspense fallback={null}>
        <Lights />
        <Reflections />
        <Warmup post={post}>
          <Sky />
          {!OFF.has('world') && <Track />}
          <Water />
          {!OFF.has('scenery') && <Scenery />}
          {!OFF.has('player') && <Player />}
          {!OFF.has('officer') && <Officer />}
          <Spawner />
          <Particles />
          <Motes count={quality === 'low' ? 120 : 240} />
          <SpeedLines />
          <Smoke />
        </Warmup>
        <CameraRig />
        {post && <PostFX quality={quality} />}
      </Suspense>
    </Canvas>
  )
}
