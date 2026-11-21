import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import GameCanvas from './scene/GameCanvas'
import { useGame } from './game/store'
import { installInput } from './game/input'
import { audio } from './game/audio'
import { runtime } from './game/runtime'
import Intro from './ui/Intro'
import MainMenu from './ui/MainMenu'
import Shop from './ui/Shop'
import Maps from './ui/Maps'
import Missions from './ui/Missions'
import Settings from './ui/Settings'
import HUD from './ui/HUD'
import PauseMenu from './ui/PauseMenu'
import GameOver from './ui/GameOver'
import Toasts from './ui/Toasts'

const SCREENS = { home: MainMenu, shop: Shop, maps: Maps, missions: Missions, settings: Settings }

export default function App() {
  const phase = useGame((s) => s.phase)
  const screen = useGame((s) => s.screen)
  const runId = useGame((s) => s.runId)
  const ready = useGame((s) => s.worldReady)

  useEffect(() => installInput(window), [])

  // Browsers only allow audio after a user gesture — start the score on the first one.
  useEffect(() => {
    const unlock = () => {
      audio.unlock()
      audio.setMusicMode(runtime.mode === 'playing' ? 'run' : runtime.mode === 'paused' ? 'pause' : 'menu')
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const inRun = phase === 'playing' || phase === 'paused'
  const Screen = SCREENS[screen] ?? MainMenu

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <GameCanvas />
      <div className="pointer-events-none absolute inset-0 select-none">
        <AnimatePresence mode="wait">
          {phase === 'intro' && <Intro key="intro" />}
          {phase === 'menu' && <Screen key={`menu-${screen}`} />}
        </AnimatePresence>
        <AnimatePresence>
          {inRun && <HUD key={`hud-${runId}`} />}
          {phase === 'paused' && <PauseMenu key="pause" />}
          {phase === 'gameover' && <GameOver key={`over-${runId}`} />}
        </AnimatePresence>
        <Toasts />
        {!ready && phase !== 'intro' && (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-ink/70 px-5 py-2.5 text-[0.62rem] uppercase tracking-[0.3em] text-mist/80 backdrop-blur-md">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-azure border-t-transparent" />
            Building the city…
          </div>
        )}
      </div>
    </div>
  )
}
