// Fully procedural audio: a generative ambient-electronic score plus synthesized SFX.
// Nothing is downloaded — every sound is built from oscillators and noise.

const BPM = 104
const SIXTEENTH = 60 / BPM / 4
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)

// Am9 → Fmaj7 → Cadd9 → Em7, two bars each
const CHORDS = [
  { bass: 33, pad: [57, 60, 64, 71], arp: [69, 72, 76, 79, 81, 76, 72, 79] },
  { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76, 77, 72, 69, 76] },
  { bass: 36, pad: [55, 60, 62, 64], arp: [67, 72, 74, 76, 79, 74, 72, 76] },
  { bass: 28, pad: [55, 59, 62, 64], arp: [64, 67, 71, 74, 76, 71, 67, 74] },
]
const COLLECT_NOTES = [76, 79, 81, 83, 86, 88, 91, 93]

class AudioEngine {
  constructor() {
    this.ctx = null
    this.enabled = true
    this.musicMode = 'menu'
    this.step = 0
    this.nextTime = 0
    this.timer = null
    this.stepFlip = false
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
        else if (this.enabled) this.ctx.resume()
      })
    }
    if (this.ctx.state === 'suspended' && this.enabled) this.ctx.resume()
    if (!this.timer) this.startScheduler()
  }

  build() {
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.enabled ? 0.85 : 0
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
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.5
    this.musicGain.connect(this.musicFilter)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.9
    this.sfx.connect(this.master)

    // Reverb
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(3.4, 2.8)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.55
    this.reverb.connect(reverbOut)
    reverbOut.connect(this.musicFilter)
    this.reverbSend = ctx.createGain()
    this.reverbSend.connect(this.reverb)

    // Dotted-eighth delay
    this.delay = ctx.createDelay(1.5)
    this.delay.delayTime.value = SIXTEENTH * 3
    const fb = ctx.createGain()
    fb.gain.value = 0.36
    const dFilter = ctx.createBiquadFilter()
    dFilter.type = 'lowpass'
    dFilter.frequency.value = 2400
    this.delay.connect(dFilter)
    dFilter.connect(fb)
    fb.connect(this.delay)
    dFilter.connect(this.musicGain)
    this.delaySend = ctx.createGain()
    this.delaySend.connect(this.delay)

    // Shared white noise buffer
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

  setEnabled(on) {
    this.enabled = on
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, t, 0.06)
    if (on && this.ctx.state === 'suspended') this.ctx.resume()
  }

  setMusicMode(mode) {
    this.musicMode = mode
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const paused = mode === 'pause'
    this.musicFilter.frequency.cancelScheduledValues(t)
    this.musicFilter.frequency.setTargetAtTime(paused ? 650 : 18000, t, 0.25)
    this.musicGain.gain.cancelScheduledValues(t)
    this.musicGain.gain.setTargetAtTime(paused ? 0.32 : mode === 'run' ? 0.55 : 0.5, t, 0.3)
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
      if (this.enabled) this.scheduleStep(this.step, this.nextTime)
      this.step++
      this.nextTime += SIXTEENTH
    }
  }

  scheduleStep(step, t) {
    const mode = this.musicMode
    if (mode === 'off') return
    const chord = CHORDS[Math.floor(step / 32) % CHORDS.length]
    const inChord = step % 32
    const groove = mode === 'run' || mode === 'pause'

    if (inChord === 0) this.pad(chord.pad, t, 32 * SIXTEENTH)

    if (groove) {
      if (step % 2 === 0) this.pluck(chord.arp[(step / 2) % chord.arp.length], t, 0.055)
      if (step % 4 === 0) this.kick(t)
      if (step % 4 === 2) this.hat(t, 0.045)
      if (step % 2 === 1 && Math.random() < 0.35) this.hat(t, 0.018)
      if (step % 16 === 4 || step % 16 === 12) this.clap(t)
      if (step % 2 === 0) this.bass(chord.bass + (step % 8 === 6 ? 12 : 0), t)
    } else if (step % 4 === 0 && Math.random() < 0.7) {
      this.pluck(chord.arp[(step / 4) % chord.arp.length], t, 0.04)
    }
  }

  // ------------------------------------------------------------ instruments
  env(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  pad(notes, t, dur) {
    const ctx = this.ctx
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600, t)
    filter.frequency.linearRampToValueAtTime(1500, t + dur * 0.5)
    filter.frequency.linearRampToValueAtTime(700, t + dur + 2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05, t + 1.6)
    g.gain.setValueAtTime(0.05, t + dur - 0.2)
    g.gain.linearRampToValueAtTime(0, t + dur + 2.4)
    filter.connect(g)
    g.connect(this.musicGain)
    g.connect(this.reverbSend)
    for (const n of notes) {
      for (const detune of [-8, 8]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midi(n)
        o.detune.value = detune
        o.connect(filter)
        o.start(t)
        o.stop(t + dur + 2.6)
      }
    }
  }

  pluck(note, t, vol) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = midi(note)
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = midi(note + 12)
    const g = ctx.createGain()
    this.env(g, t, vol, 0.004, 0.42)
    o.connect(g)
    o2.connect(g)
    g.connect(this.musicGain)
    g.connect(this.delaySend)
    g.connect(this.reverbSend)
    o.start(t)
    o2.start(t)
    o.stop(t + 0.5)
    o2.stop(t + 0.5)
  }

  kick(t) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    this.env(g, t, 0.5, 0.003, 0.32)
    o.connect(g)
    g.connect(this.musicGain)
    o.start(t)
    o.stop(t + 0.4)
  }

  noiseHit(t, { type = 'highpass', freq = 7000, q = 0.7, vol = 0.05, decay = 0.05, dest, sweepTo, sweepTime }) {
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
    src.start(t, Math.random() * 1.5)
    src.stop(t + decay + 0.05)
    return g
  }

  hat(t, vol) {
    this.noiseHit(t, { type: 'highpass', freq: 7500, vol, decay: 0.045 })
  }

  clap(t) {
    const g = this.noiseHit(t, { type: 'bandpass', freq: 1600, q: 0.9, vol: 0.12, decay: 0.2 })
    g.connect(this.reverbSend)
  }

  bass(note, t) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = midi(note)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(520, t)
    f.frequency.exponentialRampToValueAtTime(160, t + 0.2)
    const g = ctx.createGain()
    this.env(g, t, 0.16, 0.005, 0.22)
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
    if (reverb) g.connect(this.reverbSend)
    o.start(t)
    o.stop(t + attack + decay + 0.05)
  }

  // ------------------------------------------------------------------- sfx
  play(name, opts = {}) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime + 0.005
    const sfx = this.sfx
    switch (name) {
      case 'hover':
        this.tone(t, { freq: 1700, vol: 0.025, decay: 0.04 })
        break
      case 'click':
        this.tone(t, { freq: 880, to: 1320, time: 0.05, vol: 0.09, decay: 0.08 })
        this.tone(t + 0.035, { freq: 1760, vol: 0.04, decay: 0.12, reverb: true })
        break
      case 'start':
        ;[64, 69, 76, 81].forEach((n, i) =>
          this.tone(t + i * 0.05, { type: 'triangle', freq: midi(n), vol: 0.07, decay: 0.9, reverb: true }),
        )
        this.noiseHit(t, { type: 'bandpass', freq: 400, sweepTo: 3200, sweepTime: 0.5, q: 1.2, vol: 0.09, decay: 0.55, dest: sfx })
        break
      case 'jump':
        this.tone(t, { freq: 240, to: 640, time: 0.16, vol: 0.12, decay: 0.2 })
        this.noiseHit(t, { type: 'bandpass', freq: 700, sweepTo: 2600, sweepTime: 0.18, q: 1.4, vol: 0.06, decay: 0.2, dest: sfx })
        break
      case 'land':
        this.tone(t, { freq: 120, to: 50, time: 0.1, vol: 0.18, decay: 0.12 })
        this.noiseHit(t, { type: 'lowpass', freq: 900, vol: 0.05, decay: 0.09, dest: sfx })
        break
      case 'slide':
        this.noiseHit(t, { type: 'bandpass', freq: 2200, sweepTo: 450, sweepTime: 0.45, q: 0.9, vol: 0.1, decay: 0.45, dest: sfx })
        break
      case 'swoosh':
        this.noiseHit(t, { type: 'bandpass', freq: 600, sweepTo: 2400, sweepTime: 0.13, q: 1.6, vol: 0.06, decay: 0.15, dest: sfx })
        break
      case 'step': {
        this.stepFlip = !this.stepFlip
        this.noiseHit(t, { type: 'bandpass', freq: this.stepFlip ? 1100 : 1400, q: 1.1, vol: 0.035, decay: 0.035, dest: sfx })
        this.tone(t, { freq: this.stepFlip ? 85 : 95, vol: 0.05, decay: 0.05 })
        break
      }
      case 'collect': {
        const n = COLLECT_NOTES[(opts.combo ?? 0) % COLLECT_NOTES.length]
        this.tone(t, { freq: midi(n), vol: 0.075, decay: 0.35, reverb: true })
        this.tone(t, { freq: midi(n + 12) * 1.003, vol: 0.035, decay: 0.25 })
        break
      }
      case 'power':
        ;[72, 76, 79, 84, 88].forEach((n, i) =>
          this.tone(t + i * 0.055, { type: 'triangle', freq: midi(n), vol: 0.07, decay: 0.45, reverb: true }),
        )
        break
      case 'milestone':
        this.tone(t, { freq: midi(84), vol: 0.06, decay: 0.6, reverb: true })
        this.tone(t + 0.12, { freq: midi(91), vol: 0.05, decay: 0.8, reverb: true })
        break
      case 'crash': {
        this.tone(t, { freq: 130, to: 32, time: 0.5, vol: 0.5, decay: 0.6 })
        this.tone(t, { type: 'square', freq: 210, to: 90, time: 0.3, vol: 0.06, decay: 0.3 })
        this.noiseHit(t, { type: 'lowpass', freq: 3200, sweepTo: 300, sweepTime: 0.6, q: 0.6, vol: 0.38, decay: 0.7, dest: sfx })
        const g = this.noiseHit(t, { type: 'bandpass', freq: 4200, q: 3, vol: 0.06, decay: 0.9, dest: sfx })
        g.connect(this.reverbSend)
        break
      }
      case 'gameover':
        ;[76, 72, 69, 64].forEach((n, i) =>
          this.tone(t + i * 0.2, { type: 'triangle', freq: midi(n), vol: 0.06, decay: 1.2, reverb: true }),
        )
        break
      default:
        break
    }
  }
}

export const audio = new AudioEngine()
