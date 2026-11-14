import * as THREE from 'three'

// All textures are generated on canvases at startup — no external image assets.

const cache = new Map()
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

const canvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// deterministic PRNG so textures look the same every load
const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const finish = (c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

// Road tile: spans the full road width (8.4m) and 12m of length.
export const ROAD_TILE_LENGTH = 12
export function roadTextures() {
  return memo('road', () => {
    const W = 512
    const H = 768
    const [c, g] = canvas(W, H)
    const [rc, rg] = canvas(W, H)
    const rand = rng(1337)

    // asphalt base
    g.fillStyle = '#14171e'
    g.fillRect(0, 0, W, H)
    rg.fillStyle = '#8c8c8c'
    rg.fillRect(0, 0, W, H)

    // tonal blotches + wet patches
    for (let i = 0; i < 70; i++) {
      const x = rand() * W
      const y = rand() * H
      const r = 20 + rand() * 90
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      const light = rand() > 0.5
      grad.addColorStop(0, light ? 'rgba(46,52,64,0.35)' : 'rgba(5,6,9,0.45)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      for (const oy of [-H, 0, H]) {
        g.save()
        g.translate(0, oy)
        g.fillRect(x - r, y - r, r * 2, r * 2)
        g.restore()
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = 40 + rand() * (W - 80)
      const y = rand() * H
      const r = 30 + rand() * 70
      const grad = rg.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(25,25,25,0.95)')
      grad.addColorStop(1, 'rgba(25,25,25,0)')
      rg.fillStyle = grad
      for (const oy of [-H, 0, H]) {
        rg.save()
        rg.translate(0, oy)
        rg.beginPath()
        rg.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2)
        rg.fill()
        rg.restore()
      }
    }

    // grain
    const img = g.getImageData(0, 0, W, H)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 22
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n + 1.5
    }
    g.putImageData(img, 0, 0)

    const toU = (x) => ((x + 4.2) / 8.4) * W
    const px = W / 8.4

    // gutters near the edges
    g.fillStyle = 'rgba(8,10,14,0.9)'
    g.fillRect(0, 0, toU(-3.75), H)
    g.fillRect(toU(3.75), 0, W - toU(3.75), H)

    // solid edge lines
    const line = (x, w, y0, y1, color) => {
      g.fillStyle = color
      g.fillRect(toU(x) - (w * px) / 2, y0, w * px, y1 - y0)
      rg.fillStyle = '#b0b0b0'
      rg.fillRect(toU(x) - (w * px) / 2, y0, w * px, y1 - y0)
    }
    line(-3.5, 0.14, 0, H, '#cfd6e2')
    line(3.5, 0.14, 0, H, '#cfd6e2')

    // dashed lane dividers: 3m dash, 3m gap
    const mPerPx = ROAD_TILE_LENGTH / H
    for (const x of [-1.1, 1.1]) {
      for (let m = 0; m < ROAD_TILE_LENGTH; m += 6) {
        const y0 = m / mPerPx
        line(x, 0.12, y0, y0 + 3 / mPerPx, '#dfe5ee')
      }
    }

    // wear on markings
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(20,23,30,${0.3 + rand() * 0.5})`
      g.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 3)
    }

    const map = finish(c, { repeat: [1, 1] })
    const roughnessMap = finish(rc, { repeat: [1, 1], srgb: false })
    return { map, roughnessMap }
  })
}

export function paverTexture() {
  return memo('paver', () => {
    const S = 256
    const [c, g] = canvas(S, S)
    const rand = rng(99)
    g.fillStyle = '#0d1018'
    g.fillRect(0, 0, S, S)
    const n = 4
    const cell = S / n
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 26 + rand() * 12
        g.fillStyle = `rgb(${v},${v + 3},${v + 9})`
        g.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6)
      }
    }
    const img = g.getImageData(0, 0, S, S)
    for (let i = 0; i < img.data.length; i += 4) {
      const k = (rand() - 0.5) * 12
      img.data[i] += k
      img.data[i + 1] += k
      img.data[i + 2] += k
    }
    g.putImageData(img, 0, 0)
    return finish(c, { repeat: [9, 6] })
  })
}

export function glowTexture() {
  return memo('glow', () => {
    const S = 128
    const [c, g] = canvas(S, S)
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.2, 'rgba(255,255,255,0.65)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, S, S)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

export function poolTexture() {
  return memo('pool', () => {
    const S = 128
    const [c, g] = canvas(S, S)
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    grad.addColorStop(0, 'rgba(255,255,255,0.55)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.22)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, S, S)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

export function stripeTexture() {
  return memo('stripes', () => {
    const S = 128
    const [c, g] = canvas(S, S)
    g.fillStyle = '#e8ecf2'
    g.fillRect(0, 0, S, S)
    g.fillStyle = '#1b2a4a'
    for (let i = -S; i < S * 2; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + 16, 0)
      g.lineTo(i + 16 - S, S)
      g.lineTo(i - S, S)
      g.closePath()
      g.fill()
    }
    return finish(c, { repeat: [3, 1] })
  })
}

export function waterNormalTexture() {
  return memo('water', () => {
    const S = 256
    const [c, g] = canvas(S, S)
    const img = g.createImageData(S, S)
    const waves = []
    const rand = rng(7)
    for (let i = 0; i < 14; i++) {
      waves.push({
        kx: Math.floor(rand() * 9) - 4 || 1,
        ky: Math.floor(rand() * 9) - 4 || 2,
        a: 0.4 + rand(),
        p: rand() * Math.PI * 2,
      })
    }
    const h = (x, y) => {
      let s = 0
      for (const w of waves) s += w.a * Math.sin(((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p)
      return s
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = h(x + 1, y) - h(x - 1, y)
        const dy = h(x, y + 1) - h(x, y - 1)
        const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize()
        const i = (y * S + x) * 4
        img.data[i] = (n.x * 0.5 + 0.5) * 255
        img.data[i + 1] = (n.y * 0.5 + 0.5) * 255
        img.data[i + 2] = (n.z * 0.5 + 0.5) * 255
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    return finish(c, { repeat: [40, 40], srgb: false })
  })
}
