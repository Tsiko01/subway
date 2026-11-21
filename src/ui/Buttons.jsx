import { motion } from 'framer-motion'
import { ChevronLeft, Gauge, Sparkles } from 'lucide-react'
import { audio } from '../game/audio'
import { useGame } from '../game/store'
import { xpForLevel } from '../game/progression'

const withSound = (fn) => (e) => {
  audio.unlock()
  audio.play('click')
  fn?.(e)
}

export function PrimaryButton({ children, onClick, icon: Icon, className = '', autoFocus, disabled }) {
  return (
    <motion.button
      type="button"
      autoFocus={autoFocus}
      disabled={disabled}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={disabled ? undefined : { scale: 1.035 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`group pointer-events-auto relative isolate inline-flex items-center justify-center gap-3 overflow-hidden rounded-full px-8 py-3.5 text-[0.76rem] font-semibold uppercase tracking-[0.3em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-azure/70 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-silver to-[#b7c3d6]" />
      <span className="shimmer absolute inset-0 -z-10 opacity-70" />
      {Icon && <Icon className="h-4 w-4" strokeWidth={2.2} />}
      <span>{children}</span>
    </motion.button>
  )
}

export function GoldButton({ children, onClick, className = '', disabled }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={`pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ffe08a] to-[#e9a92a] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#3a2400] shadow-[0_6px_20px_-6px_rgba(255,190,60,0.6)] outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function GhostButton({ children, onClick, icon: Icon, className = '', disabled }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`pointer-events-auto inline-flex items-center justify-center gap-2.5 rounded-full border border-mist/25 bg-white/[0.04] px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-mist outline-none backdrop-blur-md transition-colors hover:border-mist/50 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-azure/60 disabled:opacity-40 ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
      <span>{children}</span>
    </motion.button>
  )
}

export function IconButton({ onClick, label, children, className = '', badge = false }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={withSound(onClick)}
      onMouseEnter={() => audio.play('hover')}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={`pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full border border-mist/20 bg-black/30 text-mist outline-none backdrop-blur-md transition-colors hover:border-mist/50 hover:text-white focus-visible:ring-2 focus-visible:ring-azure/60 ${className}`}
    >
      {children}
      {badge && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink bg-[#ff4d6d]" />}
    </motion.button>
  )
}

export function CoinIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="coinG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#c98a12" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#coinG)" stroke="#9a6608" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#a87010" strokeWidth="1.2" opacity="0.8" />
      <path d="M12 8.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3z" fill="#a87010" />
    </svg>
  )
}

export function BoardIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3.5 11.5c0-1.2 1-2 2.2-2h12.6c1.2 0 2.2.8 2.2 2" />
      <path d="M2.5 10.5c.3 1.6 1.6 2.6 3.2 2.6h12.6c1.6 0 2.9-1 3.2-2.6" />
      <circle cx="7" cy="16.5" r="1.6" />
      <circle cx="17" cy="16.5" r="1.6" />
    </svg>
  )
}

export function CoinChip({ className = '' }) {
  const coins = useGame((s) => s.profile.coins)
  return (
    <div className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-[#ffc93c]/30 bg-black/35 pl-2 pr-4 backdrop-blur-md ${className}`}>
      <CoinIcon className="h-6 w-6" />
      <span className="tabular text-[0.95rem] font-bold text-[#ffe08a]">{coins.toLocaleString('en-US')}</span>
    </div>
  )
}

export function LevelBadge({ className = '' }) {
  const level = useGame((s) => s.profile.level)
  const xp = useGame((s) => s.profile.xp)
  const need = xpForLevel(level)
  return (
    <div className={`pointer-events-auto flex h-11 items-center gap-2.5 rounded-full border border-azure/30 bg-black/35 pl-1.5 pr-4 backdrop-blur-md ${className}`} title={`${xp} / ${need} XP`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-azure to-azure-deep text-[0.8rem] font-black text-white">{level}</span>
      <div>
        <div className="text-[0.52rem] font-semibold uppercase tracking-[0.25em] text-mist/70">Level · ×{Math.min(30, level)}</div>
        <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-azure" style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

export function Progress({ value, max, className = '', color = 'bg-azure' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="pointer-events-auto flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            audio.play('click')
            onChange(t.id)
          }}
          className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[0.64rem] font-semibold uppercase tracking-[0.22em] transition-colors ${
            value === t.id ? 'text-ink' : 'text-mist/70 hover:text-white'
          }`}
        >
          {value === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 -z-0 rounded-full bg-silver" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          {t.icon && <t.icon className="relative h-3.5 w-3.5" strokeWidth={2} />}
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label, icon: Icon, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange()}
      className="pointer-events-auto flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.06]"
    >
      {Icon && <Icon className="h-5 w-5 text-azure" strokeWidth={1.7} />}
      <span className="flex-1">
        <span className="block text-[0.84rem] font-semibold text-silver">{label}</span>
        {hint && <span className="block text-[0.7rem] text-mist/55">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-azure' : 'bg-white/15'}`}>
        <motion.span layout className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )
}

/** Panel for menu sub-screens. Desktop: left column beside the live 3D preview. Mobile: bottom sheet. */
export function Sheet({ title, kicker, children, onBack, right, wide = false }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/30 sm:bg-gradient-to-r sm:from-ink/80 sm:via-ink/25 sm:to-transparent" />
      <motion.section
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1, transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] } }}
        exit={{ x: -20, opacity: 0 }}
        className={`glass-panel pointer-events-auto absolute inset-x-2 bottom-2 flex max-h-[60vh] flex-col overflow-hidden rounded-3xl sm:inset-y-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-h-none ${wide ? 'sm:w-[min(46rem,62vw)]' : 'sm:w-[min(34rem,52vw)]'}`}
      >
        <header className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5 sm:px-6 sm:py-5">
          <IconButton onClick={onBack} label="Back">
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0 flex-1">
            {kicker && <div className="text-[0.56rem] uppercase tracking-[0.45em] text-azure">{kicker}</div>}
            <h2 className="font-display truncate text-[1.9rem] leading-none text-silver sm:text-[2.3rem]">{title}</h2>
          </div>
          {right}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">{children}</div>
      </motion.section>
    </motion.div>
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
        <div className="mt-1 text-[0.58rem] uppercase tracking-[0.36em] text-mist/60">Rail Runner</div>
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
