import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Timer,
  Crown,
  History,
  X,
  Users,
  Trophy,
  Flame,
  Rocket,
  Target,
  Swords,
  Building2,
  ChevronDown,
  RotateCcw,
  Loader2,
  Hourglass,
  Sparkles,
  BookOpen,
  Scale,
  Shield,
  Medal,
  Award,
} from 'lucide-react';
import {
  getTierBadge,
  getTierKey,
  getShortTierName,
  SEASON_BASE_SCORE,
  SEASON_PLACEMENT_MATCHES,
  type TierKey,
} from '@/lib/ranking';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ResponsiveSelect,
  type ResponsiveSelectOption,
} from '@/components/ui/responsive-select';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, pageVariants } from '@/lib/animations';
import { LeaderboardSkeleton } from '@/components/LeaderboardSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/utils/apiClient';
import type {
  LeaderboardResponse,
  RawLeaderboardItem,
  SeasonSummary,
} from '@/types/api.types';

type SortMode = 'mmr' | 'weekly' | 'streak' | 'win_rate' | 'matches';
type TierFilter = 'all' | TierKey;

const SORT_OPTIONS: ReadonlyArray<{
  id: SortMode;
  label: string;
  icon: typeof Trophy;
}> = [
  { id: 'mmr', label: '積分排行', icon: Trophy },
  { id: 'weekly', label: '近7天飆分', icon: Rocket },
  { id: 'streak', label: '連勝火熱', icon: Flame },
  { id: 'win_rate', label: '勝率最高', icon: Target },
  { id: 'matches', label: '出賽鐵人', icon: Swords },
];

const TIER_FILTERS: ReadonlyArray<{ id: TierFilter; label: string }> = [
  { id: 'all', label: '全部段位' },
  { id: 'elite', label: '菁英' },
  { id: 'gold', label: '金牌' },
  { id: 'silver', label: '銀牌' },
  { id: 'bronze', label: '銅牌' },
];

function getNormalizedDept(dept?: string | null): string {
  return dept && dept !== '未設定單位' ? dept : '未設定處室';
}

function getWinRateStats(player: RawLeaderboardItem) {
  const losses = player.losses ?? Math.max(0, player.matches_played - player.wins);
  const parsedRate = parseFloat(String(player.win_rate || '0').replace('%', '')) || 0;
  const winRateRounded = Math.round(parsedRate);
  const winBarPercent =
    player.matches_played > 0
      ? Math.round((player.wins / player.matches_played) * 100)
      : 0;
  return { losses, winRateRounded, parsedRate, winBarPercent };
}

function RecentFormStrip({
  recentForm,
  compact = false,
}: Readonly<{
  recentForm?: string[];
  compact?: boolean;
}>) {
  const slots = Array.from({ length: 5 }, (_, idx) => recentForm?.[idx]);

  return (
    <div
      className={cn('flex items-center', compact ? 'gap-1' : 'justify-center gap-1.5')}
      aria-label="最近五場勝負（由左至右為最新到較舊）"
    >
      {slots.map((res, idx) => (
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
            'rounded-full shrink-0 flex items-center justify-center font-display font-bold leading-none select-none',
            compact ? 'size-5.5 text-[0.6875rem]' : 'size-6 text-xs',
            res === 'W'
              ? cn(
                  'bg-emerald-500 text-white shadow-2xs',
                  idx === 0 && 'ring-2 ring-emerald-500/30',
                )
              : res === 'L'
                ? cn(
                    'bg-rose-500 text-white shadow-2xs',
                    idx === 0 && 'ring-2 ring-rose-500/30',
                  )
                : 'border border-dashed border-border bg-surface-subtle/80 text-muted-foreground/45',
          )}
        >
          {res === 'W' ? '勝' : res === 'L' ? '敗' : '-'}
        </span>
      ))}
    </div>
  );
}

function TrendBadge({ trend }: Readonly<{ trend?: string }>) {
  const trendStr = String(trend ?? '0');
  if (trendStr === '0' || !trendStr) return null;
  const isUp = trendStr.startsWith('+');
  return (
    <span
      className={cn(
        'text-xs font-display font-semibold leading-none tabular-nums whitespace-nowrap',
        isUp
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-500 dark:text-rose-400',
      )}
    >
      {isUp ? '▲' : '▼'}
      {trendStr.replace(/[+-]/, '')}
    </span>
  );
}

function MedalBadge({
  rank,
  previewIndex,
  matchesPlayed = 0,
  isAllTime = false,
}: Readonly<{
  rank: string | number;
  previewIndex?: number;
  matchesPlayed?: number;
  isAllTime?: boolean;
}>) {
  const isRanked = rank !== '-' && rank !== '';
  const numRank = isRanked ? Number(rank) : undefined;

  if (isRanked && (numRank === 1 || numRank === 2 || numRank === 3)) {
    return (
      <span
        className={cn(
          'size-8 rounded-full flex items-center justify-center font-display font-bold text-sm tabular-nums border shadow-2xs',
          numRank === 1
            ? 'bg-amber-400/20 text-amber-700 border-amber-400/70 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50'
            : numRank === 2
              ? 'bg-slate-200/85 text-slate-700 border-slate-300 dark:bg-slate-500/25 dark:text-slate-200 dark:border-slate-500/50'
              : 'bg-orange-400/20 text-orange-700 border-orange-400/60 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/50',
        )}
      >
        {numRank}
      </span>
    );
  }

  if (isRanked) {
    return (
      <span className="font-display font-semibold text-sm text-muted-foreground tabular-nums leading-none">
        {numRank}
      </span>
    );
  }

  if (!isAllTime && matchesPlayed > 0 && matchesPlayed < SEASON_PLACEMENT_MATCHES) {
    return (
      <span
        title={`定級賽進行中（已完成 ${matchesPlayed}/${SEASON_PLACEMENT_MATCHES} 場，享有 K=32 加速，滿 ${SEASON_PLACEMENT_MATCHES} 場正式入榜）`}
        className="inline-flex items-center px-2 py-0.5 rounded-md border border-sapphire-blue/30 bg-sapphire-blue/10 text-sapphire-blue dark:border-blue-400/35 dark:bg-blue-500/15 dark:text-blue-300 text-xs font-semibold leading-none tabular-nums whitespace-nowrap"
      >
        定級 {matchesPlayed}/{SEASON_PLACEMENT_MATCHES}
      </span>
    );
  }

  return (
    <span
      title="季前依基準積分預排"
      className="size-7 rounded-full border border-dashed border-border bg-surface-subtle/80 flex items-center justify-center font-display font-semibold text-xs text-muted-foreground tabular-nums"
    >
      {previewIndex !== undefined ? `${previewIndex}` : '-'}
    </span>
  );
}

function WeeklyDeltaBadge({
  delta,
}: Readonly<{
  delta?: number;
}>) {
  const val = delta ?? 0;
  if (val === 0) {
    return (
      <span
        title="近 7 日無變動"
        className="text-xs font-medium text-muted-foreground/75 whitespace-nowrap"
      >
        持平
      </span>
    );
  }
  return (
    <span
      title="近 7 日積分漲跌"
      className={cn(
        'inline-flex items-center text-xs font-display font-semibold tabular-nums whitespace-nowrap',
        val > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {val > 0 ? `▲ +${val}` : `▼ ${val}`}
    </span>
  );
}

export function Leaderboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('mmr');
  const [showUnrankedSection, setShowUnrankedSection] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();

  const urlSeasonId = searchParams.get('season_id');

  const { data: seasons = [], isPending: isSeasonsLoading } = useQuery<SeasonSummary[]>({
    queryKey: ['seasons', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<SeasonSummary[]>('/seasons');
      return res.data;
    },
  });

  const activeSeasonId = urlSeasonId || (seasons[0]?.id ?? '');

  const {
    data: leaderboardData,
    isPending: isLeaderboardLoading,
    isFetching: isLeaderboardFetching,
  } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', activeSeasonId],
    queryFn: async () => {
      const url = `/leaderboard?season_id=${encodeURIComponent(activeSeasonId)}`;
      const res = await apiClient.get<LeaderboardResponse>(url);
      return res.data;
    },
    enabled: Boolean(activeSeasonId),
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
  });

  const realLeaderboard = useMemo(
    () => leaderboardData?.leaderboard ?? [],
    [leaderboardData],
  );
  const seasonName = leaderboardData?.season_name || '讀取中...';
  const isInitialLoading =
    (isSeasonsLoading && seasons.length === 0) ||
    (isLeaderboardLoading && !leaderboardData);

  const currentSeasonObj = seasons.find((s) => s.id === activeSeasonId);
  const isSeasonEnded = currentSeasonObj?.status === 'completed';
  const isAllTime = activeSeasonId === 'all-time';

  const openInspect = (playerId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const handleSeasonChange = (val: string | null) => {
    if (!val) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('season_id', val);
    setSearchParams(newParams);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDept('all');
    setTierFilter('all');
    setSortBy('mmr');
  };

  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of realLeaderboard) {
      const dept = getNormalizedDept(p.department);
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [realLeaderboard]);

  const seasonOptions = useMemo<ResponsiveSelectOption[]>(() => {
    const opts: ResponsiveSelectOption[] = seasons.map((s) => ({
      value: s.id,
      label: s.name,
      prefix: s.status === 'active' ? '🟢' : '🏆',
      badge: s.status === 'active' ? '進行中' : '已結算',
    }));
    opts.push({
      value: 'all-time',
      label: 'All-Time 歷史總榜',
      prefix: '👑',
      badge: '生涯',
    });
    return opts;
  }, [seasons]);

  const departmentOptions = useMemo<ResponsiveSelectOption[]>(() => {
    return [
      { value: 'all', label: '全部處室', badge: realLeaderboard.length },
      ...departments.map(([dept, count]) => ({
        value: dept,
        label: dept,
        badge: count,
      })),
    ];
  }, [departments, realLeaderboard.length]);

  const realIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    realLeaderboard.forEach((p, i) => {
      map.set(p.player_id, i + 1);
    });
    return map;
  }, [realLeaderboard]);

  const rankedCount = useMemo(
    () => realLeaderboard.filter((p) => p.rank !== '-').length,
    [realLeaderboard],
  );

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    selectedDept !== 'all' ||
    tierFilter !== 'all' ||
    sortBy !== 'mmr';

  const filteredAndSortedPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const filtered = realLeaderboard.filter((p) => {
      if (q) {
        const nameHit = p.player_name.toLowerCase().includes(q);
        const deptHit = (p.department || '').toLowerCase().includes(q);
        if (!nameHit && !deptHit) return false;
      }
      if (selectedDept !== 'all' && getNormalizedDept(p.department) !== selectedDept) {
        return false;
      }
      if (tierFilter !== 'all' && getTierKey(p.global_mmr) !== tierFilter) {
        return false;
      }
      return true;
    });

    if (sortBy === 'mmr') return filtered;

    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortBy) {
        case 'weekly': {
          const diff = (b.weekly_mmr_delta ?? 0) - (a.weekly_mmr_delta ?? 0);
          return diff !== 0 ? diff : b.global_mmr - a.global_mmr;
        }
        case 'streak': {
          const diff = (b.current_streak ?? 0) - (a.current_streak ?? 0);
          return diff !== 0 ? diff : b.global_mmr - a.global_mmr;
        }
        case 'win_rate': {
          const aPlayed = a.matches_played > 0 ? 1 : 0;
          const bPlayed = b.matches_played > 0 ? 1 : 0;
          if (aPlayed !== bPlayed) return bPlayed - aPlayed;
          const diff = parseFloat(b.win_rate) - parseFloat(a.win_rate);
          if (diff !== 0) return diff;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.global_mmr - a.global_mmr;
        }
        case 'matches': {
          if (b.matches_played !== a.matches_played) {
            return b.matches_played - a.matches_played;
          }
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.global_mmr - a.global_mmr;
        }
      }
    });
    return copy;
  }, [realLeaderboard, searchTerm, selectedDept, tierFilter, sortBy]);

  const activePlayedCount = useMemo(
    () => realLeaderboard.filter((p) => p.matches_played > 0).length,
    [realLeaderboard],
  );

  // Pre-season mode: nobody has played matches yet in this season
  const isPreseasonMode = !isAllTime && activePlayedCount === 0 && realLeaderboard.length > 0;
  // Placement rush: matches started in this season, but nobody reached 5 placement matches yet
  const isPlacementPhase = !isAllTime && rankedCount === 0 && activePlayedCount > 0;

  const { primaryPlayers, secondaryUnrankedPlayers } = useMemo(() => {
    if (isPreseasonMode) {
      return {
        primaryPlayers: filteredAndSortedPlayers,
        secondaryUnrankedPlayers: [] as RawLeaderboardItem[],
      };
    }
    return {
      primaryPlayers: filteredAndSortedPlayers.filter((p) => p.matches_played > 0),
      secondaryUnrankedPlayers: filteredAndSortedPlayers.filter(
        (p) => p.matches_played === 0,
      ),
    };
  }, [filteredAndSortedPlayers, isPreseasonMode]);

  const seasonStatusBadge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs',
        isAllTime
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
          : isSeasonEnded
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      )}
    >
      {isAllTime ? (
        <Crown size={13} aria-hidden="true" />
      ) : (
        <Timer size={13} aria-hidden="true" />
      )}
      {seasonName}
    </span>
  );

  const countAction = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-xl bg-surface-subtle border border-border text-xs font-medium text-muted-foreground">
        <Users size={14} className="text-sapphire-blue" aria-hidden="true" />
        <span>
          已定級{' '}
          <strong className="font-display font-bold text-foreground tabular-nums">
            {rankedCount}
          </strong>{' '}
          / {realLeaderboard.length} 人
        </span>
      </div>
      <button
        type="button"
        onClick={() => setIsRulesModalOpen(true)}
        className="inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-xl bg-card hover:bg-secondary border border-border text-xs font-semibold text-foreground transition-colors shadow-xs"
      >
        <BookOpen size={14} className="text-sapphire-blue" aria-hidden="true" />
        <span>賽制與段位說明</span>
      </button>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {isInitialLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LeaderboardSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="arena-page"
        >
          <motion.div variants={fadeInUp}>
            <PageHeader
              title={isAllTime ? '歷史殿堂總榜' : '賽季積分榜'}
              subtitle={
                isAllTime
                  ? '歷史累計積分總榜 · 點擊選手查看完整戰績'
                  : '賽季積分排名 · 點擊選手查看完整戰績'
              }
              badge={seasonStatusBadge}
              actions={countAction}
            />
          </motion.div>

          {/* 多維度排序、處室與段位篩選控制列 */}
          <motion.section
            variants={fadeInUp}
            aria-label="榜單篩選與排序"
            className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs space-y-3"
          >
            {/* Row 1: Season Select, Department Select, Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <ResponsiveSelect
                value={activeSeasonId}
                onValueChange={handleSeasonChange}
                options={seasonOptions}
                title="選擇檢視賽季"
                description="切換不同賽季排行榜或 All-Time 歷史總榜"
                placeholder="選擇賽季"
                triggerClassName="w-full sm:w-56 shrink-0"
                icon={
                  isLeaderboardFetching ? (
                    <Loader2
                      size={15}
                      className="text-sapphire-blue animate-spin shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <History
                      size={15}
                      className="text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                  )
                }
              />

              {departments.length > 1 && (
                <ResponsiveSelect
                  value={selectedDept}
                  onValueChange={(val) => setSelectedDept(val || 'all')}
                  options={departmentOptions}
                  title="篩選處室 / 單位"
                  description="檢視特定處室或單位的積分排行"
                  placeholder="篩選處室"
                  triggerClassName="w-full sm:w-48 shrink-0"
                  icon={
                    <Building2
                      size={15}
                      className="text-sapphire-blue shrink-0"
                      aria-hidden="true"
                    />
                  }
                />
              )}

              <div className="relative flex-1 min-w-0">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  size={17}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  aria-label="搜尋同仁姓名或單位"
                  placeholder="搜尋同仁姓名或處室..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-11 py-2.5 pl-10 pr-10 rounded-xl border border-input bg-card text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue transition-all font-medium text-foreground placeholder:text-muted-foreground/70 shadow-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="清除搜尋"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Scrollable Sort Pills & Tier Filter Pills */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-border/70">
              <div
                role="group"
                aria-label="排序維度"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0"
              >
                {SORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSortBy(opt.id)}
                      className={cn(
                        'min-h-9 px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-all',
                        active
                          ? 'bg-sapphire-blue text-white border-sapphire-blue shadow-xs'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary/70',
                      )}
                    >
                      <Icon size={13} aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <div
                  role="group"
                  aria-label="篩選段位"
                  className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-secondary border border-border shrink-0"
                >
                  {TIER_FILTERS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={tierFilter === t.id}
                      onClick={() => setTierFilter(t.id)}
                      className={cn(
                        'min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                        tierFilter === t.id
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="min-h-9 px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>重置</span>
                  </button>
                )}
              </div>
            </div>
          </motion.section>

          {/* 季前 / 定級賽提示條 */}
          {(isPreseasonMode || isPlacementPhase) && (
            <motion.div
              variants={fadeInUp}
              className="rounded-2xl bg-sapphire-blue/[0.06] dark:bg-blue-500/12 border border-sapphire-blue/25 px-4 py-3 flex items-center gap-2.5 text-xs font-medium text-foreground"
            >
              <Sparkles
                size={15}
                className="text-sapphire-blue dark:text-blue-300 shrink-0"
                aria-hidden="true"
              />
              <span>
                {isPreseasonMode ? (
                  <>
                    新賽季開戰中！目前依全體球友全域積分進行<strong>季前實力預排</strong>
                    ，完成本季 {SEASON_PLACEMENT_MATCHES} 場定級賽即可正式入榜（前 {SEASON_PLACEMENT_MATCHES} 場享有 K=32 加速）。
                  </>
                ) : (
                  <>
                    本季<strong>定級賽衝刺期</strong>進行中！目前尚未有球友打滿 {SEASON_PLACEMENT_MATCHES} 場，前 {SEASON_PLACEMENT_MATCHES} 場享有 <strong>K=32</strong> 加速校正，打滿 {SEASON_PLACEMENT_MATCHES} 場立即鎖定正式排名。
                  </>
                )}
              </span>
            </motion.div>
          )}

          {/* 模組 1 & 5：原生雙模響應式排行清單（手機原生卡片 / 桌面專業數據表） */}
          <motion.section variants={fadeInUp} aria-label="積分排行榜清單" className="space-y-4">
            {primaryPlayers.length > 0 ? (
              <>
                {/* 手機 / 小平板 (< md): 原生競技列卡 */}
                <div className="md:hidden space-y-2.5">
                  {primaryPlayers.map((player, idx) => (
                    <MobilePlayerRowCard
                      key={player.player_id}
                      player={player}
                      previewIndex={realIndexMap.get(player.player_id) ?? idx + 1}
                      isAllTime={isAllTime}
                      isMe={currentUser?.id === player.player_id}
                      onSelect={openInspect}
                    />
                  ))}
                </div>

                {/* 桌面端 (>= md): 清爽極簡積分榜數據表 */}
                <div className="hidden md:block bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="leaderboard-table-caption"
                    className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-sapphire-blue"
                  >
                    <table className="w-full text-left border-collapse">
                      <caption id="leaderboard-table-caption" className="sr-only">
                        {seasonName} 積分排行榜
                      </caption>
                      <thead>
                        <tr className="border-b border-border bg-surface-subtle/70">
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-muted-foreground text-balance w-24 text-center"
                          >
                            名次
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-muted-foreground text-balance"
                          >
                            選手
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-muted-foreground text-balance"
                          >
                            段位
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-muted-foreground text-balance min-w-[165px]"
                          >
                            勝率與戰績
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-muted-foreground text-balance text-center"
                          >
                            近 5 場
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-4 text-xs font-semibold text-foreground text-balance text-right"
                          >
                            積分 (近7日)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {primaryPlayers.map((player, idx) => {
                          const isTop1 = player.rank === 1;
                          const isMe = currentUser?.id === player.player_id;
                          const tier = getTierBadge(player.global_mmr);
                          const { losses, winRateRounded, winBarPercent } =
                            getWinRateStats(player);
                          const streak = player.current_streak ?? 0;

                          return (
                            <tr
                              key={player.player_id}
                              onClick={() => openInspect(player.player_id)}
                              className={cn(
                                'group hover:bg-surface-subtle/80 transition-colors cursor-pointer',
                                isTop1 && 'bg-amber-50/30 dark:bg-amber-500/[0.06]',
                                isMe && 'bg-sapphire-blue/[0.04] dark:bg-blue-500/[0.08]',
                              )}
                            >
                              <td className="py-3.5 px-4 w-24 text-center">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <MedalBadge
                                    rank={player.rank}
                                    matchesPlayed={player.matches_played}
                                    isAllTime={isAllTime}
                                    previewIndex={
                                      player.rank === '-'
                                        ? (realIndexMap.get(player.player_id) ?? idx + 1)
                                        : undefined
                                    }
                                  />
                                  <TrendBadge trend={player.trend} />
                                </div>
                              </td>

                              <th scope="row" className="py-3.5 px-4 font-normal text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInspect(player.player_id);
                                  }}
                                  className="flex items-center gap-3 text-left w-full min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue"
                                >
                                  <PlayerAvatar
                                    src={player.avatar_url}
                                    name={player.player_name}
                                    className="size-10 rounded-xl border border-border/80 text-sm shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <span className="font-sans font-bold text-foreground text-sm sm:text-base truncate group-hover:text-sapphire-blue transition-colors">
                                        {player.player_name}
                                      </span>
                                      {isMe && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 text-xs font-semibold leading-none shrink-0">
                                          我
                                        </span>
                                      )}
                                      {streak >= 2 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-600 border border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/30 text-xs font-semibold tabular-nums leading-none whitespace-nowrap shrink-0">
                                          <Flame size={11} aria-hidden="true" />
                                          {streak} 連勝
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                                      {getNormalizedDept(player.department)}
                                    </p>
                                  </div>
                                </button>
                              </th>

                              <td className="py-3.5 px-4">
                                <div
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit shadow-none',
                                    tier.color,
                                  )}
                                >
                                  {tier.icon}
                                  <span className="text-xs font-semibold whitespace-nowrap">
                                    {getShortTierName(player.global_mmr)}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {player.matches_played > 0 ? (
                                  <div className="space-y-1.5 max-w-[175px]">
                                    <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                                      <span className="font-display font-bold text-foreground">
                                        {winRateRounded}%
                                      </span>
                                      <span className="font-display font-semibold">
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          {player.wins}勝
                                        </span>
                                        <span className="text-muted-foreground/45 mx-0.5">
                                          ·
                                        </span>
                                        <span className="text-rose-500 dark:text-rose-400">
                                          {losses}敗
                                        </span>
                                        <span className="text-muted-foreground font-sans font-medium ml-1">
                                          ({player.matches_played})
                                        </span>
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
                                      <div
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${winBarPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    等待開季首戰
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <RecentFormStrip recentForm={player.recent_form} />
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={cn(
                                      'font-display font-bold text-xl sm:text-2xl tracking-tight tabular-nums leading-none',
                                      isTop1
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-foreground',
                                    )}
                                  >
                                    {Math.round(player.global_mmr)}
                                  </span>
                                  <WeeklyDeltaBadge delta={player.weekly_mmr_delta} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              secondaryUnrankedPlayers.length === 0 && (
                <div className="bg-card border border-border border-dashed rounded-2xl py-16 px-4 text-center flex flex-col items-center justify-center">
                  <Search
                    size={36}
                    className="mb-3 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground font-medium text-sm">
                    {hasActiveFilters
                      ? '沒有符合目前篩選條件的選手，試試重置篩選條件吧！'
                      : '目前尚無排行榜資料'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 min-h-9 py-1.5 px-4 rounded-xl bg-sapphire-blue text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      重置篩選條件
                    </button>
                  )}
                </div>
              )
            )}

            {/* 待定級 / 季前預排智慧收合區 */}
            {secondaryUnrankedPlayers.length > 0 && (
              <div className="rounded-2xl md:rounded-3xl bg-card border border-border shadow-xs overflow-hidden">
                <button
                  type="button"
                  aria-expanded={showUnrankedSection}
                  onClick={() => setShowUnrankedSection((prev) => !prev)}
                  className="w-full px-4 py-3.5 bg-surface-subtle/75 hover:bg-secondary/70 flex items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0">
                      <Hourglass size={15} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-display font-bold text-foreground truncate">
                        尚未出賽選手（共 {secondaryUnrankedPlayers.length} 人）
                      </p>
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        依全域積分排序 · 完成本季 {SEASON_PLACEMENT_MATCHES} 場定級賽即取得正式排名（前 {SEASON_PLACEMENT_MATCHES} 場享有 K=32 加速）
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      'text-muted-foreground transition-transform duration-200 shrink-0',
                      showUnrankedSection && 'rotate-180',
                    )}
                  />
                </button>

                {showUnrankedSection && (
                  <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 border-t border-border/70">
                    {secondaryUnrankedPlayers.map((player, idx) => {
                      const isMe = currentUser?.id === player.player_id;
                      const tier = getTierBadge(player.global_mmr, 11);
                      return (
                        <button
                          key={player.player_id}
                          type="button"
                          onClick={() => openInspect(player.player_id)}
                          className={cn(
                            'w-full min-h-[60px] p-3 rounded-2xl border bg-card hover:bg-surface-subtle flex items-center gap-2.5 text-left transition-colors group',
                            isMe
                              ? 'border-sapphire-blue/45 bg-sapphire-blue/[0.04] dark:bg-blue-500/10'
                              : 'border-border',
                          )}
                        >
                          <span className="text-xs font-display font-semibold text-muted-foreground w-7 text-center tabular-nums shrink-0">
                            {realIndexMap.get(player.player_id) ?? rankedCount + idx + 1}
                          </span>
                          <PlayerAvatar
                            src={player.avatar_url}
                            name={player.player_name}
                            className="size-9 rounded-xl border border-border shrink-0 text-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-display font-bold text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                                {player.player_name}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 text-xs font-semibold leading-none shrink-0">
                                  我
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-semibold shadow-none shrink-0',
                                  tier.color,
                                )}
                              >
                                {tier.icon}
                                {getShortTierName(player.global_mmr)}
                              </span>
                              <span className="text-xs font-medium text-muted-foreground truncate">
                                {getNormalizedDept(player.department)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-display font-bold text-foreground tabular-nums leading-none">
                              {Math.round(player.global_mmr)}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground mt-1">
                              待首戰
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.section>

          <RankingRulesDialog
            open={isRulesModalOpen}
            onOpenChange={setIsRulesModalOpen}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 手機專屬競技列卡（零跑版、零斷裂分隔線）
 * ─────────────────────────────────────────────────────────────────────────── */
function MobilePlayerRowCard({
  player,
  previewIndex,
  isAllTime,
  isMe,
  onSelect,
}: Readonly<{
  player: RawLeaderboardItem;
  previewIndex: number;
  isAllTime: boolean;
  isMe: boolean;
  onSelect: (id: string) => void;
}>) {
  const isTop1 = player.rank === 1;
  const tier = getTierBadge(player.global_mmr, 11);
  const { losses, winRateRounded, winBarPercent } = getWinRateStats(player);
  const streak = player.current_streak ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(player.player_id)}
      className={cn(
        'w-full text-left rounded-2xl border p-3.5 shadow-2xs transition-colors active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-sapphire-blue',
        isMe
          ? 'bg-sapphire-blue/[0.04] dark:bg-blue-500/[0.08] border-sapphire-blue/40'
          : isTop1
            ? 'bg-amber-50/30 dark:bg-amber-500/[0.06] border-amber-300/60 dark:border-amber-400/40'
            : 'bg-card border-border hover:bg-surface-subtle/80',
      )}
    >
      {/* Top Row: Medal + Avatar + Name/Badges + Right Score */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 shrink-0 flex flex-col items-center justify-center gap-1">
          <MedalBadge
            rank={player.rank}
            matchesPlayed={player.matches_played}
            isAllTime={isAllTime}
            previewIndex={player.rank === '-' ? previewIndex : undefined}
          />
          <TrendBadge trend={player.trend} />
        </div>

        <PlayerAvatar
          src={player.avatar_url}
          name={player.player_name}
          className="size-11 rounded-xl border border-border/80 shadow-2xs text-sm shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-bold text-base text-foreground truncate">
              {player.player_name}
            </span>
            {isMe && (
              <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 text-xs font-semibold leading-none shrink-0">
                我
              </span>
            )}
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/12 text-orange-600 border border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/30 text-xs font-semibold tabular-nums leading-none whitespace-nowrap shrink-0">
                <Flame size={11} aria-hidden="true" />
                {streak} 連勝
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
            {getNormalizedDept(player.department)}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p
            className={cn(
              'font-display font-bold text-2xl tabular-nums leading-none',
              isTop1 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
            )}
          >
            {Math.round(player.global_mmr)}
          </p>
          <div className="mt-1 flex justify-end">
            <WeeklyDeltaBadge delta={player.weekly_mmr_delta} />
          </div>
        </div>
      </div>

      {/* Bottom Data Capsule Strip: Full unbroken divider */}
      <div className="mt-2.5 pt-2.5 border-t border-border/75 flex items-center justify-between gap-2 min-w-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold shadow-none shrink-0 whitespace-nowrap',
            tier.color,
          )}
        >
          {tier.icon}
          <span>{getShortTierName(player.global_mmr)}</span>
        </span>

        {player.matches_played > 0 ? (
          <div className="min-w-0 flex-1 max-w-[140px] space-y-1">
            <div className="flex items-baseline justify-between gap-1 text-xs font-display font-semibold tabular-nums">
              <span className="font-bold text-foreground">{winRateRounded}%</span>
              <span className="whitespace-nowrap">
                <span className="text-emerald-600 dark:text-emerald-400">{player.wins}勝</span>
                <span className="text-muted-foreground/45 mx-0.5">·</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${winBarPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs font-medium text-muted-foreground truncate">
            等待本季首戰
          </span>
        )}

        <div className="shrink-0">
          <RecentFormStrip recentForm={player.recent_form} compact />
        </div>
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 賽制與段位說明公開彈窗（RankingRulesDialog）
 * ─────────────────────────────────────────────────────────────────────────── */
function RankingRulesDialog({
  open,
  onOpenChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const tiers = [
    {
      label: '菁英 (Elite)',
      range: '1320+ 分',
      desc: '頂尖 5%～8% 殿堂級高手',
      icon: Shield,
      pillClass:
        'bg-slate-900 text-amber-400 border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/50',
    },
    {
      label: '金牌 (Gold)',
      range: '1180 ~ 1319 分',
      desc: '俱樂部前段班實力強者',
      icon: Trophy,
      pillClass:
        'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35',
    },
    {
      label: '銀牌 (Silver)',
      range: '1050 ~ 1179 分',
      desc: '穩定出賽之中堅主力區間',
      icon: Medal,
      pillClass:
        'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-500/35',
    },
    {
      label: '銅牌 (Bronze)',
      range: '< 1050 分',
      desc: '初入賽場／熱身累積期',
      icon: Award,
      pillClass:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scale size={20} className="text-sapphire-blue shrink-0" aria-hidden="true" />
            <span>單軌積分賽制與段位說明</span>
          </DialogTitle>
          <DialogDescription>
            全系統採用單軌積分制，公開透明計算每場單雙打對戰與賽季排名。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs sm:text-sm">
          {/* 1. 段位區間 */}
          <div className="rounded-2xl border border-border bg-surface-subtle/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-bold text-foreground flex items-center gap-1.5">
                <Trophy size={14} className="text-olympic-gold" aria-hidden="true" />
                四大段位門檻（起始基準 {SEASON_BASE_SCORE} 分）
              </p>
              <span className="text-xs font-medium text-muted-foreground">最低保護 600</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tiers.map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.label}
                    className="rounded-xl border border-border bg-card p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold',
                          t.pillClass,
                        )}
                      >
                        <Icon size={11} aria-hidden="true" />
                        {t.label}
                      </span>
                      <p className="text-xs text-muted-foreground font-medium mt-1 truncate">
                        {t.desc}
                      </p>
                    </div>
                    <span className="font-display font-bold text-xs text-foreground tabular-nums shrink-0">
                      {t.range}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 賽季定級門檻 & K 值 */}
          <div className="rounded-2xl border border-border bg-surface-subtle/60 p-3.5 space-y-2">
            <p className="font-display font-bold text-foreground flex items-center gap-1.5">
              <BookOpen size={14} className="text-sapphire-blue" aria-hidden="true" />
              賽季 {SEASON_PLACEMENT_MATCHES} 場定級賽與動態 K 值
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground font-medium leading-relaxed">
              <li>
                • <strong className="font-semibold text-foreground">每季前 {SEASON_PLACEMENT_MATCHES} 場（定級賽 · K=32）</strong>
                ：享較高權重快速校準當季實力，榜單標示「定級 X/{SEASON_PLACEMENT_MATCHES}」，打滿 {SEASON_PLACEMENT_MATCHES} 場即正式取得{' '}
                <strong className="font-semibold text-foreground">第 1、2、3 名</strong>賽季名次。
              </li>
              <li>
                • <strong className="font-semibold text-foreground">每季第 {SEASON_PLACEMENT_MATCHES + 1} 場起（常態期 · K=24）</strong>
                ：完成定級後恢復穩定係數；每位選手皆<strong className="font-semibold text-foreground">獨立套用自身 K 值</strong>，不與對手平均。
              </li>
              <li>
                • <strong className="font-semibold text-foreground">季中高手速升範例</strong>
                ：同分對決 2:1 勝場定級期約 <strong className="font-semibold text-emerald-600 dark:text-emerald-400">+16 分</strong>（2:0 完封 <strong className="font-semibold text-emerald-600 dark:text-emerald-400">+19.2 分</strong>）；第 6 場起為 <strong className="font-semibold text-emerald-600 dark:text-emerald-400">+12 分</strong>（完封 <strong className="font-semibold text-emerald-600 dark:text-emerald-400">+14.4 分</strong>）。
              </li>
            </ul>
          </div>

          {/* 3. 完封加成 & 雙打機制 & 軟重置 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-border bg-surface-subtle/60 p-3.5 space-y-1.5">
              <p className="font-display font-bold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                <Flame size={14} className="text-smash-orange" aria-hidden="true" />
                完封淨勝局加成
              </p>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                BO3：2:1 為 <strong className="font-semibold text-foreground">1.0x</strong>｜2:0 完封{' '}
                <strong className="font-semibold text-foreground">1.2x</strong>
                <br />
                BO5：3:2 為 <strong className="font-semibold text-foreground">1.2x</strong>｜3:1 為{' '}
                <strong className="font-semibold text-foreground">1.35x</strong>｜3:0 宰制{' '}
                <strong className="font-semibold text-foreground">1.5x</strong>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-subtle/60 p-3.5 space-y-1.5">
              <p className="font-display font-bold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                <Users size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                雙打公平共擔 (50/50)
              </p>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                隊伍戰力採兩位搭檔平均，個人加減分為單打的{' '}
                <strong className="font-semibold text-foreground">0.85x</strong>，同 K 值搭檔同加同扣。
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-sapphire-blue/25 bg-sapphire-blue/[0.05] dark:bg-blue-500/10 p-3.5 space-y-1">
            <p className="font-display font-bold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
              <Sparkles size={14} className="text-sapphire-blue dark:text-blue-300" aria-hidden="true" />
              換季積分軟重置
            </p>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              新賽季開打時依公式{' '}
              <span className="font-display font-bold text-foreground">
                (上季結算積分 + {SEASON_BASE_SCORE}) ÷ 2
              </span>{' '}
              回歸（例：上季 1320 菁英新季從 1160 銀牌頂端出發，搭配開季前 5 場 K=32 迅速衝刺重返高段位）。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
