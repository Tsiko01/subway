import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { LANES, TRACK_HALF_WIDTH } from '../game/constants'
import { runtime } from '../game/runtime'
import { atmo } from '../game/atmosphere'
import { getMap } from '../game/maps'
import { displayMapId, useGame } from '../game/store'
import { glowTexture, trackTextures, TRACK_TILE_LENGTH, waterNormalTexture } from '../game/textures'

const LENGTH = 380
const CENTER_Z = 140 - LENGTH / 2

// ------------------------------------------------------------------ track bed + rails
function Track() {
  const mapId = useGame(displayMapId)
  const quality = useGame((s) => s.quality)
  const map = getMap(mapId)
  const tex = useMemo(() => {
    const t = trackTextures(map.track)
    const map_ = t.map.clone()
    const rough = t.roughnessMap.clone()
    for (const x of [map_, rough]) {
      x.repeat.set(1, LENGTH / TRACK_TILE_LENGTH)
      x.needsUpdate = true
    }
    return { map: map_, rough }
  }, [map.track])
  useEffect(
    () => () => {
      tex.map.dispose()
      tex.rough.dispose()
    },
    [tex],
  )

  useFrame(() => {
    tex.map.offset.y = (tex.map.offset.y + runtime.dz / TRACK_TILE_LENGTH) % 1
    tex.rough.offset.y = tex.map.offset.y
  }, -7)

  const rails = useMemo(() => {
    // rail profile: head, web and foot, extruded along the whole track
    const shape = new THREE.Shape()
    ;[
      [-0.07, 0],
      [0.07, 0],
      [0.07, 0.02],
      [0.016, 0.03],
      [0.016, 0.1],
      [0.036, 0.11],
      [0.036, 0.15],
      [-0.036, 0.15],
      [-0.036, 0.11],
      [-0.016, 0.1],
      [-0.016, 0.03],
      [-0.07, 0.02],
    ].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)))
    const base = new THREE.ExtrudeGeometry(shape, { depth: LENGTH, bevelEnabled: false })
    const geos = []
    for (const l of LANES) for (const off of [-0.7175, 0.7175]) geos.push(base.clone().translate(l + off, 0, 140 - LENGTH))
    base.dispose()
    const g = geos.reduce((acc, cur) => (acc ? mergeTwo(acc, cur) : cur), null)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0.135
      colors.set(top ? [0.95, 0.96, 1.0] : [0.3, 0.24, 0.2], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])
  useEffect(() => () => rails.dispose(), [rails])

  const wires = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, LENGTH, 4).rotateX(Math.PI / 2), [])
  const street = map.track === 'street'
  const reflective = street && quality === 'high'

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, CENTER_Z]} receiveShadow>
        <planeGeometry args={[TRACK_HALF_WIDTH * 2, LENGTH]} />
        {reflective ? (
          <MeshReflectorMaterial
            map={tex.map}
            roughnessMap={tex.rough}
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
          <meshStandardMaterial map={tex.map} roughnessMap={tex.rough} roughness={1} metalness={street ? 0.3 : 0.02} envMapIntensity={street ? 0.9 : 0.4} />
        )}
      </mesh>
      <mesh geometry={rails} receiveShadow castShadow={false}>
        <meshStandardMaterial vertexColors metalness={0.85} roughness={0.32} envMapIntensity={1.3} />
      </mesh>
      {/* deck under the bed, visible from the side on elevated sections */}
      <mesh position={[0, -0.81, CENTER_Z]}>
        <boxGeometry args={[TRACK_HALF_WIDTH * 2 + 0.2, 1.6, LENGTH]} />
        <meshStandardMaterial color="#4a4744" roughness={0.9} />
      </mesh>
      {map.wires && (
        <group>
          {LANES.map((x) => (
            <group key={x}>
              <mesh geometry={wires} position={[x, 7.2, CENTER_Z]}>
                <meshStandardMaterial color="#2a2c30" metalness={0.8} roughness={0.4} />
              </mesh>
              <mesh geometry={wires} position={[x, 7.8, CENTER_Z]}>
                <meshStandardMaterial color="#2a2c30" metalness={0.8} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

function mergeTwo(a, b) {
  const out = new THREE.BufferGeometry()
  for (const key of ['position', 'normal', 'uv']) {
    const A = a.attributes[key].array
    const B = b.attributes[key].array
    const arr = new Float32Array(A.length + B.length)
    arr.set(A)
    arr.set(B, A.length)
    out.setAttribute(key, new THREE.BufferAttribute(arr, a.attributes[key].itemSize))
  }
  a.dispose()
  b.dispose()
  return out
}

// ------------------------------------------------------------------ water
function Water() {
  const mapId = useGame(displayMapId)
  const map = getMap(mapId)
  const normalMap = useMemo(() => waterNormalTexture(), [])
  const mat = useRef()
  useFrame((_, delta) => {
    normalMap.offset.y = (normalMap.offset.y + runtime.dz / 50 + delta * 0.01) % 1
    normalMap.offset.x = (normalMap.offset.x + delta * 0.006) % 1
    if (mat.current) mat.current.color.copy(atmo.water)
  }, -7)
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, map.waterLevel, -200]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial ref={mat} metalness={map.night ? 0.85 : 0.15} roughness={map.night ? 0.12 : 0.06} normalMap={normalMap} normalScale={[0.5, 0.5]} envMapIntensity={1.3} />
    </mesh>
  )
}

// ------------------------------------------------------------------ sky
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
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uClouds;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
    float s = max(dot(d, uSunDir), 0.0);
    // sun / moon disc and glow
    float disc = smoothstep(mix(0.9994, 0.9990, uNight), mix(0.9997, 0.9993, uNight), s);
    col += uSunColor * (pow(s, 6.0) * mix(0.35, 0.12, uNight) + pow(s, 60.0) * 0.4);
    col = mix(col, uSunColor * mix(2.6, 1.6, uNight), disc);
    // clouds
    if (uClouds > 0.0 && h > 0.0) {
      vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
      float n = fbm(uv);
      float c = smoothstep(1.0 - uClouds * 0.75, 1.15 - uClouds * 0.5, n) * smoothstep(0.0, 0.25, h);
      vec3 cloudCol = mix(uHorizon * 1.08, vec3(1.0), 0.55) + uSunColor * pow(s, 4.0) * 0.4;
      col = mix(col, cloudCol, c * 0.85);
    }
    col = mix(uFog, col, smoothstep(-0.05, 0.12, h));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`
const ridgeVertex = /* glsl */ `
  attribute float aH;
  varying float vH;
  void main() {
    vH = aH;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ridgeFragment = /* glsl */ `
  uniform vec3 uFog;
  uniform vec3 uColor;
  uniform float uMix;
  varying float vH;
  void main() {
    vec3 c = mix(uFog, uColor, smoothstep(0.0, 1.0, vH) * uMix);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`

function ridgeGeometry(radius, minH, maxH, seed) {
  const segs = 220
  const pos = []
  const hs = []
  const idx = []
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const ph = Array.from({ length: 6 }, () => rnd() * Math.PI * 2)
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    let n = Math.sin(a * 3 + ph[0]) * 0.35 + Math.sin(a * 7 + ph[1]) * 0.22 + Math.abs(Math.sin(a * 13 + ph[2])) * 0.25 + Math.sin(a * 23 + ph[3]) * 0.1
    const t = Math.min(1, Math.max(0, n * 0.5 + 0.5))
    const hgt = minH + (maxH - minH) * t
    pos.push(Math.sin(a) * radius, -30, Math.cos(a) * radius, Math.sin(a) * radius, hgt, Math.cos(a) * radius)
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
  const stars = useRef()
  const glowSprite = useRef()
  const camera = useThree((s) => s.camera)
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uFog: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uNight: { value: 0 },
          uClouds: { value: 0 },
          uTime: { value: 0 },
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
        { r: 640, min: 30, max: 120, seed: 11, mix: 0.45 },
        { r: 540, min: 12, max: 70, seed: 29, mix: 0.65 },
      ].map((cfg) => ({
        cfg,
        geo: ridgeGeometry(cfg.r, cfg.min, cfg.max, cfg.seed),
        mat: new THREE.ShaderMaterial({
          uniforms: { uFog: { value: new THREE.Color() }, uColor: { value: new THREE.Color() }, uMix: { value: cfg.mix } },
          vertexShader: ridgeVertex,
          fragmentShader: ridgeFragment,
          fog: false,
          side: THREE.DoubleSide,
        }),
      })),
    [],
  )
  const starGeo = useMemo(() => {
    const n = 1400
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2
      const y = Math.pow(0.08 + Math.random() * 0.92, 2)
      const rr = Math.sqrt(1 - y * y)
      p.set([Math.cos(u) * rr * 760, y * 760, Math.sin(u) * rr * 760], i * 3)
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
      starGeo.dispose()
    },
    [skyMat, ridges, starGeo],
  )

  useFrame((state) => {
    group.current.position.copy(camera.position)
    const u = skyMat.uniforms
    u.uTop.value.copy(atmo.skyTop)
    u.uHorizon.value.copy(atmo.skyHorizon)
    u.uFog.value.copy(atmo.fog)
    u.uSunDir.value.copy(atmo.sunDir)
    u.uSunColor.value.copy(atmo.sun)
    u.uNight.value = atmo.night
    u.uClouds.value = atmo.clouds
    u.uTime.value = state.clock.elapsedTime
    ridges.forEach((r) => {
      r.mat.uniforms.uFog.value.copy(atmo.fog)
      r.mat.uniforms.uColor.value.copy(atmo.ridge)
    })
    stars.current.material.opacity = atmo.stars * 0.85
    stars.current.visible = atmo.stars > 0.02
    glowSprite.current.position.copy(atmo.sunDir).multiplyScalar(700)
    glowSprite.current.material.color.copy(atmo.sun)
    glowSprite.current.material.opacity = 0.25 + atmo.night * 0.2
  }, -4)

  return (
    <group ref={group}>
      <mesh material={skyMat} renderOrder={-10}>
        <sphereGeometry args={[800, 32, 16]} />
      </mesh>
      <points ref={stars} geometry={starGeo} renderOrder={-9}>
        <pointsMaterial color="#dfe8ff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.85} depthWrite={false} />
      </points>
      <sprite ref={glowSprite} scale={[170, 170, 1]} renderOrder={-8}>
        <spriteMaterial map={glow} transparent opacity={0.3} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {ridges.map((r, i) => (
        <mesh key={i} geometry={r.geo} material={r.mat} renderOrder={-7 + i} />
      ))}
    </group>
  )
}

// ------------------------------------------------------------------ lights & fog
function Lights() {
  const quality = useGame((s) => s.quality)
  const hemi = useRef()
  const sun = useRef()
  const rim = useRef()
  const fill = useRef()
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    scene.fog = new THREE.FogExp2(atmo.fog.clone(), atmo.fogDensity)
    scene.background = atmo.fog.clone()
    return () => {
      scene.fog = null
    }
  }, [scene])

  useFrame(() => {
    if (!scene.fog) return
    const p = runtime.player
    const tunnel = runtime.tunnel
    scene.fog.color.copy(atmo.fog).multiplyScalar(1 - tunnel * 0.75)
    scene.fog.density = atmo.fogDensity * (1 + tunnel * 1.5)
    scene.background.copy(atmo.fog)
    hemi.current.color.copy(atmo.hemiSky)
    hemi.current.groundColor.copy(atmo.hemiGround)
    hemi.current.intensity = atmo.hemiIntensity * (1 - tunnel * 0.7)
    sun.current.color.copy(atmo.sun)
    sun.current.intensity = atmo.sunIntensity * (1 - tunnel * 0.85)
    // sun shines from far ahead and high: long shadows toward the camera
    sun.current.position.set(p.x + atmo.sunDir.x * 40, Math.max(8, atmo.sunDir.y * 40), atmo.sunDir.z * 40 - 6)
    sun.current.target.position.set(p.x, 0, -6)
    sun.current.target.updateMatrixWorld()
    rim.current.position.set(p.x, p.y + 2.6, -3.2)
    rim.current.color.copy(atmo.accent)
    rim.current.intensity = 6 + atmo.night * 16 + tunnel * 10
    fill.current.position.set(p.x + 2.5, p.y + 4, 4.5)
    fill.current.intensity = 4 + atmo.night * 5 + tunnel * 8
    gl.toneMappingExposure = atmo.exposure * (gl.toneMapping === THREE.NoToneMapping ? 1 : 1.1)
  }, -6)

  const mapSize = quality === 'high' ? 2048 : 1024
  useEffect(() => {
    const light = sun.current
    if (light?.shadow.map) {
      light.shadow.map.dispose()
      light.shadow.map = null
    }
  }, [mapSize])

  return (
    <>
      <hemisphereLight ref={hemi} intensity={1} />
      <ambientLight intensity={0.1} color="#8aa4d8" />
      <directionalLight
        ref={sun}
        intensity={2}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <pointLight ref={rim} intensity={10} distance={9} decay={2} />
      <pointLight ref={fill} color="#ffd6a8" intensity={6} distance={12} decay={2} />
    </>
  )
}

/** Image-based reflections, re-baked whenever the map changes. */
function Reflections() {
  const mapId = useGame(displayMapId)
  const m = getMap(mapId)
  const p = m.palette
  return (
    <Environment key={mapId} resolution={128} frames={1}>
      <color attach="background" args={[m.night ? '#05070d' : p.skyHorizon]} />
      <Lightformer form="rect" intensity={m.night ? 1.6 : 2.2} color={m.night ? '#5f8fff' : p.skyTop} position={[0, 12, -30]} scale={[60, 10, 1]} />
      <Lightformer form="circle" intensity={m.night ? 5 : 8} color={p.sun} position={[m.sunDir[0] * 40, m.sunDir[1] * 40 + 5, m.sunDir[2] * 40]} scale={m.night ? 6 : 10} />
      <Lightformer form="rect" intensity={1.2} color={p.lamp} position={[14, 3, 0]} rotation-y={-Math.PI / 2} scale={[40, 1.2, 1]} />
      <Lightformer form="rect" intensity={1.2} color={p.accent} position={[-14, 3, 0]} rotation-y={Math.PI / 2} scale={[40, 1.2, 1]} />
      <Lightformer form="rect" intensity={m.night ? 0.8 : 1.6} color={p.hemiSky} position={[0, 14, 10]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
    </Environment>
  )
}

export { Lights, Reflections, Sky, Track, Water }

export default function World() {
  return (
    <>
      <Lights />
      <Reflections />
      <Sky />
      <Track />
      <Water />
    </>
  )
}
