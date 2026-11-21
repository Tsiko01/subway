import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Lock, Music } from 'lucide-react'
import { MAPS, getMap } from '../game/maps'
import { isMapUnlocked, useGame } from '../game/store'
import { audio } from '../game/audio'
import { CoinChip, CoinIcon, GhostButton, GoldButton, Sheet } from './Buttons'

const TRAIN_NAMES = { metro: 'metro trains', tram: 'city trams', freight: 'freight trains', beachtram: 'beach trams', neon: 'neon metro' }

export default function Maps() {
  const profile = useGame((s) => s.profile)
  const preview = useGame((s) => s.preview.map)
  const setPreview = useGame((s) => s.setPreview)
  const selectMap = useGame((s) => s.selectMap)
  const unlockMap = useGame((s) => s.unlockMap)
  const openScreen = useGame((s) => s.openScreen)
  const sel = getMap(preview ?? profile.map)
  const unlocked = isMapUnlocked(profile, sel.id)

  useEffect(() => () => setPreview('map', null), [setPreview])

  return (
    <Sheet kicker="Choose where to run" title="Maps" onBack={() => openScreen('home')} right={<CoinChip />}>
      <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="h-20" style={{ background: `linear-gradient(120deg, ${sel.swatch.join(',')})` }} />
        <div className="p-4">
          <div className="font-display text-3xl text-silver">{sel.name}</div>
          <p className="mt-1.5 text-[0.8rem] leading-relaxed text-mist/70">{sel.blurb}</p>
          <div className="mt-2 flex items-center gap-2 text-[0.64rem] uppercase tracking-[0.25em] text-mist/50">
            <Music className="h-3.5 w-3.5" /> Own soundtrack · {TRAIN_NAMES[sel.train]}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {profile.map === sel.id ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-azure/15 px-5 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-azure">
                <Check className="h-4 w-4" /> Selected
              </span>
            ) : unlocked ? (
              <GhostButton onClick={() => selectMap(sel.id)}>Run here</GhostButton>
            ) : (
              <>
                <span className="text-[0.7rem] text-mist/60">Reach level {sel.unlock.level} or</span>
                <GoldButton onClick={() => unlockMap(sel.id)} disabled={profile.coins < sel.unlock.price}>
                  Unlock · <CoinIcon className="h-4 w-4" /> {sel.unlock.price.toLocaleString('en-US')}
                </GoldButton>
              </>
            )}
          </div>
        </div>
      </motion.div>
      <div className="mt-4 grid gap-2">
        {MAPS.map((m) => {
          const open = isMapUnlocked(profile, m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                audio.play('click')
                setPreview('map', m.id)
              }}
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${sel.id === m.id ? 'border-azure/70 bg-azure/10' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.06]'}`}
            >
              <span className="h-11 w-16 shrink-0 rounded-xl" style={{ background: `linear-gradient(120deg, ${m.swatch.join(',')})` }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.82rem] font-semibold text-silver">{m.name}</span>
                <span className="block truncate text-[0.68rem] text-mist/55">{m.blurb}</span>
              </span>
              {profile.map === m.id ? (
                <Check className="h-4 w-4 text-azure" />
              ) : open ? null : (
                <span className="flex items-center gap-1 text-[0.64rem] text-mist/60">
                  <Lock className="h-3.5 w-3.5" /> Lv {m.unlock.level}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
