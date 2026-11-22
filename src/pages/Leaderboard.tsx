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
  ChevronUp,
  RotateCcw,
  Loader2,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import {
  getTierBadge,
  getTierKey,
  getShortTierName,
  type TierKey,
} from '@/lib/ranking';
import { cn } from '@/lib/utils';
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
            'rounded-md flex items-center justify-center font-display font-black leading-none select-none',
            compact ? 'size-5 text-[10px]' : 'size-6 text-[11px] rounded-lg',
            res === 'W'
              ? cn(
                  'bg-emerald-500 text-white shadow-2xs',
                  idx === 0 && 'ring-2 ring-emerald-500/35',
                )
              : res === 'L'
                ? cn(
                    'bg-rose-500 text-white shadow-2xs',
                    idx === 0 && 'ring-2 ring-rose-500/35',
                  )
                : 'border border-dashed border-border bg-surface-subtle/80 text-muted-foreground/45',
          )}
        >
          {res || '-'}
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
        'text-[10px] font-display font-black leading-none tabular-nums whitespace-nowrap',
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
}: Readonly<{
  rank: string | number;
  previewIndex?: number;
}>) {
  const isRanked = rank !== '-' && rank !== '';
  const numRank = isRanked ? Number(rank) : undefined;

  if (isRanked && (numRank === 1 || numRank === 2 || numRank === 3)) {
    return (
      <span
        className={cn(
          'size-8 rounded-full flex items-center justify-center font-display font-black text-sm tabular-nums border shadow-2xs',
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
      <span className="font-display font-black text-base text-muted-foreground tabular-nums leading-none">
        #{numRank}
      </span>
    );
  }

  return (
    <span
      title="季前依基準積分預排"
      className="size-7 rounded-full border border-dashed border-border bg-surface-subtle/80 flex items-center justify-center font-display font-black text-[11px] text-muted-foreground tabular-nums"
    >
      {previewIndex !== undefined ? `#${previewIndex}` : '-'}
    </span>
  );
}

function WeeklyDeltaBadge({
  delta,
  compact = false,
}: Readonly<{
  delta?: number;
  compact?: boolean;
}>) {
  const val = delta ?? 0;
  if (val === 0) {
    return (
      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
        ELO
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center font-display font-black tabular-nums whitespace-nowrap',
        compact
          ? 'text-[11px]'
          : 'px-2 py-0.5 rounded-full text-[11px]',
        val > 0
          ? compact
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
          : compact
            ? 'text-rose-500 dark:text-rose-400'
            : 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300',
      )}
    >
      7D {val > 0 ? `+${val}` : val}
    </span>
  );
}

export function Leaderboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('mmr');
  const [showUnrankedSection, setShowUnrankedSection] = useState(true);

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

  // Pre-season mode: nobody has played matches yet in this season
  const isPreseasonMode = rankedCount === 0 && realLeaderboard.length > 0;

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

  const podiumPlayers = useMemo(() => {
    if (rankedCount > 0) {
      return realLeaderboard.filter((p) => p.rank !== '-').slice(0, 3);
    }
    return realLeaderboard.slice(0, 3);
  }, [realLeaderboard, rankedCount]);

  const showPodium = !hasActiveFilters && podiumPlayers.length > 0;

  // Logged-in player's live standing anchor
  const myStanding = useMemo(() => {
    if (!currentUser?.id || realLeaderboard.length === 0) return null;
    const idx = realLeaderboard.findIndex((p) => p.player_id === currentUser.id);
    if (idx < 0) return null;
    const me = realLeaderboard[idx];
    const above = idx > 0 ? realLeaderboard[idx - 1] : undefined;
    return { me, idx, above };
  }, [currentUser, realLeaderboard]);

  const seasonStatusBadge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs uppercase tracking-wider',
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
    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-subtle border border-border text-xs font-bold text-muted-foreground">
      <Users size={14} className="text-sapphire-blue" aria-hidden="true" />
      <span>
        已定級{' '}
        <strong className="font-display font-black text-foreground tabular-nums">
          {rankedCount}
        </strong>{' '}
        / {realLeaderboard.length} 人
      </span>
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
              subtitle="Precision Arena · Single-Track Elo"
              badge={seasonStatusBadge}
              actions={countAction}
            />
          </motion.div>

          {/* 模組 3：個人多巴胺即時定位條 */}
          {myStanding && (
            <motion.section variants={fadeInUp} aria-label="我的排名定位">
              <MyStandingBanner
                me={myStanding.me}
                index={myStanding.idx}
                above={myStanding.above}
                onSelect={openInspect}
              />
            </motion.section>
          )}

          {/* 模組 4：多維度排序、處室與段位篩選控制列 */}
          <motion.section
            variants={fadeInUp}
            aria-label="榜單篩選與排序"
            className="arena-surface p-3 sm:p-4 space-y-3"
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
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-input bg-card text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue transition-all font-bold text-foreground placeholder:text-muted-foreground/70 shadow-xs"
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
                      onClick={() => setSortBy(opt.id)}
                      className={cn(
                        'min-h-9 px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-all',
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
                      onClick={() => setTierFilter(t.id)}
                      className={cn(
                        'min-h-8 px-2.5 py-1 rounded-lg text-xs font-black transition-all whitespace-nowrap',
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
                    className="min-h-9 px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-black text-muted-foreground hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>重置</span>
                  </button>
                )}
              </div>
            </div>
          </motion.section>

          {/* 模組 2：Mobile 1+2 / Desktop 3-Col Hero Top 3 頒獎台 */}
          {showPodium && (
            <motion.section
              variants={fadeInUp}
              aria-label="前三名領先榜"
              className="space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
                  <Crown size={14} className="text-olympic-gold" aria-hidden="true" />
                  <span>
                    {isAllTime
                      ? '歷史積分殿堂 Top 3'
                      : isSeasonEnded
                        ? '賽季最終頒獎台'
                        : isPreseasonMode
                          ? '季前實力預排 Top 3'
                          : '本季領先前三強'}
                  </span>
                </p>
                <span className="text-xs font-bold text-muted-foreground hidden sm:inline">
                  點擊選手卡片查看完整 H2H 戰績
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 items-stretch">
                <PodiumChampionCard
                  player={podiumPlayers[0]}
                  isPreseason={isPreseasonMode}
                  currentUserId={currentUser?.id}
                  onSelect={openInspect}
                  className="col-span-2 md:col-span-1 order-1 md:order-2"
                />
                <PodiumRunnerCard
                  place={2}
                  player={podiumPlayers[1]}
                  isPreseason={isPreseasonMode}
                  currentUserId={currentUser?.id}
                  onSelect={openInspect}
                  className="col-span-1 order-2 md:order-1"
                />
                <PodiumRunnerCard
                  place={3}
                  player={podiumPlayers[2]}
                  isPreseason={isPreseasonMode}
                  currentUserId={currentUser?.id}
                  onSelect={openInspect}
                  className="col-span-1 order-3 md:order-3"
                />
              </div>
            </motion.section>
          )}

          {/* 季前提示條（全場尚未打完首場本季賽事時） */}
          {isPreseasonMode && (
            <motion.div
              variants={fadeInUp}
              className="rounded-2xl bg-sapphire-blue/[0.06] dark:bg-blue-500/12 border border-sapphire-blue/25 px-4 py-3 flex items-center gap-2.5 text-xs font-bold text-foreground"
            >
              <Sparkles
                size={15}
                className="text-sapphire-blue dark:text-blue-300 shrink-0"
                aria-hidden="true"
              />
              <span>
                新賽季開戰中！目前依全體球友全域 ELO 進行<strong>季前實力預排</strong>
                ，完成第 1 場本季對戰即可正式定級入榜。
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
                      isMe={currentUser?.id === player.player_id}
                      onSelect={openInspect}
                    />
                  ))}
                </div>

                {/* 桌面端 (>= md): 高密度電競數據表 */}
                <div className="hidden md:block arena-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <caption className="sr-only">{seasonName} 積分排行榜</caption>
                      <thead>
                        <tr className="border-b border-border bg-surface-subtle/90">
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-muted-foreground uppercase tracking-wider w-20 text-center"
                          >
                            名次
                          </th>
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-muted-foreground uppercase tracking-wider"
                          >
                            選手
                          </th>
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-muted-foreground uppercase tracking-wider"
                          >
                            段位
                          </th>
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-muted-foreground uppercase tracking-wider min-w-[165px]"
                          >
                            勝率 &amp; 戰績
                          </th>
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-center"
                          >
                            近 5 場 (左新)
                          </th>
                          <th
                            scope="col"
                            className="py-3.5 px-4 text-xs font-black text-foreground uppercase tracking-wider text-right"
                          >
                            積分 &amp; 7D 動能
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
                                'group hover:bg-secondary/60 transition-colors cursor-pointer',
                                isTop1 && 'bg-amber-50/35 dark:bg-amber-500/10',
                                isMe && 'bg-sapphire-blue/[0.045] dark:bg-blue-500/12',
                              )}
                            >
                              <td className="py-3.5 px-4 w-20 text-center">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <MedalBadge
                                    rank={player.rank}
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
                                    className="size-11 rounded-2xl border border-border shadow-xs text-sm group-hover:scale-105 transition-transform shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <span className="font-sans font-black text-foreground text-base truncate group-hover:text-sapphire-blue transition-colors">
                                        {player.player_name}
                                      </span>
                                      {isMe && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                                          YOU
                                        </span>
                                      )}
                                      {streak >= 2 && (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black tabular-nums whitespace-nowrap shrink-0">
                                          <Flame size={10} aria-hidden="true" />
                                          {streak} 連勝
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-bold truncate mt-0.5">
                                      {getNormalizedDept(player.department)}
                                    </p>
                                  </div>
                                </button>
                              </th>

                              <td className="py-3.5 px-4">
                                <div
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit',
                                    tier.color,
                                  )}
                                >
                                  {tier.icon}
                                  <span className="text-xs font-black whitespace-nowrap">
                                    {tier.name}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {player.matches_played > 0 ? (
                                  <div className="space-y-1.5 max-w-[175px]">
                                    <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                                      <span className="font-display font-black text-foreground">
                                        {winRateRounded}%
                                      </span>
                                      <span className="font-display font-black">
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          {player.wins}W
                                        </span>
                                        <span className="text-muted-foreground/45 mx-0.5">
                                          -
                                        </span>
                                        <span className="text-rose-500 dark:text-rose-400">
                                          {losses}L
                                        </span>
                                        <span className="text-muted-foreground font-sans font-bold ml-1">
                                          ({player.matches_played})
                                        </span>
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
                                      <div
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${winBarPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-muted-foreground">
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
                                      'font-display font-black text-2xl tracking-tight tabular-nums leading-none',
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
                <div className="arena-surface py-16 px-4 text-center flex flex-col items-center justify-center">
                  <Search
                    size={36}
                    className="mb-3 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground font-bold text-sm">
                    {hasActiveFilters
                      ? '沒有符合目前篩選條件的選手，試試重置篩選條件吧！'
                      : '目前尚無排行榜資料'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 h-9 px-4 rounded-xl bg-sapphire-blue text-white text-xs font-black inline-flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      重置篩選條件
                    </button>
                  )}
                </div>
              )
            )}

            {/* 模組 6：待定級 / 季前預排智慧收合區（消除滿螢幕 0% / 0W-0L 雜訊） */}
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
                      <p className="text-xs sm:text-sm font-display font-black text-foreground truncate">
                        待定級／尚未出賽選手（共 {secondaryUnrankedPlayers.length} 人）
                      </p>
                      <p className="text-[11px] font-bold text-muted-foreground truncate">
                        依全域 ELO 排序 · 完成本季第 1 場比賽即正式登榜
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-muted-foreground shrink-0">
                    <span className="hidden sm:inline">
                      {showUnrankedSection ? '收合' : '展開'}
                    </span>
                    {showUnrankedSection ? (
                      <ChevronUp size={16} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} aria-hidden="true" />
                    )}
                  </span>
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
                            'w-full min-h-[60px] p-3 rounded-2xl border bg-surface-subtle/50 hover:bg-secondary/70 flex items-center gap-2.5 text-left transition-colors group',
                            isMe
                              ? 'border-sapphire-blue/45 bg-sapphire-blue/[0.05] dark:bg-blue-500/10'
                              : 'border-border/80',
                          )}
                        >
                          <span className="text-[11px] font-display font-black text-muted-foreground w-7 text-center tabular-nums shrink-0">
                            #{realIndexMap.get(player.player_id) ?? rankedCount + idx + 1}
                          </span>
                          <PlayerAvatar
                            src={player.avatar_url}
                            name={player.player_name}
                            className="size-9 rounded-xl border border-border shrink-0 text-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-display font-black text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                                {player.player_name}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-[10px] font-black shrink-0">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-black shrink-0',
                                  tier.color,
                                )}
                              >
                                {tier.icon}
                                {getShortTierName(player.global_mmr)}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground truncate">
                                {getNormalizedDept(player.department)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-display font-black text-foreground tabular-nums leading-none">
                              {Math.round(player.global_mmr)}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 模組 3：個人即時戰力定位條（MyStandingBanner）
 * ─────────────────────────────────────────────────────────────────────────── */
function MyStandingBanner({
  me,
  index,
  above,
  onSelect,
}: Readonly<{
  me: RawLeaderboardItem;
  index: number;
  above?: RawLeaderboardItem;
  onSelect: (id: string) => void;
}>) {
  const tier = getTierBadge(me.global_mmr, 12);
  const isRanked = me.rank !== '-' && me.rank !== '';
  const { losses, winRateRounded } = getWinRateStats(me);
  const streak = me.current_streak ?? 0;
  const gapToAbove = above
    ? Math.max(1, Math.round(above.global_mmr) - Math.round(me.global_mmr) + 1)
    : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(me.player_id)}
      className="w-full text-left arena-hero-surface rounded-2xl md:rounded-3xl p-4 sm:p-5 border border-blue-200/85 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-5">
        {/* Left Identity & Overtake Motivation */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <PlayerAvatar
              src={me.avatar_url}
              name={me.player_name}
              className="size-12 rounded-2xl border-2 border-sapphire-blue/40 bg-card text-sm"
            />
            <span className="absolute -top-2 -left-2 min-w-6 h-6 px-1.5 rounded-full bg-sapphire-blue text-white font-display font-black text-[11px] flex items-center justify-center shadow-sm ring-2 ring-card tabular-nums">
              {isRanked ? `#${me.rank}` : `#${index + 1}`}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-sapphire-blue dark:text-blue-300">
                我的目前定位
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-black',
                  tier.color,
                )}
              >
                {tier.icon}
                {getShortTierName(me.global_mmr)}
              </span>
              {streak >= 2 && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-black tabular-nums">
                  <Flame size={10} aria-hidden="true" />
                  {streak} 連勝
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold text-foreground/90 mt-1 leading-snug">
              {isRanked && Number(me.rank) === 1 ? (
                <span>👑 穩居榜首王座！持續守住全場最高積分</span>
              ) : isRanked && above ? (
                <span>
                  🎯 距離前一名{' '}
                  <strong className="font-black text-foreground">
                    #{above.rank !== '-' ? above.rank : index} {above.player_name}
                  </strong>{' '}
                  還差{' '}
                  <strong className="font-display font-black text-smash-orange tabular-nums">
                    {gapToAbove}
                  </strong>{' '}
                  分即可超車
                </span>
              ) : (
                <span>
                  ⚡ 依基準積分暫居預排第 #{index + 1} · 完成 1 場本季對戰即可正式定級
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right KPI Strip (3 crisp columns on mobile, inline on desktop) */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-blue-200/60 dark:border-white/10 sm:pt-0 sm:border-0 sm:flex sm:items-center sm:gap-5 shrink-0">
          <div className="rounded-xl bg-white/75 dark:bg-slate-900/55 sm:bg-transparent dark:sm:bg-transparent px-2.5 py-2 sm:p-0 text-center sm:text-right border border-blue-100/80 dark:border-white/10 sm:border-0 min-w-0">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              目前積分
            </p>
            <p className="text-lg sm:text-2xl font-display font-black text-foreground tabular-nums leading-tight">
              {Math.round(me.global_mmr)}
            </p>
          </div>

          <div className="rounded-xl bg-white/75 dark:bg-slate-900/55 sm:bg-transparent dark:sm:bg-transparent px-2.5 py-2 sm:p-0 text-center sm:text-right border border-blue-100/80 dark:border-white/10 sm:border-0 min-w-0">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              本季勝率
            </p>
            <p className="text-lg sm:text-2xl font-display font-black text-foreground tabular-nums leading-tight">
              {me.matches_played > 0 ? `${winRateRounded}%` : '待首戰'}
            </p>
          </div>

          <div className="rounded-xl bg-white/75 dark:bg-slate-900/55 sm:bg-transparent dark:sm:bg-transparent px-2.5 py-2 sm:p-0 text-center sm:text-right border border-blue-100/80 dark:border-white/10 sm:border-0 min-w-0">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              本季戰績
            </p>
            <p className="text-sm sm:text-base font-display font-black tabular-nums leading-tight mt-0.5 sm:mt-1 whitespace-nowrap">
              <span className="text-emerald-600 dark:text-emerald-400">{me.wins}W</span>
              <span className="text-muted-foreground/50 mx-0.5">-</span>
              <span className="text-rose-500 dark:text-rose-400">{losses}L</span>
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 模組 2A：#1 榜首榮耀巨頭卡（手機全寬焦點橫幅 / 桌面置中冠軍卡）
 * ─────────────────────────────────────────────────────────────────────────── */
function PodiumChampionCard({
  player,
  isPreseason,
  currentUserId,
  onSelect,
  className,
}: Readonly<{
  player?: RawLeaderboardItem;
  isPreseason: boolean;
  currentUserId?: string;
  onSelect: (id: string) => void;
  className?: string;
}>) {
  if (!player) {
    return (
      <div
        className={cn(
          'rounded-2xl md:rounded-3xl border-2 border-dashed border-amber-300/70 bg-amber-50/40 dark:bg-amber-500/5 p-5 flex flex-col items-center justify-center text-center min-h-[180px]',
          className,
        )}
      >
        <Crown size={28} className="text-amber-400/60 mb-2" aria-hidden="true" />
        <p className="text-xs font-black text-muted-foreground">榜首王座虛位以待</p>
      </div>
    );
  }

  const tier = getTierBadge(player.global_mmr, 12);
  const { losses, winRateRounded, winBarPercent } = getWinRateStats(player);
  const isMe = currentUserId === player.player_id;
  const streak = player.current_streak ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(player.player_id)}
      className={cn(
        'group relative w-full text-left md:text-center rounded-2xl md:rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-amber-50/95 via-white to-amber-100/70 dark:from-amber-500/18 dark:via-slate-900/90 dark:to-amber-500/5 border-2 border-amber-400/80 dark:border-amber-400/60 shadow-md shadow-amber-500/10 hover:shadow-lg transition-all flex flex-col justify-between gap-3.5 overflow-hidden focus-visible:outline-2 focus-visible:outline-sapphire-blue',
        className,
      )}
    >
      {/* Top Crown Pill + Weekly Momentum */}
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-olympic-gold text-white text-xs font-display font-black shadow-xs whitespace-nowrap">
          <Crown size={12} aria-hidden="true" />
          {isPreseason ? '預排 #1' : '#1 榜首王者'}
        </span>
        <WeeklyDeltaBadge delta={player.weekly_mmr_delta} />
      </div>

      {/* Main Identity: Horizontal on Phone, Centered Vertical on Desktop */}
      <div className="flex md:flex-col items-center gap-3.5 md:gap-2.5 min-w-0">
        <div className="relative shrink-0 p-[3px] rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-500 shadow-md transition-transform group-hover:scale-105">
          <PlayerAvatar
            src={player.avatar_url}
            name={player.player_name}
            className="size-15 sm:size-20 rounded-full bg-card text-xl sm:text-2xl"
          />
        </div>

        <div className="min-w-0 flex-1 md:w-full">
          <div className="flex items-center md:justify-center gap-1.5 flex-wrap min-w-0">
            <h3 className="text-base sm:text-xl font-display font-black text-foreground truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
              {player.player_name}
            </h3>
            {isMe && (
              <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-[10px] font-black shrink-0">
                YOU
              </span>
            )}
            {streak >= 2 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black tabular-nums shrink-0">
                <Flame size={10} aria-hidden="true" />
                {streak} 連勝
              </span>
            )}
          </div>

          <div className="flex items-center md:justify-center gap-1.5 mt-1 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground truncate">
              {getNormalizedDept(player.department)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black',
                tier.color,
              )}
            >
              {tier.icon}
              {getShortTierName(player.global_mmr)}
            </span>
          </div>
        </div>

        {/* Big ELO on Mobile Right / Below Name on Desktop */}
        <div className="text-right md:text-center shrink-0">
          <p className="text-3xl sm:text-4xl font-display font-black text-amber-700 dark:text-amber-300 tabular-nums leading-none">
            {Math.round(player.global_mmr)}
          </p>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
            GLOBAL ELO
          </p>
        </div>
      </div>

      {/* Bottom Win-Rate Progress Bar */}
      <div className="pt-2.5 border-t border-amber-300/50 dark:border-amber-500/20 space-y-1.5 w-full">
        {player.matches_played > 0 ? (
          <>
            <div className="flex items-center justify-between text-xs font-display font-black tabular-nums">
              <span className="text-foreground">勝率 {winRateRounded}%</span>
              <span>
                <span className="text-emerald-600 dark:text-emerald-400">{player.wins}W</span>
                <span className="text-muted-foreground/50 mx-0.5">-</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}L</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${winBarPercent}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[11px] font-bold text-muted-foreground text-center">
            季前實力預排 · 等待開季首戰
          </p>
        )}
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 模組 2B：#2 亞軍 / #3 季軍卡（手機並排 2 欄不擠壓）
 * ─────────────────────────────────────────────────────────────────────────── */
function PodiumRunnerCard({
  place,
  player,
  isPreseason,
  currentUserId,
  onSelect,
  className,
}: Readonly<{
  place: 2 | 3;
  player?: RawLeaderboardItem;
  isPreseason: boolean;
  currentUserId?: string;
  onSelect: (id: string) => void;
  className?: string;
}>) {
  const isSilver = place === 2;
  const label = isPreseason
    ? `預排 #${place}`
    : isSilver
      ? '#2 亞軍'
      : '#3 季軍';

  if (!player) {
    return (
      <div
        className={cn(
          'rounded-2xl md:rounded-3xl border border-dashed border-border bg-surface-subtle/60 p-4 flex flex-col items-center justify-center text-center min-h-[160px]',
          className,
        )}
      >
        <span className="text-xs font-display font-black text-muted-foreground mb-1">
          {label}
        </span>
        <p className="text-xs font-bold text-muted-foreground/60">虛位以待</p>
      </div>
    );
  }

  const { losses, winRateRounded, winBarPercent } = getWinRateStats(player);
  const isMe = currentUserId === player.player_id;
  const streak = player.current_streak ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(player.player_id)}
      className={cn(
        'group w-full min-w-0 overflow-hidden text-center rounded-2xl md:rounded-3xl p-3.5 sm:p-5 bg-card border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 focus-visible:outline-2 focus-visible:outline-sapphire-blue',
        isSilver
          ? 'border-slate-300/90 dark:border-slate-600/80'
          : 'border-orange-300/80 dark:border-orange-500/45',
        className,
      )}
    >
      {/* Top Medal Pill & Weekly Delta */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-display font-black border whitespace-nowrap',
            isSilver
              ? 'bg-slate-200/85 text-slate-700 border-slate-300 dark:bg-slate-500/25 dark:text-slate-200 dark:border-slate-500/50'
              : 'bg-orange-400/20 text-orange-700 border-orange-400/60 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/50',
          )}
        >
          {label}
        </span>
        <WeeklyDeltaBadge delta={player.weekly_mmr_delta} compact />
      </div>

      {/* Avatar, Name, ELO */}
      <div className="flex flex-col items-center gap-2 min-w-0">
        <div
          className={cn(
            'relative p-[2.5px] rounded-full transition-transform group-hover:scale-105',
            isSilver
              ? 'bg-gradient-to-br from-slate-300 to-slate-500'
              : 'bg-gradient-to-br from-orange-300 to-amber-600',
          )}
        >
          <PlayerAvatar
            src={player.avatar_url}
            name={player.player_name}
            className="size-13 sm:size-17 rounded-full bg-card text-base sm:text-xl"
          />
        </div>

        <div className="min-w-0 w-full space-y-0.5">
          <div className="flex items-center justify-center gap-1 min-w-0">
            <h3 className="text-sm sm:text-base font-display font-black text-foreground truncate group-hover:text-sapphire-blue transition-colors">
              {player.player_name}
            </h3>
            {isMe && (
              <span className="px-1 py-0.5 rounded bg-sapphire-blue text-white text-[9px] font-black shrink-0">
                YOU
              </span>
            )}
          </div>
          <p className="text-[11px] font-bold text-muted-foreground truncate">
            {getNormalizedDept(player.department)}
          </p>
        </div>

        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl sm:text-3xl font-display font-black text-foreground tabular-nums leading-none">
            {Math.round(player.global_mmr)}
          </span>
          <span className="text-[10px] font-black text-muted-foreground uppercase">ELO</span>
        </div>

        {streak >= 2 && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black tabular-nums">
            <Flame size={10} aria-hidden="true" />
            {streak} 連勝
          </span>
        )}
      </div>

      {/* Bottom Mini Win-Rate Bar */}
      <div className="pt-2 border-t border-border/70 space-y-1 w-full">
        {player.matches_played > 0 ? (
          <>
            <div className="flex items-center justify-between text-[11px] font-display font-black tabular-nums">
              <span className="text-foreground">{winRateRounded}%</span>
              <span>
                <span className="text-emerald-600 dark:text-emerald-400">{player.wins}W</span>
                <span className="text-muted-foreground/45 mx-0.5">-</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}L</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${winBarPercent}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[11px] font-bold text-muted-foreground">等待開季首戰</p>
        )}
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 模組 1：手機專屬原生競技球星列卡（零跑版、零斷裂分隔線）
 * ─────────────────────────────────────────────────────────────────────────── */
function MobilePlayerRowCard({
  player,
  previewIndex,
  isMe,
  onSelect,
}: Readonly<{
  player: RawLeaderboardItem;
  previewIndex: number;
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
          ? 'bg-sapphire-blue/[0.045] dark:bg-blue-500/12 border-sapphire-blue/40'
          : isTop1
            ? 'bg-amber-50/45 dark:bg-amber-500/10 border-amber-300/70 dark:border-amber-400/40'
            : 'bg-card border-border hover:bg-secondary/50',
      )}
    >
      {/* Top Row: Medal + Avatar + Name/Badges + Right ELO */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 shrink-0 flex flex-col items-center justify-center gap-1">
          <MedalBadge
            rank={player.rank}
            previewIndex={player.rank === '-' ? previewIndex : undefined}
          />
          <TrendBadge trend={player.trend} />
        </div>

        <PlayerAvatar
          src={player.avatar_url}
          name={player.player_name}
          className="size-11 rounded-2xl border border-border shadow-2xs text-sm shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-black text-base text-foreground truncate">
              {player.player_name}
            </span>
            {isMe && (
              <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-[10px] font-black uppercase shrink-0">
                YOU
              </span>
            )}
            {streak >= 2 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black tabular-nums shrink-0 whitespace-nowrap">
                <Flame size={9} aria-hidden="true" />
                {streak}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-muted-foreground truncate mt-0.5">
            {getNormalizedDept(player.department)}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p
            className={cn(
              'font-display font-black text-2xl tabular-nums leading-none',
              isTop1 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
            )}
          >
            {Math.round(player.global_mmr)}
          </p>
          <div className="mt-1 flex justify-end">
            <WeeklyDeltaBadge delta={player.weekly_mmr_delta} compact />
          </div>
        </div>
      </div>

      {/* Bottom Data Capsule Strip: Full unbroken divider */}
      <div className="mt-2.5 pt-2.5 border-t border-border/75 flex items-center justify-between gap-2 min-w-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-black shrink-0 whitespace-nowrap',
            tier.color,
          )}
        >
          {tier.icon}
          <span className="sm:hidden">{getShortTierName(player.global_mmr)}</span>
          <span className="hidden sm:inline">{tier.name}</span>
        </span>

        {player.matches_played > 0 ? (
          <div className="min-w-0 flex-1 max-w-[140px] space-y-1">
            <div className="flex items-baseline justify-between gap-1 text-[11px] font-display font-black tabular-nums">
              <span className="text-foreground">{winRateRounded}%</span>
              <span className="whitespace-nowrap">
                <span className="text-emerald-600 dark:text-emerald-400">{player.wins}W</span>
                <span className="text-muted-foreground/45 mx-0.5">-</span>
                <span className="text-rose-500 dark:text-rose-400">{losses}L</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-rose-500/25 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${winBarPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground truncate">
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
