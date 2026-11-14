import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { fx, runtime } from '../game/runtime'
import { atmo } from '../game/atmosphere'

const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aAlpha > 0.001 ? aSize * uScale / max(0.1, -mv.z) : 0.0;
    gl_Position = projectionMatrix * mv;
  }
`
const pointFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor * a * vAlpha * 1.8, 1.0);
  }
`

const makePointsMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

const usePointScale = (material) => {
  const size = useThree((s) => s.size)
  const viewport = useThree((s) => s.viewport)
  useFrame(({ camera }) => {
    material.uniforms.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  })
}

/** Pooled GPU particle system for bursts: landing dust, pickups, crash debris. */
export function Particles({ max = 900 }) {
  const sys = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(max * 3)
    const col = new Float32Array(max * 3)
    const size = new Float32Array(max)
    const alpha = new Float32Array(max)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return {
      geo,
      pos,
      col,
      size,
      alpha,
      vel: new Float32Array(max * 3),
      life: new Float32Array(max),
      maxLife: new Float32Array(max),
      grav: new Float32Array(max),
      baseSize: new Float32Array(max),
      cursor: 0,
      mat: makePointsMaterial(),
    }
  }, [max])

  usePointScale(sys.mat)

  useEffect(() => {
    const c = new THREE.Color()
    fx.burst = ({ x, y, z, count = 10, color = 0xffffff, speed = 3, up = 1, life = 0.6, size = 0.1, gravity = -6 }) => {
      c.set(color)
      for (let n = 0; n < count; n++) {
        const i = sys.cursor
        sys.cursor = (sys.cursor + 1) % max
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        const sp = speed * (0.35 + Math.random() * 0.65)
        sys.pos[i * 3] = x
        sys.pos[i * 3 + 1] = y
        sys.pos[i * 3 + 2] = z
        sys.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
        sys.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.6 + up * Math.random()
        sys.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
        const shade = 0.75 + Math.random() * 0.25
        sys.col[i * 3] = c.r * shade
        sys.col[i * 3 + 1] = c.g * shade
        sys.col[i * 3 + 2] = c.b * shade
        sys.life[i] = sys.maxLife[i] = life * (0.6 + Math.random() * 0.4)
        sys.grav[i] = gravity
        sys.baseSize[i] = size * (0.6 + Math.random() * 0.8)
      }
    }
    return () => {
      fx.burst = () => {}
      sys.geo.dispose()
      sys.mat.dispose()
    }
  }, [sys, max])

  useFrame(() => {
    const dt = runtime.dt
    const dz = runtime.dz
    const { pos, vel, life, maxLife, alpha, size, baseSize, grav } = sys
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) {
        if (alpha[i] !== 0) alpha[i] = 0
        continue
      }
      life[i] -= dt
      const drag = Math.exp(-2.2 * dt)
      vel[i * 3] *= drag
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag + grav[i] * dt
      vel[i * 3 + 2] *= drag
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] = Math.max(0.02, pos[i * 3 + 1] + vel[i * 3 + 1] * dt)
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt + dz
      const k = Math.max(0, life[i] / maxLife[i])
      alpha[i] = k * k
      size[i] = baseSize[i] * (0.4 + 0.6 * k)
    }
    const a = sys.geo.attributes
    a.position.needsUpdate = true
    a.aAlpha.needsUpdate = true
    a.aSize.needsUpdate = true
    a.aColor.needsUpdate = true
  }, -6)

  return <points geometry={sys.geo} material={sys.mat} frustumCulled={false} renderOrder={5} />
}

/** Floating dust motes around the camera — sells depth, atmosphere and speed. */
export function Motes({ count = 260 }) {
  const sys = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const alpha = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = Math.random() * 9
      pos[i * 3 + 2] = 12 - Math.random() * 90
      col.set([0.6, 0.72, 1], i * 3)
      size[i] = 0.03 + Math.random() * 0.05
      alpha[i] = 0.25 + Math.random() * 0.5
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    return { geo, pos, mat: makePointsMaterial() }
  }, [count])
  usePointScale(sys.mat)
  useEffect(
    () => () => {
      sys.geo.dispose()
      sys.mat.dispose()
    },
    [sys],
  )
  useFrame((state) => {
    const dz = runtime.dz
    const t = state.clock.elapsedTime
    const { pos } = sys
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] += dz * 1.05
      pos[i * 3] += Math.sin(t * 0.4 + i) * 0.002
      pos[i * 3 + 1] += Math.cos(t * 0.3 + i * 1.3) * 0.0015
      if (pos[i * 3 + 2] > 12) pos[i * 3 + 2] -= 90
    }
    sys.geo.attributes.position.needsUpdate = true
  }, -6)
  return <points geometry={sys.geo} material={sys.mat} frustumCulled={false} />
}

const WHITE = new THREE.Color(1, 1, 1)

/** Streaks that appear at high speed and during the score boost. */
export function SpeedLines({ count = 70 }) {
  const mesh = useRef()
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const side = Math.random() < 0.5 ? -1 : 1
        return {
          x: side * (2.8 + Math.random() * 7),
          y: 0.3 + Math.random() * 6,
          z: 10 - Math.random() * 90,
          len: 3 + Math.random() * 5,
          spd: 1.4 + Math.random() * 0.8,
        }
      }),
    [count],
  )
  const geo = useMemo(() => new THREE.BoxGeometry(0.018, 0.018, 1), [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#bcd4ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const speedK = THREE.MathUtils.smoothstep(runtime.speed, 22, 38)
    const boost = runtime.boostTime > 0 ? 0.35 : 0
    const target = runtime.mode === 'playing' && !runtime.crashed ? Math.min(0.55, speedK * 0.38 + boost) : 0
    mat.opacity += (target - mat.opacity) * 0.08
    mat.color.copy(atmo.accent).lerp(WHITE, 0.5)
    mesh.current.visible = mat.opacity > 0.01
    if (!mesh.current.visible) return
    const stretch = 0.6 + runtime.speed / 30
    for (let i = 0; i < count; i++) {
      const d = data[i]
      d.z += runtime.dz * d.spd
      if (d.z > 12) d.z -= 95
      m.makeScale(1, 1, d.len * stretch)
      m.setPosition(d.x, d.y, d.z)
      mesh.current.setMatrixAt(i, m)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, -6)
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />
}
