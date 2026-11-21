import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { Check, Crown, Home, Milestone, RotateCcw, Siren, Sparkles, Trophy } from 'lucide-react'
import { useGame } from '../game/store'
import { xpForLevel } from '../game/progression'
import { CoinIcon, GhostButton, PrimaryButton, Progress } from './Buttons'
import { MissionList } from './Missions'

const stagger = (i) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.2 + i * 0.08, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } },
})

function CountUp({ value, duration = 1.3, delay = 0.35 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, { duration, delay, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => controls.stop()
  }, [value, duration, delay])
  return <>{v.toLocaleString('en-US')}</>
}

export default function GameOver() {
  const run = useGame((s) => s.lastRun)
  const profile = useGame((s) => s.profile)
  const startGame = useGame((s) => s.startGame)
  const toMenu = useGame((s) => s.toMenu)
  if (!run) return null
  const caught = run.kind === 'caught'

  const stats = [
    { icon: Milestone, label: 'Distance', value: `${run.distance.toLocaleString('en-US')} m` },
    { icon: CoinIcon, label: 'Coins', value: `+${run.coins.toLocaleString('en-US')}` },
    { icon: Sparkles, label: 'Top multiplier', value: `×${run.maxMultiplier}` },
    { icon: Trophy, label: 'Best', value: profile.bestScore.toLocaleString('en-US') },
  ]

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-10 flex justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.7 } }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="my-auto w-full max-w-xl py-6 text-center">
        <motion.div {...stagger(0)} className={`inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.5em] ${caught ? 'text-[#ff8fa3]' : 'text-azure'}`}>
          {caught && <Siren className="h-4 w-4" />}
          {caught ? 'Caught by the officer' : 'Crashed'}
        </motion.div>
        <motion.h2 {...stagger(1)} className="font-display mt-2 text-[clamp(2.4rem,7vw,4.2rem)] leading-none text-silver">
          Run complete
        </motion.h2>

        <motion.div {...stagger(2)} className="mt-5">
          <div className="text-[0.56rem] font-semibold uppercase tracking-[0.5em] text-mist/60">Final score</div>
          <div className="tabular font-display text-glow mt-1 text-[clamp(3.2rem,12vw,6rem)] leading-none text-silver">
            <CountUp value={run.score} />
          </div>
          {run.newBest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 1.5, type: 'spring', stiffness: 260, damping: 14 } }}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-azure/50 bg-azure/15 px-4 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.35em] text-azure shadow-[0_0_30px_rgba(127,176,255,0.35)]"
            >
              <Crown className="h-3.5 w-3.5" /> New best
            </motion.div>
          )}
        </motion.div>

        <motion.div {...stagger(3)} className="glass-panel mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-ink/30 px-3 py-4">
              <Icon className="mx-auto h-4 w-4 text-azure" strokeWidth={1.7} />
              <div className="tabular font-display mt-1.5 text-2xl text-silver">{value}</div>
              <div className="mt-0.5 text-[0.52rem] uppercase tracking-[0.28em] text-mist/55">{label}</div>
            </div>
          ))}
        </motion.div>

        <motion.div {...stagger(4)} className="glass-panel mt-3 rounded-2xl p-4 text-left">
          <div className="flex items-center justify-between text-[0.7rem]">
            <span className="font-semibold text-silver">Level {profile.level}</span>
            <span className="text-azure">+{run.xpGained.toLocaleString('en-US')} XP</span>
          </div>
          <Progress value={profile.xp} max={xpForLevel(profile.level)} className="mt-2" />
          {run.levelUps.map((l) => (
            <div key={l.level} className="mt-2 flex items-center gap-2 text-[0.72rem] text-[#ffe08a]">
              <Crown className="h-4 w-4" /> Level {l.level}! +{l.coins} coins{l.boards ? ` · +${l.boards} skateboard` : ''} · score ×{Math.min(30, l.level)}
            </div>
          ))}
          {run.missions.length > 0 && (
            <div className="mt-3 border-t border-white/8 pt-3">
              {run.missions.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.72rem] text-silver">
                  <Check className="h-4 w-4 text-azure" /> {m.text}
                  <span className="ml-auto flex items-center gap-1 text-[#ffe08a]">
                    <CoinIcon className="h-3.5 w-3.5" /> {m.coins}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div {...stagger(5)} className="mt-3 text-left">
          <MissionList />
        </motion.div>

        <motion.div {...stagger(6)} className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
