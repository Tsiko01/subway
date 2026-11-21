import { motion } from 'framer-motion'
import { Award, CalendarCheck, Check, Gift, ListChecks, Rocket } from 'lucide-react'
import { achievementValue, dailyAvailable, dailyIndex, useGame } from '../game/store'
import { ACHIEVEMENTS, DAILY_REWARDS, missionProgress, missionReward, missionTarget, missionText, xpForLevel } from '../game/progression'
import { runtime } from '../game/runtime'
import { BoardIcon, CoinChip, CoinIcon, GoldButton, Progress, Sheet, Tabs } from './Buttons'

const TABS = [
  { id: 'missions', label: 'Missions', icon: ListChecks },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'daily', label: 'Daily', icon: CalendarCheck },
]

export function MissionList({ live = false }) {
  const missions = useGame((s) => s.profile.missions)
  return (
    <div className="grid gap-2">
      {missions.map((m) => {
        const target = missionTarget(m)
        const progress = Math.min(target, missionProgress(m, live ? runtime.stats : null))
        const reward = missionReward(m)
        return (
          <div key={`${m.id}-${m.tier}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.8rem] font-semibold text-silver">{missionText(m)}</span>
              <span className="flex shrink-0 items-center gap-1 text-[0.7rem] font-bold text-[#ffe08a]">
                <CoinIcon className="h-4 w-4" /> {reward.coins}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={progress} max={target} />
              <span className="tabular shrink-0 text-[0.66rem] text-mist/60">
                {progress.toLocaleString('en-US')} / {target.toLocaleString('en-US')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MissionsTab() {
  const profile = useGame((s) => s.profile)
  const need = xpForLevel(profile.level)
  return (
    <div>
      <div className="mb-3 rounded-2xl border border-azure/25 bg-azure/[0.06] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-azure to-azure-deep text-xl font-black text-white">{profile.level}</span>
          <div className="flex-1">
            <div className="text-[0.84rem] font-semibold text-silver">Level {profile.level} · score ×{Math.min(30, profile.level)}</div>
            <Progress value={profile.xp} max={need} className="mt-2" />
            <div className="mt-1 text-[0.64rem] text-mist/60">
              {profile.xp.toLocaleString('en-US')} / {need.toLocaleString('en-US')} XP · missions, distance and coins all earn XP
            </div>
          </div>
        </div>
      </div>
      <MissionList />
      <p className="mt-3 text-[0.7rem] text-mist/50">Completed missions pay out instantly and a harder one takes their place.</p>
    </div>
  )
}

function AchievementsTab() {
  const profile = useGame((s) => s.profile)
  const claim = useGame((s) => s.claimAchievement)
  return (
    <div className="grid gap-2">
      {ACHIEVEMENTS.map((a) => {
        const value = Math.min(a.goal, achievementValue(profile, a.stat))
        const done = value >= a.goal
        const claimed = profile.achievements[a.id]
        return (
          <div key={a.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${claimed ? 'border-white/5 bg-white/[0.015] opacity-60' : 'border-white/8 bg-white/[0.03]'}`}>
            <Award className={`h-6 w-6 shrink-0 ${done ? 'text-[#ffd23f]' : 'text-mist/40'}`} strokeWidth={1.6} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.8rem] font-semibold text-silver">{a.name}</div>
              <div className="text-[0.68rem] text-mist/60">{a.desc}</div>
              {!claimed && <Progress value={value} max={a.goal} className="mt-1.5" color={done ? 'bg-[#ffd23f]' : 'bg-azure'} />}
            </div>
            {claimed ? (
              <Check className="h-5 w-5 text-azure" />
            ) : (
              <GoldButton onClick={() => claim(a.id)} disabled={!done} className="!px-4">
                <CoinIcon className="h-4 w-4" /> {a.reward}
              </GoldButton>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DailyTab() {
  const profile = useGame((s) => s.profile)
  const claimDaily = useGame((s) => s.claimDaily)
  const available = dailyAvailable(profile)
  const next = dailyIndex(profile)
  return (
    <div>
      <p className="text-[0.78rem] text-mist/70">Come back every day — rewards grow over a 7-day streak. Miss a day and the streak starts again.</p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAILY_REWARDS.map((r, i) => {
          const past = available ? i < next : i <= next
          const today = available && i === next
          return (
            <motion.div
              key={i}
              animate={today ? { y: [0, -3, 0] } : {}}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className={`flex flex-col items-center rounded-2xl border px-1 py-3 text-center ${today ? 'border-[#ffd23f]/70 bg-[#ffd23f]/10' : past ? 'border-azure/30 bg-azure/[0.06]' : 'border-white/8 bg-white/[0.02]'}`}
            >
              <span className="text-[0.56rem] uppercase tracking-[0.2em] text-mist/60">Day {i + 1}</span>
              <span className="my-2">
                {r.boards && !r.coins ? <BoardIcon className="h-6 w-6 text-azure" /> : r.jets ? <Rocket className="h-6 w-6 text-azure" /> : <CoinIcon className="h-6 w-6" />}
              </span>
              <span className="text-[0.66rem] font-bold text-silver">
                {r.coins ? r.coins : r.boards ? `${r.boards}×` : `${r.jets}×`}
                {r.coins && r.boards ? ` +${r.boards}` : ''}
              </span>
              {past && <Check className="mt-1 h-3.5 w-3.5 text-azure" />}
            </motion.div>
          )
        })}
      </div>
      <div className="mt-5 flex justify-center">
        <GoldButton onClick={claimDaily} disabled={!available} className="!px-8 !py-3">
          <Gift className="h-4 w-4" /> {available ? `Claim day ${next + 1}` : 'Claimed today'}
        </GoldButton>
      </div>
    </div>
  )
}

export default function Missions() {
  const tab = useGame((s) => (['missions', 'achievements', 'daily'].includes(s.shopTab) ? s.shopTab : 'missions'))
  const setShopTab = useGame((s) => s.setShopTab)
  const openScreen = useGame((s) => s.openScreen)
  return (
    <Sheet kicker="Progression" title="Missions" onBack={() => openScreen('home')} right={<CoinChip />}>
      <Tabs tabs={TABS} value={tab} onChange={setShopTab} />
      <div className="mt-4">
        {tab === 'missions' && <MissionsTab />}
        {tab === 'achievements' && <AchievementsTab />}
        {tab === 'daily' && <DailyTab />}
      </div>
    </Sheet>
  )
}
