import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Crown,
  Flame,
  Loader2,
  MapPin,
  Rocket,
  Search,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { cn, formatLocalTime } from '@/lib/utils';
import { formatChallengeDateTimeLabel } from '@/lib/challengeUtils';
import { usePublicChallenges } from '@/hooks/useChallenges';
import type {
  ClubSpotlights,
  LeaderboardResponse,
  RawLeaderboardItem,
  SeasonPulse,
} from '@/types/api.types';

interface ClubRightRailProps {
  seasonData?: LeaderboardResponse;
  allTimeData?: LeaderboardResponse;
  isAllTimeFetching?: boolean;
  scope: 'season' | 'all-time';
  onScopeChange: (scope: 'season' | 'all-time') => void;
  currentUserId?: string;
  onInspectPlayer: (playerId: string) => void;
}

function getMedalClass(position: number): string {
  switch (position) {
    case 1:
      return 'bg-amber-400/20 text-amber-700 border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50';
    case 2:
      return 'bg-slate-200/90 text-slate-700 border-slate-300 dark:bg-slate-500/25 dark:text-slate-200 dark:border-slate-500/50';
    case 3:
      return 'bg-orange-400/20 text-orange-700 border-orange-400/60 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/50';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

function SeasonPulseCard({
  pulse,
  className,
}: Readonly<{
  pulse?: SeasonPulse | null;
  className?: string;
}>) {
  const navigate = useNavigate();

  if (!pulse) {
    return (
      <section aria-label="賽季脈動" className={cn('min-w-0', className)}>
        <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs p-4 sm:p-5 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarClock size={14} className="text-sapphire-blue" aria-hidden="true" />
              休賽季準備中
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
              休賽期
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            目前尚未開啟計分賽季，所有對戰仍會即時更新全域積分與歷史生涯總榜。
          </p>
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="w-full min-h-10 px-3.5 rounded-xl bg-surface-subtle hover:bg-secondary border border-border text-xs font-semibold text-foreground flex items-center justify-between transition-colors"
          >
            <span>查看生涯積分榜</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  const isCompleted = pulse.status === 'completed';
  const countdownLabel = isCompleted
    ? '已結算'
    : pulse.days_remaining == null
      ? '進行中'
      : pulse.days_remaining === 0
        ? '今日結算'
        : `剩 ${pulse.days_remaining} 天`;

  const startLabel = pulse.start_date ? formatLocalTime(pulse.start_date, 'MM/dd') : null;
  const endLabel = pulse.end_date ? formatLocalTime(pulse.end_date, 'MM/dd') : null;

  return (
    <section aria-label="賽季脈動" className={cn('min-w-0', className)}>
      <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs p-4 sm:p-5 space-y-3.5 overflow-hidden">
        {/* Top Header: Live indicator + Season Name + Countdown Badge */}
        <div className="flex items-start justify-between gap-2.5 min-w-0">
          <div className="min-w-0 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {!isCompleted && (
                <span className="relative flex size-2" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
              )}
              <span>{isCompleted ? '賽季已結算' : '賽季進行中'}</span>
            </div>
            <h2 className="text-base sm:text-lg font-display font-bold text-foreground truncate leading-tight">
              {pulse.season_name}
            </h2>
          </div>

          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
              isCompleted
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : pulse.days_remaining !== null &&
                    pulse.days_remaining !== undefined &&
                    pulse.days_remaining <= 7
                  ? 'bg-smash-orange/15 text-smash-orange'
                  : 'bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300',
            )}
          >
            <CalendarClock size={12} aria-hidden="true" />
            {countdownLabel}
          </span>
        </div>

        {/* Timeline Progress Bar (when dates are configured) */}
        {pulse.progress_percent != null && (
          <div className="space-y-1.5">
            <div
              className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden"
              role="progressbar"
              aria-label="賽季進行進度"
              aria-valuenow={pulse.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sapphire-blue to-tita-teal transition-all duration-500"
                style={{ width: `${pulse.progress_percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground tabular-nums">
              <span>{startLabel ? `開季 ${startLabel}` : '賽季進度'}</span>
              <span>
                {pulse.progress_percent}%{endLabel ? ` · 結算 ${endLabel}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Unified 3-Column Mini KPI Strip */}
        <div className="grid grid-cols-3 divide-x divide-border/70 rounded-xl bg-surface-subtle/50 border border-border/70 overflow-hidden">
          <div className="min-w-0 px-2.5 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground truncate">本季場次</p>
            <p className="text-base sm:text-lg font-display font-bold text-foreground tabular-nums leading-tight mt-0.5">
              {pulse.total_matches}
            </p>
          </div>
          <div className="min-w-0 px-2.5 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground truncate">近 7 天</p>
            <p className="text-base sm:text-lg font-display font-bold text-sapphire-blue dark:text-blue-300 tabular-nums leading-tight mt-0.5">
              {pulse.matches_last_7d}
            </p>
          </div>
          <div className="min-w-0 px-2.5 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground truncate">活躍人數</p>
            <p className="text-base sm:text-lg font-display font-bold text-foreground tabular-nums leading-tight mt-0.5">
              {pulse.active_players}
              <span className="text-xs font-medium text-muted-foreground">
                /{pulse.total_members}
              </span>
            </p>
          </div>
        </div>

        {/* Footer CTA to Season Prizes & Rules */}
        <button
          type="button"
          onClick={() => navigate(`/season/${encodeURIComponent(pulse.season_id)}`)}
          className="w-full min-h-10 px-3.5 rounded-xl bg-surface-subtle/80 hover:bg-secondary border border-border text-xs font-semibold text-foreground flex items-center justify-between transition-colors group"
        >
          <span className="inline-flex items-center gap-1.5">
            <Trophy size={13} className="text-olympic-gold shrink-0" aria-hidden="true" />
            <span>查看賽季獎勵與規章</span>
          </span>
          <ChevronRight
            size={14}
            className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>
    </section>
  );
}

function TopRivalsCard({
  data,
  scope,
  onScopeChange,
  isFetching,
  currentUserId,
  onInspectPlayer,
  className,
}: Readonly<{
  data?: LeaderboardResponse;
  scope: 'season' | 'all-time';
  onScopeChange: (scope: 'season' | 'all-time') => void;
  isFetching?: boolean;
  currentUserId?: string;
  onInspectPlayer: (playerId: string) => void;
  className?: string;
}>) {
  const navigate = useNavigate();
  const list = data?.leaderboard ?? [];
  const top5 = list.slice(0, 5);
  const allUnrankedPreview =
    top5.length > 0 && top5.every((player) => player.matches_played === 0);

  const myIndex = currentUserId
    ? list.findIndex((player) => player.player_id === currentUserId)
    : -1;
  const myEntry: RawLeaderboardItem | undefined =
    myIndex >= 0 && myIndex >= 5 ? list[myIndex] : undefined;
  const fifthPlayer = top5.length >= 5 ? top5[4] : top5[top5.length - 1];
  const gapToTop5 =
    myEntry && fifthPlayer ? Math.max(0, fifthPlayer.global_mmr - myEntry.global_mmr + 1) : 0;

  return (
    <section aria-label="群雄榜單" className={cn('space-y-3 min-w-0', className)}>
      {/* Section Header + Scope Toggle */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl text-foreground font-display font-bold tracking-tight flex items-center gap-1.5">
              <Crown size={18} className="text-olympic-gold shrink-0" aria-hidden="true" />
              <span>群雄榜單</span>
            </h2>
            {isFetching && (
              <Loader2
                size={13}
                className="animate-spin text-sapphire-blue shrink-0"
                aria-label="更新榜單中"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
            {scope === 'all-time' ? '生涯前 5 名' : '本季前 5 名'}
            {allUnrankedPreview && ' · 季前實力預排'}
          </p>
        </div>

        <div
          role="group"
          aria-label="切換榜單範圍"
          className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-secondary border border-border shrink-0"
        >
          {([
            { id: 'season', label: '本季' },
            { id: 'all-time', label: '總榜' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onScopeChange(tab.id)}
              className={cn(
                'min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                scope === tab.id
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Compact Top-5 Container */}
      <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs overflow-hidden">
        {top5.length > 0 ? (
          <>
            <div className="divide-y divide-border/70">
              {top5.map((player, idx) => {
                const isRanked = player.rank !== '-' && player.rank !== '';
                const numericPos = isRanked ? Number(player.rank) : idx + 1;
                const isMe = currentUserId === player.player_id;
                const trendStr = String(player.trend ?? '0');
                const isPositiveTrend = trendStr.startsWith('+');
                const streak = player.current_streak ?? 0;
                const weeklyDelta = player.weekly_mmr_delta ?? 0;
                const winRateRounded = Math.round(
                  parseFloat(String(player.win_rate || '0').replace('%', '')) || 0,
                );
                const losses = player.losses ?? Math.max(0, player.matches_played - player.wins);
                const dept =
                  player.department && player.department !== '未設定單位'
                    ? player.department
                    : '';

                return (
                  <button
                    key={player.player_id}
                    type="button"
                    onClick={() => onInspectPlayer(player.player_id)}
                    className={cn(
                      'w-full min-h-[60px] px-3.5 py-2.5 flex items-center gap-2.5 sm:gap-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-sapphire-blue',
                      isMe && 'bg-sapphire-blue/[0.05] dark:bg-blue-500/10',
                    )}
                  >
                    {/* Rank / Medal */}
                    <div className="w-8 shrink-0 flex flex-col items-center justify-center gap-0.5">
                      {isRanked && numericPos <= 3 ? (
                        <span
                          className={cn(
                            'size-7 rounded-full border flex items-center justify-center font-display font-bold text-xs tabular-nums',
                            getMedalClass(numericPos),
                          )}
                        >
                          {numericPos}
                        </span>
                      ) : isRanked ? (
                        <span className="font-display font-bold text-sm text-muted-foreground tabular-nums leading-none">
                          {numericPos}
                        </span>
                      ) : (
                        <span
                          title="季前依積分預排，完成首戰即正式上榜"
                          className="size-7 rounded-full border border-dashed border-border bg-surface-subtle/80 flex items-center justify-center font-display font-semibold text-xs text-muted-foreground tabular-nums"
                        >
                          {idx + 1}
                        </span>
                      )}

                      {trendStr !== '0' && (
                        <span
                          className={cn(
                            'text-xs font-semibold leading-none tabular-nums',
                            isPositiveTrend
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400',
                          )}
                        >
                          {isPositiveTrend ? '▲' : '▼'}
                          {trendStr.replace(/[+-]/, '')}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <PlayerAvatar
                      src={player.avatar_url}
                      name={player.player_name}
                      className={cn(
                        'size-10 rounded-xl shrink-0 text-xs border',
                        isRanked && numericPos === 1
                          ? 'border-amber-400 ring-2 ring-amber-400/25'
                          : 'border-border',
                      )}
                    />

                    {/* Player Name, Badges & Record */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-display font-semibold text-foreground truncate">
                          {player.player_name}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-xs font-semibold shrink-0 leading-none">
                            你
                          </span>
                        )}
                        {streak >= 2 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-500/12 text-smash-orange text-xs font-semibold tabular-nums shrink-0 whitespace-nowrap leading-none">
                            <Flame size={10} aria-hidden="true" />
                            {streak}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground truncate mt-0.5 tabular-nums">
                        {player.matches_played > 0 ? (
                          <>
                            {winRateRounded}% 勝率 · {player.wins}勝 {losses}敗
                          </>
                        ) : (
                          <>{dept ? `${dept} · ` : ''}等待開季首戰</>
                        )}
                      </p>
                    </div>

                    {/* Rating & Weekly Delta */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-display font-bold text-foreground tabular-nums leading-none">
                        {Math.round(player.global_mmr)}
                      </p>
                      {weeklyDelta !== 0 ? (
                        <p
                          title="近 7 日積分漲跌"
                          className={cn(
                            'text-xs font-display font-semibold tabular-nums mt-1',
                            weeklyDelta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400',
                          )}
                        >
                          {weeklyDelta > 0 ? `+${weeklyDelta}` : weeklyDelta} 分
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-muted-foreground mt-1">
                          分
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pinned "My Rank Anchor" when user is outside Top 5 */}
            {myEntry && (
              <button
                type="button"
                onClick={() => onInspectPlayer(myEntry.player_id)}
                className="w-full min-h-[60px] px-3.5 py-2.5 bg-sapphire-blue/[0.05] hover:bg-sapphire-blue/[0.1] dark:bg-blue-500/12 dark:hover:bg-blue-500/20 border-t border-sapphire-blue/25 flex items-center gap-2.5 sm:gap-3 text-left transition-colors"
              >
                <div className="w-8 shrink-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-sapphire-blue dark:text-blue-300 leading-none">
                    我的
                  </span>
                  <span className="text-xs font-display font-bold text-foreground tabular-nums mt-0.5">
                    {myEntry.rank !== '-' ? `${myEntry.rank}名` : `${myIndex + 1}名`}
                  </span>
                </div>

                <PlayerAvatar
                  src={myEntry.avatar_url}
                  name={myEntry.player_name}
                  className="size-9 rounded-xl shrink-0 text-xs border border-sapphire-blue/40"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-display font-semibold text-foreground truncate">
                    {myEntry.player_name}
                  </p>
                  <p className="text-xs font-medium text-sapphire-blue dark:text-blue-300 truncate mt-0.5 tabular-nums">
                    {myEntry.matches_played === 0 && scope === 'season'
                      ? '完成本季首戰即可登榜'
                      : gapToTop5 > 0
                        ? `距前 5 強還差 ${gapToTop5} 分`
                        : '緊追前 5 強中'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-display font-bold text-foreground tabular-nums leading-none">
                    {Math.round(myEntry.global_mmr)}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    分
                  </p>
                </div>
              </button>
            )}

            {/* Full Leaderboard CTA */}
            <button
              type="button"
              onClick={() =>
                navigate(
                  scope === 'all-time' ? '/leaderboard?season_id=all-time' : '/leaderboard',
                )
              }
              className="w-full min-h-11 px-4 border-t border-border bg-surface-subtle/60 hover:bg-secondary text-xs font-semibold text-foreground flex items-center justify-between transition-colors group"
            >
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                <span>查看完整積分榜（共 {list.length} 人）</span>
              </span>
              <ArrowRight
                size={14}
                className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                aria-hidden="true"
              />
            </button>
          </>
        ) : (
          <div className="text-center py-10 px-4 space-y-2">
            <Search size={26} className="mx-auto text-muted-foreground/50" aria-hidden="true" />
            <p className="text-muted-foreground font-medium text-xs">尚無排行榜資料</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ClubSpotlightsCard({
  spotlights,
  onInspectPlayer,
  className,
}: Readonly<{
  spotlights?: ClubSpotlights | null;
  onInspectPlayer: (playerId: string) => void;
  className?: string;
}>) {
  const streak = spotlights?.hot_streak;
  const climber = spotlights?.weekly_climber;
  const active = spotlights?.most_active;
  const hasAny = Boolean(streak || climber || active);

  return (
    <section aria-label="俱樂部焦點人物" className={cn('space-y-3 min-w-0', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl text-foreground font-display font-bold tracking-tight flex items-center gap-1.5">
            <Sparkles size={17} className="text-smash-orange shrink-0" aria-hidden="true" />
            <span>俱樂部焦點</span>
          </h2>
        </div>
      </div>

      <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs divide-y divide-border/70 overflow-hidden">
        {hasAny ? (
          <>
            {streak && (
              <button
                type="button"
                onClick={() => onInspectPlayer(streak.player_id)}
                className="w-full min-h-[60px] px-4 py-3 hover:bg-surface-subtle/70 flex items-center gap-3 text-left transition-colors group"
              >
                <PlayerAvatar
                  src={streak.avatar_url}
                  name={streak.player_name}
                  className="size-9 rounded-xl border border-border shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                    {streak.player_name}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground truncate inline-flex items-center gap-1">
                    <Flame size={12} className="text-smash-orange shrink-0" aria-hidden="true" />
                    <span>連勝火熱王 · {streak.global_mmr} 分</span>
                  </p>
                </div>
                <span className="text-sm font-display font-bold text-smash-orange tabular-nums whitespace-nowrap shrink-0">
                  {streak.streak} 連勝
                </span>
              </button>
            )}

            {climber && (
              <button
                type="button"
                onClick={() => onInspectPlayer(climber.player_id)}
                className="w-full min-h-[60px] px-4 py-3 hover:bg-surface-subtle/70 flex items-center gap-3 text-left transition-colors group"
              >
                <PlayerAvatar
                  src={climber.avatar_url}
                  name={climber.player_name}
                  className="size-9 rounded-xl border border-border shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                    {climber.player_name}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground truncate inline-flex items-center gap-1">
                    <Rocket size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>{climber.window_label}飆分王 · {climber.global_mmr} 分</span>
                  </p>
                </div>
                <span className="text-sm font-display font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
                  +{climber.mmr_delta} 分
                </span>
              </button>
            )}

            {active && (
              <button
                type="button"
                onClick={() => onInspectPlayer(active.player_id)}
                className="w-full min-h-[60px] px-4 py-3 hover:bg-surface-subtle/70 flex items-center gap-3 text-left transition-colors group"
              >
                <PlayerAvatar
                  src={active.avatar_url}
                  name={active.player_name}
                  className="size-9 rounded-xl border border-border shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                    {active.player_name}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground truncate inline-flex items-center gap-1">
                    <Swords size={12} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                    <span>{active.scope_label}最活躍 · {active.wins} 勝</span>
                  </p>
                </div>
                <span className="text-sm font-display font-bold text-sapphire-blue dark:text-blue-300 tabular-nums whitespace-nowrap shrink-0">
                  {active.matches_count} 場
                </span>
              </button>
            )}
          </>
        ) : (
          <div className="py-6 px-4 text-center space-y-1">
            <p className="text-xs font-semibold text-foreground">新賽季焦點頭銜虛位以待</p>
            <p className="text-xs font-medium text-muted-foreground">
              完成本季首場對戰即可搶下連勝王與飆分王稱號
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function UpcomingChallengesCard({
  onInspectPlayer,
  className,
}: Readonly<{
  onInspectPlayer: (playerId: string) => void;
  className?: string;
}>) {
  const { data: upcoming = [] } = usePublicChallenges();

  return (
    <section aria-label="近期公開約戰預告" className={cn('space-y-3 min-w-0', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl text-foreground font-display font-bold tracking-tight flex items-center gap-1.5">
            <Swords size={18} className="text-smash-orange shrink-0" aria-hidden="true" />
            <span>近期約戰預告</span>
          </h2>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            即將開打的公開挑戰，歡迎前往觀戰加油
          </p>
        </div>
        {upcoming.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-smash-orange/12 text-smash-orange text-xs font-display font-semibold tabular-nums shrink-0">
            {upcoming.length} 場
          </span>
        )}
      </div>

      <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs divide-y divide-border/70 overflow-hidden">
        {upcoming.length > 0 ? (
          upcoming.map((ch) => (
            <div key={ch.id} className="p-3.5 sm:px-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-display font-semibold text-sapphire-blue dark:text-blue-300 tabular-nums">
                  <CalendarClock size={12} aria-hidden="true" />
                  {formatChallengeDateTimeLabel(ch.proposed_at)}
                </span>
                <span className="px-2 py-0.5 rounded bg-secondary text-xs font-medium text-muted-foreground shrink-0">
                  {ch.match_type === 'doubles' ? '雙打' : '單打'} · {ch.format}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => ch.challenger && onInspectPlayer(ch.challenger.id)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left group"
                >
                  <PlayerAvatar
                    src={ch.challenger?.avatar}
                    name={ch.challenger?.name || '?'}
                    className="size-7 rounded-lg border border-border shrink-0 text-xs"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                    {ch.challenger?.name}
                    {ch.match_type === 'doubles' && ch.challenger_partner
                      ? `/${ch.challenger_partner.name}`
                      : ''}
                  </span>
                </button>

                <span className="text-xs font-display font-bold italic text-smash-orange shrink-0">
                  VS
                </span>

                <button
                  type="button"
                  onClick={() => ch.challenged && onInspectPlayer(ch.challenged.id)}
                  className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right group"
                >
                  <span className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                    {ch.challenged?.name}
                    {ch.match_type === 'doubles' && ch.challenged_partner
                      ? `/${ch.challenged_partner.name}`
                      : ''}
                  </span>
                  <PlayerAvatar
                    src={ch.challenged?.avatar}
                    name={ch.challenged?.name || '?'}
                    className="size-7 rounded-lg border border-border shrink-0 text-xs"
                  />
                </button>
              </div>

              {(ch.location || ch.message) && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground pt-0.5">
                  {ch.location && (
                    <span className="inline-flex items-center gap-1 font-medium truncate">
                      <MapPin size={11} className="shrink-0" aria-hidden="true" />
                      {ch.location}
                    </span>
                  )}
                  {ch.message && <span className="truncate italic">「{ch.message}」</span>}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-5 px-4 text-center space-y-1">
            <p className="text-xs font-semibold text-foreground">目前尚無公開約戰預告</p>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              點擊任一球友頭像即可下戰帖約時間！
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function ClubRightRail({
  seasonData,
  allTimeData,
  isAllTimeFetching,
  scope,
  onScopeChange,
  currentUserId,
  onInspectPlayer,
}: Readonly<ClubRightRailProps>) {
  const activeLeaderboardData =
    scope === 'all-time' ? (allTimeData ?? seasonData) : seasonData;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 items-start">
      <SeasonPulseCard
        pulse={seasonData?.season_pulse}
        className="order-1 md:order-2 xl:order-1"
      />
      <UpcomingChallengesCard
        onInspectPlayer={onInspectPlayer}
        className="order-2 md:order-3 xl:order-2"
      />
      <TopRivalsCard
        data={activeLeaderboardData}
        scope={scope}
        onScopeChange={onScopeChange}
        isFetching={scope === 'all-time' && isAllTimeFetching}
        currentUserId={currentUserId}
        onInspectPlayer={onInspectPlayer}
        className="order-3 md:order-1 md:col-span-2 xl:col-span-1 xl:order-3"
      />
      <ClubSpotlightsCard
        spotlights={seasonData?.spotlights}
        onInspectPlayer={onInspectPlayer}
        className="order-4 md:order-4 xl:order-4"
      />
    </div>
  );
}
