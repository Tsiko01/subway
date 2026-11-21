// Fully procedural audio: a generative soundtrack per map plus synthesized SFX and loops.
// Nothing is downloaded — every sound is built from oscillators and noise.

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
const pat = (s) => s.split('').map((c) => c === '1')

const PRESETS = {
  subway: {
    bpm: 92,
    swing: 0.14,
    chords: [
      { bass: 33, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79, 72, 76, 69, 67] },
      { bass: 38, pad: [57, 60, 62, 65], arp: [62, 65, 69, 72, 69, 65, 62, 60] },
      { bass: 31, pad: [55, 59, 62, 65], arp: [67, 71, 74, 77, 74, 71, 67, 65] },
      { bass: 36, pad: [55, 59, 60, 64], arp: [64, 67, 71, 72, 71, 67, 64, 60] },
    ],
    pad: { type: 'triangle', cutoff: 1100, vol: 0.05 },
    pluck: { type: 'sine', harm: 'triangle', decay: 0.55, vol: 0.06, every: 2 },
    kick: pat('1000001010000000'),
    snare: pat('0000100000001000'),
    hat: pat('1010101010101010'),
    perc: null,
    bassPat: pat('1000001010000010'),
    bassType: 'sine',
    bassCut: 420,
  },
  city: {
    bpm: 118,
    swing: 0,
    chords: [
      { bass: 36, pad: [55, 60, 64, 67], arp: [72, 76, 79, 84, 79, 76, 72, 67] },
      { bass: 31, pad: [55, 59, 62, 67], arp: [71, 74, 79, 83, 79, 74, 71, 67] },
      { bass: 33, pad: [57, 60, 64, 69], arp: [72, 76, 81, 84, 81, 76, 72, 69] },
      { bass: 29, pad: [53, 57, 60, 65], arp: [69, 72, 77, 81, 77, 72, 69, 65] },
    ],
    pad: { type: 'sawtooth', cutoff: 1600, vol: 0.035 },
    pluck: { type: 'triangle', harm: 'square', decay: 0.32, vol: 0.05, every: 2 },
    kick: pat('1000100010001000'),
    snare: pat('0000100000001000'),
    hat: pat('0010001000100010'),
    perc: pat('0000000100000001'),
    percType: 'shaker',
    bassPat: pat('1010101010101010'),
    bassType: 'sawtooth',
    bassCut: 600,
  },
  industrial: {
    bpm: 126,
    swing: 0,
    chords: [
      { bass: 28, pad: [52, 55, 59, 64], arp: [64, 67, 71, 64, 67, 71, 76, 71] },
      { bass: 24, pad: [48, 52, 55, 60], arp: [60, 64, 67, 60, 64, 67, 72, 67] },
      { bass: 26, pad: [50, 54, 57, 62], arp: [62, 66, 69, 62, 66, 69, 74, 69] },
      { bass: 23, pad: [47, 50, 54, 59], arp: [59, 62, 66, 59, 62, 66, 71, 66] },
    ],
    pad: { type: 'sawtooth', cutoff: 520, vol: 0.05 },
    pluck: { type: 'square', harm: 'sawtooth', decay: 0.18, vol: 0.03, every: 4, offset: 2 },
    kick: pat('1000100010001000'),
    snare: pat('0000100000001000'),
    hat: pat('1111111111111111'),
    hatVol: 0.016,
    perc: pat('0001001000100100'),
    percType: 'metal',
    bassPat: pat('0111011101110111'),
    bassType: 'sawtooth',
    bassCut: 380,
  },
  beach: {
    bpm: 108,
    swing: 0.08,
    chords: [
      { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 77, 72, 69, 65, 72] },
      { bass: 36, pad: [55, 60, 64, 67], arp: [64, 67, 72, 76, 72, 67, 64, 72] },
      { bass: 26, pad: [53, 57, 62, 65], arp: [62, 65, 69, 74, 69, 65, 62, 69] },
      { bass: 34, pad: [53, 58, 62, 65], arp: [62, 65, 70, 74, 70, 65, 62, 70] },
    ],
    pad: { type: 'triangle', cutoff: 1300, vol: 0.04 },
    pluck: { type: 'sine', harm: 'sine3', decay: 0.28, vol: 0.07, every: 1, mask: pat('1011010110110101') },
    kick: pat('1000100010001000'),
    snare: pat('0000100000001000'),
    hat: pat('0010001000100010'),
    perc: pat('1111111111111111'),
    percType: 'shaker',
    bassPat: pat('1000100110001001'),
    bassType: 'sine',
    bassCut: 500,
  },
  night: {
    bpm: 104,
    swing: 0,
    chords: [
      { bass: 33, pad: [57, 60, 64, 71], arp: [69, 72, 76, 79, 81, 76, 72, 79] },
      { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76, 77, 72, 69, 76] },
      { bass: 36, pad: [55, 60, 62, 64], arp: [67, 72, 74, 76, 79, 74, 72, 76] },
      { bass: 28, pad: [55, 59, 62, 64], arp: [64, 67, 71, 74, 76, 71, 67, 74] },
    ],
    pad: { type: 'sawtooth', cutoff: 1500, vol: 0.05 },
    pluck: { type: 'triangle', harm: 'sine', decay: 0.42, vol: 0.055, every: 2 },
    kick: pat('1000100010001000'),
    snare: pat('0000100000001000'),
    hat: pat('0010001000100010'),
    perc: null,
    bassPat: pat('1010101010101010'),
    bassType: 'sawtooth',
    bassCut: 520,
  },
}

const COIN_NOTES = [84, 88, 91, 96]

class AudioEngine {
  constructor() {
    this.ctx = null
    this.musicOn = true
    this.sfxOn = true
    this.musicMode = 'menu'
    this.preset = PRESETS.subway
    this.step = 0
    this.nextTime = 0
    this.timer = null
    this.stepFlip = false
    this.loops = {}
  }

  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      try {
        this.ctx = new AC()
      } catch {
        return
      }
      this.build()
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return
        if (document.hidden) this.ctx.suspend()
        else this.ctx.resume()
      })
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (!this.timer) this.startScheduler()
  }

  build() {
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.25
    this.master.connect(comp)
    comp.connect(ctx.destination)

    this.musicFilter = ctx.createBiquadFilter()
    this.musicFilter.type = 'lowpass'
    this.musicFilter.frequency.value = 18000
    this.musicFilter.connect(this.master)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicOn ? 1 : 0
    this.musicBus.connect(this.musicFilter)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.5
    this.musicGain.connect(this.musicBus)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = this.sfxOn ? 0.9 : 0
    this.sfx.connect(this.master)

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(3, 2.8)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.5
    this.reverb.connect(reverbOut)
    reverbOut.connect(this.musicBus)
    this.reverbSend = ctx.createGain()
    this.reverbSend.connect(this.reverb)
    // sfx get their own reverb return so muting music doesn't kill sfx tails
    this.sfxVerb = ctx.createConvolver()
    this.sfxVerb.buffer = this.reverb.buffer
    const sfxVerbOut = ctx.createGain()
    sfxVerbOut.gain.value = 0.4
    this.sfxVerb.connect(sfxVerbOut)
    sfxVerbOut.connect(this.sfx)

    this.delay = ctx.createDelay(1.5)
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const dFilter = ctx.createBiquadFilter()
    dFilter.type = 'lowpass'
    dFilter.frequency.value = 2400
    this.delay.connect(dFilter)
    dFilter.connect(fb)
    fb.connect(this.delay)
    dFilter.connect(this.musicGain)
    this.delaySend = ctx.createGain()
    this.delaySend.connect(this.delay)
    this.updateDelayTime()

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  get sixteenth() {
    return 60 / this.preset.bpm / 4
  }
  updateDelayTime() {
    if (this.delay) this.delay.delayTime.setValueAtTime(this.sixteenth * 3, this.ctx.currentTime)
  }

  // ---------------------------------------------------------------- settings
  setMusicEnabled(on) {
    this.musicOn = on
    if (!this.ctx) return
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08)
  }
  setSfxEnabled(on) {
    this.sfxOn = on
    if (!on) this.stopLoops()
    if (!this.ctx) return
    this.sfx.gain.cancelScheduledValues(this.ctx.currentTime)
    this.sfx.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05)
  }
  setMusicPreset(name) {
    const next = PRESETS[name] ?? PRESETS.subway
    if (next === this.preset) return
    this.preset = next
    if (this.ctx) {
      // restart the bar so the new progression starts cleanly
      this.step = 0
      this.updateDelayTime()
    }
  }
  setMusicMode(mode) {
    this.musicMode = mode
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const paused = mode === 'pause'
    this.musicFilter.frequency.cancelScheduledValues(t)
    this.musicFilter.frequency.setTargetAtTime(paused ? 650 : 18000, t, 0.25)
    this.musicGain.gain.cancelScheduledValues(t)
    this.musicGain.gain.setTargetAtTime(paused ? 0.32 : mode === 'run' ? 0.52 : 0.46, t, 0.3)
  }

  // ---------------------------------------------------------------- scheduler
  startScheduler() {
    this.nextTime = this.ctx.currentTime + 0.08
    this.timer = setInterval(() => this.tick(), 25)
  }

  tick() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05
    while (this.nextTime < ctx.currentTime + 0.12) {
      const p = this.preset
      const swing = this.step % 2 === 1 ? p.swing * this.sixteenth : 0
      if (this.musicOn) this.scheduleStep(this.step, this.nextTime + swing)
      this.step++
      this.nextTime += this.sixteenth
    }
  }

  scheduleStep(step, t) {
    const p = this.preset
    const mode = this.musicMode
    const chord = p.chords[Math.floor(step / 32) % p.chords.length]
    const inChord = step % 32
    const s16 = step % 16
    const groove = mode === 'run' || mode === 'pause'

    if (inChord === 0) this.pad(chord.pad, t, 32 * this.sixteenth, p.pad)

    if (groove) {
      const pl = p.pluck
      const on = pl.mask ? pl.mask[s16] : (step - (pl.offset ?? 0)) % pl.every === 0
      if (on) this.pluck(chord.arp[Math.floor(step / Math.max(1, pl.every)) % chord.arp.length], t, pl.vol, pl)
      if (p.kick[s16]) this.kick(t)
      if (p.snare[s16]) this.clap(t)
      if (p.hat[s16]) this.hat(t, p.hatVol ?? 0.04)
      if (p.perc?.[s16]) p.percType === 'metal' ? this.metal(t) : this.shaker(t)
      if (p.bassPat[s16]) this.bass(chord.bass + (s16 === 14 ? 12 : 0), t, p)
    } else if (step % 4 === 0 && Math.random() < 0.7) {
      this.pluck(chord.arp[(step / 4) % chord.arp.length], t, p.pluck.vol * 0.7, p.pluck)
    }
  }

  // ---------------------------------------------------------------- instruments
  env(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  pad(notes, t, dur, cfg) {
    const ctx = this.ctx
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cfg.cutoff * 0.5, t)
    filter.frequency.linearRampToValueAtTime(cfg.cutoff, t + dur * 0.5)
    filter.frequency.linearRampToValueAtTime(cfg.cutoff * 0.55, t + dur + 2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(cfg.vol, t + 1.4)
    g.gain.setValueAtTime(cfg.vol, t + dur - 0.2)
    g.gain.linearRampToValueAtTime(0, t + dur + 2.2)
    filter.connect(g)
    g.connect(this.musicGain)
    g.connect(this.reverbSend)
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator()
        o.type = cfg.type
        o.frequency.value = midi(n)
        o.detune.value = detune
        o.connect(filter)
        o.start(t)
        o.stop(t + dur + 2.4)
      }
    }
  }

  pluck(note, t, vol, cfg) {
    const ctx = this.ctx
    const g = ctx.createGain()
    this.env(g, t, vol, 0.004, cfg.decay)
    const o = ctx.createOscillator()
    o.type = cfg.type
    o.frequency.value = midi(note)
    o.connect(g)
    const o2 = ctx.createOscillator()
    if (cfg.harm === 'sine3') {
      o2.type = 'sine'
      o2.frequency.value = midi(note) * 3
    } else {
      o2.type = cfg.harm ?? 'sine'
      o2.frequency.value = midi(note + 12)
    }
    const g2 = ctx.createGain()
    g2.gain.value = cfg.harm === 'sine3' ? 0.25 : 0.35
    o2.connect(g2)
    g2.connect(g)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 3200
    g.connect(f)
    f.connect(this.musicGain)
    f.connect(this.delaySend)
    f.connect(this.reverbSend)
    o.start(t)
    o2.start(t)
    o.stop(t + cfg.decay + 0.1)
    o2.stop(t + cfg.decay + 0.1)
  }

  kick(t) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    this.env(g, t, 0.55, 0.003, 0.3)
    o.connect(g)
    g.connect(this.musicGain)
    o.start(t)
    o.stop(t + 0.4)
  }

  noiseHit(t, { type = 'highpass', freq = 7000, q = 0.7, vol = 0.05, decay = 0.05, dest, sweepTo, sweepTime, verb }) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + (sweepTime ?? decay))
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, t, vol, 0.003, decay)
    src.connect(f)
    f.connect(g)
    g.connect(dest ?? this.musicGain)
    if (verb) g.connect(verb)
    src.start(t, Math.random() * 1.5)
    src.stop(t + decay + 0.05)
    return g
  }

  hat(t, vol) {
    this.noiseHit(t, { type: 'highpass', freq: 7500, vol, decay: 0.045 })
  }
  shaker(t) {
    this.noiseHit(t, { type: 'bandpass', freq: 9000, q: 1.2, vol: 0.022, decay: 0.06 })
  }
  metal(t) {
    this.noiseHit(t, { type: 'bandpass', freq: 3300 + Math.random() * 400, q: 18, vol: 0.18, decay: 0.22, verb: this.reverbSend })
  }
  clap(t) {
    this.noiseHit(t, { type: 'bandpass', freq: 1600, q: 0.9, vol: 0.12, decay: 0.18, verb: this.reverbSend })
  }

  bass(note, t, p) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = p.bassType
    o.frequency.value = midi(note)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(p.bassCut, t)
    f.frequency.exponentialRampToValueAtTime(p.bassCut * 0.35, t + 0.2)
    const g = ctx.createGain()
    this.env(g, t, p.bassType === 'sine' ? 0.26 : 0.15, 0.005, 0.22)
    o.connect(f)
    f.connect(g)
    g.connect(this.musicGain)
    o.start(t)
    o.stop(t + 0.3)
  }

  tone(t, { type = 'sine', freq, to, time = 0.1, vol = 0.1, decay = 0.2, attack = 0.004, reverb = false }) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + time)
    const g = ctx.createGain()
    this.env(g, t, vol, attack, decay)
    o.connect(g)
    g.connect(this.sfx)
    if (reverb) g.connect(this.sfxVerb)
    o.start(t)
    o.stop(t + attack + decay + 0.05)
    return o
  }

  // ---------------------------------------------------------------- loops
  startLoop(name) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running' || this.loops[name]) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    const nodes = [src]
    if (name === 'skate') {
      f.type = 'bandpass'
      f.frequency.value = 520
      f.Q.value = 0.8
      g.gain.linearRampToValueAtTime(0.09, t + 0.2)
    } else if (name === 'jet') {
      f.type = 'lowpass'
      f.frequency.value = 900
      f.Q.value = 0.6
      g.gain.linearRampToValueAtTime(0.16, t + 0.3)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 13
      const lg = ctx.createGain()
      lg.gain.value = 0.03
      lfo.connect(lg)
      lg.connect(g.gain)
      lfo.start(t)
      nodes.push(lfo)
    }
    src.connect(f)
    f.connect(g)
    g.connect(this.sfx)
    src.start(t)
    this.loops[name] = { nodes, g, f }
  }
  setLoop(name, { vol, freq }) {
    const l = this.loops[name]
    if (!l) return
    const t = this.ctx.currentTime
    if (vol != null) l.g.gain.setTargetAtTime(vol, t, 0.08)
    if (freq != null) l.f.frequency.setTargetAtTime(freq, t, 0.08)
  }
  stopLoop(name) {
    const l = this.loops[name]
    if (!l) return
    const t = this.ctx.currentTime
    l.g.gain.cancelScheduledValues(t)
    l.g.gain.setTargetAtTime(0, t, 0.06)
    l.nodes.forEach((n) => n.stop(t + 0.4))
    delete this.loops[name]
  }
  stopLoops() {
    Object.keys(this.loops).forEach((n) => this.stopLoop(n))
  }

  // ---------------------------------------------------------------- sfx
  play(name, opts = {}) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime + 0.005
    const sfx = this.sfx
    const n = (o) => this.noiseHit(t + (o.at ?? 0), { dest: sfx, ...o })
    switch (name) {
      case 'hover':
        this.tone(t, { freq: 1700, vol: 0.022, decay: 0.04 })
        break
      case 'click':
        this.tone(t, { freq: 880, to: 1320, time: 0.05, vol: 0.08, decay: 0.08 })
        this.tone(t + 0.035, { freq: 1760, vol: 0.035, decay: 0.12, reverb: true })
        break
      case 'error':
        this.tone(t, { type: 'square', freq: 180, vol: 0.05, decay: 0.12 })
        this.tone(t + 0.12, { type: 'square', freq: 140, vol: 0.05, decay: 0.16 })
        break
      case 'start':
        ;[64, 69, 76, 81].forEach((m, i) => this.tone(t + i * 0.05, { type: 'triangle', freq: midi(m), vol: 0.06, decay: 0.9, reverb: true }))
        n({ type: 'bandpass', freq: 400, sweepTo: 3200, sweepTime: 0.5, q: 1.2, vol: 0.09, decay: 0.55 })
        break
      case 'jump':
        this.tone(t, { freq: 240, to: 640, time: 0.16, vol: 0.11, decay: 0.2 })
        n({ type: 'bandpass', freq: 700, sweepTo: 2600, sweepTime: 0.18, q: 1.4, vol: 0.05, decay: 0.2 })
        break
      case 'superjump':
        this.tone(t, { type: 'triangle', freq: 180, to: 1100, time: 0.35, vol: 0.12, decay: 0.4 })
        this.tone(t + 0.02, { freq: 520, to: 1560, time: 0.3, vol: 0.05, decay: 0.35, reverb: true })
        break
      case 'land':
        this.tone(t, { freq: 120, to: 50, time: 0.1, vol: 0.16, decay: 0.12 })
        n({ type: 'lowpass', freq: 900, vol: 0.05, decay: 0.09 })
        break
      case 'roof':
        this.tone(t, { freq: 160, to: 70, time: 0.12, vol: 0.14, decay: 0.15 })
        n({ type: 'bandpass', freq: 2400, q: 6, vol: 0.06, decay: 0.25, verb: this.sfxVerb })
        break
      case 'slide':
        n({ type: 'bandpass', freq: 2200, sweepTo: 450, sweepTime: 0.45, q: 0.9, vol: 0.1, decay: 0.45 })
        break
      case 'swoosh':
        n({ type: 'bandpass', freq: 600, sweepTo: 2400, sweepTime: 0.13, q: 1.6, vol: 0.05, decay: 0.15 })
        break
      case 'trainpass':
        n({ type: 'lowpass', freq: 300, sweepTo: 1600, sweepTime: 0.5, q: 0.7, vol: 0.18, decay: 0.8 })
        this.tone(t, { type: 'sawtooth', freq: 330, to: 290, time: 0.6, vol: 0.03, decay: 0.7 })
        break
      case 'step': {
        this.stepFlip = !this.stepFlip
        const metal = opts.surface === 'train'
        n({ type: 'bandpass', freq: metal ? 2600 : this.stepFlip ? 1100 : 1400, q: metal ? 4 : 1.1, vol: metal ? 0.04 : 0.032, decay: metal ? 0.06 : 0.035 })
        this.tone(t, { freq: this.stepFlip ? 85 : 95, vol: 0.045, decay: 0.05 })
        break
      }
      case 'coin': {
        const m = COIN_NOTES[(opts.combo ?? 0) % COIN_NOTES.length]
        this.tone(t, { type: 'square', freq: midi(m), vol: 0.028, decay: 0.08 })
        this.tone(t + 0.055, { freq: midi(m + 7), vol: 0.05, decay: 0.22, reverb: true })
        break
      }
      case 'power':
        ;[72, 76, 79, 84, 88].forEach((m, i) => this.tone(t + i * 0.05, { type: 'triangle', freq: midi(m), vol: 0.06, decay: 0.4, reverb: true }))
        if (opts.type === 'jetpack') n({ type: 'lowpass', freq: 300, sweepTo: 2000, sweepTime: 0.5, vol: 0.2, decay: 0.7 })
        if (opts.type === 'sneakers') this.tone(t, { freq: 200, to: 900, time: 0.25, vol: 0.08, decay: 0.3 })
        if (opts.type === 'magnet') this.tone(t, { type: 'sawtooth', freq: 120, to: 480, time: 0.4, vol: 0.04, decay: 0.45 })
        break
      case 'ollie':
        n({ type: 'highpass', freq: 1800, vol: 0.12, decay: 0.05 })
        this.tone(t, { freq: 320, to: 180, time: 0.06, vol: 0.12, decay: 0.08 })
        break
      case 'boardland':
        this.tone(t, { freq: 140, to: 60, time: 0.08, vol: 0.18, decay: 0.1 })
        n({ type: 'bandpass', freq: 1400, q: 2, vol: 0.12, decay: 0.08 })
        break
      case 'boardon':
        n({ type: 'bandpass', freq: 300, sweepTo: 1500, sweepTime: 0.3, q: 1, vol: 0.12, decay: 0.35 })
        this.tone(t, { type: 'triangle', freq: midi(67), vol: 0.06, decay: 0.3, reverb: true })
        this.tone(t + 0.08, { type: 'triangle', freq: midi(74), vol: 0.06, decay: 0.35, reverb: true })
        break
      case 'boardbreak':
        n({ type: 'bandpass', freq: 2000, q: 1.5, vol: 0.25, decay: 0.35 })
        this.tone(t, { type: 'square', freq: 400, to: 90, time: 0.3, vol: 0.06, decay: 0.3 })
        break
      case 'stumble':
        this.tone(t, { freq: 150, to: 60, time: 0.18, vol: 0.32, decay: 0.25 })
        n({ type: 'lowpass', freq: 2200, sweepTo: 400, sweepTime: 0.3, vol: 0.18, decay: 0.32 })
        break
      case 'whistle': {
        const o = this.tone(t, { freq: 2900, vol: 0.05, decay: 0.55, attack: 0.02 })
        const lfo = this.ctx.createOscillator()
        lfo.frequency.value = 38
        const lg = this.ctx.createGain()
        lg.gain.value = 140
        lfo.connect(lg)
        lg.connect(o.frequency)
        lfo.start(t)
        lfo.stop(t + 0.6)
        this.tone(t + 0.62, { freq: 2900, vol: 0.05, decay: 0.3, attack: 0.02 })
        break
      }
      case 'crash':
        this.tone(t, { freq: 130, to: 32, time: 0.5, vol: 0.5, decay: 0.6 })
        this.tone(t, { type: 'square', freq: 210, to: 90, time: 0.3, vol: 0.05, decay: 0.3 })
        n({ type: 'lowpass', freq: 3200, sweepTo: 300, sweepTime: 0.6, q: 0.6, vol: 0.36, decay: 0.7 })
        n({ type: 'bandpass', freq: 4200, q: 3, vol: 0.06, decay: 0.9, verb: this.sfxVerb })
        break
      case 'caught':
        ;[70, 66, 63].forEach((m, i) => this.tone(t + i * 0.16, { type: 'square', freq: midi(m), vol: 0.05, decay: 0.25 }))
        break
      case 'gameover':
        ;[76, 72, 69, 64].forEach((m, i) => this.tone(t + i * 0.2, { type: 'triangle', freq: midi(m), vol: 0.06, decay: 1.2, reverb: true }))
        break
      case 'milestone':
        this.tone(t, { freq: midi(84), vol: 0.06, decay: 0.6, reverb: true })
        this.tone(t + 0.12, { freq: midi(91), vol: 0.05, decay: 0.8, reverb: true })
        break
      case 'mission':
        ;[72, 76, 79, 84].forEach((m, i) => this.tone(t + i * 0.08, { type: 'triangle', freq: midi(m), vol: 0.07, decay: 0.5, reverb: true }))
        break
      case 'levelup':
        ;[60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(t + i * 0.07, { type: 'triangle', freq: midi(m), vol: 0.07, decay: 0.7, reverb: true }))
        break
      case 'purchase':
        this.tone(t, { type: 'square', freq: midi(88), vol: 0.03, decay: 0.07 })
        this.tone(t + 0.07, { freq: midi(95), vol: 0.07, decay: 0.45, reverb: true })
        n({ type: 'highpass', freq: 6000, vol: 0.04, decay: 0.2, at: 0.07 })
        break
      case 'reward':
        ;[79, 84, 88, 91].forEach((m, i) => this.tone(t + i * 0.06, { freq: midi(m), vol: 0.06, decay: 0.5, reverb: true }))
        break
      default:
        break
    }
  }
}

export const audio = new AudioEngine()
