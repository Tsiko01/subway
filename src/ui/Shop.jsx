import { motion } from 'framer-motion'
import { Check, Footprints, Lock, Magnet, Package, Rocket, Shirt, Sparkles, Zap } from 'lucide-react'
import { useGame } from '../game/store'
import { BOARDS, ITEMS, SKINS, UPGRADES, UPGRADE_COSTS, getBoard, getSkin, upgradeDuration } from '../game/catalog'
import { audio } from '../game/audio'
import { BoardIcon, CoinChip, CoinIcon, GhostButton, GoldButton, Sheet, Tabs } from './Buttons'

const TABS = [
  { id: 'characters', label: 'Characters', icon: Shirt },
  { id: 'boards', label: 'Boards', icon: BoardIcon },
  { id: 'upgrades', label: 'Upgrades', icon: Sparkles },
  { id: 'items', label: 'Items', icon: Package },
]

const Price = ({ value, affordable = true }) => (
  <span className={`inline-flex items-center gap-1.5 ${affordable ? '' : 'opacity-60'}`}>
    <CoinIcon className="h-4 w-4" />
    <span className="tabular">{value.toLocaleString('en-US')}</span>
  </span>
)

function ActionButton({ owned, equipped, price, coins, onBuy, onEquip }) {
  if (equipped)
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-azure/15 px-5 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-azure">
        <Check className="h-4 w-4" /> Equipped
      </span>
    )
  if (owned)
    return (
      <GhostButton onClick={onEquip} className="!px-6 !py-2.5">
        Equip
      </GhostButton>
    )
  return (
    <GoldButton onClick={onBuy} disabled={coins < price}>
      Buy · <Price value={price} />
    </GoldButton>
  )
}

function Characters() {
  const profile = useGame((s) => s.profile)
  const preview = useGame((s) => s.preview.skin)
  const setPreview = useGame((s) => s.setPreview)
  const buySkin = useGame((s) => s.buySkin)
  const equipSkin = useGame((s) => s.equipSkin)
  const sel = getSkin(preview ?? profile.skin)
  const owned = profile.ownedSkins.includes(sel.id)

  return (
    <div>
      <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.56rem] uppercase tracking-[0.4em] text-azure">{sel.role}</div>
            <div className="font-display mt-1 text-3xl text-silver">{sel.name}</div>
          </div>
          {!owned && <Lock className="mt-1 h-5 w-5 text-mist/50" />}
        </div>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-mist/70">{sel.blurb}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[0.62rem] uppercase tracking-[0.25em] text-mist/50">Emote · {sel.emote}</span>
          <ActionButton
            owned={owned}
            equipped={profile.skin === sel.id}
            price={sel.price}
            coins={profile.coins}
            onBuy={() => buySkin(sel.id)}
            onEquip={() => equipSkin(sel.id)}
          />
        </div>
      </motion.div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {SKINS.map((s) => {
          const own = profile.ownedSkins.includes(s.id)
          const active = sel.id === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                audio.play('click')
                setPreview('skin', s.id)
              }}
              className={`pointer-events-auto relative rounded-2xl border p-2.5 text-left transition-colors ${active ? 'border-azure/70 bg-azure/10' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.06]'}`}
            >
              <span
                className="mx-auto block h-12 w-12 rounded-full border border-white/20"
                style={{ background: `conic-gradient(from 200deg, ${s.top.color}, ${s.top.color2}, ${s.bottom.color}, ${s.shoes.color}, ${s.top.color})` }}
              />
              <span className="mt-2 block truncate text-center text-[0.72rem] font-semibold text-silver">{s.name}</span>
              <span className="mt-0.5 flex justify-center text-[0.64rem] text-[#ffe08a]">
                {profile.skin === s.id ? <span className="text-azure">Equipped</span> : own ? <span className="text-mist/60">Owned</span> : <Price value={s.price} affordable={profile.coins >= s.price} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const deckStyle = (b) => {
  const [a, c, d] = b.colors
  switch (b.design) {
    case 'stripes':
      return `repeating-linear-gradient(90deg, ${c} 0 14px, ${a} 14px 24px)`
    case 'gradient':
      return `linear-gradient(90deg, ${a}, ${c}, ${d})`
    case 'camo':
      return `radial-gradient(circle at 20% 40%, ${c} 0 12%, transparent 13%), radial-gradient(circle at 65% 60%, ${d} 0 14%, transparent 15%), radial-gradient(circle at 80% 30%, ${b.colors[3]} 0 10%, transparent 11%), ${a}`
    case 'waves':
      return `repeating-radial-gradient(circle at 50% 120%, ${a} 0 8px, ${c} 8px 14px, ${d} 14px 16px)`
    case 'carbon':
      return `repeating-linear-gradient(45deg, ${a} 0 4px, ${c} 4px 8px)`
    case 'galaxy':
      return `radial-gradient(circle at 50% 50%, ${c}, ${a} 70%)`
    case 'gold':
      return `linear-gradient(120deg, ${a}, ${d}, ${c})`
    default:
      return `linear-gradient(90deg, ${a}, ${c})`
  }
}

function Boards() {
  const profile = useGame((s) => s.profile)
  const preview = useGame((s) => s.preview.board)
  const setPreview = useGame((s) => s.setPreview)
  const buy = useGame((s) => s.buyBoardDesign)
  const equip = useGame((s) => s.equipBoard)
  const setShopTab = useGame((s) => s.setShopTab)
  const sel = getBoard(preview ?? profile.board)
  const owned = profile.ownedBoards.includes(sel.id)

  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <BoardIcon className="h-6 w-6 text-azure" />
          <div>
            <div className="text-[0.82rem] font-semibold text-silver">{profile.boards} skateboards</div>
            <div className="text-[0.68rem] text-mist/60">Press E or double-tap to ride. One board absorbs one crash.</div>
          </div>
        </div>
        <GhostButton onClick={() => setShopTab('items')} className="!px-4 !py-2">
          Get more
        </GhostButton>
      </div>
      <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[0.56rem] uppercase tracking-[0.4em] text-azure">Board design</div>
        <div className="font-display mt-1 text-3xl text-silver">{sel.name}</div>
        <div className="mt-3 h-8 w-full rounded-full border border-white/20" style={{ background: deckStyle(sel), boxShadow: sel.glow ? `0 0 18px ${sel.glow}` : 'none' }} />
        <div className="mt-4 flex justify-end">
          <ActionButton owned={owned} equipped={profile.board === sel.id} price={sel.price} coins={profile.coins} onBuy={() => buy(sel.id)} onEquip={() => equip(sel.id)} />
        </div>
      </motion.div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BOARDS.map((b) => {
          const own = profile.ownedBoards.includes(b.id)
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                audio.play('click')
                setPreview('board', b.id)
              }}
              className={`pointer-events-auto rounded-2xl border p-3 text-left transition-colors ${sel.id === b.id ? 'border-azure/70 bg-azure/10' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.06]'}`}
            >
              <span className="block h-5 rounded-full border border-white/15" style={{ background: deckStyle(b), boxShadow: b.glow ? `0 0 10px ${b.glow}` : 'none' }} />
              <span className="mt-2 block truncate text-[0.72rem] font-semibold text-silver">{b.name}</span>
              <span className="mt-0.5 block text-[0.64rem] text-[#ffe08a]">
                {profile.board === b.id ? <span className="text-azure">Equipped</span> : own ? <span className="text-mist/60">Owned</span> : <Price value={b.price} affordable={profile.coins >= b.price} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const UPGRADE_ICONS = { magnet: Magnet, sneakers: Footprints, jetpack: Rocket, double: Zap, board: BoardIcon }

function Upgrades() {
  const profile = useGame((s) => s.profile)
  const buy = useGame((s) => s.buyUpgrade)
  return (
    <div className="grid gap-2.5">
      {UPGRADES.map((u) => {
        const lvl = profile.upgrades[u.id] ?? 0
        const max = lvl >= UPGRADE_COSTS.length
        const cost = UPGRADE_COSTS[lvl]
        const Icon = UPGRADE_ICONS[u.id]
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-azure">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.84rem] font-semibold text-silver">{u.name}</div>
              <div className="text-[0.68rem] text-mist/60">{u.blurb}</div>
              <div className="mt-1.5 flex items-center gap-1">
                {UPGRADE_COSTS.map((_, i) => (
                  <span key={i} className={`h-1.5 w-6 rounded-full ${i < lvl ? 'bg-azure' : 'bg-white/12'}`} />
                ))}
                <span className="ml-2 text-[0.64rem] text-mist/60">
                  {upgradeDuration(u.id, lvl).toFixed(0)}s{!max && ` → ${upgradeDuration(u.id, lvl + 1).toFixed(0)}s`}
                </span>
              </div>
            </div>
            {max ? (
              <span className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-azure">Max</span>
            ) : (
              <GoldButton onClick={() => buy(u.id)} disabled={profile.coins < cost} className="!px-4">
                <Price value={cost} />
              </GoldButton>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Items() {
  const profile = useGame((s) => s.profile)
  const buy = useGame((s) => s.buyItem)
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[0.75rem] text-mist">
          <BoardIcon className="h-4 w-4 text-azure" /> {profile.boards} skateboards
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[0.75rem] text-mist">
          <Rocket className="h-4 w-4 text-azure" /> {profile.jets} jet launches
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <div key={it.id} className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2.5">
              {it.icon === 'board' ? <BoardIcon className="h-5 w-5 text-azure" /> : <Rocket className="h-5 w-5 text-azure" />}
              <span className="text-[0.86rem] font-semibold text-silver">{it.name}</span>
            </div>
            <p className="mt-1.5 flex-1 text-[0.72rem] leading-relaxed text-mist/60">{it.blurb}</p>
            <GoldButton onClick={() => buy(it.id)} disabled={profile.coins < it.price} className="mt-3 self-start">
              Buy · <Price value={it.price} />
            </GoldButton>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Shop() {
  const tab = useGame((s) => s.shopTab)
  const setShopTab = useGame((s) => s.setShopTab)
  const openScreen = useGame((s) => s.openScreen)
  return (
    <Sheet kicker="Spend your coins" title="Shop" onBack={() => openScreen('home')} right={<CoinChip />} wide>
      <Tabs tabs={TABS} value={tab} onChange={setShopTab} />
      <div className="mt-4">
        {tab === 'characters' && <Characters />}
        {tab === 'boards' && <Boards />}
        {tab === 'upgrades' && <Upgrades />}
        {tab === 'items' && <Items />}
      </div>
    </Sheet>
  )
}
