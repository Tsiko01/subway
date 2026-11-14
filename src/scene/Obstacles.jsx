import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { getMaterials } from './materials'
import { glowTexture, poolTexture } from '../game/textures'

// Visual definitions for every obstacle type. Local origin = lane center on the ground,
// front face toward +z (the player). Geometries are module-level singletons shared by all pools.

let G = null
const geos = () => {
  if (G) return G
  const jersey = new THREE.Shape()
  ;[
    [-0.3, 0],
    [0.3, 0],
    [0.3, 0.08],
    [0.13, 0.3],
    [0.09, 1.0],
    [-0.09, 1.0],
    [-0.13, 0.3],
    [-0.3, 0.08],
  ].forEach(([x, y], i) => (i ? jersey.lineTo(x, y) : jersey.moveTo(x, y)))
  const jerseyGeo = new THREE.ExtrudeGeometry(jersey, { depth: 1.9, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 })
  jerseyGeo.rotateY(Math.PI / 2)
  jerseyGeo.translate(-0.95, 0, 0)

  G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
    jersey: jerseyGeo,
    carBody: new RoundedBoxGeometry(1.78, 0.56, 4.1, 4, 0.2),
    carCabin: new RoundedBoxGeometry(1.46, 0.5, 2.1, 4, 0.22),
    wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.26, 20).rotateZ(Math.PI / 2),
    sphere: new THREE.SphereGeometry(0.8, 40, 28),
    ring: new THREE.TorusGeometry(0.815, 0.03, 8, 64),
    plane: new THREE.PlaneGeometry(1, 1),
    groundPlane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    magnet: new THREE.TorusGeometry(0.26, 0.085, 12, 28, Math.PI),
    orbitRing: new THREE.TorusGeometry(0.3, 0.035, 8, 40),
    core: new THREE.IcosahedronGeometry(0.16, 0),
    bubble: new THREE.SphereGeometry(0.55, 24, 16),
  }
  return G
}

let X = null
const extraMats = () => {
  if (X) return X
  X = {
    paint: new THREE.MeshPhysicalMaterial({ color: '#0c1424', metalness: 0.9, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }),
    tint: new THREE.MeshPhysicalMaterial({ color: '#05080f', metalness: 1, roughness: 0.04, clearcoat: 1 }),
    beam: new THREE.MeshBasicMaterial({
      map: poolTexture(),
      color: '#dfe9ff',
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    headGlow: new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: '#e6efff',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    bubble: new THREE.MeshStandardMaterial({ color: '#9cc4ff', transparent: true, opacity: 0.14, metalness: 1, roughness: 0, depthWrite: false }),
    beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae42').multiplyScalar(3), toneMapped: false }),
  }
  return X
}
export const beaconMaterial = () => extraMats().beacon

// helper: a mesh from the shared unit geometry, scaled to size
function Block({ size, position, material, rotation, cast = true, geometry }) {
  const g = geos()
  return (
    <mesh
      geometry={geometry ?? g.box}
      material={material}
      position={position}
      rotation={rotation}
      scale={size}
      castShadow={cast}
    />
  )
}

export function Barrier() {
  const M = getMaterials()
  return (
    <group>
      <Block size={[1.92, 2.3, 0.32]} position={[0, 1.3, 0]} material={M.graphite} />
      <Block size={[1.98, 0.08, 0.38]} position={[0, 2.49, 0]} material={M.silver} />
      <Block size={[1.98, 0.06, 0.38]} position={[0, 0.17, 0]} material={M.silver} />
      <Block size={[0.3, 0.14, 0.8]} position={[-0.72, 0.07, 0]} material={M.darkMetal} />
      <Block size={[0.3, 0.14, 0.8]} position={[0.72, 0.07, 0]} material={M.darkMetal} />
      <Block size={[0.035, 1.9, 0.012]} position={[0, 1.3, 0.166]} rotation={[0, 0, 0.62]} material={M.glowIce} cast={false} />
      <Block size={[0.035, 1.9, 0.012]} position={[0, 1.3, 0.166]} rotation={[0, 0, -0.62]} material={M.glowIce} cast={false} />
      <Block size={[1.7, 0.03, 0.012]} position={[0, 2.3, 0.166]} material={M.glowBlue} cast={false} />
      <Block size={[1.7, 0.03, 0.012]} position={[0, 0.32, 0.166]} material={M.glowBlue} cast={false} />
    </group>
  )
}

export function Hurdle() {
  const M = getMaterials()
  const g = geos()
  return (
    <group>
      {[-0.92, 0.92].map((x) => (
        <group key={x}>
          <Block geometry={g.cyl} size={[0.045, 1.0, 0.045]} position={[x, 0.5, 0]} material={M.silver} />
          <Block size={[0.12, 0.05, 0.55]} position={[x, 0.025, 0]} material={M.darkMetal} />
        </group>
      ))}
      <Block size={[1.9, 0.17, 0.1]} position={[0, 0.88, 0]} material={M.graphite} />
      <Block size={[1.84, 0.045, 0.012]} position={[0, 0.88, 0.056]} material={M.glowBlue} cast={false} />
      <Block size={[1.84, 0.04, 0.04]} position={[0, 0.45, 0]} material={M.silver} />
    </group>
  )
}

export function Gate() {
  const M = getMaterials()
  return (
    <group>
      {[-1.02, 1.02].map((x) => (
        <Block key={x} size={[0.1, 3.3, 0.12]} position={[x, 1.65, 0]} material={M.darkMetal} />
      ))}
      <Block size={[2.0, 1.55, 0.2]} position={[0, 2.13, 0]} material={M.graphite} />
      <Block size={[2.04, 0.07, 0.26]} position={[0, 1.34, 0]} material={M.glowIce} cast={false} />
      <Block size={[2.04, 0.05, 0.24]} position={[0, 2.93, 0]} material={M.silver} />
      {/* downward chevrons signal "slide" */}
      {[0, 0.38].map((dy) => (
        <group key={dy} position={[0, 2.35 - dy, 0.104]}>
          <Block size={[0.5, 0.04, 0.01]} position={[-0.2, 0, 0]} rotation={[0, 0, -0.5]} material={M.glowBlue} cast={false} />
          <Block size={[0.5, 0.04, 0.01]} position={[0.2, 0, 0]} rotation={[0, 0, 0.5]} material={M.glowBlue} cast={false} />
        </group>
      ))}
    </group>
  )
}

export function Roadblock() {
  const M = getMaterials()
  const g = geos()
  const E = extraMats()
  return (
    <group>
      <mesh geometry={g.jersey} material={M.concrete} castShadow />
      <Block size={[1.9, 0.09, 0.012]} position={[0, 0.62, 0.122]} rotation={[-0.06, 0, 0]} material={M.glowBlue} cast={false} />
      <Block size={[1.9, 0.09, 0.012]} position={[0, 0.62, -0.122]} rotation={[0.06, 0, 0]} material={M.glowBlue} cast={false} />
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 1.0, 0]}>
          <Block geometry={g.cyl} size={[0.05, 0.08, 0.05]} position={[0, 0.04, 0]} material={M.darkMetal} />
          <Block geometry={g.cyl} size={[0.065, 0.09, 0.065]} position={[0, 0.12, 0]} material={E.beacon} cast={false} />
        </group>
      ))}
    </group>
  )
}

export function Vehicle({ wheelsRef }) {
  const M = getMaterials()
  const g = geos()
  const E = extraMats()
  return (
    <group>
      <mesh geometry={g.carBody} material={E.paint} position={[0, 0.5, 0]} castShadow />
      <mesh geometry={g.carCabin} material={E.tint} position={[0, 0.95, 0.25]} castShadow />
      <Block size={[1.5, 0.03, 0.03]} position={[0, 0.79, 1.2]} material={M.silver} cast={false} />
      <group ref={wheelsRef}>
        {[
          [-0.82, 1.35],
          [0.82, 1.35],
          [-0.82, -1.35],
          [0.82, -1.35],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={g.wheel} material={M.graphite} position={[x, 0.34, z]} />
        ))}
      </group>
      {/* headlights face the player */}
      {[-0.58, 0.58].map((x) => (
        <group key={x} position={[x, 0.58, 2.06]}>
          <Block size={[0.46, 0.055, 0.03]} material={M.glowWhite} cast={false} />
          <mesh geometry={g.plane} material={E.headGlow} scale={[1.6, 1.6, 1]} position={[0, 0, 0.05]} />
        </group>
      ))}
      <Block size={[1.3, 0.025, 0.02]} position={[0, 0.42, 2.06]} material={M.glowIce} cast={false} />
      <mesh geometry={g.groundPlane} material={E.beam} position={[0, 0.03, 5.5]} scale={[3.2, 1, 8]} />
    </group>
  )
}

export function Roller({ ballRef }) {
  const M = getMaterials()
  const g = geos()
  return (
    <group>
      <group ref={ballRef} position={[0, 0.8, 0]}>
        <mesh geometry={g.sphere} material={M.chrome} castShadow />
        <mesh geometry={g.ring} material={M.glowBlue} />
        <mesh geometry={g.ring} material={M.glowBlue} rotation-y={Math.PI / 2} />
      </group>
    </group>
  )
}

export function MagnetPickup() {
  const M = getMaterials()
  const g = geos()
  const E = extraMats()
  return (
    <group>
      <mesh geometry={g.magnet} material={M.silver} rotation-z={Math.PI} />
      <Block size={[0.17, 0.12, 0.17]} position={[-0.26, -0.03, 0]} material={M.glowIce} cast={false} />
      <Block size={[0.17, 0.12, 0.17]} position={[0.26, -0.03, 0]} material={M.glowIce} cast={false} />
      <mesh geometry={g.bubble} material={E.bubble} />
      <mesh geometry={g.plane} material={M.halo} scale={[1.9, 1.9, 1]} />
    </group>
  )
}

export function BoostPickup() {
  const M = getMaterials()
  const g = geos()
  const E = extraMats()
  return (
    <group>
      <mesh geometry={g.orbitRing} material={M.glowIce} rotation-x={Math.PI / 2.6} />
      <mesh geometry={g.orbitRing} material={M.glowIce} rotation-y={Math.PI / 2} rotation-x={0.4} />
      <mesh geometry={g.core} material={M.glowBlue} />
      <mesh geometry={g.bubble} material={E.bubble} />
      <mesh geometry={g.plane} material={M.halo} scale={[2.1, 2.1, 1]} />
    </group>
  )
}

export function useObstacleGeometries() {
  return useMemo(() => geos(), [])
}
