import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Gem, Info, Magnet, Play, Trophy, X, Zap } from 'lucide-react'
import { useGame } from '../game/store'
import { Brand, GhostButton, IconButton, PrimaryButton, QualityToggle, SoundToggle } from './Buttons'

const fade = (delay = 0, y = 16) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0, transition: { delay, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.35 } },
})

export function ControlsGuide({ compact = false }) {
  const rows = [
    { keys: [<ArrowLeft key="l" className="h-3.5 w-3.5" />, 'A'], label: 'Move left', swipe: 'Swipe left' },
    { keys: [<ArrowRight key="r" className="h-3.5 w-3.5" />, 'D'], label: 'Move right', swipe: 'Swipe right' },
    { keys: [<ArrowUp key="u" className="h-3.5 w-3.5" />, 'W', 'Space'], label: 'Jump', swipe: 'Swipe up' },
    { keys: [<ArrowDown key="d" className="h-3.5 w-3.5" />, 'S'], label: 'Slide · dive in air', swipe: 'Swipe down' },
  ]
  return (
    <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
          <span className="text-[0.78rem] text-mist/90">{r.label}</span>
          <span className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 [@media(pointer:fine)]:flex">
              {r.keys.map((k, i) => (
                <span key={i} className="kbd">
                  {k}
                </span>
              ))}
            </span>
            <span className="text-[0.68rem] uppercase tracking-[0.2em] text-azure [@media(pointer:fine)]:hidden">{r.swipe}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function HowToPlay({ onClose }) {
  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-panel relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-9"
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] } }}
        exit={{ y: 16, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton onClick={onClose} label="Close" className="absolute right-5 top-5">
          <X className="h-4 w-4" />
        </IconButton>
        <div className="text-[0.62rem] uppercase tracking-[0.5em] text-azure">How to play</div>
        <h2 className="font-display mt-2 text-4xl text-silver">The night is endless</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-mist/75">
          Your runner sprints forward on their own. Switch between three lanes, leap the low barriers, slide beneath the gantries and never
          meet a wall head-on. The city speeds up the further you go.
        </p>
        <div className="hairline my-6" />
        <ControlsGuide />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Tip icon={Gem} title="Azure drops" text="+25 points each. Every 25 drops raises your multiplier, up to ×6." />
          <Tip icon={Magnet} title="Magnet" text="Pulls every nearby drop toward you for 9 seconds." />
          <Tip icon={Zap} title="Double score" text="Doubles your multiplier for 9 seconds." />
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.72rem] text-mist/60">
          <span>
            <span className="kbd mr-2">Esc</span>Pause
          </span>
          <span>
            <span className="kbd mr-2">Enter</span>Start / retry
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Tip({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
      <Icon className="h-5 w-5 text-azure" strokeWidth={1.6} />
      <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.25em] text-silver">{title}</div>
      <p className="mt-1.5 text-[0.76rem] leading-relaxed text-mist/70">{text}</p>
    </div>
  )
}

export default function MainMenu() {
  const startGame = useGame((s) => s.startGame)
  const best = useGame((s) => s.best)
  const [help, setHelp] = useState(false)

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      {/* legibility gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-ink/40 sm:bg-gradient-to-r sm:from-ink/85 sm:via-ink/30 sm:to-transparent" />

      {/* top bar */}
      <motion.header {...fade(0.1, -10)} className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 sm:pt-8">
        <Brand className="text-azure" />
        <div className="flex items-center gap-2.5">
          <QualityToggle className="hidden sm:flex" />
          <SoundToggle />
        </div>
      </motion.header>

      {/* hero copy */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[min(46rem,55vw)] sm:items-start sm:justify-center sm:px-14 sm:pb-0 sm:text-left lg:px-20">
        <motion.div {...fade(0.25)} className="flex items-center gap-3 text-[0.62rem] font-medium uppercase tracking-[0.55em] text-azure">
          <span className="hidden h-px w-10 bg-azure/60 sm:block" />
          An endless night run
        </motion.div>
        <motion.h1
          {...fade(0.4, 24)}
          className="font-display text-glow mt-4 text-[clamp(3.4rem,10vw,8.5rem)] leading-[0.9] font-normal tracking-[0.06em] text-silver"
        >
          Nocturne
        </motion.h1>
        <motion.p {...fade(0.55)} className="font-display mt-3 text-[clamp(1.15rem,2.2vw,1.6rem)] italic text-mist/85">
          Run into the blue hour.
        </motion.p>
        <motion.p {...fade(0.65)} className="mt-5 hidden max-w-md text-[0.88rem] leading-relaxed text-mist/65 sm:block">
          Sprint through a moonlit city that never sleeps — from Midnight Avenue, across the Harbor Bridge, into the Glass District. Collect
          azure drops, outpace the night, and set a record worth remembering.
        </motion.p>

        <motion.div {...fade(0.8)} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative">
            <motion.span
              className="pointer-events-none absolute -inset-3 rounded-full border border-azure/40"
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <PrimaryButton onClick={startGame} icon={Play} autoFocus>
              Play
            </PrimaryButton>
          </div>
          <GhostButton onClick={() => setHelp(true)} icon={Info}>
            How to play
          </GhostButton>
        </motion.div>

        <motion.div {...fade(0.95)} className="mt-8 flex items-center gap-6 text-[0.66rem] uppercase tracking-[0.3em] text-mist/60">
          <span className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-azure" strokeWidth={1.8} />
            Best <span className="tabular text-silver">{(best?.score ?? 0).toLocaleString('en-US')}</span>
          </span>
          {best?.distance > 0 && (
            <span className="tabular hidden sm:inline">{best.distance.toLocaleString('en-US')} m</span>
          )}
        </motion.div>
      </div>

      {/* quick controls (desktop) */}
      <motion.div
        {...fade(1.1)}
        className="absolute bottom-8 right-10 hidden items-center gap-5 text-[0.62rem] uppercase tracking-[0.28em] text-mist/55 lg:flex [@media(pointer:coarse)]:!hidden"
      >
        <span className="flex items-center gap-2">
          <span className="kbd">
            <ArrowLeft className="h-3 w-3" />
          </span>
          <span className="kbd">
            <ArrowRight className="h-3 w-3" />
          </span>
          Lanes
        </span>
        <span className="flex items-center gap-2">
          <span className="kbd">
            <ArrowUp className="h-3 w-3" />
          </span>
          Jump
        </span>
        <span className="flex items-center gap-2">
          <span className="kbd">
            <ArrowDown className="h-3 w-3" />
          </span>
          Slide
        </span>
      </motion.div>

      <AnimatePresence>{help && <HowToPlay onClose={() => setHelp(false)} />}</AnimatePresence>
    </motion.div>
  )
}
