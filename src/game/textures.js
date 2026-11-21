import * as THREE from 'three'

// All textures are generated on canvases at runtime — no external image assets.
// Everything is memoized, so each texture is only built the first time a map needs it.

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

const grain = (g, w, h, rand, amount, tint = [0, 0, 0]) => {
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount
    d[i] += n + tint[0]
    d[i + 1] += n + tint[1]
    d[i + 2] += n + tint[2]
  }
  g.putImageData(img, 0, 0)
}

const stones = (g, w, h, rand, count, palette, size = [1, 4]) => {
  for (let i = 0; i < count; i++) {
    g.fillStyle = palette[Math.floor(rand() * palette.length)]
    const r = size[0] + rand() * (size[1] - size[0])
    g.beginPath()
    g.ellipse(rand() * w, rand() * h, r, r * (0.6 + rand() * 0.4), rand() * 3, 0, Math.PI * 2)
    g.fill()
  }
}

// ---------------------------------------------------------------- track bed
// One tile spans the full track bed width (9.2 m) and 6 m of length.
export const TRACK_TILE_LENGTH = 6
const TRACK_STYLES = {
  wood: { base: '#5b544c', stones: ['#6d675f', '#4a443d', '#7a746b', '#3c3731', '#857e74'], sleeper: ['#4a3426', '#3a291e'], plate: '#2a2a2c' },
  concrete: { base: '#6f6f6c', stones: ['#808080', '#5c5c5a', '#8f8d88', '#4e4e4c', '#9a9894'], sleeper: ['#a7a5a0', '#8d8b86'], plate: '#3a3b3e' },
  rust: { base: '#4f3f33', stones: ['#5f4a3a', '#3e3128', '#6e5442', '#2f2620', '#7a5a43'], sleeper: ['#3a2a20', '#2a1e17'], plate: '#2b2522' },
  sand: { base: '#bfa57e', stones: ['#cdb48d', '#a88f6b', '#d8c39d', '#9c835f', '#e1cfaa'], sleeper: ['#8a7058', '#76604b'], plate: '#4b4540' },
}

export function trackTextures(style) {
  return memo(`track-${style}`, () => {
    const W = 512
    const H = 336
    const [c, g] = canvas(W, H)
    const [rc, rg] = canvas(W, H)
    const rand = rng(style.length * 977 + 13)
    const toU = (x) => ((x + 4.6) / 9.2) * W
    const pxPerM = W / 9.2
    const lanes = [-2.5, 0, 2.5]

    if (style === 'street') {
      // wet asphalt with embedded rails (Night City)
      g.fillStyle = '#15161d'
      g.fillRect(0, 0, W, H)
      rg.fillStyle = '#7a7a7a'
      rg.fillRect(0, 0, W, H)
      for (let i = 0; i < 40; i++) {
        const x = rand() * W
        const y = rand() * H
        const r = 18 + rand() * 60
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, rand() > 0.5 ? 'rgba(46,44,66,0.35)' : 'rgba(4,4,8,0.45)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grad
        for (const oy of [-H, 0, H]) g.fillRect(x - r, y - r + oy, r * 2, r * 2)
        const pr = rg.createRadialGradient(x, y, 0, x, y, r)
        pr.addColorStop(0, 'rgba(20,20,20,0.9)')
        pr.addColorStop(1, 'rgba(20,20,20,0)')
        rg.fillStyle = pr
        for (const oy of [-H, 0, H]) rg.fillRect(x - r, y - r + oy, r * 2, r * 2)
      }
      grain(g, W, H, rand, 16, [0, 0, 2])
      for (const l of lanes) {
        for (const off of [-0.72, 0.72]) {
          g.fillStyle = 'rgba(0,0,0,0.6)'
          g.fillRect(toU(l + off) - 4, 0, 8, H)
        }
      }
      // dashed lane dividers
      g.fillStyle = 'rgba(220,226,240,0.85)'
      for (const x of [-1.25, 1.25]) for (let y = 0; y < H; y += H / 2) g.fillRect(toU(x) - 2, y, 4, H / 4)
      g.fillStyle = 'rgba(220,226,240,0.9)'
      for (const x of [-4.3, 4.3]) g.fillRect(toU(x) - 3, 0, 6, H)
    } else {
      const s = TRACK_STYLES[style] ?? TRACK_STYLES.wood
      g.fillStyle = s.base
      g.fillRect(0, 0, W, H)
      rg.fillStyle = '#d8d8d8'
      rg.fillRect(0, 0, W, H)
      stones(g, W, H, rand, 9000, s.stones, [0.8, 2.6])
      // sleepers: 2.6 m long, 0.26 m wide, every 0.6 m
      const perTile = 10
      for (const l of lanes) {
        for (let k = 0; k < perTile; k++) {
          const y = (k / perTile) * H + 4
          const x0 = toU(l - 1.3)
          const w = 2.6 * pxPerM
          const h = 0.26 * pxPerM
          g.fillStyle = s.sleeper[k % 2]
          g.fillRect(x0, y, w, h)
          // wood grain / concrete texture
          for (let i = 0; i < 6; i++) {
            g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`
            g.fillRect(x0, y + rand() * h, w, 1)
          }
          g.fillStyle = 'rgba(255,255,255,0.06)'
          g.fillRect(x0, y, w, 2)
          g.fillStyle = 'rgba(0,0,0,0.35)'
          g.fillRect(x0, y + h, w, 3)
          // tie plates under the rails
          g.fillStyle = s.plate
          for (const off of [-0.72, 0.72]) g.fillRect(toU(l + off) - 7, y - 1, 14, h + 2)
          rg.fillStyle = '#b4b4b4'
          rg.fillRect(x0, y, w, h)
        }
      }
      grain(g, W, H, rand, 14)
    }
    return {
      map: finish(c, { repeat: [1, 1] }),
      roughnessMap: finish(rc, { repeat: [1, 1], srgb: false }),
    }
  })
}

// ---------------------------------------------------------------- side ground
export function groundTexture(kind) {
  return memo(`ground-${kind}`, () => {
    const S = 512
    const [c, g] = canvas(S, S)
    const rand = rng(kind.length * 331 + 7)
    if (kind === 'sand') {
      g.fillStyle = '#e3cc9c'
      g.fillRect(0, 0, S, S)
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(${rand() > 0.5 ? '255,245,220' : '170,140,95'},0.25)`
        g.lineWidth = 2 + rand() * 3
        g.beginPath()
        const y = rand() * S
        g.moveTo(0, y)
        for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 6)
        g.stroke()
      }
      stones(g, S, S, rand, 2500, ['#d2b98a', '#efdcb2', '#c7ab7a'], [0.5, 1.4])
      grain(g, S, S, rand, 18)
    } else if (kind === 'concrete' || kind === 'yard') {
      const yard = kind === 'yard'
      g.fillStyle = yard ? '#7a7066' : '#8a8682'
      g.fillRect(0, 0, S, S)
      for (let i = 0; i < 70; i++) {
        const x = rand() * S
        const y = rand() * S
        const r = 10 + rand() * (yard ? 90 : 50)
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, yard && rand() > 0.6 ? 'rgba(30,22,16,0.45)' : `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},0.1)`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grad
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = 2
      for (let k = 0; k <= 4; k++) {
        g.beginPath()
        g.moveTo(0, (k * S) / 4)
        g.lineTo(S, (k * S) / 4)
        g.moveTo((k * S) / 4, 0)
        g.lineTo((k * S) / 4, S)
        g.stroke()
      }
      if (yard) {
        g.fillStyle = 'rgba(232,190,40,0.75)'
        g.fillRect(S * 0.1, 0, 10, S)
      }
      stones(g, S, S, rand, 1800, ['#6a6560', '#9a958e', '#55504a'], [0.5, 1.5])
      grain(g, S, S, rand, 16)
    } else if (kind === 'pavement' || kind === 'pavers') {
      const dark = kind === 'pavers'
      g.fillStyle = dark ? '#0d1018' : '#a9a7a2'
      g.fillRect(0, 0, S, S)
      const n = 8
      const cell = S / n
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const v = dark ? 26 + rand() * 12 : 170 + rand() * 25
          g.fillStyle = `rgb(${v},${v + (dark ? 3 : 0)},${v + (dark ? 9 : -4)})`
          g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4)
        }
      }
      grain(g, S, S, rand, dark ? 10 : 14)
    } else if (kind === 'asphalt') {
      // a 2-lane side road: 9.4 m wide tile, 12 m long
      g.fillStyle = '#3a3b3f'
      g.fillRect(0, 0, S, S)
      stones(g, S, S, rand, 6000, ['#45464b', '#303135', '#4f5055'], [0.5, 1.6])
      g.fillStyle = 'rgba(235,235,235,0.9)'
      g.fillRect(S * 0.03, 0, 7, S)
      g.fillRect(S * 0.97 - 7, 0, 7, S)
      g.fillStyle = 'rgba(240,196,40,0.95)'
      for (let y = 0; y < S; y += S / 2) g.fillRect(S / 2 - 4, y, 8, S / 4)
      grain(g, S, S, rand, 10)
    } else if (kind === 'boardwalk') {
      g.fillStyle = '#9a7552'
      g.fillRect(0, 0, S, S)
      const planks = 16
      for (let i = 0; i < planks; i++) {
        const y = (i / planks) * S
        g.fillStyle = `rgb(${150 + rand() * 30},${112 + rand() * 20},${78 + rand() * 18})`
        g.fillRect(0, y + 2, S, S / planks - 4)
        for (let k = 0; k < 5; k++) {
          g.fillStyle = 'rgba(60,40,20,0.15)'
          g.fillRect(0, y + 2 + rand() * (S / planks - 4), S, 1)
        }
      }
      grain(g, S, S, rand, 14)
    }
    return finish(c)
  })
}

// ---------------------------------------------------------------- atlases (2×2 tiles)
const atlas = (key, draw) =>
  memo(key, () => {
    const S = 1024
    const [c, g] = canvas(S, S)
    const rand = rng(key.length * 101 + 3)
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 512
      // tile 0/1 are the bottom row in UV space
      const y = i < 2 ? 512 : 0
      g.save()
      g.translate(x, y)
      g.beginPath()
      g.rect(0, 0, 512, 512)
      g.clip()
      draw(g, i, rand)
      g.restore()
    }
    const t = finish(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })

const WORDS = ['RUN', 'FLOW', 'ZOOM', 'RAIL', 'DASH', 'LUX', 'KAI', 'WILD', 'NOCT', 'BLAZE', 'JUNO', 'FAST']
const SPRAY = ['#ff4d6d', '#ffd23f', '#3bceac', '#7b5cff', '#ff8c42', '#2ec4f1', '#e94e77', '#9bdc52']

export function graffitiAtlas() {
  return atlas('graffiti', (g, i, rand) => {
    // weathered concrete wall
    g.fillStyle = '#8b8780'
    g.fillRect(0, 0, 512, 512)
    for (let k = 0; k < 300; k++) {
      g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${rand() * 0.06})`
      g.fillRect(rand() * 512, rand() * 512, 4 + rand() * 40, 4 + rand() * 40)
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'
    for (let x = 0; x < 512; x += 128) g.fillRect(x, 0, 3, 512)
    // background shapes
    for (let k = 0; k < 5; k++) {
      g.fillStyle = SPRAY[Math.floor(rand() * SPRAY.length)] + '55'
      g.beginPath()
      g.arc(rand() * 512, 120 + rand() * 300, 30 + rand() * 80, 0, Math.PI * 2)
      g.fill()
    }
    // bubble-letter piece
    const word = WORDS[(i * 3 + Math.floor(rand() * 3)) % WORDS.length]
    const c1 = SPRAY[(i * 2) % SPRAY.length]
    const c2 = SPRAY[(i * 2 + 3) % SPRAY.length]
    g.save()
    g.translate(256, 300)
    g.rotate((rand() - 0.5) * 0.25)
    g.font = `900 ${word.length > 4 ? 120 : 160}px Impact, "Arial Black", sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.strokeStyle = '#111'
    g.lineWidth = 34
    g.strokeText(word, 6, 8)
    g.strokeStyle = '#fff'
    g.lineWidth = 18
    g.strokeText(word, 0, 0)
    const grad = g.createLinearGradient(0, -80, 0, 80)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    g.fillStyle = grad
    g.fillText(word, 0, 0)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.font = `900 ${word.length > 4 ? 120 : 160}px Impact, "Arial Black", sans-serif`
    g.save()
    g.beginPath()
    g.rect(-260, -80, 520, 40)
    g.clip()
    g.fillText(word, 0, 0)
    g.restore()
    g.restore()
    // drips
    for (let k = 0; k < 14; k++) {
      g.fillStyle = c2
      const x = 70 + rand() * 370
      const y = 340 + rand() * 30
      g.fillRect(x, y, 3, 20 + rand() * 70)
    }
    // small tags
    g.font = 'italic 700 34px "Segoe Script", "Brush Script MT", cursive'
    g.fillStyle = '#151515'
    g.fillText(WORDS[(i + 5) % WORDS.length].toLowerCase() + '!', 60 + rand() * 300, 90 + rand() * 40)
    g.fillStyle = SPRAY[(i + 1) % SPRAY.length]
    g.beginPath()
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2
      const a2 = a + Math.PI / 5
      g.lineTo(440 + Math.cos(a) * 30, 110 + Math.sin(a) * 30)
      g.lineTo(440 + Math.cos(a2) * 13, 110 + Math.sin(a2) * 13)
    }
    g.fill()
    // grime at the bottom
    const dirt = g.createLinearGradient(0, 400, 0, 512)
    dirt.addColorStop(0, 'rgba(40,30,20,0)')
    dirt.addColorStop(1, 'rgba(40,30,20,0.55)')
    g.fillStyle = dirt
    g.fillRect(0, 400, 512, 112)
  })
}

const ADS = [
  { bg: ['#ff4f6d', '#ffb347'], title: 'FIZZ', sub: 'ORANGE • ZERO SUGAR', shape: 'circle' },
  { bg: ['#1b2a6b', '#2f9bff'], title: 'SKYLINE', sub: 'TOWERS • NOW LEASING', shape: 'bars' },
  { bg: ['#101418', '#21c766'], title: 'VELO', sub: 'NEW RUNNING SHOES', shape: 'swoosh' },
  { bg: ['#6b2fb3', '#ff6ec7'], title: '101.7', sub: 'CITY WAVE FM', shape: 'wave' },
]
export function billboardAtlas() {
  return atlas('billboards', (g, i) => {
    const ad = ADS[i]
    const grad = g.createLinearGradient(0, 0, 512, 512)
    grad.addColorStop(0, ad.bg[0])
    grad.addColorStop(1, ad.bg[1])
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 512)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    if (ad.shape === 'circle') {
      g.beginPath()
      g.arc(400, 140, 120, 0, Math.PI * 2)
      g.fill()
    } else if (ad.shape === 'bars') {
      for (let k = 0; k < 6; k++) g.fillRect(40 + k * 75, 120 - k * 12, 50, 300 + k * 12)
    } else if (ad.shape === 'swoosh') {
      g.lineWidth = 40
      g.strokeStyle = 'rgba(255,255,255,0.3)'
      g.beginPath()
      g.moveTo(40, 380)
      g.quadraticCurveTo(260, 470, 480, 160)
      g.stroke()
    } else {
      g.lineWidth = 10
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      for (let k = 0; k < 4; k++) {
        g.beginPath()
        for (let x = 0; x <= 512; x += 8) g.lineTo(x, 380 + k * 22 + Math.sin(x * 0.03 + k) * 20)
        g.stroke()
      }
    }
    g.fillStyle = '#ffffff'
    g.textAlign = 'left'
    g.font = '900 120px "Arial Black", Impact, sans-serif'
    g.fillText(ad.title, 34, 300)
    g.font = '700 30px Arial, sans-serif'
    g.fillText(ad.sub, 38, 352)
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    g.lineWidth = 12
    g.strokeRect(6, 6, 500, 500)
  })
}

const NEON = [
  { text: 'OPEN', sub: '24 HRS', c: '#ff3df2' },
  { text: 'NOODLE', sub: 'BAR', c: '#29e1ff' },
  { text: 'HOTEL', sub: '★ ★ ★', c: '#ffd23f' },
  { text: 'ARCADE', sub: 'PLAY ▸', c: '#7bff6a' },
]
export function neonAtlas() {
  return atlas('neon', (g, i) => {
    const n = NEON[i]
    g.fillStyle = '#05050a'
    g.fillRect(0, 0, 512, 512)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = n.c
    g.shadowBlur = 30
    g.strokeStyle = n.c
    g.lineWidth = 8
    g.strokeRect(30, 60, 452, 392)
    g.fillStyle = '#ffffff'
    g.font = `900 ${n.text.length > 5 ? 96 : 120}px "Arial Black", Impact, sans-serif`
    g.fillText(n.text, 256, 220)
    g.fillStyle = n.c
    g.fillText(n.text, 256, 220)
    g.font = '700 54px Arial, sans-serif'
    g.fillText(n.sub, 256, 350)
    g.shadowBlur = 0
  })
}

const SIGNS = [
  { bg: '#1d4f9c', text: 'CENTRAL', sub: 'PLATFORM 2' },
  { bg: '#1d4f9c', text: 'RIVER ST.', sub: 'PLATFORM 1' },
  { bg: '#f2c230', text: 'LOW', sub: 'CLEARANCE', fg: '#111' },
  { bg: '#c62f3a', text: 'STOP', sub: 'NO ENTRY' },
]
export function signAtlas() {
  return atlas('signs', (g, i) => {
    const s = SIGNS[i]
    g.fillStyle = s.bg
    g.fillRect(0, 0, 512, 512)
    g.fillStyle = s.fg ?? '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '900 110px "Arial Black", Arial, sans-serif'
    g.fillText(s.text, 256, 210)
    g.font = '700 58px Arial, sans-serif'
    g.fillText(s.sub, 256, 340)
    if (i === 2) {
      g.fillStyle = '#111'
      for (let k = 0; k < 8; k++) {
        g.beginPath()
        g.moveTo(k * 70 - 20, 512)
        g.lineTo(k * 70 + 15, 512)
        g.lineTo(k * 70 + 50, 440)
        g.lineTo(k * 70 + 15, 440)
        g.fill()
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 14
    g.strokeRect(10, 10, 492, 492)
  })
}

// ---------------------------------------------------------------- props
export function corrugatedTexture() {
  return memo('corrugated', () => {
    const W = 256
    const H = 128
    const [c, g] = canvas(W, H)
    const rand = rng(41)
    for (let x = 0; x < W; x++) {
      const v = 205 + Math.sin((x / W) * Math.PI * 2 * 24) * 35
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, 0, 1, H)
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(110,60,30,${rand() * 0.35})`
      g.fillRect(rand() * W, rand() * H, 2 + rand() * 6, 2 + rand() * 10)
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(0, 0, W, 6)
    g.fillRect(0, H - 6, W, 6)
    return finish(c)
  })
}

export function trainWindowTexture() {
  return memo('trainwindows', () => {
    const W = 512
    const H = 64
    const [c, g] = canvas(W, H)
    g.fillStyle = '#1a1d22'
    g.fillRect(0, 0, W, H)
    for (let k = 0; k < 6; k++) {
      const x = k * (W / 6) + 8
      const w = W / 6 - 16
      const grad = g.createLinearGradient(0, 6, 0, H - 6)
      grad.addColorStop(0, '#5f7088')
      grad.addColorStop(0.5, '#28323f')
      grad.addColorStop(1, '#161b22')
      g.fillStyle = grad
      g.fillRect(x, 6, w, H - 12)
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.fillRect(x + 6, 10, w * 0.35, 4)
    }
    return finish(c, { repeat: [1, 1] })
  })
}

export function vestTextTexture() {
  return memo('vest', () => {
    const [c, g] = canvas(256, 128)
    g.fillStyle = '#c6ef1f'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#d7dde6'
    g.fillRect(0, 10, 256, 14)
    g.fillRect(0, 104, 256, 14)
    g.fillStyle = '#0d1424'
    g.fillRect(18, 38, 220, 56)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '900 30px "Arial Black", Arial, sans-serif'
    g.fillText('TRANSIT', 128, 56)
    g.font = '800 22px Arial, sans-serif'
    g.fillText('POLICE', 128, 82)
    return finish(c)
  })
}

export function deckTexture(board) {
  return memo(`deck-${board.id}`, () => {
    const W = 128
    const H = 512
    const [c, g] = canvas(W, H)
    const [a, b, d] = board.colors
    const rand = rng(board.id.length * 59 + 5)
    switch (board.design) {
      case 'stripes':
        g.fillStyle = b
        g.fillRect(0, 0, W, H)
        g.fillStyle = a
        for (let y = 60; y < H; y += 90) g.fillRect(0, y, W, 34)
        g.fillStyle = d
        g.font = '900 34px "Arial Black", sans-serif'
        g.save()
        g.translate(W / 2, H / 2)
        g.rotate(-Math.PI / 2)
        g.textAlign = 'center'
        g.fillText('CLASSIC', 0, 12)
        g.restore()
        break
      case 'neon':
        g.fillStyle = a
        g.fillRect(0, 0, W, H)
        g.lineWidth = 6
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = k % 2 ? b : d
          g.beginPath()
          g.moveTo(0, 40 + k * 70)
          g.lineTo(W, 90 + k * 70)
          g.stroke()
        }
        break
      case 'gradient': {
        const grad = g.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, a)
        grad.addColorStop(0.5, b)
        grad.addColorStop(1, d)
        g.fillStyle = grad
        g.fillRect(0, 0, W, H)
        g.fillStyle = 'rgba(255,255,255,0.85)'
        g.beginPath()
        g.arc(W / 2, H * 0.62, 34, Math.PI, 0)
        g.fill()
        break
      }
      case 'camo':
        g.fillStyle = a
        g.fillRect(0, 0, W, H)
        for (let k = 0; k < 60; k++) {
          g.fillStyle = board.colors[1 + (k % 3)]
          g.beginPath()
          g.ellipse(rand() * W, rand() * H, 10 + rand() * 26, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2)
          g.fill()
        }
        break
      case 'waves':
        g.fillStyle = a
        g.fillRect(0, 0, W, H)
        for (let k = 0; k < 12; k++) {
          g.strokeStyle = k % 2 ? b : d
          g.lineWidth = 8
          g.beginPath()
          for (let x = 0; x <= W; x += 4) g.lineTo(x, 30 + k * 42 + Math.sin(x * 0.08 + k) * 10)
          g.stroke()
        }
        break
      case 'carbon':
        for (let y = 0; y < H; y += 8) {
          for (let x = 0; x < W; x += 8) {
            g.fillStyle = (x + y) % 16 === 0 ? a : b
            g.fillRect(x, y, 8, 8)
          }
        }
        g.fillStyle = d
        g.fillRect(W / 2 - 6, 0, 12, H)
        break
      case 'galaxy': {
        const grad = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H / 2)
        grad.addColorStop(0, b)
        grad.addColorStop(1, a)
        g.fillStyle = grad
        g.fillRect(0, 0, W, H)
        for (let k = 0; k < 220; k++) {
          g.fillStyle = k % 9 === 0 ? d : '#ffffff'
          g.fillRect(rand() * W, rand() * H, rand() * 2.5, rand() * 2.5)
        }
        break
      }
      case 'gold': {
        const grad = g.createLinearGradient(0, 0, W, H)
        grad.addColorStop(0, a)
        grad.addColorStop(0.5, d)
        grad.addColorStop(1, b)
        g.fillStyle = grad
        g.fillRect(0, 0, W, H)
        g.fillStyle = 'rgba(80,50,0,0.6)'
        g.font = '900 60px "Arial Black", sans-serif'
        g.textAlign = 'center'
        g.fillText('★', W / 2, H / 2 + 20)
        break
      }
      default:
        g.fillStyle = a
        g.fillRect(0, 0, W, H)
    }
    const t = finish(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// ---------------------------------------------------------------- glow sprites & water
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

export function stripeTexture(a = '#e8ecf2', b = '#c62f3a') {
  return memo(`stripes-${a}-${b}`, () => {
    const S = 128
    const [c, g] = canvas(S, S)
    g.fillStyle = a
    g.fillRect(0, 0, S, S)
    g.fillStyle = b
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
      waves.push({ kx: Math.floor(rand() * 9) - 4 || 1, ky: Math.floor(rand() * 9) - 4 || 2, a: 0.4 + rand(), p: rand() * Math.PI * 2 })
    }
    const h = (x, y) => {
      let s = 0
      for (const w of waves) s += w.a * Math.sin(((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p)
      return s
    }
    const n = new THREE.Vector3()
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = h(x + 1, y) - h(x - 1, y)
        const dy = h(x, y + 1) - h(x, y - 1)
        n.set(-dx * 2.2, -dy * 2.2, 1).normalize()
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
