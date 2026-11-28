import type * as React from 'react';
import type { DashboardPlayer } from '@/types/api.types';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  Trophy,
  Sparkles,
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
  return 'from-sapphire-blue via-[#198cd8] to-tita-teal';
}

function getLeaderboardRankBadgeStyle(
  rank: string | number,
  isInPlacement: boolean,
): { containerClass: string; textLabel: string; isNumeric: boolean } {
  const isRanked = rank !== '-' && rank !== '';
  const numRank = isRanked ? Number(rank) : undefined;

  if (isRanked && numRank === 1) {
    return {
      containerClass:
        'bg-amber-100 text-amber-700 border-amber-400/80 dark:bg-amber-950/90 dark:text-amber-300 dark:border-amber-400/60',
      textLabel: '1',
      isNumeric: true,
    };
  }
  if (isRanked && numRank === 2) {
    return {
      containerClass:
        'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-500/70',
      textLabel: '2',
      isNumeric: true,
    };
  }
  if (isRanked && numRank === 3) {
    return {
      containerClass:
        'bg-orange-100 text-orange-700 border-orange-400/75 dark:bg-orange-950/90 dark:text-orange-300 dark:border-orange-400/60',
      textLabel: '3',
      isNumeric: true,
    };
  }
  if (isRanked && numRank !== undefined && !Number.isNaN(numRank)) {
    return {
      containerClass:
        'bg-secondary text-muted-foreground border-border dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
      textLabel: String(numRank),
      isNumeric: true,
    };
  }
  if (isInPlacement) {
    return {
      containerClass:
        'bg-blue-50 text-sapphire-blue border-sapphire-blue/40 dark:bg-blue-950/90 dark:text-blue-300 dark:border-blue-400/50',
      textLabel: '定級',
      isNumeric: false,
    };
  }
  return {
    containerClass:
      'bg-surface-subtle text-muted-foreground border-dashed border-border dark:bg-slate-900 dark:text-slate-400',
    textLabel: '-',
    isNumeric: false,
  };
}

function RecentFormCircles({
  recentForm,
  size = 'md',
}: Readonly<{
  recentForm: string[];
  size?: 'sm' | 'md';
}>) {
  return (
    <div
      className={cn(
        size === 'sm'
          ? 'flex items-center gap-1.5'
          : 'grid grid-cols-5 gap-1 xl:gap-1.5 items-center justify-items-center w-full py-1 px-0.5',
      )}
      aria-label="近 5 場勝負（由左至右為最新到較舊）"
    >
      {Array.from({ length: 5 }).map((_, idx) => {
        const res = recentForm[idx];
        const label = res === 'W' ? '勝' : res === 'L' ? '敗' : '-';
        return (
          <span
            key={idx}
            title={
              res === 'W'
                ? idx === 0
                  ? '最新一場：勝'
                  : '勝'
                : res === 'L'
                  ? idx === 0
                    ? '最新一場：敗'
                    : '敗'
                  : '尚無紀錄'
            }
            className={cn(
              'rounded-full shrink-0 flex items-center justify-center font-display font-black leading-none select-none',
              size === 'sm'
                ? 'size-6 text-[0.6875rem]'
                : 'w-full max-w-[26px] aspect-square text-[0.6875rem] xl:text-xs',
              res === 'W'
                ? cn('bg-emerald-500 text-white shadow-2xs', idx === 0 && 'ring-2 ring-emerald-500/35')
                : res === 'L'
                  ? cn('bg-rose-500 text-white shadow-2xs', idx === 0 && 'ring-2 ring-rose-500/35')
                  : 'border border-dashed border-border bg-surface-subtle/80 text-muted-foreground/45',
            )}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
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
    const stdBadge = getLeaderboardRankBadgeStyle(displayRank, false);
    return (
      <Card className="group relative transition-all duration-300 overflow-visible rounded-2xl bg-card hover:bg-secondary/60 p-4 mt-3 border border-border shadow-xs">
        <Link
          to={`?inspect=${player.id}`}
          className="block rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue"
        >
          <div
            className={cn(
              'absolute -left-2 -top-2.5 sm:-left-3 sm:-top-3 flex items-center justify-center font-display font-black rounded-full shadow-md z-20 border-2 ring-4 ring-surface-shell transform transition-transform group-hover:scale-105 tabular-nums size-9 sm:size-10 text-sm sm:text-base',
              stdBadge.containerClass,
            )}
          >
            {stdBadge.textLabel}
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
                  <h3 className="font-display font-bold truncate transition-colors text-sm sm:text-base text-foreground group-hover:text-sapphire-blue">
                    {player.name}
                  </h3>
                  <span className="text-xs font-medium truncate text-muted-foreground mt-0.5">
                    @{player.username}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-display font-bold tracking-tight tabular-nums leading-none text-xl sm:text-2xl text-foreground">
                  {Math.round(displayRating)}
                </div>
                <p className="text-xs font-sans font-semibold mt-1 flex items-center gap-1 justify-end text-muted-foreground">
                  分
                  <TrendingUp size={12} aria-hidden="true" className="text-sapphire-blue" />
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2 sm:gap-3 mt-4 pt-3.5 border-t border-border">
              <div className="space-y-0.5">
                <p className="text-xs font-sans font-medium text-muted-foreground">
                  勝率
                </p>
                <p className="font-display font-bold text-base tabular-nums text-foreground">
                  {String(displayStats.winRate).replace('%', '')}%
                </p>
              </div>
              <div className="space-y-0.5 pl-3 border-l border-border">
                <p className="text-xs font-sans font-medium text-muted-foreground">
                  總場次
                </p>
                <p className="font-display font-bold text-base tabular-nums text-foreground">
                  {(displayStats.wins || 0) + (displayStats.losses || 0)}
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs font-sans font-medium text-muted-foreground">
                  戰績
                </p>
                <div className="flex items-center justify-end gap-1 text-xs sm:text-sm font-display font-bold tabular-nums">
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

  // Featured: Personal Hero Card (Sleek Single-Panel Mobile + 4-Pod Bento Desktop)
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
  const isInPlacement =
    !hasNumericRank && seasonMatches > 0 && seasonMatches < SEASON_PLACEMENT_MATCHES;
  const rankBadge = getLeaderboardRankBadgeStyle(displayRank, isInPlacement);

  return (
    <Card className="group relative transition-all duration-300 overflow-hidden sm:overflow-visible rounded-2xl md:rounded-3xl arena-hero-surface text-foreground p-4 sm:p-6 mt-1 sm:mt-3 border border-border/90 shadow-sm">
      <div
        aria-hidden="true"
        className="hidden sm:block absolute left-14 right-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-sapphire-blue via-[#198cd8] to-tita-teal opacity-90 pointer-events-none"
      />
      {/* Floating Rank Badge (Tablet / Desktop — matches Leaderboard MedalBadge) */}
      <div
        title={
          isInPlacement
            ? `定級賽進行中（${seasonMatches}/${SEASON_PLACEMENT_MATCHES} 場）`
            : hasNumericRank
              ? `目前積分榜第 ${displayRank} 名`
              : '尚未完成本季定級'
        }
        className={cn(
          'hidden sm:flex absolute -left-3 -top-3 items-center justify-center font-display font-bold shadow-md z-20 border-2 ring-4 ring-surface-shell transform transition-transform group-hover:scale-105 tabular-nums',
          isInPlacement
            ? 'flex-col rounded-2xl px-2 py-1.5 min-w-12 leading-none'
            : 'rounded-full size-12 text-lg',
          rankBadge.containerClass,
        )}
      >
        {isInPlacement ? (
          <>
            <span className="text-xs font-sans font-semibold opacity-85">定級</span>
            <span className="text-xs mt-0.5">
              {seasonMatches}/{SEASON_PLACEMENT_MATCHES}
            </span>
          </>
        ) : (
          rankBadge.textLabel
        )}
      </div>

      <CardContent className="p-0 space-y-3.5 sm:space-y-5">
        {/* Zone 1: Player Identity & Live Score */}
        <Link
          to={`?inspect=${player.id}`}
          className="block rounded-2xl pt-0 sm:pt-1 pl-0 sm:pl-6 focus-visible:outline-2 focus-visible:outline-sapphire-blue"
        >
          <div className="flex items-start justify-between gap-3 sm:gap-4 w-full">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div
                className={cn(
                  'relative shrink-0 p-[2px] sm:p-[2.5px] rounded-2xl bg-gradient-to-br shadow-sm',
                  getTierAvatarRing(displayRating),
                )}
              >
                {/* Mobile Rank Badge (matches Leaderboard MedalBadge colors & text) */}
                <span
                  className={cn(
                    'sm:hidden absolute -top-2 -left-2 z-10 font-display font-bold flex items-center justify-center shadow-sm border ring-2 ring-card tabular-nums leading-none',
                    isInPlacement
                      ? 'rounded-lg px-1.5 min-h-5 text-xs'
                      : 'rounded-full size-6 text-xs',
                    rankBadge.containerClass,
                  )}
                >
                  {isInPlacement ? `${seasonMatches}/${SEASON_PLACEMENT_MATCHES}` : rankBadge.textLabel}
                </span>
                <PlayerAvatar
                  src={player.avatar}
                  name={player.name}
                  className="size-12 sm:size-18 rounded-[13px] sm:rounded-[14px] bg-card text-lg sm:text-xl"
                />
                {player.isVerified && (
                  <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 sm:p-1 shadow-md bg-sapphire-blue text-white ring-2 ring-card">
                    <ShieldCheck size={11} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                  <h3 className="font-display font-bold truncate leading-tight transition-colors text-lg sm:text-2xl text-foreground group-hover:text-sapphire-blue dark:group-hover:text-blue-300">
                    {player.name}
                  </h3>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full border text-xs font-semibold shadow-2xs whitespace-nowrap',
                      tier.color,
                    )}
                  >
                    {tier.icon} {tier.name}
                  </div>
                  {isInPlacement && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 border border-sapphire-blue/25 text-xs font-semibold whitespace-nowrap tabular-nums">
                      定級賽 {seasonMatches}/{SEASON_PLACEMENT_MATCHES} · K=32
                    </span>
                  )}
                  {currentStreak >= 2 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-smash-orange to-rose-500 text-white text-xs font-semibold shadow-xs whitespace-nowrap">
                      <Flame size={12} aria-hidden="true" />
                      {currentStreak} 連勝
                    </span>
                  )}
                </div>

                {/* Single-line Clean Metadata (No chunky loadout boxes) */}
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate mt-1">
                  {departmentLabel} · {handLabel}持拍
                  {rubbersLabel && <span className="hidden sm:inline"> · {rubbersLabel}</span>}
                </p>
              </div>
            </div>

            {/* Live Rating Block */}
            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span className="font-display font-black tracking-tight tabular-nums leading-none text-3xl sm:text-5xl text-foreground">
                  {currentRounded}
                </span>
                <span className="text-xs sm:text-sm font-sans font-semibold text-muted-foreground">
                  分
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-1.5 sm:mt-2">
                {ptsChange !== 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                      ptsChange > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400',
                    )}
                  >
                    {ptsChange > 0 ? (
                      <TrendingUp size={13} aria-hidden="true" />
                    ) : (
                      <TrendingDown size={13} aria-hidden="true" />
                    )}
                    {ptsChange > 0 ? `+${ptsChange}` : ptsChange} 分
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    基準 1000 分
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* Zone 2A (Mobile Only): Unified Compact Panel */}
        <div className="sm:hidden rounded-2xl bg-card/90 dark:bg-slate-900/65 border border-border/80 shadow-2xs overflow-hidden divide-y divide-border/70">
          {/* Top 3-Column KPI Strip */}
          <div className="grid grid-cols-3 divide-x divide-border/70">
            <div className="px-3 py-2.5 min-w-0">
              <p className="text-xs font-medium text-muted-foreground leading-none">
                勝率 · {totalMatches}場
              </p>
              <p className="text-lg font-display font-bold text-foreground tabular-nums leading-tight mt-1">
                {winRateNum}%
              </p>
              <p className="text-xs font-display font-semibold tabular-nums leading-none mt-1">
                <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>
                <span className="text-muted-foreground/40 mx-0.5">·</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
              </p>
            </div>

            <div className="px-3 py-2.5 min-w-0">
              <p className="text-xs font-medium text-muted-foreground leading-none flex items-center gap-1">
                <Trophy size={11} className="text-olympic-gold shrink-0" aria-hidden="true" />
                <span className="truncate">巔峰</span>
              </p>
              <p className="text-lg font-display font-bold text-foreground tabular-nums leading-tight mt-1">
                {peakMmr}
                <span className="text-xs font-medium text-muted-foreground ml-0.5">分</span>
              </p>
              <p className="text-xs font-medium text-muted-foreground truncate leading-none mt-1">
                {isAtPeak ? '歷史新高' : peakGap > 0 ? `差 ${peakGap} 分` : '首戰新高'}
              </p>
            </div>

            {nextRival ? (
              <Link
                to={`?inspect=${nextRival.id}`}
                className="px-3 py-2.5 min-w-0 block hover:bg-sapphire-blue/5 transition-colors"
              >
                <p className="text-xs font-medium text-muted-foreground leading-none flex items-center justify-between gap-0.5">
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <Target size={11} className="text-smash-orange shrink-0" aria-hidden="true" />
                    超車 {nextRival.target_rank}名
                  </span>
                  <ChevronRight size={12} className="text-muted-foreground/70 shrink-0" aria-hidden="true" />
                </p>
                <p className="text-lg font-display font-bold text-smash-orange tabular-nums leading-tight mt-1">
                  -{nextRival.mmr_gap}
                  <span className="text-xs font-medium ml-0.5">分</span>
                </p>
                <p className="text-xs font-semibold text-foreground/85 truncate leading-none mt-1">
                  {nextRival.name}
                </p>
              </Link>
            ) : (
              <div className="px-3 py-2.5 min-w-0">
                <p className="text-xs font-medium text-muted-foreground leading-none flex items-center gap-0.5">
                  <Target size={11} className="text-olympic-gold shrink-0" aria-hidden="true" />
                  排名
                </p>
                <p className="text-sm font-display font-bold text-foreground leading-tight mt-1.5 truncate">
                  {hasNumericRank
                    ? '👑 榜首'
                    : isInPlacement
                      ? `定級 ${seasonMatches}/${SEASON_PLACEMENT_MATCHES}`
                      : '待定級'}
                </p>
                <p className="text-xs font-medium text-muted-foreground truncate leading-none mt-1">
                  {hasNumericRank ? '全場領先' : 'K=32 加速'}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Single-Row Recent 5 Form */}
          <div className="px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                近 5 場
              </span>
              {recentForm.length > 0 && recent5Delta !== 0 && (
                <span
                  className={cn(
                    'text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                    recent5Delta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400',
                  )}
                >
                  {recent5Delta > 0 ? `+${recent5Delta}` : recent5Delta} 分
                </span>
              )}
            </div>
            <RecentFormCircles recentForm={recentForm} size="sm" />
          </div>
        </div>

        {/* Zone 2B (Tablet / Desktop): Unified Single Divided Glass Bar (Zero Card-in-Card Bloat) */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:ml-6 rounded-2xl bg-card/90 dark:bg-slate-900/65 border border-border/80 divide-y sm:divide-y-0 lg:divide-x divide-border/70 overflow-hidden shadow-2xs">
          {/* Col 1: Win Rate & W-L Split */}
          <div className="min-w-0 p-4 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                勝率 &amp; 戰績
              </span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                {totalMatches} 場
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-2xl font-display font-bold text-foreground tabular-nums leading-none">
                {winRateNum}%
              </p>
              <div className="h-1.5 w-full rounded-full bg-rose-500/20 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${winBarPercent}%` }}
                />
              </div>
              <p className="text-xs font-display font-semibold tabular-nums leading-none">
                <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>
                <span className="text-muted-foreground/40 mx-1">·</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
              </p>
            </div>
          </div>

          {/* Col 2: Recent 5 Form & Net Delta */}
          <div className="min-w-0 p-4 flex flex-col justify-between gap-2 sm:border-l sm:border-border/70 lg:border-l-0">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap truncate">
                近 5 場手感
              </span>
              {recentForm.length > 0 && recent5Delta !== 0 && (
                <span
                  className={cn(
                    'text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                    recent5Delta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400',
                  )}
                >
                  {recent5Delta > 0 ? `+${recent5Delta}` : recent5Delta} 分
                </span>
              )}
            </div>
            <div>
              <RecentFormCircles recentForm={recentForm} size="md" />
            </div>
          </div>

          {/* Col 3: Rival Overtake Radar */}
          {nextRival ? (
            <Link
              to={`?inspect=${nextRival.id}`}
              className="min-w-0 p-4 hover:bg-surface-subtle/70 flex flex-col justify-between gap-2 transition-colors sm:border-t sm:border-border/70 lg:border-t-0"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Target size={12} className="text-smash-orange shrink-0" aria-hidden="true" />
                  超車目標
                </span>
                <span className="text-xs font-display font-bold text-smash-orange tabular-nums whitespace-nowrap">
                  差 {nextRival.mmr_gap} 分
                </span>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  src={nextRival.avatar}
                  name={nextRival.name}
                  className="size-8 rounded-xl text-xs shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-foreground truncate leading-tight">
                    {nextRival.target_rank}名 {nextRival.name}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground tabular-nums mt-0.5">
                    {nextRival.mmr} 分
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="min-w-0 p-4 flex flex-col justify-between gap-2 sm:border-t sm:border-border/70 lg:border-t-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Target size={12} className="text-olympic-gold shrink-0" aria-hidden="true" />
                  目前排名位置
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-display font-bold text-foreground leading-tight truncate">
                  {hasNumericRank
                    ? '👑 全場最高積分'
                    : isInPlacement
                      ? `定級賽 (${seasonMatches}/${SEASON_PLACEMENT_MATCHES}) · K=32`
                      : `定級賽 (0/${SEASON_PLACEMENT_MATCHES}) · K=32`}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1 truncate">
                  {hasNumericRank
                    ? '持續守住領先優勢'
                    : isInPlacement
                      ? `再完成 ${SEASON_PLACEMENT_MATCHES - seasonMatches} 場即正式入榜`
                      : `打滿 ${SEASON_PLACEMENT_MATCHES} 場即正式入榜`}
                </p>
              </div>
            </div>
          )}

          {/* Col 4: Career Peak Rating */}
          <div className="min-w-0 p-4 flex flex-col justify-between gap-2 sm:border-t sm:border-l sm:border-border/70 lg:border-t-0 lg:border-l-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                <Trophy size={12} className="text-olympic-gold shrink-0" aria-hidden="true" />
                生涯巔峰
              </span>
              {isAtPeak && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300 whitespace-nowrap shrink-0">
                  <Sparkles size={11} aria-hidden="true" />
                  紀錄中
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground tabular-nums leading-none">
                {peakMmr}
                <span className="text-xs font-medium text-muted-foreground ml-1">分</span>
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5 truncate">
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
        <div className="pt-3 sm:pt-4 border-t border-border/70 pl-0 sm:pl-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="min-w-0 truncate leading-snug">
                {tierProgress.nextTierName ? (
                  <>
                    <span className="font-semibold text-foreground">
                      距 {tierProgress.nextTierName} ({tierProgress.targetMmr})
                    </span>
                    <span className="text-muted-foreground font-medium ml-1.5">
                      還差{' '}
                      <span className="text-foreground font-bold tabular-nums">
                        {tierProgress.remainingMmr}
                      </span>{' '}
                      分 · 約再贏{' '}
                      <span className="text-sapphire-blue dark:text-blue-300 font-bold tabular-nums">
                        {estimatedWinsToNextTier}
                      </span>{' '}
                      場
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-foreground">已登頂最高段位 · 菁英殿堂</span>
                )}
              </div>
              <span className="font-display font-bold text-xs sm:text-sm text-sapphire-blue dark:text-olympic-gold tabular-nums shrink-0">
                {tierProgress.progressPercent}%
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden"
              role="progressbar"
              aria-label="段位晉級進度"
              aria-valuenow={tierProgress.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  tierProgress.progressPercent >= 85
                    ? 'bg-gradient-to-r from-smash-orange via-olympic-gold to-amber-300'
                    : 'bg-gradient-to-r from-sapphire-blue to-tita-teal',
                )}
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
