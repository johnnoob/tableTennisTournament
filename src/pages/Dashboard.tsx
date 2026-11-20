import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '@/utils/apiClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RankingCard } from '@/components/RankingCard';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MatchItem } from '@/components/MatchItem';
import { StatsChart } from '@/components/StatsChart';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ReportScore } from '@/components/ReportScore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Skull,
  Crown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trophy,
  Timer,
  History,
  ArrowRight,
  Zap,
  Megaphone,
  Users,
  LogIn,
  Swords,
  Handshake,
  Plus,
} from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { PendingActions } from '@/components/PendingActions';
import { useAuth } from '@/hooks/useAuth';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';

import { isTopTierRank } from '@/lib/ranking';
import type {
  Announcement,
  MatchFeedItem,
  RivalsResponse,
  PartnersResponse,
  LeaderboardResponse,
  PlayerStats,
  DashboardPlayer,
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
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-300',
          label: '賽事公告',
        };
      case 'club':
        return {
          icon: Users,
          badgeBg: 'bg-emerald-500/20',
          badgeText: 'text-emerald-300',
          label: '社團公告',
        };
      default:
        return {
          icon: Megaphone,
          badgeBg: 'bg-sapphire-blue/25',
          badgeText: 'text-blue-300',
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
        className="arena-hero-surface rounded-2xl px-3.5 sm:px-4 py-2.5 border border-slate-700/80 shadow-md shadow-primary-navy/10 overflow-hidden"
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
                'inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shrink-0',
                style.badgeBg,
                style.badgeText
              )}
            >
              <Icon size={13} aria-hidden="true" />
              {style.label}
            </span>

            <AnimatePresence mode="wait">
              <motion.span
                key={current.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="text-xs sm:text-sm font-display font-black text-white truncate group-hover:text-blue-200 transition-colors"
              >
                {current.title}
              </motion.span>
            </AnimatePresence>

            <span className="hidden md:inline-flex items-center gap-1 text-slate-400 text-xs font-bold tabular-nums shrink-0">
              <Timer size={12} aria-hidden="true" />
              {formatLocalTime(current.created_at, 'yyyy-MM-dd')}
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {items.length > 1 && (
              <>
                <span className="hidden sm:inline text-xs font-black text-white/60 tabular-nums px-1">
                  {(safeIndex + 1).toString().padStart(2, '0')}/{items.length.toString().padStart(2, '0')}
                </span>
                <button
                  type="button"
                  aria-label="上一則公告"
                  onClick={prevMsg}
                  className="size-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="下一則公告"
                  onClick={nextMsg}
                  className="size-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </>
            )}

            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? '收合公告詳情' : '展開公告詳情'}
              onClick={() => setExpanded((prev) => !prev)}
              className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1 text-xs font-bold text-slate-200 transition-colors"
            >
              <span className="hidden sm:inline">{expanded ? '收合' : '詳情'}</span>
              {expanded ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
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
              <div className="pt-3 mt-2.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed whitespace-pre-line">
                    {current.content}
                  </p>
                  <p className="text-xs text-slate-400 font-bold md:hidden tabular-nums">
                    發布日期：{formatLocalTime(current.created_at, 'yyyy-MM-dd')}
                  </p>
                </div>
                {current.link_url && (
                  <Button
                    type="button"
                    onClick={() => window.open(current.link_url, '_blank')}
                    className="h-9 px-4 rounded-xl font-black text-xs tracking-wider bg-white hover:bg-slate-100 text-primary-navy shrink-0 gap-1"
                  >
                    {current.link_text || '了解詳情'}
                    <ChevronRight size={14} strokeWidth={3} aria-hidden="true" />
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
      const res = await apiClient.get<MatchFeedItem[]>('/matches/recent');
      return res.data;
    },
    refetchInterval: 10000,
  });

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

  const { data: topPlayers = [], isPending: isLeaderboardLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const leaderRes = await apiClient.get<LeaderboardResponse>('/leaderboard');
      if (!leaderRes.data || !leaderRes.data.leaderboard) return [];
      return leaderRes.data.leaderboard.slice(0, 3).map((p): DashboardPlayer => ({
        id: p.player_id,
        name: p.player_name,
        username: p.player_name,
        rank: p.rank,
        rating: Math.round(p.global_mmr),
        mmr: Math.round(p.global_mmr),
        avatar: p.avatar_url || '',
        isVerified: isTopTierRank(p.rank),
        department: p.department,
        stats: {
          wins: p.wins,
          losses: p.matches_played - p.wins,
          winRate: parseFloat(p.win_rate),
          avgScore: 0,
        },
      }));
    },
    refetchInterval: 10000,
  });

  const { data: myStats, isPending: isStatsLoading, isError: isStatsError } = useQuery({
    queryKey: ['users', 'me', 'stats', chartInterval],
    queryFn: async () => {
      const statsRes = await apiClient.get<PlayerStats>(`/users/me/stats?interval=${chartInterval}`);
      return statsRes.data;
    },
    enabled: isLoggedIn,
    refetchInterval: 10000,
    retry: 1,
  });

  const isFirstLoading =
    (isFeedLoading && recentFeed.length === 0) ||
    (isLeaderboardLoading && topPlayers.length === 0) ||
    (isLoggedIn && isStatsLoading && !myStats && !isStatsError);

  const ptsChange = myStats?.pts_change;

  const frequentColleagues = useMemo(() => {
    if (!user) return [];
    const seen = new Set<string>([String(user.id)]);
    const list: Array<{ id: string; name: string; avatar?: string | null }> = [];

    const tryAdd = (id?: string, name?: string, avatar?: string | null) => {
      if (!id || !name) return;
      const key = String(id);
      if (seen.has(key) || list.length >= 6) return;
      seen.add(key);
      list.push({ id: key, name, avatar });
    };

    rivals.nemesis.forEach((p) => tryAdd(p.id, p.name, p.avatar));
    rivals.minions.forEach((p) => tryAdd(p.id, p.name, p.avatar));
    partners.golden_partners.forEach((p) => tryAdd(p.id, p.name, p.avatar));
    partners.worst_partners.forEach((p) => tryAdd(p.id, p.name, p.avatar));
    recentFeed.forEach((match) => {
      [...(match.player1 || []), ...(match.opponent || [])].forEach((p) =>
        tryAdd(p.id, p.name, p.avatar)
      );
    });

    return list;
  }, [user, rivals, partners, recentFeed]);

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
              subtitle={isLoggedIn ? 'Precision Arena · Personal Dashboard' : 'Precision Arena · Live Overview'}
              actions={
                !isLoggedIn ? (
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="hidden lg:inline-flex h-11 px-5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm gap-2"
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

          {/* 2nd: Slim Announcement Ticker Bar */}
          <motion.div variants={fadeInUp}>
            <AnnouncementBanner items={announcements} />
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10 items-start">
            <div className="xl:col-span-8 space-y-8 md:space-y-10">
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 md:space-y-10">
                {!isLoggedIn && (
                  <motion.section
                    variants={itemVariants}
                    className="arena-hero-surface text-white rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                  >
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sapphire-blue/25 text-blue-200 text-xs font-black uppercase tracking-wider">
                        訪客瀏覽模式
                      </span>
                      <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight">
                        登入戰情室，記錄每場熱血對決
                      </h2>
                      <p className="text-sm text-slate-300 font-medium leading-relaxed">
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
                    {/* Hero Personal Card with Tier Progress & Report CTA */}
                    <motion.section variants={itemVariants}>
                      <RankingCard
                        player={{
                          id: user?.id || 'me',
                          name: user?.name || 'Me',
                          username: user?.username || user?.name || 'Me',
                          avatar: user?.avatar_url || user?.avatar || '',
                          isVerified: user?.isVerified || false,
                          department: user?.department || '',
                          rating: (myStats?.global_mmr || user?.global_mmr || user?.mmr || 1000) as number,
                          mmr: (myStats?.global_mmr || user?.global_mmr || user?.mmr || 1000) as number,
                          rank: myStats?.rank ?? '-',
                          stats: {
                            winRate: myStats?.win_rate || '0%',
                            wins: myStats?.wins || 0,
                            losses: myStats?.losses || 0,
                            avgScore: 0,
                          },
                        }}
                        variant="featured"
                        actionSlot={
                          <ReportScore
                            trigger={
                              <Button
                                type="button"
                                className="w-full sm:w-auto h-10 px-4 rounded-xl bg-gradient-to-r from-smash-orange to-orange-600 hover:opacity-95 text-white font-display font-black text-xs tracking-wider shadow-md shadow-smash-orange/25 border-none gap-1.5"
                              >
                                <Zap size={14} aria-hidden="true" />
                                立即報分
                              </Button>
                            }
                          />
                        }
                      />
                    </motion.section>

                    {/* Frequent Opponents Quick-Match Bar */}
                    <motion.section variants={itemVariants} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm sm:text-base font-display font-black text-foreground flex items-center gap-2">
                          <Swords size={16} className="text-smash-orange" aria-hidden="true" />
                          常打對手 · 一鍵約戰報分
                        </h2>
                        <span className="text-xs font-bold text-muted-foreground hidden sm:inline">
                          點選頭像直接預填對手
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
                        {frequentColleagues.map((colleague) => (
                          <ReportScore
                            key={colleague.id}
                            initialOpponentId={colleague.id}
                            trigger={
                              <button
                                type="button"
                                className="shrink-0 flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl bg-card hover:bg-secondary border border-border hover:border-sapphire-blue/40 shadow-xs transition-all group"
                              >
                                <PlayerAvatar
                                  src={colleague.avatar}
                                  name={colleague.name}
                                  className="size-9 rounded-xl border border-border text-xs group-hover:scale-105 transition-transform"
                                />
                                <div className="text-left">
                                  <p className="text-xs font-black text-foreground group-hover:text-sapphire-blue transition-colors max-w-[84px] truncate">
                                    {colleague.name}
                                  </p>
                                  <p className="text-[11px] font-bold text-smash-orange leading-tight">
                                    ⚡ 報分
                                  </p>
                                </div>
                              </button>
                            }
                          />
                        ))}

                        <ReportScore
                          trigger={
                            <button
                              type="button"
                              className="shrink-0 h-12 px-3.5 rounded-2xl bg-surface-subtle hover:bg-secondary border border-dashed border-border text-muted-foreground hover:text-foreground text-xs font-black flex items-center gap-1.5 transition-colors"
                            >
                              <Plus size={14} aria-hidden="true" />
                              自選對手
                            </button>
                          }
                        />
                      </div>
                    </motion.section>

                    {/* Rating Progression Chart */}
                    <motion.section
                      variants={itemVariants}
                      className="arena-surface p-5 sm:p-6 md:p-8 overflow-hidden min-h-[340px]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="font-display text-lg sm:text-xl text-foreground font-black tracking-tight">
                              戰力走勢分析
                            </h2>
                            {typeof ptsChange === 'number' && (
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-full text-xs font-display font-black tabular-nums border',
                                  ptsChange >= 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                                    : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                                )}
                              >
                                最新 {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 uppercase font-sans font-bold tracking-wider">
                            Rating Progression · Single-Track Elo
                          </p>
                        </div>
                        <Tabs value={chartInterval} onValueChange={setChartInterval} className="w-full sm:w-auto">
                          <TabsList className="grid w-full grid-cols-5 h-9 bg-card border border-border rounded-xl p-1">
                            <TabsTrigger value="recent" className="text-xs font-bold rounded-lg">10場</TabsTrigger>
                            <TabsTrigger value="hour" className="text-xs font-bold rounded-lg">小時</TabsTrigger>
                            <TabsTrigger value="day" className="text-xs font-bold rounded-lg">日</TabsTrigger>
                            <TabsTrigger value="month" className="text-xs font-bold rounded-lg">月</TabsTrigger>
                            <TabsTrigger value="quarter" className="text-xs font-bold rounded-lg">季</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <StatsChart
                        showCard={false}
                        showHeader={false}
                        data={myStats?.chart_data || []}
                      />
                    </motion.section>

                    {/* Tabbed Bento Rivalry & Synergy Section */}
                    <motion.section variants={itemVariants} className="space-y-4">
                      <Tabs defaultValue="rivals" className="w-full space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                          <div>
                            <h2 className="text-lg sm:text-xl text-foreground font-display font-black tracking-tight">
                              對戰情報室
                            </h2>
                            <p className="text-xs text-muted-foreground uppercase font-sans font-bold tracking-wider">
                              Rivalry &amp; Partner Synergy
                            </p>
                          </div>
                          <TabsList className="grid w-full sm:w-auto grid-cols-2 h-10 bg-secondary border border-border rounded-xl p-1">
                            <TabsTrigger value="rivals" className="text-xs font-black rounded-lg px-3.5 gap-1.5">
                              <Swords size={13} aria-hidden="true" />
                              宿敵與提款機
                            </TabsTrigger>
                            <TabsTrigger value="partners" className="text-xs font-black rounded-lg px-3.5 gap-1.5">
                              <Handshake size={13} aria-hidden="true" />
                              雙打搭檔情報
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="rivals" className="mt-0 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div className="rounded-2xl md:rounded-3xl bg-rose-50/50 dark:bg-rose-950/25 p-5 sm:p-6 border border-rose-200/70 dark:border-rose-500/30 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-md shadow-rose-600/20">
                                <Skull size={20} className="text-white" aria-hidden="true" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-display font-black text-foreground">宿命天敵</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nemesis</p>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              {rivals.nemesis.length > 0 ? (
                                rivals.nemesis.map((item) => (
                                  <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground font-bold text-center py-4">尚無天敵資料</p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl md:rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/25 p-5 sm:p-6 border border-emerald-200/70 dark:border-emerald-500/30 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
                                <Crown size={20} className="text-white" aria-hidden="true" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-display font-black text-foreground">積分提款機</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Minions</p>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              {rivals.minions.length > 0 ? (
                                rivals.minions.map((item) => (
                                  <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground font-bold text-center py-4">尚無提款機資料</p>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="partners" className="mt-0 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div className="rounded-2xl md:rounded-3xl bg-amber-50/50 dark:bg-amber-950/25 p-5 sm:p-6 border border-amber-200/70 dark:border-amber-500/30 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-xl bg-olympic-gold flex items-center justify-center shadow-md shadow-amber-500/20">
                                <Trophy size={20} className="text-white" aria-hidden="true" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-display font-black text-foreground">黃金搭檔</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Best Partners</p>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              {partners.golden_partners.length > 0 ? (
                                partners.golden_partners.map((item) => (
                                  <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground font-bold text-center py-4">尚無黃金搭檔資料</p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl md:rounded-3xl bg-surface-subtle/80 p-5 sm:p-6 border border-border space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-xl bg-slate-600 flex items-center justify-center shadow-md shadow-slate-600/20">
                                <Zap size={20} className="text-white" aria-hidden="true" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-display font-black text-foreground">磨合搭檔</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Toughest Pairings</p>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              {partners.worst_partners.length > 0 ? (
                                partners.worst_partners.map((item) => (
                                  <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground font-bold text-center py-4">尚無相關資料</p>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </motion.section>
                  </>
                )}

                <motion.section variants={itemVariants} className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-lg sm:text-xl text-foreground font-display font-black tracking-tight">
                        近期戰報動態
                      </h2>
                      <p className="text-xs text-muted-foreground uppercase font-sans font-bold tracking-wider">
                        Recent Feed · Live Updates
                      </p>
                    </div>
                    {isLoggedIn && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs font-black tracking-wider text-sapphire-blue hover:bg-sapphire-blue/10 rounded-xl px-3"
                        onClick={() => navigate('/history')}
                      >
                        查看全部
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {recentFeed.length > 0 ? (
                      recentFeed.map((match) => (
                        <MatchItem key={match.id} match={match} />
                      ))
                    ) : (
                      <div className="text-center py-14 arena-surface border-dashed">
                        <History size={28} className="mx-auto text-muted-foreground/50 mb-3" aria-hidden="true" />
                        <p className="text-muted-foreground font-bold text-xs">目前還沒有對戰紀錄</p>
                      </div>
                    )}
                  </div>
                </motion.section>
              </motion.div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="xl:col-span-4 space-y-6"
            >
              <motion.section variants={itemVariants} className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-lg sm:text-xl text-foreground font-display font-black tracking-tight">
                      群雄榜單
                    </h2>
                    <p className="text-xs text-muted-foreground uppercase font-sans font-bold tracking-wider">
                      Top Rivals · Global Elo
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="前往完整積分榜"
                    className="rounded-full bg-secondary border border-border text-foreground"
                    onClick={() => navigate('/leaderboard')}
                  >
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {topPlayers.length > 0 ? (
                    topPlayers.map((player) => (
                      <RankingCard key={player.id} player={player} />
                    ))
                  ) : (
                    <div className="text-center py-10 arena-surface border-dashed">
                      <Search size={28} className="mx-auto text-muted-foreground/50 mb-3" aria-hidden="true" />
                      <p className="text-muted-foreground font-bold text-xs">尚無排行榜資料</p>
                    </div>
                  )}
                  <Button
                    onClick={() => navigate('/leaderboard')}
                    variant="outline"
                    className="w-full h-12 bg-card hover:bg-secondary text-foreground border-border rounded-2xl font-sans font-black text-xs uppercase tracking-widest mt-2"
                  >
                    查看完整積分榜
                  </Button>
                </div>
              </motion.section>
            </motion.div>
          </div>
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
      className="w-full text-left flex items-center gap-3.5 bg-card p-3.5 rounded-2xl shadow-xs border border-border group hover:border-sapphire-blue/40 hover:shadow-sm transition-all"
    >
      <PlayerAvatar
        src={avatar}
        name={name}
        className="size-10 rounded-full border border-border text-xs"
      />
      <div className="flex-1 min-w-0">
        <p className="font-sans font-black text-foreground text-sm truncate group-hover:text-sapphire-blue transition-colors">
          {name}
        </p>
        <p className="text-xs text-muted-foreground font-bold mt-0.5 tabular-nums">
          {matches} 場 • {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} 分
        </p>
      </div>
      <span
        className={cn(
          'font-display font-black text-base tabular-nums shrink-0',
          type === 'nemesis' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {winRate}%
      </span>
    </button>
  );
}
