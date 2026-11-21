import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Footprints, Info, ListChecks, Magnet, Rocket, Siren, Zap } from 'lucide-react'
import { events } from '../game/runtime'
import { POWER_COLORS } from '../scene/prefabs'
import { BoardIcon, CoinIcon } from './Buttons'

let nextId = 1
const POWER_ICON = { magnet: Magnet, sneakers: Footprints, jetpack: Rocket, double: Zap, board: BoardIcon }

/** Center-screen callouts: power-ups, missions, the officer, milestones. */
export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const timers = new Set()
    const off = events.on('toast', (t) => {
      const id = nextId++
      setItems((list) => [...list.filter((x) => x.kind !== t.kind), { ...t, id }].slice(-3))
      const timer = setTimeout(
        () => {
          setItems((list) => list.filter((x) => x.id !== id))
          timers.delete(timer)
        },
        t.kind === 'mission' ? 2600 : 1900,
      )
      timers.add(timer)
    })
    const offCrash = events.on('crash', () => setItems([]))
    return () => {
      off()
      offCrash()
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[21vh] flex flex-col items-center gap-2 px-4 text-center">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = t.kind === 'power' ? POWER_ICON[t.power] : t.kind === 'mission' ? ListChecks : t.kind === 'officer' ? Siren : t.kind === 'info' ? Info : null
          const color = t.kind === 'power' ? POWER_COLORS[t.power] : t.kind === 'officer' ? '#ff8fa3' : t.kind === 'mission' ? '#ffe08a' : '#c9d3e3'
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.35 } }}
              className="glass-panel flex max-w-[92vw] items-center gap-3 rounded-full px-5 py-2.5"
              style={{ borderColor: `${color}55` }}
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" style={{ color }} />}
              <span className="font-display text-xl text-silver sm:text-2xl">{t.title}</span>
              {t.sub && <span className="hidden text-[0.6rem] uppercase tracking-[0.25em] text-mist/65 sm:inline">{t.sub}</span>}
              {t.reward && (
                <span className="flex items-center gap-1 text-[0.8rem] font-bold text-[#ffe08a]">
                  +<CoinIcon className="h-4 w-4" />
                  {t.reward}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
