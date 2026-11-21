import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Footprints, Magnet, Pause, Rocket, Siren, Zap } from 'lucide-react'
import { HEAT_DURATION } from '../game/constants'
import { POWER_KEYS, events, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { pushAction } from '../game/input'
import { audio } from '../game/audio'
import { BoardIcon, CoinIcon, IconButton } from './Buttons'

const fmt = (n) => Math.floor(n).toLocaleString('en-US')
const POWER_UI = {
  magnet: { icon: Magnet, label: 'Magnet', color: '#ff4d5e' },
  sneakers: { icon: Footprints, label: 'Sneakers', color: '#7dff5a' },
  jetpack: { icon: Rocket, label: 'Jetpack', color: '#ff9a3c' },
  double: { icon: Zap, label: '2× Score', color: '#ffd23f' },
  board: { icon: BoardIcon, label: 'Board', color: '#5ad7ff' },
}

const pop = (el) => {
  if (!el) return
  el.classList.remove('pop')
  void el.offsetWidth
  el.classList.add('pop')
}

/**
 * Heads-up display. Values are written straight to DOM nodes from a rAF loop,
 * so the HUD never re-renders while the game runs.
 */
export default function HUD() {
  const pause = useGame((s) => s.pause)
  const boards = useGame((s) => s.profile.boards)
  const jets = useGame((s) => s.profile.jets)
  const refs = useRef({})
  const r = (k) => (el) => {
    refs.current[k] = el
  }
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 5200)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => events.on('coin', () => pop(refs.current.coinWrap)), [])

  useEffect(() => {
    let raf
    const last = { score: -1, dist: -1, coins: -1, mult: -1 }
    const loop = () => {
      const R = refs.current
      const score = Math.floor(runtime.score)
      const dist = Math.floor(runtime.distance)
      if (score !== last.score && R.score) R.score.textContent = fmt(score)
      if (dist !== last.dist) {
        if (R.dist) R.dist.textContent = fmt(dist)
        if (R.distM) R.distM.textContent = `${fmt(dist)} m`
      }
      if (runtime.coins !== last.coins && R.coins) R.coins.textContent = fmt(runtime.coins)
      if (runtime.multiplier !== last.mult && R.mult) {
        R.mult.textContent = `×${runtime.multiplier}`
        if (last.mult >= 0) pop(R.multWrap)
      }
      for (const k of POWER_KEYS) {
        const chip = R[`p-${k}`]
        if (!chip) continue
        const f = runtime.power[k] / runtime.powerMax[k]
        chip.style.opacity = f > 0 ? '1' : '0'
        chip.style.transform = `translateX(${f > 0 ? 0 : -12}px)`
        chip.style.display = f > 0 ? 'flex' : 'none'
        R[`b-${k}`].style.transform = `scaleX(${f})`
      }
      // officer alert
      const heat = runtime.chase.heat
      if (R.alert) {
        const on = heat > 0 && !runtime.crashed
        R.alert.style.opacity = on ? '1' : '0'
        R.alert.style.transform = `translate(-50%, ${on ? 0 : -8}px)`
        R.heat.style.transform = `scaleX(${heat / HEAT_DURATION})`
        const blink = Math.floor(performance.now() / 260) % 2
        R.siren.style.opacity = on ? '1' : '0'
        R.siren.style.boxShadow = on ? `inset ${blink ? '' : '-'}60px 0 80px -40px ${blink ? 'rgba(255,40,60,0.55)' : 'rgba(40,110,255,0.55)'}` : 'none'
      }
      if (R.boardBtn) R.boardBtn.style.opacity = runtime.power.board > 0 ? '0.45' : '1'
      last.score = score
      last.dist = dist
      last.coins = runtime.coins
      last.mult = runtime.multiplier
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const [crashed, setCrashed] = useState(false)
  useEffect(() => events.on('crash', () => setCrashed(true)), [])

  const press = (action) => (e) => {
    e.stopPropagation()
    audio.unlock()
    pushAction(action)
  }

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: crashed ? 0 : 1, transition: { duration: crashed ? 1.1 : 0.8, delay: crashed ? 0.3 : 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div ref={r('siren')} className="absolute inset-0 transition-opacity duration-300" style={{ opacity: 0 }} />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink/60 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <div className="min-w-0">
          <div className="text-[0.54rem] font-semibold uppercase tracking-[0.45em] text-mist/70">Score</div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span ref={r('score')} className="tabular font-display text-glow text-[clamp(1.9rem,5vw,3.2rem)] leading-none text-silver">
              0
            </span>
            <span ref={r('multWrap')} className="inline-block rounded-full border border-azure/40 bg-azure/15 px-2.5 py-0.5 text-[0.75rem] font-bold text-azure">
              <span ref={r('mult')} className="tabular">
                ×1
              </span>
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {POWER_KEYS.map((k) => {
              const ui = POWER_UI[k]
              return (
                <div
                  key={k}
                  ref={r(`p-${k}`)}
                  className="w-40 items-center gap-2 rounded-full border bg-ink/55 px-3 py-1.5 backdrop-blur-md transition-[opacity,transform] duration-300"
                  style={{ opacity: 0, display: 'none', borderColor: `${ui.color}66` }}
                >
                  <ui.icon className="h-3.5 w-3.5 shrink-0" style={{ color: ui.color }} strokeWidth={2} />
                  <span className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-silver">{ui.label}</span>
                  <div className="ml-auto h-[3px] w-12 overflow-hidden rounded-full bg-white/10">
                    <div ref={r(`b-${k}`)} className="h-full origin-left rounded-full" style={{ background: ui.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="absolute left-1/2 top-[max(0.9rem,env(safe-area-inset-top))] hidden -translate-x-1/2 text-center sm:top-6 md:block">
          <div className="text-[0.54rem] font-semibold uppercase tracking-[0.45em] text-mist/70">Distance</div>
          <div className="mt-1 font-display text-[2.1rem] leading-none text-silver">
            <span ref={r('dist')} className="tabular">
              0
            </span>
            <span className="ml-1 text-lg text-mist/60">m</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div ref={r('coinWrap')} className="flex h-11 items-center gap-2 rounded-full border border-[#ffc93c]/30 bg-ink/50 pl-1.5 pr-4 backdrop-blur-md">
            <CoinIcon className="h-7 w-7" />
            <span ref={r('coins')} className="tabular text-[1.05rem] font-bold text-[#ffe08a]">
              0
            </span>
          </div>
          <IconButton onClick={pause} label="Pause">
            <Pause className="h-4 w-4" strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      {/* officer alert */}
      <div
        ref={r('alert')}
        className="absolute left-1/2 top-[max(4.6rem,calc(env(safe-area-inset-top)+3.8rem))] flex w-56 -translate-x-1/2 flex-col items-center rounded-2xl border border-[#ff4d6d]/50 bg-ink/70 px-4 py-2 backdrop-blur-md transition-[opacity,transform] duration-200 md:top-[6.6rem]"
        style={{ opacity: 0 }}
      >
        <div className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.3em] text-[#ff8fa3]">
          <Siren className="h-4 w-4" /> Officer on your tail
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div ref={r('heat')} className="h-full origin-left rounded-full bg-gradient-to-r from-[#ff4d6d] to-[#4d7bff]" />
        </div>
      </div>

      {/* action buttons (always available; essential on touch screens) */}
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 flex flex-col items-end gap-2.5 sm:bottom-8 sm:right-8">
        {jets > 0 && (
          <button
            type="button"
            onPointerDown={press('jet')}
            className="pointer-events-auto flex h-14 items-center gap-2 rounded-full border border-[#ff9a3c]/50 bg-ink/60 pl-3 pr-4 text-silver backdrop-blur-md active:scale-95"
            aria-label="Jet launch"
          >
            <Rocket className="h-6 w-6 text-[#ff9a3c]" />
            <span className="text-left leading-tight">
              <span className="block text-[0.52rem] uppercase tracking-[0.2em] text-mist/70">Jet · Q</span>
              <span className="block text-sm font-bold">{jets}</span>
            </span>
          </button>
        )}
        <button
          ref={r('boardBtn')}
          type="button"
          onPointerDown={press('board')}
          disabled={boards <= 0}
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full border border-[#5ad7ff]/50 bg-ink/60 pl-3 pr-4 text-silver backdrop-blur-md active:scale-95 disabled:opacity-35"
          aria-label="Ride skateboard"
        >
          <BoardIcon className="h-7 w-7 text-[#5ad7ff]" />
          <span className="text-left leading-tight">
            <span className="block text-[0.52rem] uppercase tracking-[0.2em] text-mist/70">Board · E</span>
            <span className="block text-sm font-bold">{boards}</span>
          </span>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-[max(1.1rem,env(safe-area-inset-bottom))] text-center md:hidden">
        <span ref={r('distM')} className="tabular font-display text-xl text-mist/85">
          0 m
        </span>
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div className="absolute inset-x-0 bottom-[27vh] flex justify-center px-4 sm:bottom-[16vh]" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }} exit={{ opacity: 0, y: 8 }}>
            <div className="glass-panel rounded-full px-6 py-3 text-center text-[0.6rem] uppercase tracking-[0.25em] text-mist/85">
              <span className="hidden [@media(pointer:fine)]:inline">← → lanes · ↑ jump · ↓ slide · E skateboard · Q jet</span>
              <span className="[@media(pointer:fine)]:hidden">Swipe to move · double-tap for a skateboard</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
