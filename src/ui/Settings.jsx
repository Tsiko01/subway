import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gauge, Music, RotateCcw, Sparkles, Vibrate, Volume2 } from 'lucide-react'
import { useGame } from '../game/store'
import { audio } from '../game/audio'
import { GhostButton, Sheet, Toggle } from './Buttons'
import { ControlsGuide } from './MainMenu'

const TIERS = [
  { id: 'high', label: 'Cinematic', hint: 'Reflections, bloom, sharp shadows' },
  { id: 'medium', label: 'Balanced', hint: 'Bloom, lighter shadows' },
  { id: 'low', label: 'Performance', hint: 'Best for phones & older GPUs' },
]

export default function Settings() {
  const settings = useGame((s) => s.profile.settings)
  const quality = useGame((s) => s.quality)
  const setQuality = useGame((s) => s.setQuality)
  const toggleMusic = useGame((s) => s.toggleMusic)
  const toggleSfx = useGame((s) => s.toggleSfx)
  const toggleShake = useGame((s) => s.toggleShake)
  const resetProgress = useGame((s) => s.resetProgress)
  const openScreen = useGame((s) => s.openScreen)
  const [confirm, setConfirm] = useState(false)

  return (
    <Sheet kicker="Preferences" title="Settings" onBack={() => openScreen('home')}>
      <div className="grid gap-2">
        <Toggle on={settings.music} onChange={toggleMusic} label="Music" hint="Each map has its own soundtrack" icon={Music} />
        <Toggle on={settings.sfx} onChange={toggleSfx} label="Sound effects" hint="Footsteps, coins, trains, the officer's whistle" icon={Volume2} />
        <Toggle on={settings.shake} onChange={toggleShake} label="Camera shake" hint="Impacts and landings" icon={Vibrate} />
      </div>

      <div className="mt-5 text-[0.6rem] uppercase tracking-[0.4em] text-azure">Graphics</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              audio.play('click')
              setQuality(t.id)
            }}
            className={`pointer-events-auto rounded-2xl border p-3 text-left transition-colors ${quality === t.id ? 'border-azure/70 bg-azure/10' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.06]'}`}
          >
            <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-silver">
              {t.id === 'low' ? <Gauge className="h-4 w-4 text-azure" /> : <Sparkles className="h-4 w-4 text-azure" />}
              {t.label}
            </span>
            <span className="mt-1 block text-[0.66rem] text-mist/55">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 text-[0.6rem] uppercase tracking-[0.4em] text-azure">Controls</div>
      <div className="mt-2">
        <ControlsGuide compact />
      </div>

      <div className="mt-6 flex justify-center">
        <GhostButton icon={RotateCcw} onClick={() => setConfirm(true)} className="!border-[#ff4d6d]/40 !text-[#ff8fa3]">
          Reset progress
        </GhostButton>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-30 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-panel pointer-events-auto w-full max-w-sm rounded-3xl p-6 text-center">
              <div className="font-display text-3xl text-silver">Reset everything?</div>
              <p className="mt-2 text-[0.8rem] text-mist/70">Coins, characters, boards, maps, missions and records will be erased. This can't be undone.</p>
              <div className="mt-5 flex justify-center gap-2">
                <GhostButton onClick={() => setConfirm(false)}>Cancel</GhostButton>
                <GhostButton
                  onClick={() => {
                    resetProgress()
                    setConfirm(false)
                  }}
                  className="!border-[#ff4d6d]/60 !text-[#ff8fa3]"
                >
                  Reset
                </GhostButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
