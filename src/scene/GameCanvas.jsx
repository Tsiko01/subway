import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from '../game/store'
import Director from './Director'
import World from './World'
import Scenery from './Scenery'
import Player from './Player'
import Spawner from './Spawner'
import CameraRig from './CameraRig'
import PostFX from './PostFX'
import { Motes, Particles, SpeedLines } from './Effects3D'

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

export default function GameCanvas() {
  const quality = useGame((s) => s.quality)
  const degradeQuality = useGame((s) => s.degradeQuality)
  const [dprFactor, setDprFactor] = useState(1)
  const mountedAt = useRef(performance.now())

  const post = quality !== 'low' && !OFF.has('post')
  const dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, MAX_DPR[quality]) * dprFactor)

  // Adaptive performance: first lower the tier (unless the player chose one), then resolution.
  const onDecline = () => {
    if (performance.now() - mountedAt.current < 6000) return // ignore shader-compile hitches at startup
    if (!degradeQuality()) setDprFactor((f) => Math.max(0.7, +(f - 0.1).toFixed(2)))
  }

  return (
    <Canvas
      className="!absolute inset-0"
      shadows={!OFF.has('shadow')}
      dpr={dpr}
      gl={{ antialias: !post, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 42, near: 0.1, far: 1400, position: [12, 20, -30] }}
      onCreated={({ gl }) => {
        if (import.meta.env.DEV && window.__nocturne) window.__nocturne.gl = gl
        gl.shadowMap.type = THREE.PCFShadowMap
      }}
    >
      <PerformanceMonitor onDecline={onDecline} onIncline={() => setDprFactor((f) => Math.min(1, +(f + 0.1).toFixed(2)))} />
      <RendererTone post={post} />
      <Director />
      <Suspense fallback={null}>
        {!OFF.has('world') && <World />}
        {!OFF.has('scenery') && <Scenery />}
        {!OFF.has('player') && <Player />}
        <Spawner />
        <Particles />
        <Motes count={quality === 'low' ? 120 : 240} />
        <SpeedLines />
        <CameraRig />
        {post && <PostFX quality={quality} />}
      </Suspense>
    </Canvas>
  )
}
