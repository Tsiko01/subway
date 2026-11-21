import { motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Gift, Map as MapIcon, Play, Settings, Shirt, ShoppingBag, Target, Trophy } from 'lucide-react'
import { dailyAvailable, useGame } from '../game/store'
import { getMap } from '../game/maps'
import { getSkin } from '../game/catalog'
import { ACHIEVEMENTS } from '../game/progression'
import { achievementValue } from '../game/store'
import { audio } from '../game/audio'
import { BoardIcon, Brand, CoinChip, IconButton, LevelBadge, PrimaryButton } from './Buttons'

const fade = (delay = 0, y = 16) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0, transition: { delay, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.3 } },
})

export function ControlsGuide({ compact = false }) {
  const rows = [
    { keys: [<ArrowLeft key="l" className="h-3.5 w-3.5" />, 'A'], label: 'Move left', swipe: 'Swipe left' },
    { keys: [<ArrowRight key="r" className="h-3.5 w-3.5" />, 'D'], label: 'Move right', swipe: 'Swipe right' },
    { keys: [<ArrowUp key="u" className="h-3.5 w-3.5" />, 'W', 'Space'], label: 'Jump', swipe: 'Swipe up' },
    { keys: [<ArrowDown key="d" className="h-3.5 w-3.5" />, 'S'], label: 'Slide · dive', swipe: 'Swipe down' },
    { keys: ['E'], label: 'Ride skateboard', swipe: 'Double-tap' },
    { keys: ['Q'], label: 'Jet launch', swipe: 'Jet button' },
  ]
  return (
    <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
          <span className="text-[0.76rem] text-mist/90">{r.label}</span>
          <span className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 [@media(pointer:fine)]:flex">
              {r.keys.map((k, i) => (
                <span key={i} className="kbd">
                  {k}
                </span>
              ))}
            </span>
            <span className="text-[0.64rem] uppercase tracking-[0.18em] text-azure [@media(pointer:fine)]:hidden">{r.swipe}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function MenuTile({ icon: Icon, label, sub, onClick, badge }) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        audio.play('click')
        onClick()
      }}
      onMouseEnter={() => audio.play('hover')}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="pointer-events-auto relative flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3 text-left backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.06]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-azure">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-silver">{label}</span>
        {sub && <span className="block truncate text-[0.68rem] text-mist/55">{sub}</span>}
      </span>
      {badge && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#ff4d6d] shadow-[0_0_10px_#ff4d6d]" />}
    </motion.button>
  )
}

export default function MainMenu() {
  const startGame = useGame((s) => s.startGame)
  const openScreen = useGame((s) => s.openScreen)
  const profile = useGame((s) => s.profile)
  const map = getMap(profile.map)
  const daily = dailyAvailable(profile)
  const claimable = ACHIEVEMENTS.some((a) => !profile.achievements[a.id] && achievementValue(profile, a.stat) >= a.goal)

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-ink/40 sm:bg-gradient-to-r sm:from-ink/85 sm:via-ink/30 sm:to-transparent" />

      <motion.header {...fade(0.05, -10)} className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
        <Brand className="hidden text-azure md:flex" />
        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          <LevelBadge className="hidden sm:flex" />
          <CoinChip />
          <IconButton onClick={() => openScreen('missions', 'daily')} label="Daily reward" badge={daily}>
            <Gift className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </IconButton>
          <IconButton onClick={() => openScreen('settings')} label="Settings">
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </IconButton>
        </div>
      </motion.header>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-[max(1.2rem,env(safe-area-inset-bottom))] text-center sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[min(40rem,52vw)] sm:items-start sm:justify-center sm:px-12 sm:pb-0 sm:text-left lg:px-16">
        <motion.div {...fade(0.2)} className="flex items-center gap-3 text-[0.6rem] font-medium uppercase tracking-[0.5em] text-azure">
          <span className="hidden h-px w-10 bg-azure/60 sm:block" />
          Endless rail runner
        </motion.div>
        <motion.h1 {...fade(0.3, 24)} className="font-display text-glow mt-3 text-[clamp(3rem,8.5vw,7rem)] leading-[0.9] font-normal tracking-[0.05em] text-silver">
          Nocturne
        </motion.h1>
        <motion.p {...fade(0.42)} className="font-display mt-2 text-[clamp(1.05rem,2vw,1.45rem)] italic text-mist/85">
          Run the rails. Outrun the officer.
        </motion.p>

        <motion.div {...fade(0.55)} className="mt-6 flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <motion.span
              className="pointer-events-none absolute -inset-2.5 rounded-full border border-azure/40"
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <PrimaryButton onClick={startGame} icon={Play} autoFocus className="px-12 py-4">
              Play
            </PrimaryButton>
          </div>
          <button
            type="button"
            onClick={() => {
              audio.play('click')
              openScreen('maps')
            }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/12 bg-black/30 py-1.5 pl-1.5 pr-4 backdrop-blur-md transition-colors hover:border-white/30"
          >
            <span className="h-8 w-8 rounded-full" style={{ background: `linear-gradient(135deg, ${map.swatch.join(',')})` }} />
            <span className="text-left">
              <span className="block text-[0.52rem] uppercase tracking-[0.3em] text-mist/60">Map</span>
              <span className="block text-[0.78rem] font-semibold text-silver">{map.name}</span>
            </span>
          </button>
        </motion.div>

        <motion.div {...fade(0.68)} className="mt-6 grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
          <MenuTile icon={Shirt} label="Characters" sub={getSkin(profile.skin).name} onClick={() => openScreen('shop', 'characters')} />
          <MenuTile icon={BoardIcon} label="Boards" sub={`${profile.boards} owned`} onClick={() => openScreen('shop', 'boards')} />
          <MenuTile icon={ShoppingBag} label="Shop" sub="Upgrades & items" onClick={() => openScreen('shop', 'upgrades')} />
          <MenuTile icon={MapIcon} label="Maps" sub={`${map.name}`} onClick={() => openScreen('maps')} />
          <MenuTile icon={Target} label="Missions" sub={`${profile.missions.length} active`} onClick={() => openScreen('missions', 'missions')} badge={claimable || daily} />
          <MenuTile icon={Settings} label="Settings" sub="Sound & graphics" onClick={() => openScreen('settings')} />
        </motion.div>

        <motion.div {...fade(0.8)} className="mt-5 flex items-center gap-5 text-[0.62rem] uppercase tracking-[0.28em] text-mist/60">
          <span className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-azure" strokeWidth={1.8} />
            Best <span className="tabular text-silver">{profile.bestScore.toLocaleString('en-US')}</span>
          </span>
          <span className="tabular hidden sm:inline">{profile.bestDistance.toLocaleString('en-US')} m</span>
        </motion.div>
      </div>
    </motion.div>
  )
}
