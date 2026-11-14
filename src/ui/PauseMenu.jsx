import { motion } from 'framer-motion'
import { Home, Play, RotateCcw } from 'lucide-react'
import { useGame } from '../game/store'
import { runtime } from '../game/runtime'
import { GhostButton, PrimaryButton, QualityToggle, SoundToggle } from './Buttons'
import { ControlsGuide } from './MainMenu'

export default function PauseMenu() {
  const resume = useGame((s) => s.resume)
  const startGame = useGame((s) => s.startGame)
  const toMenu = useGame((s) => s.toMenu)

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-10 grid place-items-center bg-ink/55 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="glass-panel w-full max-w-md rounded-3xl p-7 text-center sm:p-10"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] } }}
        exit={{ y: 12, opacity: 0 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] uppercase tracking-[0.5em] text-azure">Intermission</span>
          <div className="flex items-center gap-2">
            <QualityToggle />
            <SoundToggle />
          </div>
        </div>
        <h2 className="font-display mt-4 text-5xl text-silver">Paused</h2>
        <div className="mt-4 flex justify-center gap-8 text-[0.62rem] uppercase tracking-[0.3em] text-mist/60">
          <span>
            Score <span className="tabular ml-1 text-silver">{Math.floor(runtime.score).toLocaleString('en-US')}</span>
          </span>
          <span>
            <span className="tabular text-silver">{Math.floor(runtime.distance).toLocaleString('en-US')}</span> m
          </span>
        </div>
        <div className="hairline my-7" />
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={resume} icon={Play} autoFocus>
            Resume
          </PrimaryButton>
          <GhostButton onClick={startGame} icon={RotateCcw}>
            Restart
          </GhostButton>
          <GhostButton onClick={toMenu} icon={Home}>
            Main menu
          </GhostButton>
        </div>
        <div className="mt-7 text-left">
          <ControlsGuide compact />
        </div>
      </motion.div>
    </motion.div>
  )
}
