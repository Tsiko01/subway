import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { atmo } from '../game/atmosphere'
import { roadTextures, ROAD_TILE_LENGTH, waterNormalTexture, glowTexture } from '../game/textures'
import { useGame } from '../game/store'

const ROAD_LENGTH = 380
const ROAD_CENTER_Z = 140 - ROAD_LENGTH / 2
const MOON_DIR = new THREE.Vector3(-0.42, 0.36, -0.83).normalize()

function Road() {
  const quality = useGame((s) => s.quality)
  const { map, roughnessMap } = useMemo(() => {
    const t = roadTextures()
    t.map.repeat.set(1, ROAD_LENGTH / ROAD_TILE_LENGTH)
    t.roughnessMap.repeat.set(1, ROAD_LENGTH / ROAD_TILE_LENGTH)
    return t
  }, [])

  useFrame(() => {
    const d = runtime.dz / ROAD_TILE_LENGTH
    map.offset.y = (map.offset.y + d) % 1
    roughnessMap.offset.y = map.offset.y
  }, -7)

  const edge = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#6a9dff').multiplyScalar(1.4), toneMapped: false }), [])
  useFrame(() => edge.color.copy(atmo.accent).multiplyScalar(1.5), -6)

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, ROAD_CENTER_Z]} receiveShadow>
        <planeGeometry args={[8.4, ROAD_LENGTH]} />
        {quality === 'high' ? (
          <MeshReflectorMaterial
            map={map}
            roughnessMap={roughnessMap}
            color="#c4cad6"
            roughness={1}
            metalness={0.2}
            resolution={512}
            blur={[320, 90]}
            mixBlur={0.85}
            mixStrength={9}
            mixContrast={1.15}
            mirror={0.5}
            depthScale={0.5}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
          />
        ) : (
          <meshStandardMaterial map={map} roughnessMap={roughnessMap} color="#c4cad6" roughness={1} metalness={0.3} envMapIntensity={0.9} />
        )}
      </mesh>
      {/* deck + glowing edge accents */}
      <mesh position={[0, -0.81, ROAD_CENTER_Z]}>
        <boxGeometry args={[8.6, 1.6, ROAD_LENGTH]} />
        <meshStandardMaterial color="#1a1f2a" roughness={0.8} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 4.14, 0.012, ROAD_CENTER_Z]} material={edge}>
            <boxGeometry args={[0.05, 0.02, ROAD_LENGTH]} />
          </mesh>
          <mesh position={[s * 4.31, -0.22, ROAD_CENTER_Z]} material={edge}>
            <boxGeometry args={[0.02, 0.06, ROAD_LENGTH]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Water() {
  const normalMap = useMemo(() => waterNormalTexture(), [])
  useFrame((_, delta) => {
    normalMap.offset.y = (normalMap.offset.y + runtime.dz / 50) % 1
    normalMap.offset.x = (normalMap.offset.x + delta * 0.004) % 1
  }, -7)
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -3.2, -200]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial
        color="#050d1d"
        metalness={0.9}
        roughness={0.16}
        normalMap={normalMap}
        normalScale={[0.55, 0.55]}
        envMapIntensity={1.2}
      />
    </mesh>
  )
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uFog;
  uniform vec3 uMoonDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.5, h));
    col = mix(uFog, col, smoothstep(-0.05, 0.12, h));
    float m = max(dot(d, uMoonDir), 0.0);
    col += vec3(0.55, 0.68, 1.0) * (pow(m, 80.0) * 0.55 + pow(m, 8.0) * 0.12);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const mountainFragment = /* glsl */ `
  uniform vec3 uFog;
  uniform vec3 uColor;
  uniform float uMix;
  varying float vH;
  varying vec3 vWorld;
  void main() {
    vec3 c = mix(uFog, uColor, smoothstep(0.0, 1.0, vH) * uMix);
    // moonlit snowy crests
    c += vec3(0.32, 0.4, 0.55) * smoothstep(0.78, 1.0, vH) * uMix * 0.6;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`
const mountainVertex = /* glsl */ `
  attribute float aH;
  varying float vH;
  varying vec3 vWorld;
  void main() {
    vH = aH;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

function ridgeGeometry(radius, minH, maxH, seed) {
  const segs = 220
  const pos = []
  const hs = []
  const idx = []
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const phases = Array.from({ length: 6 }, () => rnd() * Math.PI * 2)
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    let n = 0
    n += Math.sin(a * 3 + phases[0]) * 0.35
    n += Math.sin(a * 7 + phases[1]) * 0.22
    n += Math.abs(Math.sin(a * 13 + phases[2])) * 0.25
    n += Math.sin(a * 23 + phases[3]) * 0.1
    n += Math.abs(Math.sin(a * 41 + phases[4])) * 0.08
    const t = Math.min(1, Math.max(0, n * 0.5 + 0.5))
    const h = minH + (maxH - minH) * t
    const x = Math.sin(a) * radius
    const z = Math.cos(a) * radius
    pos.push(x, -30, z, x, h, z)
    hs.push(0, 0.35 + t * 0.65)
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1))
  g.setIndex(idx)
  return g
}

function Sky() {
  const group = useRef()
  const camera = useThree((s) => s.camera)
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uFog: { value: new THREE.Color() },
          uMoonDir: { value: MOON_DIR },
        },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  const ridges = useMemo(
    () =>
      [
        { r: 620, min: 30, max: 120, seed: 11, color: '#22355a', mix: 0.55 },
        { r: 520, min: 12, max: 70, seed: 29, color: '#0f1a30', mix: 0.75 },
      ].map((cfg) => ({
        geo: ridgeGeometry(cfg.r, cfg.min, cfg.max, cfg.seed),
        mat: new THREE.ShaderMaterial({
          uniforms: { uFog: { value: new THREE.Color() }, uColor: { value: new THREE.Color(cfg.color) }, uMix: { value: cfg.mix } },
          vertexShader: mountainVertex,
          fragmentShader: mountainFragment,
          fog: false,
          side: THREE.DoubleSide,
        }),
      })),
    [],
  )
  const stars = useMemo(() => {
    const n = 1400
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2
      const v = 0.08 + Math.random() * 0.92
      const r = 760
      const y = v * v
      const rr = Math.sqrt(1 - y * y)
      p.set([Math.cos(u) * rr * r, y * r, Math.sin(u) * rr * r], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  const glow = useMemo(() => glowTexture(), [])

  useEffect(
    () => () => {
      skyMat.dispose()
      ridges.forEach((r) => {
        r.geo.dispose()
        r.mat.dispose()
      })
      stars.dispose()
    },
    [skyMat, ridges, stars],
  )

  useFrame(() => {
    group.current.position.copy(camera.position)
    skyMat.uniforms.uTop.value.copy(atmo.skyTop)
    skyMat.uniforms.uHorizon.value.copy(atmo.skyHorizon)
    skyMat.uniforms.uFog.value.copy(atmo.fog)
    ridges.forEach((r) => r.mat.uniforms.uFog.value.copy(atmo.fog))
  }, -4)

  const moonPos = MOON_DIR.clone().multiplyScalar(700)
  return (
    <group ref={group}>
      <mesh material={skyMat} renderOrder={-10}>
        <sphereGeometry args={[800, 32, 16]} />
      </mesh>
      <points geometry={stars} renderOrder={-9}>
        <pointsMaterial color="#dfe8ff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.85} depthWrite={false} />
      </points>
      <mesh position={moonPos} renderOrder={-8}>
        <sphereGeometry args={[16, 32, 16]} />
        <meshBasicMaterial color={new THREE.Color('#eef3ff').multiplyScalar(2.2)} fog={false} toneMapped={false} />
      </mesh>
      <sprite position={moonPos} scale={[150, 150, 1]} renderOrder={-8}>
        <spriteMaterial map={glow} color="#8fb2ff" transparent opacity={0.4} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {ridges.map((r, i) => (
        <mesh key={i} geometry={r.geo} material={r.mat} renderOrder={-7 + i} />
      ))}
    </group>
  )
}

function Lights() {
  const quality = useGame((s) => s.quality)
  const hemi = useRef()
  const sun = useRef()
  const rim = useRef()
  const fill = useRef()
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    scene.fog = new THREE.FogExp2(atmo.fog.clone(), 0.0105)
    scene.background = atmo.fog.clone()
    return () => {
      scene.fog = null
    }
  }, [scene])

  useFrame(() => {
    if (!scene.fog) return
    const px = runtime.player.x
    scene.fog.color.copy(atmo.fog)
    scene.background.copy(atmo.fog)
    hemi.current.color.copy(atmo.hemiSky)
    hemi.current.groundColor.copy(atmo.hemiGround)
    sun.current.position.set(px - 9, 17, -22)
    sun.current.target.position.set(px, 0, -6)
    sun.current.target.updateMatrixWorld()
    rim.current.position.set(px, 2.6, -3.2)
    fill.current.position.set(px + 2.5, 4, 4.5)
  }, -6)

  const mapSize = quality === 'high' ? 2048 : 1024
  // a new map size needs a fresh shadow render target
  useEffect(() => {
    const light = sun.current
    if (light?.shadow.map) {
      light.shadow.map.dispose()
      light.shadow.map = null
    }
  }, [mapSize])
  return (
    <>
      <hemisphereLight ref={hemi} intensity={0.75} />
      <ambientLight intensity={0.12} color="#8aa4d8" />
      <directionalLight
        ref={sun}
        intensity={1.7}
        color="#c4d6ff"
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <pointLight ref={rim} color="#6f9fff" intensity={22} distance={9} decay={2} />
      <pointLight ref={fill} color="#ffd6a8" intensity={9} distance={12} decay={2} />
    </>
  )
}

function Reflections() {
  return (
    <Environment resolution={128} frames={1}>
      <color attach="background" args={['#05070d']} />
      <Lightformer form="rect" intensity={1.6} color="#5f8fff" position={[0, 8, -30]} scale={[40, 4, 1]} />
      <Lightformer form="circle" intensity={5} color="#eaf1ff" position={[-20, 18, -40]} scale={6} />
      <Lightformer form="rect" intensity={1.2} color="#ffcf9a" position={[14, 3, 0]} rotation-y={-Math.PI / 2} scale={[40, 1.2, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#9cc2ff" position={[-14, 3, 0]} rotation-y={Math.PI / 2} scale={[40, 1.2, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#c8d6ff" position={[0, 12, 10]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
    </Environment>
  )
}

export default function World() {
  return (
    <>
      <Lights />
      <Reflections />
      <Sky />
      <Road />
      <Water />
    </>
  )
}
