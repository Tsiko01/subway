import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { getMap } from '../game/maps'
import { displayMapId, useGame } from '../game/store'

/** HDR post stack (Cinematic / Balanced tiers): bloom → ACES → chromatic speed fringe → vignette → grain. */
export default function PostFX({ quality }) {
  const ca = useRef()
  const high = quality === 'high'
  const bloom = getMap(useGame(displayMapId)).bloom

  useFrame(() => {
    if (!ca.current) return
    const speedK = THREE.MathUtils.smoothstep(runtime.speed, 24, 40) * (runtime.mode === 'playing' ? 1 : 0)
    const amount = 0.0004 + speedK * 0.0011 + runtime.trauma * 0.006 + (runtime.power.double > 0 || runtime.power.jetpack > 0 ? 0.0006 : 0)
    ca.current.offset.set(amount, amount * 0.6)
  })

  return (
    <EffectComposer multisampling={high ? 4 : 0} frameBufferType={THREE.HalfFloatType}>
      <Bloom
        mipmapBlur
        levels={high ? 8 : 5}
        intensity={bloom.intensity * (high ? 1.05 : 0.9)}
        luminanceThreshold={bloom.threshold}
        luminanceSmoothing={0.25}
        radius={0.72}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <ChromaticAberration ref={ca} radialModulation modulationOffset={0.25} offset={[0.0005, 0.0003]} />
      <Vignette offset={0.28} darkness={0.72} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={high ? 0.18 : 0.12} />
    </EffectComposer>
  )
}
