import { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '@/utils/apiClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RankingCard } from '@/components/RankingCard';
import { ClubRightRail } from '@/components/ClubRightRail';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MatchSeriesItem } from '@/components/MatchItem';
import { PlayerAnalyticsHub } from '@/components/PlayerAnalyticsHub';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ReportScore } from '@/components/ReportScore';
import { MatchPresetEditorModal, MatchPresetManagerModal } from '@/components/MatchPresetModal';
import {
  MAX_MATCH_PRESETS,
  useQuickMatchItems,
} from '@/hooks/useMatchPresets';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Skull,
  Crown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trophy,
  Timer,
  History,
  Zap,
  Megaphone,
  Users,
  LogIn,
  Swords,
  Handshake,
  Plus,
  Star,
  SlidersHorizontal,
  Globe,
  UserCheck,
} from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { clusterMatchesIntoSeries } from '@/lib/matchDate';
import { PendingActions } from '@/components/PendingActions';
import { ChallengeHub } from '@/components/ChallengeHub';
import { useAuth } from '@/hooks/useAuth';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import type { MatchFormat } from '@/lib/matchScore';

import type {
  Announcement,
  ChallengeItem,
  MatchFeedItem,
  MatchHistoryResponse,
  MatchPreset,
  RivalsResponse,
  PartnersResponse,
  LeaderboardResponse,
  PlayerStats,
  RivalryItem
} from '@/types/api.types';

function AnnouncementBanner({ items }: { items: Announcement[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const safeIndex = items.length > 0 ? currentIndex % items.length : 0;
  const current = items[safeIndex];

  useEffect(() => {
    if (isPaused || expanded || items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, expanded, items.length]);

  if (!items || items.length === 0 || !current) return null;

  const getStyle = (type: string) => {
    switch (type) {
      case 'tournament':
        return {
          icon: Trophy,
          badgeBg: 'bg-amber-500/15 border border-amber-500/25 dark:bg-amber-500/20 dark:border-amber-400/30',
          badgeText: 'text-amber-700 dark:text-amber-300',
          label: '賽事公告',
        };
      case 'club':
        return {
          icon: Users,
          badgeBg: 'bg-emerald-500/15 border border-emerald-500/25 dark:bg-emerald-500/20 dark:border-emerald-400/30',
          badgeText: 'text-emerald-700 dark:text-emerald-300',
          label: '社團公告',
        };
      default:
        return {
          icon: Megaphone,
          badgeBg: 'bg-sapphire-blue/12 border border-sapphire-blue/25 dark:bg-sapphire-blue/25 dark:border-blue-400/30',
          badgeText: 'text-sapphire-blue dark:text-blue-300',
          label: '系統公告',
        };
    }
  };

  const style = getStyle(current.type || 'system');
  const Icon = style.icon;

  const nextMsg = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };
  const prevMsg = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <section aria-label="公告快訊">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="bg-card rounded-2xl px-4 py-2.5 border border-border shadow-xs overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 min-h-8">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
          >
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0',
                style.badgeBg,
                style.badgeText
              )}
            >
              <Icon size={12} aria-hidden="true" />
              {style.label}
            </span>

            <AnimatePresence mode="wait">
              <motion.span
                key={current.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="text-sm font-display font-semibold text-foreground truncate group-hover:text-sapphire-blue dark:group-hover:text-blue-300 transition-colors"
              >
                {current.title}
              </motion.span>
            </AnimatePresence>

            <span className="hidden md:inline-flex items-center gap-1 text-muted-foreground text-xs font-medium tabular-nums shrink-0">
              <Timer size={12} aria-hidden="true" />
              {formatLocalTime(current.created_at, 'yyyy-MM-dd')}
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {items.length > 1 && (
              <>
                <span className="hidden sm:inline text-xs font-semibold text-muted-foreground tabular-nums px-1">
                  {(safeIndex + 1).toString().padStart(2, '0')}/{items.length.toString().padStart(2, '0')}
                </span>
                <button
                  type="button"
                  aria-label="上一則公告"
                  onClick={prevMsg}
                  className="size-8 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/80 flex items-center justify-center text-foreground transition-colors"
                >
                  <ChevronLeft size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="下一則公告"
                  onClick={nextMsg}
                  className="size-8 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/80 flex items-center justify-center text-foreground transition-colors"
                >
                  <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </>
            )}

            <button
              type="button"
              aria-expanded={expanded}
              aria-label="切換公告詳情"
              title={expanded ? '收合公告' : '展開公告'}
              onClick={() => setExpanded((prev) => !prev)}
              className="size-8 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/80 flex items-center justify-center text-foreground transition-colors shrink-0"
            >
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={cn('transition-transform duration-200', expanded && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-2.5 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm text-foreground/85 font-normal leading-relaxed whitespace-pre-line">
                    {current.content}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium md:hidden tabular-nums">
                    發布日期：{formatLocalTime(current.created_at, 'yyyy-MM-dd')}
                  </p>
                </div>
                {current.link_url && (
                  <Button
                    type="button"
                    onClick={() => window.open(current.link_url, '_blank')}
                    className="min-h-9 px-4 rounded-xl font-semibold text-xs bg-sapphire-blue hover:bg-blue-700 text-white shrink-0 gap-1"
                  >
                    {current.link_text || '了解詳情'}
                    <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useAuth();
  const [chartInterval, setChartInterval] = useState<string>('recent');
  const [quickFilter, setQuickFilter] = useState<'all' | 'singles' | 'doubles'>('all');
  const [showAllQuickItems, setShowAllQuickItems] = useState(false);
  const [feedScope, setFeedScope] = useState<'all' | 'mine'>('all');
  const [showAllFeedClusters, setShowAllFeedClusters] = useState(false);
  const [isFeedSectionCollapsed, setIsFeedSectionCollapsed] = useState(false);
  const [railScope, setRailScope] = useState<'season' | 'all-time'>('season');
  const [quickReportState, setQuickReportState] = useState<{
    open: boolean;
    nonce: number;
    matchType: 'singles' | 'doubles';
    format?: MatchFormat;
    partnerId: string | null;
    opponent1Id: string | null;
    opponent2Id: string | null;
    challengeId?: string | null;
  }>({
    open: false,
    nonce: 0,
    matchType: 'singles',
    format: undefined,
    partnerId: null,
    opponent1Id: null,
    opponent2Id: null,
    challengeId: null,
  });
  const [editorState, setEditorState] = useState<{
    open: boolean;
    nonce: number;
    preset: MatchPreset | null;
  }>({
    open: false,
    nonce: 0,
    preset: null,
  });
  const [managerOpen, setManagerOpen] = useState(false);

  const isLoggedIn = !!user;

  const openInspect = (playerId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await apiClient.get<Announcement[]>('/announcements');
      return res.data;
    },
  });

  const { data: recentFeed = [], isPending: isFeedLoading } = useQuery({
    queryKey: ['matches', 'recent'],
    queryFn: async () => {
      const res = await apiClient.get<MatchFeedItem[]>('/matches/recent?limit=16');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: myRecentData, isPending: isMyRecentLoading } = useQuery({
    queryKey: ['matches', 'history', 'dashboard-mine', user?.id],
    queryFn: async () => {
      const res = await apiClient.get<MatchHistoryResponse>(
        '/users/me/matches?limit=16&offset=0&result_filter=all&match_type=all',
      );
      return res.data;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const activeFeedMatches = useMemo(
    () => (feedScope === 'mine' ? (myRecentData?.matches ?? []) : recentFeed),
    [feedScope, myRecentData, recentFeed],
  );
  const feedClusters = useMemo(
    () => clusterMatchesIntoSeries(activeFeedMatches),
    [activeFeedMatches],
  );
  const DEFAULT_VISIBLE_CLUSTERS = 4;
  const visibleFeedClusters = showAllFeedClusters
    ? feedClusters
    : feedClusters.slice(0, DEFAULT_VISIBLE_CLUSTERS);
  const hiddenClusterCount = Math.max(0, feedClusters.length - DEFAULT_VISIBLE_CLUSTERS);

  const { data: rivals = { nemesis: [], minions: [] } } = useQuery({
    queryKey: ['users', 'me', 'rivals'],
    queryFn: async () => {
      const res = await apiClient.get<RivalsResponse>('/users/me/rivals');
      return res.data;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const { data: partners = { golden_partners: [], worst_partners: [] } } = useQuery({
    queryKey: ['users', 'me', 'partners'],
    queryFn: async () => {
      const res = await apiClient.get<PartnersResponse>('/users/me/partners');
      return res.data;
    },
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const { data: seasonLeaderboardData, isPending: isLeaderboardLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await apiClient.get<LeaderboardResponse>('/leaderboard');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const { data: allTimeLeaderboardData, isFetching: isAllTimeFetching } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', 'all-time'],
    queryFn: async () => {
      const res = await apiClient.get<LeaderboardResponse>('/leaderboard?season_id=all-time');
      return res.data;
    },
    enabled: railScope === 'all-time',
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });

  const {
    data: myStats,
    isPending: isStatsLoading,
    isFetching: isStatsFetching,
    isError: isStatsError,
  } = useQuery({
    queryKey: ['users', 'me', 'stats', chartInterval],
    queryFn: async () => {
      const statsRes = await apiClient.get<PlayerStats>(`/users/me/stats?interval=${chartInterval}`);
      return statsRes.data;
    },
    enabled: isLoggedIn,
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
    retry: 1,
  });

  const { items: quickMatchItems, customPresets } = useQuickMatchItems({
    enabled: isLoggedIn,
    userId: user?.id,
    rivals,
    partners,
    recentFeed,
  });

  const openQuickReport = (
    matchType: 'singles' | 'doubles',
    partnerId: string | null,
    opponent1Id: string | null,
    opponent2Id: string | null
  ) => {
    setQuickReportState((prev) => ({
      open: true,
      nonce: prev.nonce + 1,
      matchType,
      format: undefined,
      partnerId,
      opponent1Id,
      opponent2Id,
      challengeId: null,
    }));
  };

  const handleReportFromChallenge = (challenge: ChallengeItem) => {
    const prefill = challenge.report_prefill;
    setQuickReportState((prev) => ({
      open: true,
      nonce: prev.nonce + 1,
      matchType: prefill?.match_type || challenge.match_type,
      format: (prefill?.format || challenge.format) as MatchFormat,
      partnerId: prefill?.partner_id ?? null,
      opponent1Id: prefill?.opponent1_id ?? null,
      opponent2Id: prefill?.opponent2_id ?? null,
      challengeId: challenge.id,
    }));
  };

  const openPresetEditor = (preset: MatchPreset | null = null) => {
    setEditorState((prev) => ({
      open: true,
      nonce: prev.nonce + 1,
      preset,
    }));
  };

  const isFirstLoading =
    (isFeedLoading && recentFeed.length === 0) ||
    (isLeaderboardLoading && !seasonLeaderboardData) ||
    (isLoggedIn && isStatsLoading && !myStats && !isStatsError);

  const filteredQuickItems = useMemo(() => {
    if (quickFilter === 'all') return quickMatchItems;
    return quickMatchItems.filter((item) => item.matchType === quickFilter);
  }, [quickMatchItems, quickFilter]);

  const visibleQuickItems = showAllQuickItems
    ? filteredQuickItems
    : filteredQuickItems.slice(0, 6);

  return (
    <AnimatePresence mode="wait">
      {isFirstLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <DashboardSkeleton />
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
              title={user?.name || 'Precision Arena'}
              subtitle={isLoggedIn ? '個人戰情總覽' : '即時戰況總覽'}
              actions={
                !isLoggedIn ? (
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="hidden lg:inline-flex min-h-11 px-5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-bold text-sm gap-2"
                  >
                    <LogIn size={16} aria-hidden="true" />
                    登入戰情室
                  </Button>
                ) : undefined
              }
            />
          </motion.div>

          {/* 1st Priority: Pending Actions */}
          {isLoggedIn && (
            <motion.div variants={fadeInUp}>
              <PendingActions />
            </motion.div>
          )}

          {/* 1.5 Priority: Match Challenges Hub */}
          {isLoggedIn && (
            <motion.div variants={fadeInUp}>
              <ChallengeHub
                currentUserId={user?.id}
                onInspectPlayer={openInspect}
                onReportChallenge={handleReportFromChallenge}
              />
            </motion.div>
          )}

          {/* 2nd: Slim Announcement Ticker Bar */}
          <motion.div variants={fadeInUp}>
            <AnnouncementBanner items={announcements} />
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10 items-start">
            <div className="xl:col-span-8 min-w-0 space-y-8 md:space-y-10">
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="min-w-0 space-y-8 md:space-y-10">
                {!isLoggedIn && (
                  <motion.section
                    variants={itemVariants}
                    className="arena-hero-surface text-foreground rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-md dark:shadow-lg border border-blue-200/85 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                  >
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sapphire-blue/12 text-sapphire-blue dark:bg-sapphire-blue/25 dark:text-blue-200 border border-sapphire-blue/20 text-xs font-black uppercase tracking-wider">
                        訪客瀏覽模式
                      </span>
                      <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-foreground">
                        登入戰情室，記錄每場熱血對決
                      </h2>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                        登入後可即時申報單雙打比分、追蹤個人 Elo 走勢，並查看與所有對手的 H2H 交手分析。
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="h-12 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-600 text-white font-display font-black text-sm gap-2 shrink-0"
                    >
                      <LogIn size={16} aria-hidden="true" />
                      立即登入
                    </Button>
                  </motion.section>
                )}

                {isLoggedIn && (
                  <>
                    {/* Hero Personal Card with Dopamine Pro Stats & Report CTA */}
                    <motion.section variants={itemVariants}>
                      <RankingCard
                        player={{
                          id: user?.id || 'me',
                          name: user?.name || 'Me',
                          username: user?.username || user?.name || 'Me',
                          avatar: user?.avatar_url || user?.avatar || '',
                          isVerified: user?.isVerified || false,
                          department: user?.department || '',
                          dominantHand: user?.dominant_hand,
                          rubberForehand: user?.rubber_forehand,
                          rubberBackhand: user?.rubber_backhand,
                          rating: (myStats?.global_mmr || user?.global_mmr || user?.mmr || 1000) as number,
                          mmr: (myStats?.global_mmr || user?.global_mmr || user?.mmr || 1000) as number,
                          rank: myStats?.rank ?? '-',
                          seasonMatchesPlayed: myStats?.season_matches_played ?? 0,
                          ptsChange: myStats?.pts_change,
                          recentForm: myStats?.recent_form,
                          recent5Delta: myStats?.recent_5_delta,
                          currentStreak: myStats?.current_streak,
                          peakMmr: myStats?.peak_mmr,
                          nextRival: myStats?.next_rival,
                          stats: {
                            winRate: myStats?.win_rate || '0%',
                            wins: myStats?.wins || 0,
                            losses: myStats?.losses || 0,
                            avgScore: 0,
                          },
                        }}
                        variant="featured"
                      />
                    </motion.section>

                    {/* Quick-Match Bar (Singles + Doubles + Custom Presets) */}
                    <motion.section variants={itemVariants} className="space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                            <Swords size={16} className="text-smash-orange" aria-hidden="true" />
                            一鍵約戰報分
                          </h2>
                          <div
                            role="group"
                            aria-label="篩選快速報分組合類型"
                            className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-secondary border border-border"
                          >
                            {([
                              { id: 'all', label: '全部' },
                              { id: 'singles', label: '單打' },
                              { id: 'doubles', label: '雙打' },
                            ] as const).map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                  setQuickFilter(tab.id);
                                  setShowAllQuickItems(false);
                                }}
                                className={cn(
                                  'min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                                  quickFilter === tab.id
                                    ? 'bg-card text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setManagerOpen(true)}
                            className="min-h-9 px-3 rounded-xl bg-secondary hover:bg-card border border-border text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                          >
                            <SlidersHorizontal size={13} aria-hidden="true" />
                            <span>管理</span>
                            {customPresets.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-semibold tabular-nums leading-none">
                                {customPresets.length}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={customPresets.length >= MAX_MATCH_PRESETS}
                            onClick={() => openPresetEditor(null)}
                            className="min-h-9 px-3 rounded-xl bg-sapphire-blue/10 hover:bg-sapphire-blue/20 text-sapphire-blue dark:text-blue-300 border border-sapphire-blue/25 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-45"
                          >
                            <Plus size={14} aria-hidden="true" />
                            <span>新增組合</span>
                          </button>
                        </div>
                      </div>

                      {visibleQuickItems.length > 0 ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2.5">
                            {visibleQuickItems.map((item) => {
                              const isDoubles = item.matchType === 'doubles';
                              const hasBothOpponents =
                                Boolean(item.opponent1) && Boolean(item.opponent2);
                              const customLabel = item.label?.trim();
                              const avatarPlayer = isDoubles ? item.partner : item.opponent1;

                              const primaryTitle =
                                customLabel ||
                                (isDoubles
                                  ? `搭 ${item.partner?.name ?? '搭檔'}`
                                  : item.opponent1?.name || '單打對手');

                              const secondarySubtitle = isDoubles
                                ? hasBothOpponents
                                  ? `vs ${item.opponent1?.name ?? ''} · ${item.opponent2?.name ?? ''}`
                                  : '雙打搭檔'
                                : customLabel
                                  ? item.opponent1?.name || '單打'
                                  : item.matchCount && item.matchCount > 1
                                    ? `單打 · ${item.matchCount} 場`
                                    : '單打';

                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() =>
                                    openQuickReport(
                                      item.matchType,
                                      item.partner?.id ?? null,
                                      item.opponent1?.id ?? null,
                                      item.opponent2?.id ?? null
                                    )
                                  }
                                  className="w-full min-w-0 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-card hover:bg-secondary/70 border border-border hover:border-sapphire-blue/40 shadow-xs transition-all group text-left"
                                >
                                  <PlayerAvatar
                                    src={avatarPlayer?.avatar}
                                    name={avatarPlayer?.name || '球'}
                                    className="size-9 rounded-xl text-xs shrink-0 border border-border transition-transform group-hover:scale-105"
                                  />

                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {item.isCustom && (
                                        <Star
                                          size={12}
                                          fill="currentColor"
                                          className="text-olympic-gold shrink-0"
                                          aria-hidden="true"
                                        />
                                      )}
                                      <p className="text-sm font-semibold text-foreground group-hover:text-sapphire-blue transition-colors truncate">
                                        {primaryTitle}
                                      </p>
                                    </div>
                                    <p className="text-xs font-medium text-muted-foreground truncate">
                                      {secondarySubtitle}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {filteredQuickItems.length > 6 && (
                            <div className="flex justify-center pt-0.5">
                              <button
                                type="button"
                                aria-expanded={showAllQuickItems}
                                aria-label="切換全部快速約戰組合"
                                title={
                                  showAllQuickItems
                                    ? '收合清單'
                                    : `顯示全部 (${filteredQuickItems.length} 組)`
                                }
                                onClick={() => setShowAllQuickItems((prev) => !prev)}
                                className="inline-flex items-center gap-1 min-h-9 px-3 rounded-xl bg-surface-subtle hover:bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {!showAllQuickItems && (
                                  <span>+{filteredQuickItems.length - 6}</span>
                                )}
                                <ChevronDown
                                  size={14}
                                  aria-hidden="true"
                                  className={cn(
                                    'transition-transform duration-200',
                                    showAllQuickItems && 'rotate-180',
                                  )}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-surface-subtle/80 border border-dashed border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {quickFilter === 'doubles'
                              ? '尚無常打雙打組合，可手動建立固定搭檔或四人團！'
                              : quickFilter === 'singles'
                                ? '尚無常打單打對手，可手動新增常用對手！'
                                : '尚無快速約戰組合，立即新增常用對手或固定雙打團吧！'}
                          </p>
                          <button
                            type="button"
                            disabled={customPresets.length >= MAX_MATCH_PRESETS}
                            onClick={() => openPresetEditor(null)}
                            className="shrink-0 min-h-9 px-3.5 rounded-xl bg-sapphire-blue text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-700 transition-colors disabled:opacity-45"
                          >
                            <Plus size={14} aria-hidden="true" />
                            <span>新增自訂組合</span>
                          </button>
                        </div>
                      )}
                    </motion.section>

                    {/* Player Analytics Hub (Progression / Radar / Breakdown) */}
                    <motion.div variants={itemVariants}>
                      <PlayerAnalyticsHub
                        stats={myStats}
                        chartInterval={chartInterval}
                        onChartIntervalChange={setChartInterval}
                        isFetching={isStatsFetching}
                        onInspectPlayer={openInspect}
                      />
                    </motion.div>

                    {/* Tabbed Clean Rivalry & Synergy Section */}
                    <motion.section variants={itemVariants} className="space-y-4">
                      <Tabs defaultValue="rivals" className="w-full flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                          <div>
                            <h2 className="text-lg sm:text-xl text-foreground font-display font-bold tracking-tight">
                              對戰情報室
                            </h2>
                          </div>
                          <TabsList className="grid w-full sm:w-auto grid-cols-2 min-h-10 h-auto bg-secondary border border-border rounded-xl p-1 shrink-0">
                            <TabsTrigger value="rivals" className="min-h-8 text-xs font-semibold rounded-lg px-3.5 gap-1.5">
                              <Swords size={13} aria-hidden="true" />
                              宿敵與提款機
                            </TabsTrigger>
                            <TabsTrigger value="partners" className="min-h-8 text-xs font-semibold rounded-lg px-3.5 gap-1.5">
                              <Handshake size={13} aria-hidden="true" />
                              雙打搭檔情報
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="rivals" className="mt-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
                              <div className="px-4 py-3.5 border-b border-border/70 flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                  <Skull size={16} aria-hidden="true" />
                                </div>
                                <h3 className="text-base font-display font-bold text-foreground">宿命天敵</h3>
                              </div>
                              <div className="divide-y divide-border/70">
                                {rivals.nemesis.length > 0 ? (
                                  rivals.nemesis.map((item) => (
                                    <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground font-medium text-center py-6">尚無天敵資料</p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
                              <div className="px-4 py-3.5 border-b border-border/70 flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <Crown size={16} aria-hidden="true" />
                                </div>
                                <h3 className="text-base font-display font-bold text-foreground">積分提款機</h3>
                              </div>
                              <div className="divide-y divide-border/70">
                                {rivals.minions.length > 0 ? (
                                  rivals.minions.map((item) => (
                                    <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground font-medium text-center py-6">尚無提款機資料</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="partners" className="mt-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
                              <div className="px-4 py-3.5 border-b border-border/70 flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                  <Trophy size={16} aria-hidden="true" />
                                </div>
                                <h3 className="text-base font-display font-bold text-foreground">黃金搭檔</h3>
                              </div>
                              <div className="divide-y divide-border/70">
                                {partners.golden_partners.length > 0 ? (
                                  partners.golden_partners.map((item) => (
                                    <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground font-medium text-center py-6">尚無黃金搭檔資料</p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
                              <div className="px-4 py-3.5 border-b border-border/70 flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                                  <Zap size={16} aria-hidden="true" />
                                </div>
                                <h3 className="text-base font-display font-bold text-foreground">磨合搭檔</h3>
                              </div>
                              <div className="divide-y divide-border/70">
                                {partners.worst_partners.length > 0 ? (
                                  partners.worst_partners.map((item) => (
                                    <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground font-medium text-center py-6">尚無相關資料</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </motion.section>
                  </>
                )}

                <motion.section variants={itemVariants} className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg sm:text-xl text-foreground font-display font-bold tracking-tight">
                          近期戰報動態
                        </h2>
                        <div
                          role="group"
                          aria-label="切換近期戰報動態範圍"
                          className="inline-flex p-0.5 rounded-xl bg-secondary border border-border"
                        >
                          <button
                            type="button"
                            aria-pressed={feedScope === 'all'}
                            onClick={() => {
                              setFeedScope('all');
                              setShowAllFeedClusters(false);
                              setIsFeedSectionCollapsed(false);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 min-h-8 px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
                              feedScope === 'all'
                                ? 'bg-card text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <Globe size={13} aria-hidden="true" />
                            <span>全部</span>
                          </button>
                          <button
                            type="button"
                            aria-pressed={feedScope === 'mine'}
                            onClick={() => {
                              if (!isLoggedIn) {
                                navigate('/login');
                                return;
                              }
                              setFeedScope('mine');
                              setShowAllFeedClusters(false);
                              setIsFeedSectionCollapsed(false);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 min-h-8 px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
                              feedScope === 'mine'
                                ? 'bg-card text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <UserCheck size={13} aria-hidden="true" />
                            <span>個人</span>
                          </button>
                        </div>
                      </div>
                      {activeFeedMatches.length > 0 && (
                        <p className="text-xs text-muted-foreground font-sans font-medium mt-1">
                          共 {activeFeedMatches.length} 場
                          {feedClusters.length < activeFeedMatches.length &&
                            ` · 同組連打已收疊為 ${feedClusters.length} 組`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        aria-expanded={!isFeedSectionCollapsed}
                        aria-label="切換近期對戰紀錄"
                        title={isFeedSectionCollapsed ? '展開近期戰報' : '收合近期戰報'}
                        onClick={() => setIsFeedSectionCollapsed((prev) => !prev)}
                        className="size-9 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          className={cn(
                            'transition-transform duration-200',
                            !isFeedSectionCollapsed && 'rotate-180',
                          )}
                        />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-9 text-xs sm:text-sm font-semibold text-sapphire-blue hover:bg-sapphire-blue/10 rounded-xl px-3 whitespace-nowrap"
                        onClick={() =>
                          navigate(feedScope === 'mine' ? '/history?scope=mine' : '/history?scope=all')
                        }
                      >
                        查看全部
                      </Button>
                    </div>
                  </div>

                  {isFeedSectionCollapsed ? (
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-label="顯示近期對戰紀錄"
                      onClick={() => setIsFeedSectionCollapsed(false)}
                      className="w-full py-3 px-4 rounded-2xl border border-dashed border-border bg-surface-subtle/60 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>
                        已隱藏 {activeFeedMatches.length} 場{feedScope === 'mine' ? '個人' : '全部'}近期戰報
                      </span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  ) : feedScope === 'mine' && isMyRecentLoading && activeFeedMatches.length === 0 ? (
                    <div className="text-center py-10 arena-surface text-xs font-bold text-muted-foreground">
                      載入個人近期戰報中...
                    </div>
                  ) : activeFeedMatches.length > 0 ? (
                    <div className="space-y-2.5">
                      {feedScope === 'all' ? (
                        <div className="bg-card border border-border rounded-2xl md:rounded-3xl overflow-hidden shadow-xs divide-y divide-border/70">
                          {visibleFeedClusters.map((cluster) => (
                            <MatchSeriesItem
                              key={cluster.key}
                              cluster={cluster}
                              variant="feed"
                              timeDisplay="smart"
                              enableDeepLinkFocus={false}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {visibleFeedClusters.map((cluster) => (
                            <MatchSeriesItem
                              key={cluster.key}
                              cluster={cluster}
                              variant="personal"
                              timeDisplay="smart"
                              enableDeepLinkFocus={false}
                            />
                          ))}
                        </div>
                      )}

                      {feedClusters.length > DEFAULT_VISIBLE_CLUSTERS && (
                        <div className="flex justify-center pt-0.5">
                          <button
                            type="button"
                            aria-expanded={showAllFeedClusters}
                            aria-label="切換顯示全部近期戰報"
                            title={
                              showAllFeedClusters
                                ? '收合部分戰報'
                                : `顯示其餘 ${hiddenClusterCount} 組戰報`
                            }
                            onClick={() => setShowAllFeedClusters((prev) => !prev)}
                            className="inline-flex items-center gap-1 h-8 px-3.5 rounded-xl bg-surface-subtle hover:bg-secondary border border-border text-xs font-black text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {!showAllFeedClusters && <span>+{hiddenClusterCount} 組</span>}
                            <ChevronDown
                              size={14}
                              aria-hidden="true"
                              className={cn(
                                'transition-transform duration-200',
                                showAllFeedClusters && 'rotate-180',
                              )}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-14 arena-surface border-dashed">
                      <History size={28} className="mx-auto text-muted-foreground/50 mb-3" aria-hidden="true" />
                      <p className="text-muted-foreground font-bold text-xs">
                        {feedScope === 'mine' ? '您目前還沒有個人對戰紀錄' : '目前還沒有對戰紀錄'}
                      </p>
                    </div>
                  )}
                </motion.section>
              </motion.div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="xl:col-span-4 min-w-0 xl:sticky xl:top-6"
            >
              <ClubRightRail
                seasonData={seasonLeaderboardData}
                allTimeData={allTimeLeaderboardData}
                isAllTimeFetching={isAllTimeFetching}
                scope={railScope}
                onScopeChange={setRailScope}
                currentUserId={user?.id}
                onInspectPlayer={openInspect}
              />
            </motion.div>
          </div>

          {isLoggedIn && (
            <>
              <ReportScore
                key={quickReportState.nonce}
                open={quickReportState.open}
                onOpenChange={(nextOpen) =>
                  setQuickReportState((prev) => ({ ...prev, open: nextOpen }))
                }
                initialMatchType={quickReportState.matchType}
                initialFormat={quickReportState.format}
                initialPartnerId={quickReportState.partnerId}
                initialOpponentId={quickReportState.opponent1Id}
                initialOpponent2Id={quickReportState.opponent2Id}
                challengeId={quickReportState.challengeId}
              />

              <MatchPresetEditorModal
                key={editorState.nonce}
                open={editorState.open}
                onOpenChange={(nextOpen) =>
                  setEditorState((prev) => ({ ...prev, open: nextOpen }))
                }
                editingPreset={editorState.preset}
              />

              <MatchPresetManagerModal
                open={managerOpen}
                onOpenChange={setManagerOpen}
                presets={customPresets}
                onCreateNew={() => openPresetEditor(null)}
                onEdit={(preset) => openPresetEditor(preset)}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RivalRow({
  id,
  name,
  avatar,
  winRate,
  matches,
  pointsExchanged,
  type,
  onInspect,
}: RivalryItem & { type: 'nemesis' | 'minions'; onInspect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onInspect(id)}
      className="w-full text-left flex items-center gap-3.5 px-4 py-3 group hover:bg-surface-subtle/70 transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue focus-visible:-outline-offset-2"
    >
      <PlayerAvatar
        src={avatar}
        name={name}
        className="size-10 rounded-full border border-border text-xs shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold text-foreground text-sm truncate group-hover:text-sapphire-blue transition-colors">
          {name}
        </p>
        <p className="text-xs text-muted-foreground font-medium mt-0.5 tabular-nums">
          {matches} 場 · {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} 分
        </p>
      </div>
      <span
        className={cn(
          'font-display font-bold text-base tabular-nums shrink-0',
          type === 'nemesis' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {winRate}%
      </span>
    </button>
  );
}
