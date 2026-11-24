import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Trophy, ArrowLeft, Crown, ExternalLink, History, Timer } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import apiClient from '@/utils/apiClient';
import type { LeaderboardResponse, RawLeaderboardItem, SeasonDetailResponse } from '@/types/api.types';

export function SeasonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: season, isPending: isSeasonLoading } = useQuery<SeasonDetailResponse>({
    queryKey: ['seasons', 'detail', id],
    queryFn: async () => {
      const res = await apiClient.get<SeasonDetailResponse>(`/seasons/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const { data: lbData, isPending: isLbLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', id],
    queryFn: async () => {
      const res = await apiClient.get<LeaderboardResponse>(`/leaderboard?season_id=${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const loading = isSeasonLoading || isLbLoading;
  const topPlayers: RawLeaderboardItem[] = lbData?.leaderboard?.slice(0, 5) || [];

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (season?.status === 'completed') return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [season]);

  if (loading) {
    return <SeasonDetailSkeleton />;
  }

  if (!season) {
    return (
      <div className="arena-page flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground font-bold">找不到該賽季資訊</p>
        <Button onClick={() => navigate('/tournament')}>返回賽事中心</Button>
      </div>
    );
  }

  const isCompleted = season.status === 'completed';

  const hasValidTimeline = Boolean(season.start_date && season.end_date);
  const start = hasValidTimeline ? new Date(season.start_date) : new Date();
  const end = hasValidTimeline ? new Date(season.end_date) : new Date();

  let totalDuration = 1;
  let elapsed = 0;
  let progress = 0;
  let diffTime = 0;

  if (hasValidTimeline) {
    totalDuration = end.getTime() - start.getTime();
    if (totalDuration <= 0) totalDuration = 1;
    elapsed = now.getTime() - start.getTime();
    progress = isCompleted ? 100 : Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    diffTime = Math.max(0, end.getTime() - now.getTime());
  }

  const rDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const rHours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
  const rMinutes = Math.floor((diffTime / 1000 / 60) % 60);
  const rSeconds = Math.floor((diffTime / 1000) % 60);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="arena-page"
    >
      <motion.div variants={fadeInUp}>
        <PageHeader
          title={season.name}
          subtitle={isCompleted ? 'Completed League Season' : 'Active League Season Detail'}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/history?scope=all&season_id=${encodeURIComponent(season.id)}`)}
                className="rounded-xl border-sapphire-blue/30 bg-sapphire-blue/8 text-sapphire-blue dark:text-blue-300 font-black hover:bg-sapphire-blue/15 w-fit gap-1.5"
              >
                <History size={15} aria-hidden="true" />
                查看本季戰報
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/tournament')}
                className="rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground w-fit"
              >
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> 返回賽事中心
              </Button>
            </div>
          }
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10">
        {/* Left Column: Progress & Prizes */}
        <div className="xl:col-span-8 space-y-8 md:space-y-10">
          <motion.section variants={fadeInUp}>
            <Card className="arena-surface p-6 sm:p-8 md:p-10 overflow-hidden relative group">
              <div className="absolute -top-8 -right-8 p-4 opacity-5 group-hover:rotate-12 group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                <Timer size={180} aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 relative z-10">
                <div>
                  <p className="text-xs uppercase font-sans tracking-widest text-muted-foreground font-black mb-2">
                    賽季時間軸
                  </p>
                  <div className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-foreground tracking-tight">
                    {isCompleted ? (
                      <>賽季已 <span className="text-muted-foreground/40">結束</span></>
                    ) : !hasValidTimeline ? (
                      <>時間 <span className="text-muted-foreground/40">待定</span></>
                    ) : (
                      <div className="flex items-baseline gap-2 sm:gap-3.5 tabular-nums">
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rDays}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-muted-foreground mt-1.5 font-black">Days</span>
                        </div>
                        <span className="text-muted-foreground/40 pb-3">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rHours.toString().padStart(2, '0')}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-muted-foreground mt-1.5 font-black">Hrs</span>
                        </div>
                        <span className="text-muted-foreground/40 pb-3">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rMinutes.toString().padStart(2, '0')}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-muted-foreground mt-1.5 font-black">Min</span>
                        </div>
                        <span className="text-muted-foreground/40 pb-3">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none text-sapphire-blue">{rSeconds.toString().padStart(2, '0')}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-sapphire-blue/70 mt-1.5 font-black">Sec</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    'text-xs sm:text-sm font-sans font-black px-3.5 py-1.5 rounded-xl w-fit tabular-nums',
                    isCompleted
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300'
                  )}
                >
                  {isCompleted ? '🏆 賽季已結束' : `${progress.toFixed(1)}% 進度`}
                </span>
              </div>

              <div className="relative z-10">
                <Progress value={progress} className="h-3.5 bg-slate-200/70 dark:bg-slate-800 rounded-full" />
                <div className="flex justify-between mt-3 text-xs font-bold text-muted-foreground uppercase tracking-wider tabular-nums">
                  <span>{formatLocalTime(season.start_date, 'yyyy/MM/dd')} 開始</span>
                  <span>{formatLocalTime(season.end_date, 'yyyy/MM/dd')} 截止</span>
                </div>
              </div>
            </Card>
          </motion.section>

          {/* Prizes Grid */}
          <section className="space-y-5">
            <motion.h2
              variants={fadeInUp}
              className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground font-sans border-b border-border pb-3 inline-block"
            >
              賽季獎勵
            </motion.h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              {[1, 2, 3].map((rank) => {
                const prize = (season.prizes || []).find((p) => p.rank === rank);
                return (
                  <motion.div key={rank} variants={itemVariants} className="relative mt-2 group">
                    <div
                      className={cn(
                        'absolute -top-2.5 -left-2.5 size-10 rounded-xl bg-popover/95 backdrop-blur-md flex items-center justify-center font-display font-black shadow-md border z-20 transition-transform group-hover:scale-105',
                        rank === 1
                          ? 'text-olympic-gold border-amber-200 dark:border-amber-500/40'
                          : rank === 2
                            ? 'text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                            : 'text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/40'
                      )}
                    >
                      {rank === 1 ? <Crown size={18} aria-hidden="true" /> : rank}
                    </div>

                    <Card className="arena-card overflow-hidden group hover:shadow-md transition-all p-0 h-full flex flex-col">
                      <div className="h-44 relative overflow-hidden bg-surface-subtle">
                        {prize?.image_url ? (
                          <img
                            src={prize.image_url}
                            alt={prize.item_name}
                            className="size-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center text-muted-foreground/30">
                            <Trophy size={56} aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="p-5 text-center flex-1">
                        <span className="text-xs uppercase font-sans font-black text-sapphire-blue tracking-wider block mb-1.5">
                          {rank === 1 ? '冠軍' : rank === 2 ? '亞軍' : '季軍'}
                        </span>
                        <h4 className="font-display font-bold text-foreground text-base leading-snug mb-1.5">
                          {prize?.item_name || '即將公布'}
                        </h4>
                        <p className="text-xs text-muted-foreground font-sans">
                          {prize?.quantity ? `數量：${prize.quantity}` : '神秘驚喜獎項'}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>
        </div>

        {/* Right Column: Mini Leaderboard */}
        <div className="xl:col-span-4 space-y-6">
          <section className="space-y-5">
            <motion.div variants={fadeInUp} className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg sm:text-xl text-foreground font-display font-black">即時戰績榜</h2>
              <Trophy size={18} className="text-muted-foreground/40" aria-hidden="true" />
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {topPlayers.map((player, idx: number) => (
                <motion.button
                  type="button"
                  key={player.player_id}
                  variants={itemVariants}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('inspect', player.player_id);
                    setSearchParams(newParams);
                  }}
                  className="w-full text-left flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-subtle/80 hover:bg-secondary transition-colors border border-border relative overflow-visible group mt-2 cursor-pointer"
                >
                  <div
                    className={cn(
                      'absolute -left-2 -top-2.5 size-8 sm:size-9 rounded-xl flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm z-20 border-2 border-card tabular-nums',
                      idx === 0 ? 'bg-olympic-gold text-white' : 'bg-card text-foreground'
                    )}
                  >
                    {player.rank}
                  </div>
                  <div className="flex-1 pl-5 flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      src={player.avatar_url}
                      name={player.player_name}
                      className="size-10 rounded-full border border-border text-sm"
                    />
                    <div className="min-w-0">
                      <h4 className="font-sans font-black text-foreground text-sm truncate group-hover:text-sapphire-blue transition-colors">
                        {player.player_name}
                      </h4>
                      <p className="text-xs font-sans font-bold text-muted-foreground truncate mt-0.5 tabular-nums">
                        勝率 {player.win_rate} • {player.department || '一般同仁'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display font-black text-lg text-foreground tabular-nums">
                      {Math.round(player.global_mmr ?? 0)}
                    </span>
                  </div>
                </motion.button>
              ))}

              {topPlayers.length === 0 && (
                <div className="py-14 text-center text-muted-foreground font-bold text-xs arena-surface border-dashed">
                  目前尚無比賽數據
                </div>
              )}

              <Button
                onClick={() => navigate(`/leaderboard?season_id=${id}`)}
                className="w-full h-12 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black tracking-wider group shadow-md mt-2"
              >
                查看完整排行榜 <ExternalLink size={15} className="ml-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </Button>
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function SeasonDetailSkeleton() {
  return (
    <div className="arena-page animate-pulse">
      <div className="flex items-center gap-4">
        <Skeleton className="w-2 h-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-56 rounded-xl" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10">
        <div className="xl:col-span-8 space-y-8">
          <Skeleton className="h-52 rounded-2xl md:rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Skeleton className="h-64 rounded-2xl md:rounded-3xl" />
            <Skeleton className="h-64 rounded-2xl md:rounded-3xl" />
            <Skeleton className="h-64 rounded-2xl md:rounded-3xl" />
          </div>
        </div>
        <div className="xl:col-span-4 space-y-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
