import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { Crown, Gem, Home, Milestone, RotateCcw, Trophy, X as Times } from 'lucide-react'
import { useGame } from '../game/store'
import { GhostButton, PrimaryButton, SoundToggle } from './Buttons'

const stagger = (i) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.25 + i * 0.09, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] } },
})

function CountUp({ value, duration = 1.4, delay = 0.4 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, { duration, delay, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => controls.stop()
  }, [value, duration, delay])
  return <>{v.toLocaleString('en-US')}</>
}

export default function GameOver() {
  const run = useGame((s) => s.lastRun)
  const best = useGame((s) => s.best)
  const startGame = useGame((s) => s.startGame)
  const toMenu = useGame((s) => s.toMenu)
  if (!run) return null

  const stats = [
    { icon: Milestone, label: 'Distance', value: `${run.distance.toLocaleString('en-US')} m` },
    { icon: Gem, label: 'Drops', value: run.gems.toLocaleString('en-US') },
    { icon: Times, label: 'Top multiplier', value: `×${run.maxMultiplier}` },
    { icon: Trophy, label: 'Best', value: (best?.score ?? 0).toLocaleString('en-US') },
  ]

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.8 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <div className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] sm:right-10 sm:top-8">
        <SoundToggle />
      </div>
      <div className="w-full max-w-xl text-center">
        <motion.div {...stagger(0)} className="text-[0.62rem] uppercase tracking-[0.55em] text-azure">
          The night ends here
        </motion.div>
        <motion.h2 {...stagger(1)} className="font-display mt-3 text-[clamp(2.6rem,7vw,4.4rem)] leading-none text-silver">
          Run complete
        </motion.h2>

        <motion.div {...stagger(2)} className="mt-8">
          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.5em] text-mist/60">Final score</div>
          <div className="tabular font-display text-glow mt-2 text-[clamp(3.6rem,13vw,6.5rem)] leading-none text-silver">
            <CountUp value={run.score} />
          </div>
          {run.newBest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 1.6, type: 'spring', stiffness: 260, damping: 14 } }}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-azure/50 bg-azure/15 px-4 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.35em] text-azure shadow-[0_0_30px_rgba(127,176,255,0.35)]"
            >
              <Crown className="h-3.5 w-3.5" /> New best
            </motion.div>
          )}
        </motion.div>

        <motion.div {...stagger(3)} className="glass-panel mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-ink/30 px-4 py-5">
              <Icon className="mx-auto h-4 w-4 text-azure" strokeWidth={1.7} />
              <div className="tabular font-display mt-2 text-2xl text-silver">{value}</div>
              <div className="mt-1 text-[0.54rem] uppercase tracking-[0.3em] text-mist/55">{label}</div>
            </div>
          ))}
        </motion.div>

        <motion.div {...stagger(4)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryButton onClick={startGame} icon={RotateCcw} autoFocus>
            Play again
          </PrimaryButton>
          <GhostButton onClick={toMenu} icon={Home}>
            Main menu
          </GhostButton>
        </motion.div>
      </div>
    </motion.div>
  )
}
