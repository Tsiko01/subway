import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Gem, Magnet, Pause, Zap } from 'lucide-react'
import { BOOST_DURATION, MAGNET_DURATION, ZONES, ZONE_LENGTH } from '../game/constants'
import { events, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { IconButton } from './Buttons'

const fmt = (n) => Math.floor(n).toLocaleString('en-US')

/**
 * Heads-up display. Values are written straight to DOM nodes from a rAF loop,
 * so the HUD never re-renders while the game runs.
 */
export default function HUD() {
  const pause = useGame((s) => s.pause)
  const refs = useRef({})
  const r = (k) => (el) => {
    refs.current[k] = el
  }
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 4800)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    let raf
    const last = { score: -1, dist: -1, gems: -1, mult: -1, zone: -1 }
    const loop = () => {
      const R = refs.current
      const score = Math.floor(runtime.score)
      const dist = Math.floor(runtime.distance)
      if (score !== last.score && R.score) R.score.textContent = fmt(score)
      if (dist !== last.dist && R.dist) R.dist.textContent = fmt(dist)
      if (runtime.gems !== last.gems && R.gems) {
        R.gems.textContent = fmt(runtime.gems)
        if (last.gems >= 0 && R.gemWrap) {
          R.gemWrap.classList.remove('pop')
          void R.gemWrap.offsetWidth
          R.gemWrap.classList.add('pop')
        }
      }
      if (runtime.multiplier !== last.mult && R.mult) {
        R.mult.textContent = `×${runtime.multiplier}`
        R.multWrap.style.opacity = runtime.multiplier > 1 ? '1' : '0.55'
        if (last.mult >= 0) {
          R.multWrap.classList.remove('pop')
          void R.multWrap.offsetWidth
          R.multWrap.classList.add('pop')
        }
      }
      // zone progress
      const zi = Math.floor(runtime.distance / ZONE_LENGTH)
      if (zi !== last.zone && R.zone) {
        R.zone.textContent = ZONES[zi % ZONES.length].name
        R.next.textContent = ZONES[(zi + 1) % ZONES.length].name
      }
      if (R.progress) R.progress.style.transform = `scaleX(${(runtime.distance % ZONE_LENGTH) / ZONE_LENGTH})`
      // power-ups
      if (R.magnet) {
        const m = runtime.magnetTime / MAGNET_DURATION
        R.magnet.style.opacity = m > 0 ? '1' : '0'
        R.magnet.style.transform = `translateY(${m > 0 ? 0 : -6}px)`
        R.magnetBar.style.transform = `scaleX(${m})`
      }
      if (R.boost) {
        const b = runtime.boostTime / BOOST_DURATION
        R.boost.style.opacity = b > 0 ? '1' : '0'
        R.boost.style.transform = `translateY(${b > 0 ? 0 : -6}px)`
        R.boostBar.style.transform = `scaleX(${b})`
      }
      last.score = score
      last.dist = dist
      last.gems = runtime.gems
      last.mult = runtime.multiplier
      last.zone = zi
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // hide the HUD a moment after a crash so the game-over screen takes the stage
  const [crashed, setCrashed] = useState(false)
  useEffect(() => events.on('crash', () => setCrashed(true)), [])

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: crashed ? 0 : 1, transition: { duration: crashed ? 1.2 : 0.8, delay: crashed ? 0.3 : 0.5 } }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/70 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
        {/* score */}
        <div className="min-w-0">
          <div className="text-[0.56rem] font-semibold uppercase tracking-[0.45em] text-mist/60">Score</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span ref={r('score')} className="tabular font-display text-[clamp(2rem,5.4vw,3.4rem)] leading-none text-silver text-glow">
              0
            </span>
            <span
              ref={r('multWrap')}
              className="inline-block rounded-full border border-azure/40 bg-azure/10 px-2.5 py-0.5 text-[0.75rem] font-bold text-azure"
            >
              <span ref={r('mult')} className="tabular">
                ×1
              </span>
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <PowerChip refKey="magnet" barKey="magnetBar" setRef={r} icon={Magnet} label="Magnet" />
            <PowerChip refKey="boost" barKey="boostBar" setRef={r} icon={Zap} label="Double" />
          </div>
        </div>

        {/* distance + zone */}
        <div className="absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] hidden -translate-x-1/2 text-center sm:top-7 md:block">
          <div className="text-[0.56rem] font-semibold uppercase tracking-[0.45em] text-mist/60">Distance</div>
          <div className="mt-1 font-display text-[2.2rem] leading-none text-silver">
            <span ref={r('dist')} className="tabular">
              0
            </span>
            <span className="ml-1 text-lg text-mist/60">m</span>
          </div>
          <div className="mt-3 w-56">
            <div className="flex justify-between text-[0.52rem] uppercase tracking-[0.3em] text-mist/50">
              <span ref={r('zone')}>{ZONES[0].name}</span>
              <span ref={r('next')}>{ZONES[1].name}</span>
            </div>
            <div className="mt-1.5 h-px w-full bg-white/10">
              <div ref={r('progress')} className="h-px origin-left bg-gradient-to-r from-azure/40 to-azure" style={{ transform: 'scaleX(0)' }} />
            </div>
          </div>
        </div>

        {/* gems + pause */}
        <div className="flex items-start gap-3">
          <div className="text-right">
            <div className="text-[0.56rem] font-semibold uppercase tracking-[0.45em] text-mist/60">Drops</div>
            <div ref={r('gemWrap')} className="mt-1 flex items-center justify-end gap-2">
              <Gem className="h-5 w-5 text-azure drop-shadow-[0_0_8px_rgba(127,176,255,0.8)]" strokeWidth={1.6} />
              <span ref={r('gems')} className="tabular font-display text-[clamp(1.6rem,4vw,2.4rem)] leading-none text-silver">
                0
              </span>
            </div>
          </div>
          <IconButton onClick={pause} label="Pause">
            <Pause className="h-4 w-4" strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      {/* compact distance on small screens */}
      <MobileDistance />

      <AnimatePresence>
        {hint && (
          <motion.div
            className="absolute inset-x-0 bottom-[12vh] flex justify-center px-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className="glass-panel flex items-center gap-5 rounded-full px-6 py-3 text-[0.62rem] uppercase tracking-[0.28em] text-mist/80">
              <span className="hidden items-center gap-2 [@media(pointer:fine)]:flex">
                <span className="kbd"><ArrowLeft className="h-3 w-3" /></span>
                <span className="kbd"><ArrowRight className="h-3 w-3" /></span>
                Lanes
              </span>
              <span className="hidden items-center gap-2 [@media(pointer:fine)]:flex">
                <span className="kbd"><ArrowUp className="h-3 w-3" /></span>
                Jump
              </span>
              <span className="hidden items-center gap-2 [@media(pointer:fine)]:flex">
                <span className="kbd"><ArrowDown className="h-3 w-3" /></span>
                Slide
              </span>
              <span className="[@media(pointer:fine)]:hidden">Swipe to move · jump · slide</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PowerChip({ refKey, barKey, setRef, icon: Icon, label }) {
  return (
    <div
      ref={setRef(refKey)}
      className="flex w-36 items-center gap-2 rounded-full border border-azure/30 bg-ink/50 px-3 py-1.5 backdrop-blur-md transition-[opacity,transform] duration-300"
      style={{ opacity: 0 }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-azure" strokeWidth={2} />
      <span className="text-[0.56rem] font-semibold uppercase tracking-[0.25em] text-silver">{label}</span>
      <div className="ml-auto h-[3px] w-12 overflow-hidden rounded-full bg-white/10">
        <div ref={setRef(barKey)} className="h-full origin-left rounded-full bg-azure" />
      </div>
    </div>
  )
}

function MobileDistance() {
  const ref = useRef()
  useEffect(() => {
    let raf
    let last = -1
    const loop = () => {
      const d = Math.floor(runtime.distance)
      if (d !== last && ref.current) {
        ref.current.textContent = `${fmt(d)} m`
        last = d
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] text-center md:hidden">
      <span ref={ref} className="tabular font-display text-xl text-mist/80">
        0 m
      </span>
    </div>
  )
}
