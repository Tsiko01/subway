import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import GameCanvas from './scene/GameCanvas'
import { useGame } from './game/store'
import { installInput } from './game/input'
import { audio } from './game/audio'
import { runtime } from './game/runtime'
import Intro from './ui/Intro'
import MainMenu from './ui/MainMenu'
import HUD from './ui/HUD'
import PauseMenu from './ui/PauseMenu'
import GameOver from './ui/GameOver'
import Toasts from './ui/Toasts'

export default function App() {
  const phase = useGame((s) => s.phase)
  const runId = useGame((s) => s.runId)

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

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <GameCanvas />
      <div className="pointer-events-none absolute inset-0 select-none">
        <AnimatePresence>
          {phase === 'intro' && <Intro key="intro" />}
          {phase === 'menu' && <MainMenu key="menu" />}
          {inRun && <HUD key={`hud-${runId}`} />}
          {phase === 'paused' && <PauseMenu key="pause" />}
          {phase === 'gameover' && <GameOver key={`over-${runId}`} />}
        </AnimatePresence>
        {inRun && <Toasts key={`toasts-${runId}`} />}
      </div>
    </div>
  )
}
