import { motion } from 'framer-motion'
import { Gauge, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { audio } from '../game/audio'
import { useGame } from '../game/store'

const withSound = (fn) => (e) => {
  audio.unlock()
  audio.play('click')
  fn?.(e)
}

export function PrimaryButton({ children, onClick, icon: Icon, className = '', autoFocus }) {
  return (
    <motion.button
      type="button"
      autoFocus={autoFocus}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={{ scale: 1.035 }}
      whileTap={{ scale: 0.97 }}
      className={`group pointer-events-auto relative isolate inline-flex items-center justify-center gap-3 overflow-hidden rounded-full px-9 py-4 text-[0.78rem] font-semibold uppercase tracking-[0.34em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-azure/70 ${className}`}
    >
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-silver to-[#b7c3d6]" />
      <span className="shimmer absolute inset-0 -z-10 opacity-70" />
      <span className="absolute -inset-px -z-20 rounded-full bg-azure/40 blur-xl transition-opacity duration-500 group-hover:opacity-100 opacity-50" />
      {Icon && <Icon className="h-4 w-4" strokeWidth={2.2} />}
      <span>{children}</span>
    </motion.button>
  )
}

export function GhostButton({ children, onClick, icon: Icon, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`pointer-events-auto inline-flex items-center justify-center gap-3 rounded-full border border-mist/25 bg-white/[0.03] px-7 py-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-mist outline-none backdrop-blur-md transition-colors hover:border-mist/50 hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-azure/60 ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
      <span>{children}</span>
    </motion.button>
  )
}

export function IconButton({ onClick, label, children, className = '' }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={`pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-mist/20 bg-black/25 text-mist outline-none backdrop-blur-md transition-colors hover:border-mist/50 hover:text-white focus-visible:ring-2 focus-visible:ring-azure/60 ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function SoundToggle({ className = '' }) {
  const soundOn = useGame((s) => s.soundOn)
  const toggleSound = useGame((s) => s.toggleSound)
  return (
    <IconButton onClick={toggleSound} label={soundOn ? 'Mute sound' : 'Enable sound'} className={className}>
      {soundOn ? <Volume2 className="h-[18px] w-[18px]" strokeWidth={1.7} /> : <VolumeX className="h-[18px] w-[18px]" strokeWidth={1.7} />}
    </IconButton>
  )
}

export function Brand({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <path d="M16 3 L26 16 L16 29 L6 16 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M16 9 L21 16 L16 23 L11 16 Z" fill="currentColor" opacity="0.85" />
      </svg>
      <div className="leading-none">
        <div className="text-[0.72rem] font-semibold tracking-[0.42em] text-silver">NOCTURNE</div>
        <div className="mt-1 text-[0.58rem] tracking-[0.36em] text-mist/60 uppercase">The Night Run</div>
      </div>
    </div>
  )
}

const QUALITY_LABEL = { high: 'Cinematic', medium: 'Balanced', low: 'Performance' }

/** Cycles the graphics tier: Cinematic → Balanced → Performance. */
export function QualityToggle({ className = '' }) {
  const quality = useGame((s) => s.quality)
  const cycleQuality = useGame((s) => s.cycleQuality)
  const Icon = quality === 'low' ? Gauge : Sparkles
  return (
    <motion.button
      type="button"
      onClick={withSound(cycleQuality)}
      onMouseEnter={() => audio.play('hover')}
      whileTap={{ scale: 0.95 }}
      className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-mist/20 bg-black/25 px-4 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-mist backdrop-blur-md transition-colors hover:border-mist/50 hover:text-white ${className}`}
      title="Graphics quality — click to change"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {QUALITY_LABEL[quality]}
    </motion.button>
  )
}
