import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { events } from '../game/runtime'

let nextId = 1

/** Cinematic center-screen callouts: zone titles, milestones, multipliers, power-ups. */
export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const timers = new Set()
    const off = events.on('toast', (t) => {
      const id = nextId++
      setItems((list) => [...list.filter((x) => x.kind !== t.kind), { ...t, id }].slice(-2))
      const timer = setTimeout(() => {
        setItems((list) => list.filter((x) => x.id !== id))
        timers.delete(timer)
      }, t.kind === 'zone' ? 3200 : 2000)
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
    <div className="pointer-events-none absolute inset-x-0 top-[22vh] flex flex-col items-center gap-3 px-4 text-center">
      <AnimatePresence>
        {items.map((t) =>
          t.kind === 'zone' ? (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9 } }}
              exit={{ opacity: 0, y: -10, filter: 'blur(8px)', transition: { duration: 0.7 } }}
            >
              <div className="text-[0.58rem] uppercase tracking-[0.6em] text-azure">Now entering</div>
              <div className="font-display text-glow mt-2 text-[clamp(2.2rem,6vw,3.8rem)] leading-none text-silver">{t.title}</div>
              <div className="font-display mt-2 text-lg italic text-mist/75">{t.sub}</div>
            </motion.div>
          ) : (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.4 } }}
              className="glass-panel rounded-full px-6 py-2.5"
            >
              <span className="font-display text-2xl text-silver">{t.title}</span>
              {t.sub && <span className="ml-3 text-[0.6rem] uppercase tracking-[0.3em] text-mist/60">{t.sub}</span>}
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  )
}
