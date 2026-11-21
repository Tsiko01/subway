import { motion } from 'framer-motion'
import { Home, Music, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useGame } from '../game/store'
import { runtime } from '../game/runtime'
import { GhostButton, IconButton, PrimaryButton, QualityToggle } from './Buttons'
import { MissionList } from './Missions'

export default function PauseMenu() {
  const resume = useGame((s) => s.resume)
  const quitRun = useGame((s) => s.quitRun)
  const settings = useGame((s) => s.profile.settings)
  const toggleMusic = useGame((s) => s.toggleMusic)
  const toggleSfx = useGame((s) => s.toggleSfx)

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-ink/55 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="glass-panel w-full max-w-md rounded-3xl p-6 text-center sm:p-8"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] } }}
        exit={{ y: 12, opacity: 0 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] uppercase tracking-[0.5em] text-azure">Paused</span>
          <div className="flex items-center gap-2">
            <QualityToggle className="hidden sm:flex" />
            <IconButton onClick={toggleMusic} label={settings.music ? 'Mute music' : 'Enable music'} className={settings.music ? '' : 'opacity-50'}>
              <Music className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={toggleSfx} label={settings.sfx ? 'Mute effects' : 'Enable effects'}>
              {settings.sfx ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </IconButton>
          </div>
        </div>
        <h2 className="font-display mt-3 text-5xl text-silver">Take a breath</h2>
        <div className="mt-3 flex justify-center gap-6 text-[0.6rem] uppercase tracking-[0.28em] text-mist/60">
          <span>
            Score <span className="tabular ml-1 text-silver">{Math.floor(runtime.score).toLocaleString('en-US')}</span>
          </span>
          <span>
            <span className="tabular text-silver">{Math.floor(runtime.distance).toLocaleString('en-US')}</span> m
          </span>
          <span>
            <span className="tabular text-[#ffe08a]">{runtime.coins}</span> coins
          </span>
        </div>
        <div className="hairline my-5" />
        <div className="flex flex-col gap-2.5">
          <PrimaryButton onClick={resume} icon={Play} autoFocus>
            Resume
          </PrimaryButton>
          <GhostButton onClick={() => quitRun(true)} icon={RotateCcw}>
            Restart
          </GhostButton>
          <GhostButton onClick={() => quitRun(false)} icon={Home}>
            Main menu
          </GhostButton>
        </div>
        <div className="mt-5 text-left">
          <div className="mb-2 text-[0.56rem] uppercase tracking-[0.4em] text-azure">Missions</div>
          <MissionList live />
        </div>
      </motion.div>
    </motion.div>
  )
}
