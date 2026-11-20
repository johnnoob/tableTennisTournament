import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Skull, Crown, ChevronLeft, ChevronRight, Trophy, Timer, History, ArrowRight, Zap, Megaphone, Users, LogIn } from 'lucide-react';
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
  const [direction, setDirection] = useState(0);

  const current = items[currentIndex];

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, items.length]);

  if (!items || items.length === 0) return null;

  const getStyle = (type: string) => {
    switch (type) {
      case 'tournament':
        return {
          icon: Trophy,
          bg: 'bg-olympic-gold',
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-300',
          label: '賽事公告'
        };
      case 'club':
        return {
          icon: Users,
          bg: 'bg-emerald-500',
          badgeBg: 'bg-emerald-500/20',
          badgeText: 'text-emerald-300',
          label: '社團公告'
        };
      default:
        return {
          icon: Megaphone,
          bg: 'bg-sapphire-blue',
          badgeBg: 'bg-sapphire-blue/20',
          badgeText: 'text-blue-300',
          label: '系統公告'
        };
    }
  };

  const style = getStyle(current.type || 'system');
  const Icon = style.icon;

  const nextMsg = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };
  const prevMsg = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 40 : -40,
      opacity: 0
    })
  };

  return (
    <section aria-label="公告橫幅">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="bg-primary-navy rounded-2xl md:rounded-3xl p-5 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-lg shadow-primary-navy/15 border border-slate-800 relative overflow-hidden group min-h-[140px]"
      >
        <div className="absolute -right-8 -top-8 opacity-[0.04] pointer-events-none group-hover:scale-110 transition-transform duration-700 text-white">
          <Icon size={220} aria-hidden="true" />
        </div>

        <div className="absolute top-3.5 right-3.5 z-20 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 flex items-center gap-1.5">
          <span className="text-xs font-black tracking-widest text-white/60 tabular-nums">
            {(currentIndex + 1).toString().padStart(2, '0')}
          </span>
          <span className="text-white/30 text-xs">/</span>
          <span className="text-xs font-black tracking-widest text-white/90 tabular-nums">
            {items.length.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="flex items-start md:items-center gap-4 relative z-10 flex-1 w-full min-w-0 pr-12 md:pr-0">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={current.id + '-icon'}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'size-12 md:size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white',
                style.bg
              )}
            >
              <Icon size={24} aria-hidden="true" />
            </motion.div>
          </AnimatePresence>

          <div className="space-y-1 flex-1 min-w-0">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={current.id}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="space-y-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider',
                      style.badgeBg,
                      style.badgeText
                    )}
                  >
                    {style.label}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 text-xs font-bold tabular-nums">
                    <Timer size={12} aria-hidden="true" /> {formatLocalTime(current.created_at, 'yyyy-MM-dd')}
                  </span>
                </div>
                <h3 className="text-base md:text-lg font-display font-black text-white leading-snug truncate">
                  {current.title}
                </h3>
                <p className="text-xs md:text-sm text-slate-300 font-medium line-clamp-2">
                  {current.content}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-3 relative z-10 shrink-0 border-t border-white/10 md:border-none pt-3.5 md:pt-0">
          <div className="flex items-center gap-2 w-full md:w-auto">
            {items.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="上一則公告"
                  onClick={prevMsg}
                  className="size-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all border border-white/10"
                >
                  <ChevronLeft size={16} strokeWidth={3} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="下一則公告"
                  onClick={nextMsg}
                  className="size-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all border border-white/10"
                >
                  <ChevronRight size={16} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            )}
            {current.link_url && (
              <Button
                onClick={() => window.open(current.link_url, '_blank')}
                className="flex-1 md:flex-none h-10 md:h-11 px-5 rounded-xl font-black text-xs sm:text-sm tracking-wider transition-all active:scale-95 gap-1.5 border-none bg-white hover:bg-slate-100 text-primary-navy"
              >
                {current.link_text || '了解詳情'}
                <ChevronRight size={16} strokeWidth={3} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
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

          <motion.div variants={fadeInUp}>
            <AnnouncementBanner items={announcements} />
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10 items-start">
            <div className="xl:col-span-8 space-y-8 md:space-y-10">
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 md:space-y-10">
                {!isLoggedIn && (
                  <motion.section
                    variants={itemVariants}
                    className="bg-primary-navy text-white rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
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
                    <motion.div variants={itemVariants}>
                      <PendingActions />
                    </motion.div>

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
                          rank: (myStats?.rank || '-') as any,
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

                    <motion.section
                      variants={itemVariants}
                      className="arena-surface p-5 sm:p-6 md:p-8 overflow-hidden min-h-[340px]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="font-display text-lg sm:text-xl text-primary-navy font-black tracking-tight">
                              戰力走勢分析
                            </h2>
                            {typeof ptsChange === 'number' && (
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-full text-xs font-display font-black tabular-nums border',
                                  ptsChange >= 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border-rose-200'
                                )}
                              >
                                最新 {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 uppercase font-sans font-bold tracking-wider">
                            Rating Progression · Single-Track Elo
                          </p>
                        </div>
                        <Tabs value={chartInterval} onValueChange={setChartInterval} className="w-full sm:w-auto">
                          <TabsList className="grid w-full grid-cols-5 h-9 bg-white border border-slate-200/80 rounded-xl p-1">
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
                  </>
                )}

                <motion.section variants={itemVariants} className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-lg sm:text-xl text-primary-navy font-display font-black tracking-tight">
                        近期戰報動態
                      </h2>
                      <p className="text-xs text-slate-400 uppercase font-sans font-bold tracking-wider">
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
                        <History size={28} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                        <p className="text-slate-400 font-bold text-xs">目前還沒有對戰紀錄</p>
                      </div>
                    )}
                  </div>
                </motion.section>

                {isLoggedIn && (
                  <>
                    <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="rounded-2xl md:rounded-3xl bg-rose-50/50 p-5 sm:p-6 border border-rose-200/70 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-md shadow-rose-600/20">
                            <Skull size={20} className="text-white" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-display font-black text-primary-navy">宿命天敵</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nemesis</p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {rivals.nemesis.length > 0 ? (
                            rivals.nemesis.map((item) => (
                              <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 font-bold text-center py-4">尚無天敵資料</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl md:rounded-3xl bg-emerald-50/50 p-5 sm:p-6 border border-emerald-200/70 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
                            <Crown size={20} className="text-white" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-display font-black text-primary-navy">積分提款機</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Minions</p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {rivals.minions.length > 0 ? (
                            rivals.minions.map((item) => (
                              <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 font-bold text-center py-4">尚無提款機資料</p>
                          )}
                        </div>
                      </div>
                    </motion.section>

                    <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="rounded-2xl md:rounded-3xl bg-amber-50/50 p-5 sm:p-6 border border-amber-200/70 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-olympic-gold flex items-center justify-center shadow-md shadow-amber-500/20">
                            <Trophy size={20} className="text-white" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-display font-black text-primary-navy">黃金搭檔</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Best Partners</p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {partners.golden_partners.length > 0 ? (
                            partners.golden_partners.map((item) => (
                              <RivalRow key={item.id} {...item} type="minions" onInspect={openInspect} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 font-bold text-center py-4">尚無黃金搭檔資料</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl md:rounded-3xl bg-slate-50/80 p-5 sm:p-6 border border-slate-200/80 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-slate-600 flex items-center justify-center shadow-md shadow-slate-600/20">
                            <Zap size={20} className="text-white" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-display font-black text-primary-navy">磨合搭檔</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toughest Pairings</p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {partners.worst_partners.length > 0 ? (
                            partners.worst_partners.map((item) => (
                              <RivalRow key={item.id} {...item} type="nemesis" onInspect={openInspect} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 font-bold text-center py-4">尚無相關資料</p>
                          )}
                        </div>
                      </div>
                    </motion.section>
                  </>
                )}
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
                    <h2 className="text-lg sm:text-xl text-primary-navy font-display font-black tracking-tight">
                      群雄榜單
                    </h2>
                    <p className="text-xs text-slate-400 uppercase font-sans font-bold tracking-wider">
                      Top Rivals · Global Elo
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="前往完整積分榜"
                    className="rounded-full bg-slate-50 border border-slate-200/70 text-primary-navy"
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
                      <Search size={28} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                      <p className="text-slate-400 font-bold text-xs">尚無排行榜資料</p>
                    </div>
                  )}
                  <Button
                    onClick={() => navigate('/leaderboard')}
                    variant="outline"
                    className="w-full h-12 bg-white hover:bg-slate-50 text-primary-navy border-slate-200 rounded-2xl font-sans font-black text-xs uppercase tracking-widest mt-2"
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
      className="w-full text-left flex items-center gap-3.5 bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/70 group hover:border-sapphire-blue/40 hover:shadow-sm transition-all"
    >
      <PlayerAvatar
        src={avatar}
        name={name}
        className="size-10 rounded-full border border-slate-200 text-xs"
      />
      <div className="flex-1 min-w-0">
        <p className="font-sans font-black text-primary-navy text-sm truncate group-hover:text-sapphire-blue transition-colors">
          {name}
        </p>
        <p className="text-xs text-slate-400 font-bold mt-0.5 tabular-nums">
          {matches} 場 • {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} 分
        </p>
      </div>
      <span
        className={cn(
          'font-display font-black text-base tabular-nums shrink-0',
          type === 'nemesis' ? 'text-rose-500' : 'text-emerald-600'
        )}
      >
        {winRate}%
      </span>
    </button>
  );
}
