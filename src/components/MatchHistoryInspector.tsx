import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Clock,
  Filter,
  Flame,
  Globe,
  LogIn,
  Swords,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { cn } from '@/lib/utils';
import {
  formatSignedDelta,
  getNormalizedDept,
  type ClubInspectorStats,
  type PersonalPivots,
  type PersonalSliceStats,
} from '@/lib/matchInspector';

export interface MatchHistoryInspectorProps {
  scope: 'mine' | 'all';
  isLoggedIn: boolean;
  isLoading: boolean;
  hasActiveFilters: boolean;
  searchQuery: string;
  matchTypeFilter: 'all' | 'singles' | 'doubles';
  statusFilter: 'all' | 'confirmed' | 'pending';
  personalSlice: PersonalSliceStats;
  personalPivots: PersonalPivots;
  clubStats: ClubInspectorStats;
  onSelectRival: (name: string) => void;
  onSelectPartner: (name: string) => void;
  onSelectClubPlayer: (name: string) => void;
  onToggleMatchType: (type: 'singles' | 'doubles') => void;
  onTogglePendingFilter: () => void;
  onResetFilters: () => void;
  onLoginClick: () => void;
}

export function MatchHistoryMobileStrip({
  scope,
  isLoggedIn,
  isLoading,
  hasActiveFilters,
  searchQuery,
  matchTypeFilter,
  statusFilter,
  personalSlice,
  personalPivots,
  clubStats,
  onSelectRival,
  onSelectPartner,
  onSelectClubPlayer,
  onTogglePendingFilter,
  onResetFilters,
}: Readonly<MatchHistoryInspectorProps>) {
  const [pivotsOpen, setPivotsOpen] = useState(false);

  if (scope === 'mine' && !isLoggedIn) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-2xl" />;
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();

  if (scope === 'mine') {
    const hasAnyPivots =
      personalPivots.topRivals.length > 0 || personalPivots.topPartners.length > 0;
    const { total, wins, losses, winRate, netMmr, h2hContext } = personalSlice;

    return (
      <div className="arena-surface rounded-2xl px-3.5 py-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 min-h-[32px]">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            {h2hContext ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-black">
                <PlayerAvatar
                  src={h2hContext.player.avatar}
                  name={h2hContext.player.name}
                  className="size-5 rounded-md text-[10px]"
                />
                <span>
                  {h2hContext.role === 'rival' ? 'VS' : '搭檔'} {h2hContext.player.name}
                </span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-lg bg-secondary text-xs font-black text-foreground/80 tabular-nums whitespace-nowrap">
                {hasActiveFilters ? `篩選 ${total} 場` : `近 ${total} 場`}
              </span>
            )}

            {total > 0 ? (
              <div className="flex items-center gap-1.5 text-xs font-display font-black tabular-nums whitespace-nowrap">
                <span>
                  <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>{' '}
                  <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
                </span>
                <span className="text-muted-foreground font-sans font-bold">({winRate}%)</span>
                {netMmr !== 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[11px] font-black',
                      netMmr > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                    )}
                  >
                    {formatSignedDelta(netMmr)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">尚無符合場次</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="h-7 px-2 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                清除
              </button>
            )}
            {hasAnyPivots && (
              <button
                type="button"
                aria-expanded={pivotsOpen}
                onClick={() => setPivotsOpen((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-black transition-colors whitespace-nowrap',
                  pivotsOpen
                    ? 'bg-sapphire-blue/10 border-sapphire-blue/35 text-sapphire-blue dark:text-blue-300'
                    : 'bg-card border-border text-foreground hover:bg-secondary',
                )}
              >
                <span>快篩</span>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={cn('transition-transform duration-150', pivotsOpen && 'rotate-180')}
                />
              </button>
            )}
          </div>
        </div>

        {pivotsOpen && hasAnyPivots && (
          <div className="pt-2.5 mt-2.5 border-t border-border/70 space-y-2.5">
            {personalPivots.topRivals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black text-muted-foreground flex items-center gap-1">
                  <Swords size={12} className="text-sapphire-blue" aria-hidden="true" />
                  常交手對手（點選查交手）
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {personalPivots.topRivals.map((rival) => {
                    const isActive = trimmedQuery === rival.name.toLowerCase();
                    return (
                      <button
                        key={rival.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onSelectRival(rival.name)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors',
                          isActive
                            ? 'bg-sapphire-blue text-white border-sapphire-blue shadow-2xs'
                            : 'bg-card border-border text-foreground hover:bg-secondary',
                        )}
                      >
                        <PlayerAvatar
                          src={rival.avatar}
                          name={rival.name}
                          className="size-5 rounded-md text-[10px]"
                        />
                        <span>{rival.name}</span>
                        <span
                          className={cn(
                            'text-[11px] font-display font-black tabular-nums',
                            isActive ? 'text-white/90' : 'text-muted-foreground',
                          )}
                        >
                          {rival.wins}勝{rival.losses}敗
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {personalPivots.topPartners.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black text-muted-foreground flex items-center gap-1">
                  <Users size={12} className="text-amber-500" aria-hidden="true" />
                  雙打搭檔（點選看合拍）
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {personalPivots.topPartners.map((partner) => {
                    const isActive =
                      trimmedQuery === partner.name.toLowerCase() &&
                      matchTypeFilter === 'doubles';
                    return (
                      <button
                        key={partner.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onSelectPartner(partner.name)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors',
                          isActive
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-card border-border text-foreground hover:bg-secondary',
                        )}
                      >
                        <PlayerAvatar
                          src={partner.avatar}
                          name={partner.name}
                          className="size-5 rounded-md text-[10px]"
                        />
                        <span>{partner.name}</span>
                        <span
                          className={cn(
                            'text-[11px] font-display font-black tabular-nums',
                            isActive ? 'text-white/90' : 'text-muted-foreground',
                          )}
                        >
                          {partner.winRate}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Club mode ('all') mobile strip
  const hasClubPlayers = clubStats.topActivePlayers.length > 0;

  return (
    <div className="arena-surface rounded-2xl px-3.5 py-2.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2 min-h-[32px]">
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-lg bg-secondary text-xs font-black text-foreground/85 tabular-nums whitespace-nowrap">
            共 {clubStats.total} 場
          </span>
          <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
            單 {clubStats.singlesCount} · 雙 {clubStats.doublesCount}
          </span>
          {clubStats.totalPendingInBase > 0 && (
            <button
              type="button"
              aria-pressed={statusFilter === 'pending'}
              onClick={onTogglePendingFilter}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black border transition-colors whitespace-nowrap',
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
              )}
            >
              <Clock size={11} aria-hidden="true" />
              待確認 {clubStats.totalPendingInBase}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="h-7 px-2 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              清除
            </button>
          )}
          {hasClubPlayers && (
            <button
              type="button"
              aria-expanded={pivotsOpen}
              onClick={() => setPivotsOpen((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-black transition-colors whitespace-nowrap',
                pivotsOpen
                  ? 'bg-sapphire-blue/10 border-sapphire-blue/35 text-sapphire-blue dark:text-blue-300'
                  : 'bg-card border-border text-foreground hover:bg-secondary',
              )}
            >
              <span>活躍球友</span>
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={cn('transition-transform duration-150', pivotsOpen && 'rotate-180')}
              />
            </button>
          )}
        </div>
      </div>

      {pivotsOpen && hasClubPlayers && (
        <div className="pt-2.5 mt-2.5 border-t border-border/70 flex flex-wrap gap-1.5">
          {clubStats.topActivePlayers.map((player) => {
            const isActive = trimmedQuery === player.name.toLowerCase();
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectClubPlayer(player.name)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors',
                  isActive
                    ? 'bg-sapphire-blue text-white border-sapphire-blue shadow-2xs'
                    : 'bg-card border-border text-foreground hover:bg-secondary',
                )}
              >
                <PlayerAvatar
                  src={player.avatar}
                  name={player.name}
                  className="size-5 rounded-md text-[10px]"
                />
                <span>{player.name}</span>
                <span
                  className={cn(
                    'text-[11px] font-display font-black tabular-nums',
                    isActive ? 'text-white/90' : 'text-muted-foreground',
                  )}
                >
                  {player.matches}場
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MatchHistorySidebar({
  scope,
  isLoggedIn,
  isLoading,
  hasActiveFilters,
  searchQuery,
  matchTypeFilter,
  statusFilter,
  personalSlice,
  personalPivots,
  clubStats,
  onSelectRival,
  onSelectPartner,
  onSelectClubPlayer,
  onToggleMatchType,
  onTogglePendingFilter,
  onResetFilters,
  onLoginClick,
}: Readonly<MatchHistoryInspectorProps>) {
  const trimmedQuery = searchQuery.trim().toLowerCase();

  const hasPivotCards = useMemo(
    () => personalPivots.topRivals.length > 0 || personalPivots.topPartners.length > 0,
    [personalPivots.topRivals.length, personalPivots.topPartners.length],
  );

  if (scope === 'mine' && !isLoggedIn) {
    return (
      <Card className="arena-surface overflow-hidden shadow-xs">
        <CardHeader className="px-4 py-3.5 border-b border-border/80">
          <CardTitle className="text-sm font-black tracking-wider text-foreground flex items-center gap-2">
            <Activity size={16} className="text-sapphire-blue" aria-hidden="true" />
            個人戰績情報
          </CardTitle>
          <p className="text-xs text-muted-foreground font-bold mt-0.5">
            登入後連動對戰數據與交手檔案
          </p>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-center">
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            登入戰情室即可即時追蹤篩選場次勝率、宿敵交手紀錄與雙打搭檔默契。
          </p>
          <Button
            type="button"
            onClick={onLoginClick}
            className="w-full h-10 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-xs gap-1.5"
          >
            <LogIn size={14} aria-hidden="true" />
            登入查看個人情報
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (scope === 'mine') {
    const { total, wins, losses, winRate, netMmr, singles, doubles, recentForm, h2hContext } =
      personalSlice;

    return (
      <div className="space-y-4">
        {/* Card 1: Context-Aware Summary / H2H Spotlight */}
        <Card className="arena-surface overflow-hidden shadow-xs">
          <CardHeader className="px-4 py-3.5 border-b border-border/80">
            <div className="flex items-start justify-between gap-2">
              {h2hContext ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    src={h2hContext.player.avatar}
                    name={h2hContext.player.name}
                    className="size-9 rounded-xl border border-border text-xs"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CardTitle className="text-sm font-black text-foreground truncate">
                        {h2hContext.role === 'rival'
                          ? `VS ${h2hContext.player.name}`
                          : `搭檔 · ${h2hContext.player.name}`}
                      </CardTitle>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none whitespace-nowrap',
                          h2hContext.role === 'rival'
                            ? 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300'
                            : 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {h2hContext.role === 'rival' ? '交手檔案' : '雙打默契'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold mt-0.5 tabular-nums">
                      共 {total} 場對戰明細
                    </p>
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <CardTitle className="text-sm font-black tracking-wider text-foreground flex items-center gap-2">
                    {hasActiveFilters ? (
                      <Filter size={15} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                    ) : (
                      <Activity size={15} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                    )}
                    <span>{hasActiveFilters ? '當前篩選摘要' : '個人戰績摘要'}</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-bold mt-0.5 tabular-nums">
                    {hasActiveFilters
                      ? `符合條件 ${total} 場`
                      : `基於已載入最近 ${total} 場比賽`}
                  </p>
                </div>
              )}

              {(h2hContext || hasActiveFilters) && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  aria-label="重設篩選條件"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {h2hContext ? <X size={12} aria-hidden="true" /> : <span>重設</span>}
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {total === 0 ? (
              <div className="py-5 text-center space-y-2.5">
                <p className="text-xs font-bold text-muted-foreground">
                  目前篩選條件下尚無符合場次
                </p>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onResetFilters}
                    className="h-8 rounded-xl text-xs font-bold"
                  >
                    清除篩選條件
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* 2-Column Hero KPI Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-surface-subtle/70 border border-border/80 px-3 py-2.5">
                    <p className="text-[11px] font-black text-muted-foreground">勝率</p>
                    <p className="text-2xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
                      {winRate}%
                    </p>
                    <p className="text-xs font-display font-black tabular-nums mt-0.5">
                      <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>{' '}
                      <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-surface-subtle/70 border border-border/80 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-black text-muted-foreground">淨積分變動</p>
                      {netMmr >= 0 ? (
                        <TrendingUp
                          size={13}
                          className="text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <TrendingDown
                          size={13}
                          className="text-rose-500 dark:text-rose-400 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-2xl font-display font-black tabular-nums leading-tight mt-0.5',
                        netMmr >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatSignedDelta(netMmr)}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                      已確認結算
                    </p>
                  </div>
                </div>

                {/* Win/Loss Split Bar */}
                <div className="h-2 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${winRate}%` }}
                  />
                  <div
                    className="h-full bg-rose-400 transition-all duration-500 ease-out"
                    style={{ width: `${100 - winRate}%` }}
                  />
                </div>

                {/* Format Split Quick Toggle */}
                {matchTypeFilter === 'all' && (singles.total > 0 || doubles.total > 0) && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleMatchType('singles')}
                      disabled={singles.total === 0}
                      className="rounded-xl border border-border bg-card hover:bg-secondary/70 disabled:opacity-45 px-3 py-2 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground">
                        <span>單打</span>
                        <span className="font-display text-foreground tabular-nums">
                          {singles.total > 0 ? `${singles.winRate}%` : '-'}
                        </span>
                      </div>
                      <p className="text-xs font-display font-black tabular-nums mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {singles.wins}勝
                        </span>{' '}
                        <span className="text-rose-500 dark:text-rose-400">
                          {singles.losses}敗
                        </span>
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleMatchType('doubles')}
                      disabled={doubles.total === 0}
                      className="rounded-xl border border-border bg-card hover:bg-secondary/70 disabled:opacity-45 px-3 py-2 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground">
                        <span>雙打</span>
                        <span className="font-display text-foreground tabular-nums">
                          {doubles.total > 0 ? `${doubles.winRate}%` : '-'}
                        </span>
                      </div>
                      <p className="text-xs font-display font-black tabular-nums mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {doubles.wins}勝
                        </span>{' '}
                        <span className="text-rose-500 dark:text-rose-400">
                          {doubles.losses}敗
                        </span>
                      </p>
                    </button>
                  </div>
                )}

                {/* Compact Recent Form Strip */}
                {recentForm.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground">
                      <span>近 {recentForm.length} 場走勢 · 左新</span>
                      <span>懸停看比分</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {recentForm.map((item) => (
                        <div
                          key={item.id}
                          title={item.tooltip}
                          aria-label={item.tooltip}
                          className={cn(
                            'flex-1 max-w-[28px] h-7 rounded-lg flex items-center justify-center text-xs font-display font-black text-white shadow-2xs select-none',
                            item.win ? 'bg-emerald-500' : 'bg-rose-500',
                          )}
                        >
                          {item.win ? '勝' : '敗'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Quick Pivot Radar */}
        {hasPivotCards && (
          <Card className="arena-surface overflow-hidden shadow-xs">
            <CardContent className="p-4 space-y-4">
              {personalPivots.topRivals.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <Swords size={13} className="text-sapphire-blue" aria-hidden="true" />
                      常交手對手
                    </h3>
                    <span className="text-[11px] font-bold text-muted-foreground">點選查交手</span>
                  </div>
                  <div className="space-y-1.5">
                    {personalPivots.topRivals.map((rival) => {
                      const isActive = trimmedQuery === rival.name.toLowerCase();
                      const dept = getNormalizedDept(rival.department);
                      return (
                        <button
                          key={rival.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => onSelectRival(rival.name)}
                          className={cn(
                            'w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border text-left transition-all',
                            isActive
                              ? 'bg-sapphire-blue/10 border-sapphire-blue ring-1 ring-sapphire-blue/30'
                              : 'bg-card border-border/80 hover:bg-secondary/70',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <PlayerAvatar
                              src={rival.avatar}
                              name={rival.name}
                              className="size-8 rounded-xl border border-border text-xs"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-foreground truncate">
                                {rival.name}
                              </p>
                              {dept && (
                                <p className="text-[11px] font-bold text-muted-foreground truncate">
                                  {dept}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <p className="text-xs font-display font-black">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {rival.wins}勝
                              </span>{' '}
                              <span className="text-rose-500 dark:text-rose-400">
                                {rival.losses}敗
                              </span>
                            </p>
                            {rival.netMmr !== 0 && (
                              <p
                                className={cn(
                                  'text-[11px] font-display font-black',
                                  rival.netMmr > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-500 dark:text-rose-400',
                                )}
                              >
                                {formatSignedDelta(rival.netMmr)}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {personalPivots.topPartners.length > 0 && (
                <div
                  className={cn(
                    'space-y-2',
                    personalPivots.topRivals.length > 0 && 'pt-3 border-t border-border/70',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <Users size={13} className="text-amber-500" aria-hidden="true" />
                      雙打搭檔
                    </h3>
                    <span className="text-[11px] font-bold text-muted-foreground">點選看合拍</span>
                  </div>
                  <div className="space-y-1.5">
                    {personalPivots.topPartners.map((partner) => {
                      const isActive =
                        trimmedQuery === partner.name.toLowerCase() &&
                        matchTypeFilter === 'doubles';
                      return (
                        <button
                          key={partner.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => onSelectPartner(partner.name)}
                          className={cn(
                            'w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border text-left transition-all',
                            isActive
                              ? 'bg-amber-500/12 border-amber-500 ring-1 ring-amber-500/30'
                              : 'bg-card border-border/80 hover:bg-secondary/70',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <PlayerAvatar
                              src={partner.avatar}
                              name={partner.name}
                              className="size-8 rounded-xl border border-border text-xs"
                            />
                            <span className="text-xs font-black text-foreground truncate">
                              {partner.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                            <span className="text-xs font-display font-black">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {partner.wins}勝
                              </span>{' '}
                              <span className="text-rose-500 dark:text-rose-400">
                                {partner.losses}敗
                              </span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[11px] font-display font-black text-foreground">
                              {partner.winRate}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Club mode ('all') sidebar
  return (
    <div className="space-y-4">
      {/* Card 1: Club Pulse */}
      <Card className="arena-surface overflow-hidden shadow-xs">
        <CardHeader className="px-4 py-3.5 border-b border-border/80">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm font-black tracking-wider text-foreground flex items-center gap-2">
                <Globe size={15} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                <span>俱樂部戰況脈動</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground font-bold mt-0.5 tabular-nums">
                目前顯示 {clubStats.total} 場 · {clubStats.activePlayersCount} 位參賽者
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-2 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                重設
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {clubStats.totalPendingInBase > 0 && (
            <button
              type="button"
              aria-pressed={statusFilter === 'pending'}
              onClick={onTogglePendingFilter}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors',
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50/90 border-amber-200/80 text-amber-900 hover:bg-amber-100/70 dark:bg-amber-500/12 dark:border-amber-500/30 dark:text-amber-200',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Clock size={14} className="shrink-0" aria-hidden="true" />
                <span className="text-xs font-black tabular-nums">
                  待確認場次 {clubStats.totalPendingInBase} 場
                </span>
              </div>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[11px] font-black whitespace-nowrap shrink-0',
                  statusFilter === 'pending'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/80 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200',
                )}
              >
                {statusFilter === 'pending' ? '返回全部' : '篩選待確認'}
              </span>
            </button>
          )}

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={matchTypeFilter === 'singles'}
                onClick={() => onToggleMatchType('singles')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-all',
                  matchTypeFilter === 'singles'
                    ? 'bg-sapphire-blue/10 border-sapphire-blue ring-1 ring-sapphire-blue/30'
                    : 'bg-card border-border hover:bg-secondary/70',
                )}
              >
                <p className="text-[11px] font-black text-muted-foreground">單打對決</p>
                <p className="text-sm font-display font-black text-foreground tabular-nums mt-0.5">
                  {clubStats.singlesCount} 場{' '}
                  <span className="text-xs font-bold text-muted-foreground">
                    ({clubStats.singlesPct}%)
                  </span>
                </p>
              </button>

              <button
                type="button"
                aria-pressed={matchTypeFilter === 'doubles'}
                onClick={() => onToggleMatchType('doubles')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-all',
                  matchTypeFilter === 'doubles'
                    ? 'bg-amber-500/12 border-amber-500 ring-1 ring-amber-500/30'
                    : 'bg-card border-border hover:bg-secondary/70',
                )}
              >
                <p className="text-[11px] font-black text-muted-foreground">雙打對決</p>
                <p className="text-sm font-display font-black text-foreground tabular-nums mt-0.5">
                  {clubStats.doublesCount} 場{' '}
                  <span className="text-xs font-bold text-muted-foreground">
                    ({clubStats.doublesPct}%)
                  </span>
                </p>
              </button>
            </div>

            {clubStats.total > 0 && (
              <div className="h-2 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-sapphire-blue transition-all duration-500 ease-out"
                  style={{ width: `${clubStats.singlesPct}%` }}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${clubStats.doublesPct}%` }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Active Club Players */}
      {clubStats.topActivePlayers.length > 0 && (
        <Card className="arena-surface overflow-hidden shadow-xs">
          <CardHeader className="px-4 py-3 border-b border-border/80">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-black text-foreground flex items-center gap-1.5">
                <Flame size={14} className="text-smash-orange" aria-hidden="true" />
                近期活躍球友
              </CardTitle>
              <span className="text-[11px] font-bold text-muted-foreground">點選篩選場次</span>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-1.5">
            {clubStats.topActivePlayers.map((player) => {
              const isActive = trimmedQuery === player.name.toLowerCase();
              const dept = getNormalizedDept(player.department);
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectClubPlayer(player.name)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border text-left transition-all',
                    isActive
                      ? 'bg-sapphire-blue/10 border-sapphire-blue ring-1 ring-sapphire-blue/30'
                      : 'bg-card border-border/80 hover:bg-secondary/70',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <PlayerAvatar
                      src={player.avatar}
                      name={player.name}
                      className="size-8 rounded-xl border border-border text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-foreground truncate">{player.name}</p>
                      {dept && (
                        <p className="text-[11px] font-bold text-muted-foreground truncate">
                          {dept}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-xs font-display font-black text-foreground">
                      {player.matches} 場
                    </p>
                    <p className="text-[11px] font-display font-black">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {player.wins}勝
                      </span>{' '}
                      <span className="text-rose-500 dark:text-rose-400">
                        {player.losses}敗
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
