import type * as React from 'react';
import type { DashboardPlayer } from '@/types/api.types';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Building2,
  Flame,
  Target,
  Trophy,
  Zap,
  Sparkles,
  Swords,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { getTierBadge, getTierProgress, SEASON_PLACEMENT_MATCHES } from '@/lib/ranking';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface RankingCardProps {
  player: DashboardPlayer;
  variant?: 'featured' | 'standard';
  actionSlot?: React.ReactNode;
}

function getTierAvatarRing(mmr: number): string {
  if (mmr >= 1320) return 'from-amber-400 via-yellow-300 to-amber-500';
  if (mmr >= 1180) return 'from-amber-400 via-orange-400 to-yellow-500';
  if (mmr >= 1050) return 'from-slate-300 via-blue-300 to-indigo-400';
  return 'from-sapphire-blue via-sky-400 to-indigo-500';
}

export function RankingCard({
  player,
  variant = 'standard',
  actionSlot,
}: Readonly<RankingCardProps>) {
  const isFeatured = variant === 'featured';

  const displayRating = player.global_mmr || player.rating;
  const displayRank = player.rank;
  const displayStats = player.stats;
  const tier = getTierBadge(displayRating);

  if (!isFeatured) {
    return (
      <Card className="group relative transition-all duration-300 overflow-visible rounded-2xl bg-card hover:bg-secondary/60 p-4 mt-3 border border-border shadow-xs">
        <Link
          to={`?inspect=${player.id}`}
          className="block rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue"
        >
          <div className="absolute -left-2 -top-2.5 sm:-left-3 sm:-top-3 flex items-center justify-center font-display font-black rounded-full shadow-lg z-20 border-4 border-surface-shell transform transition-transform group-hover:scale-105 tabular-nums size-10 sm:size-11 text-base sm:text-lg bg-sapphire-blue text-white">
            {displayRank}
          </div>

          <CardContent className="p-0 flex flex-col pt-2 pl-5 sm:pl-6">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <PlayerAvatar
                    src={player.avatar}
                    name={player.name}
                    className="rounded-full transition-all group-hover:ring-2 group-hover:ring-offset-2 size-11 sm:size-12 border border-border group-hover:ring-sapphire-blue text-sm"
                  />
                  {player.isVerified && (
                    <div className="absolute -bottom-1 -right-1 rounded-full p-1 shadow-md bg-blue-100 text-primary-navy dark:bg-blue-500/20 dark:text-blue-300">
                      <ShieldCheck size={12} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <h3 className="font-display font-black truncate transition-colors text-sm sm:text-base text-foreground group-hover:text-sapphire-blue">
                    {player.name}
                  </h3>
                  <span className="text-xs font-bold truncate text-muted-foreground mt-0.5">
                    @{player.username}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-display font-black tracking-tight tabular-nums leading-none text-xl sm:text-2xl text-foreground">
                  {Math.round(displayRating)}
                </div>
                <p className="text-xs uppercase tracking-wider font-sans font-black mt-1.5 flex items-center gap-1 justify-end text-muted-foreground">
                  ELO
                  <TrendingUp size={11} aria-hidden="true" className="text-sapphire-blue" />
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2 sm:gap-3 mt-4 pt-3.5 border-t border-border">
              <div className="space-y-0.5">
                <p className="text-xs uppercase font-sans font-black tracking-wider text-muted-foreground">
                  勝率
                </p>
                <p className="font-display font-black text-base tabular-nums text-foreground">
                  {String(displayStats.winRate).replace('%', '')}%
                </p>
              </div>
              <div className="space-y-0.5 pl-3 border-l border-border">
                <p className="text-xs uppercase font-sans font-black tracking-wider text-muted-foreground">
                  總場次
                </p>
                <p className="font-display font-black text-base tabular-nums text-foreground">
                  {(displayStats.wins || 0) + (displayStats.losses || 0)}
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs uppercase font-sans font-black tracking-wider text-muted-foreground">
                  戰績
                </p>
                <div className="flex items-center justify-end gap-1 text-xs sm:text-sm font-display font-black tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {displayStats.wins || 0}勝
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-rose-500 dark:text-rose-400">
                    {displayStats.losses || 0}敗
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    );
  }

  // Featured: Dopamine Pro Player Card (Crisp Daylight Aurora in Light Mode + Cyber Navy in Dark Mode)
  const tierProgress = getTierProgress(displayRating);
  const wins = Number(displayStats.wins || 0);
  const losses = Number(displayStats.losses || 0);
  const totalMatches = wins + losses;
  const winRateNum = parseFloat(String(displayStats.winRate || '0').replace('%', '')) || 0;
  const winBarPercent = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const currentRounded = Math.round(displayRating);
  const peakMmr = Math.round(player.peakMmr ?? displayRating);
  const peakGap = Math.max(0, peakMmr - currentRounded);
  const isAtPeak = totalMatches > 0 && currentRounded >= peakMmr;

  const ptsChange = player.ptsChange ?? 0;
  const currentStreak = player.currentStreak ?? 0;
  const recentForm = player.recentForm ?? [];
  const recent5Delta = player.recent5Delta ?? 0;
  const nextRival = player.nextRival;

  const rubbersLabel = [player.rubberForehand, player.rubberBackhand].filter(Boolean).join(' / ');
  const departmentLabel =
    player.department && player.department !== '未設定單位' ? player.department : '未設定處室';
  const handLabel = player.dominantHand || '右手';
  const estimatedWinsToNextTier =
    tierProgress.remainingMmr > 0 ? Math.max(1, Math.ceil(tierProgress.remainingMmr / 16)) : 0;

  const hasNumericRank = displayRank !== '-' && displayRank !== '';
  const seasonMatches = player.seasonMatchesPlayed ?? 0;
  const isInPlacement = !hasNumericRank && seasonMatches > 0 && seasonMatches < SEASON_PLACEMENT_MATCHES;
  const rankBadgeLabel = hasNumericRank
    ? `#${displayRank}`
    : isInPlacement
      ? `${seasonMatches}/${SEASON_PLACEMENT_MATCHES}`
      : 'NEW';

  return (
    <Card className="group relative transition-all duration-300 overflow-hidden sm:overflow-visible rounded-2xl md:rounded-3xl arena-hero-surface text-foreground p-4 sm:p-6 mt-1 sm:mt-3 border border-blue-200/85 dark:border-slate-700/80 shadow-md shadow-sapphire-blue/8 dark:shadow-primary-navy/30">
      {/* Floating Rank Badge (Tablet / Desktop) */}
      <div
        className={cn(
          'hidden sm:flex absolute -left-3 -top-3 items-center justify-center font-display font-black rounded-full shadow-lg z-20 border-4 border-surface-shell transform transition-transform group-hover:scale-105 tabular-nums size-14',
          hasNumericRank
            ? 'bg-olympic-gold text-white text-xl'
            : isInPlacement
              ? 'bg-sapphire-blue text-white text-sm tracking-tight'
              : 'bg-olympic-gold text-white text-xs tracking-wider',
        )}
      >
        {rankBadgeLabel}
      </div>

      <CardContent className="p-0 space-y-4 sm:space-y-5">
        {/* Zone 1: Player Identity, Loadout Strip & Live ELO Momentum */}
        <Link
          to={`?inspect=${player.id}`}
          className="block rounded-2xl pt-0 sm:pt-1 pl-0 sm:pl-6 focus-visible:outline-2 focus-visible:outline-sapphire-blue"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3.5 sm:gap-4 w-full">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div
                className={cn(
                  'relative shrink-0 p-[2.5px] rounded-2xl bg-gradient-to-br shadow-md',
                  getTierAvatarRing(displayRating),
                )}
              >
                <span
                  className={cn(
                    'sm:hidden absolute -top-2 -left-2 z-10 min-w-6 h-6 px-1.5 rounded-full text-white font-display font-black flex items-center justify-center shadow-md ring-2 ring-card tabular-nums',
                    hasNumericRank
                      ? 'bg-olympic-gold text-[11px]'
                      : isInPlacement
                        ? 'bg-sapphire-blue text-[10px]'
                        : 'bg-olympic-gold text-[9px] tracking-wider',
                  )}
                >
                  {rankBadgeLabel}
                </span>
                <PlayerAvatar
                  src={player.avatar}
                  name={player.name}
                  className="size-14 sm:size-18 rounded-[14px] bg-card text-xl"
                />
                {player.isVerified && (
                  <div className="absolute -bottom-1 -right-1 rounded-full p-1 shadow-md bg-sapphire-blue text-white ring-2 ring-card">
                    <ShieldCheck size={12} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
                  <h3 className="font-display font-black truncate leading-tight transition-colors text-lg sm:text-2xl text-foreground group-hover:text-sapphire-blue dark:group-hover:text-blue-300">
                    {player.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-black shadow-2xs whitespace-nowrap',
                        tier.color,
                      )}
                    >
                      {tier.icon} {tier.name}
                    </div>
                    {isInPlacement && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 border border-sapphire-blue/25 text-xs font-black whitespace-nowrap tabular-nums">
                        定級賽 {seasonMatches}/{SEASON_PLACEMENT_MATCHES} · K=32
                      </span>
                    )}
                    {currentStreak >= 2 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-black shadow-xs whitespace-nowrap">
                        <Flame size={12} aria-hidden="true" />
                        {currentStreak} 連勝中
                      </span>
                    )}
                    {currentStreak === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/25 text-xs font-black whitespace-nowrap">
                        <Zap size={11} aria-hidden="true" />
                        近期獲勝
                      </span>
                    )}
                    {currentStreak <= -2 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/12 text-muted-foreground border border-border text-xs font-black whitespace-nowrap">
                        <Swords size={11} aria-hidden="true" />
                        蓄力反擊
                      </span>
                    )}
                  </div>
                </div>

                {/* Loadout & Identity Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/85 dark:bg-white/10 border border-blue-100 dark:border-white/10 text-xs font-bold text-foreground/85 whitespace-nowrap">
                    <Building2 size={11} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                    {departmentLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/85 dark:bg-white/10 border border-blue-100 dark:border-white/10 text-xs font-bold text-foreground/85 whitespace-nowrap">
                    {handLabel}持拍
                  </span>
                  {rubbersLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/85 dark:bg-white/10 border border-blue-100 dark:border-white/10 text-xs font-bold text-foreground/85 truncate max-w-full sm:max-w-[220px]">
                      {rubbersLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live ELO Spotlight Strip (Mobile) / Score Block (Desktop) */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/55 border border-blue-100/90 dark:border-white/10 shadow-2xs sm:block sm:p-0 sm:rounded-none sm:bg-transparent dark:sm:bg-transparent sm:border-0 sm:shadow-none sm:text-right shrink-0">
              <div className="flex items-baseline sm:justify-end">
                <span className="font-display font-black tracking-tight tabular-nums leading-none text-3xl sm:text-5xl text-foreground">
                  {currentRounded}
                </span>
                <span className="sm:hidden text-xs uppercase tracking-wider font-sans font-black text-muted-foreground ml-1.5">
                  ELO
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5 sm:mt-2">
                <span className="hidden sm:inline text-xs uppercase tracking-wider font-sans font-black text-muted-foreground">
                  ELO
                </span>
                {ptsChange !== 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-full text-xs font-display font-black tabular-nums whitespace-nowrap',
                      ptsChange > 0
                        ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300',
                    )}
                  >
                    {ptsChange > 0 ? (
                      <TrendingUp size={11} aria-hidden="true" />
                    ) : (
                      <TrendingDown size={11} aria-hidden="true" />
                    )}
                    {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full sm:p-0 sm:bg-transparent bg-secondary/70 text-xs font-bold text-muted-foreground">
                    基準 1000
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* Zone 2: Mobile-First 1-2-1 Bento Grid (Tablet 2x2 / Desktop 4-col) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pl-0 sm:pl-6">
          {/* Pod 1: Win Rate & W-L Split */}
          <div className="col-span-1 order-1 min-w-0 overflow-hidden rounded-2xl p-3 sm:p-3.5 bg-white/85 dark:bg-slate-900/60 border border-blue-100/90 dark:border-white/10 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-muted-foreground whitespace-nowrap">
                勝率<span className="hidden sm:inline"> &amp; 戰績</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[11px] font-display font-black text-foreground tabular-nums whitespace-nowrap">
                {totalMatches} 場
              </span>
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <span className="text-2xl font-display font-black text-foreground tabular-nums leading-none">
                  {winRateNum}%
                </span>
                <span className="text-xs font-display font-black tabular-nums whitespace-nowrap mt-0.5 sm:mt-0">
                  <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>
                  <span className="mx-1" />
                  <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-rose-500/25 overflow-hidden mt-2 flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${winBarPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pod 2: Recent 5 Form & Net Delta */}
          <div className="col-span-2 sm:col-span-1 order-3 sm:order-2 min-w-0 overflow-hidden rounded-2xl p-3 sm:p-3.5 bg-white/85 dark:bg-slate-900/60 border border-blue-100/90 dark:border-white/10 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-muted-foreground whitespace-nowrap">
                近 5 場手感
              </span>
              {recentForm.length > 0 && recent5Delta !== 0 ? (
                <span
                  className={cn(
                    'text-[11px] font-display font-black tabular-nums whitespace-nowrap',
                    recent5Delta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400',
                  )}
                >
                  <span className="sm:hidden">淨變動 </span>
                  {recent5Delta > 0 ? `+${recent5Delta}` : recent5Delta} 分
                </span>
              ) : recentForm.length === 0 ? (
                <span className="text-[11px] font-bold text-muted-foreground sm:hidden">
                  尚無紀錄
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-5 gap-2 sm:gap-1.5">
              {Array.from({ length: 5 }).map((_, idx) => {
                const res = recentForm[idx];
                const label = res === 'W' ? '勝' : res === 'L' ? '敗' : '-';
                return (
                  <div
                    key={idx}
                    className={cn(
                      'h-9 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-sm sm:text-xs font-display font-black',
                      res === 'W'
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : res === 'L'
                          ? 'bg-rose-500 text-white shadow-2xs'
                          : 'border border-dashed border-border bg-surface-subtle/70 text-muted-foreground/40',
                    )}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pod 3: Rival Overtake Radar */}
          {nextRival ? (
            <Link
              to={`?inspect=${nextRival.id}`}
              className="col-span-2 sm:col-span-1 order-4 sm:order-3 min-w-0 overflow-hidden rounded-2xl p-3 sm:p-3.5 bg-white/85 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900/80 border border-blue-100/90 dark:border-white/10 hover:border-sapphire-blue/50 shadow-2xs flex flex-col justify-between gap-2 transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Target size={12} className="text-smash-orange shrink-0" aria-hidden="true" />
                  超車雷達
                </span>
                <span className="px-2 py-0.5 rounded-full bg-smash-orange/12 text-smash-orange text-[11px] font-display font-black whitespace-nowrap">
                  差 {nextRival.mmr_gap} 分
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-2 min-w-0">
                  <PlayerAvatar
                    src={nextRival.avatar}
                    name={nextRival.name}
                    className="size-9 sm:size-7 rounded-xl sm:rounded-lg text-xs sm:text-[10px] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-display font-black text-foreground truncate leading-tight">
                      #{nextRival.target_rank} {nextRival.name}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground tabular-nums">
                      {nextRival.mmr} ELO
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="sm:hidden text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              </div>
            </Link>
          ) : (
            <div className="col-span-2 sm:col-span-1 order-4 sm:order-3 min-w-0 overflow-hidden rounded-2xl p-3 sm:p-3.5 bg-white/85 dark:bg-slate-900/60 border border-amber-200/80 dark:border-amber-500/30 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Target size={12} className="text-olympic-gold shrink-0" aria-hidden="true" />
                  目前排名位置
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-display font-black text-foreground leading-tight truncate">
                  {hasNumericRank
                    ? '👑 全場最高積分'
                    : isInPlacement
                      ? `⚡ 定級賽 (${seasonMatches}/${SEASON_PLACEMENT_MATCHES}) · K=32`
                      : `⚡ 定級賽 (0/${SEASON_PLACEMENT_MATCHES}) · K=32`}
                </p>
                <p className="text-[11px] font-bold text-muted-foreground mt-0.5 truncate">
                  {hasNumericRank
                    ? '持續守住王座領先優勢'
                    : isInPlacement
                      ? `再完成 ${SEASON_PLACEMENT_MATCHES - seasonMatches} 場本季對戰即正式入榜`
                      : `打滿 ${SEASON_PLACEMENT_MATCHES} 場本季對戰即正式入榜`}
                </p>
              </div>
            </div>
          )}

          {/* Pod 4: Career Peak ELO */}
          <div className="col-span-1 order-2 sm:order-4 min-w-0 overflow-hidden rounded-2xl p-3 sm:p-3.5 bg-white/85 dark:bg-slate-900/60 border border-blue-100/90 dark:border-white/10 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                <Trophy size={12} className="text-olympic-gold shrink-0" aria-hidden="true" />
                生涯巔峰
              </span>
              {isAtPeak && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black whitespace-nowrap shrink-0">
                  <Sparkles size={10} aria-hidden="true" />
                  <span className="sm:hidden">新高</span>
                  <span className="hidden sm:inline">紀錄中</span>
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-display font-black text-foreground tabular-nums leading-none">
                {peakMmr}
                <span className="text-[11px] font-bold text-muted-foreground ml-1">ELO</span>
              </p>
              <p className="text-[11px] font-bold text-muted-foreground mt-1.5 truncate">
                {isAtPeak
                  ? '正處歷史最高點'
                  : peakGap > 0
                    ? `距巔峰差 ${peakGap} 分`
                    : '首戰即紀錄新高'}
              </p>
            </div>
          </div>
        </div>

        {/* Zone 3: Tier Promotion Bar + Report Score Action */}
        <div className="pt-3.5 sm:pt-4 border-t border-blue-200/60 dark:border-white/10 pl-0 sm:pl-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0 leading-snug">
                {tierProgress.nextTierName ? (
                  <>
                    <span className="font-black text-foreground">
                      距離 {tierProgress.nextTierName} ({tierProgress.targetMmr})
                    </span>
                    <span className="block sm:inline text-muted-foreground sm:text-foreground/85 font-bold mt-0.5 sm:mt-0 sm:ml-1.5">
                      還差{' '}
                      <span className="text-foreground font-black tabular-nums">
                        {tierProgress.remainingMmr}
                      </span>{' '}
                      ELO · 約再贏{' '}
                      <span className="text-sapphire-blue dark:text-blue-300 font-black tabular-nums">
                        {estimatedWinsToNextTier}
                      </span>{' '}
                      場
                    </span>
                  </>
                ) : (
                  <span className="font-black text-foreground">已登頂最高段位 · 菁英殿堂</span>
                )}
              </div>
              <span className="font-display font-black text-sm sm:text-xs text-sapphire-blue dark:text-olympic-gold tabular-nums shrink-0">
                {tierProgress.progressPercent}%
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden"
              role="progressbar"
              aria-label="段位晉級進度"
              aria-valuenow={tierProgress.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sapphire-blue via-blue-400 to-olympic-gold transition-all duration-500"
                style={{ width: `${tierProgress.progressPercent}%` }}
              />
            </div>
          </div>
          {actionSlot && <div className="w-full sm:w-auto shrink-0">{actionSlot}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
