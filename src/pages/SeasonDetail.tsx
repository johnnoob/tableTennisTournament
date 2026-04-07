import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, ArrowLeft, Crown, ExternalLink, Timer } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import apiClient from '@/utils/apiClient';

export function SeasonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: season, isPending: isSeasonLoading } = useQuery({
    queryKey: ['seasons', 'detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/seasons/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const { data: lbData, isPending: isLbLoading } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: async () => {
      const res = await apiClient.get(`/leaderboard?season_id=${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const loading = isSeasonLoading || isLbLoading;
  const topPlayers = lbData?.leaderboard?.slice(0, 5) || [];

  // 🌟 動態倒數計時與進度條
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (season?.status === 'completed') return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000); // 每秒更新
    return () => clearInterval(interval);
  }, [season]);

  if (loading) {
    return <SeasonDetailSkeleton />;
  }

  if (!season) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400 font-bold">找不到該賽季資訊</p>
        <Button onClick={() => navigate('/tournament')}>返回列表</Button>
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
      className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 bg-white min-h-screen"
    >
      {/* Header */}
      <motion.header variants={fadeInUp} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center">
          <div className="w-2 md:w-3 bg-gradient-to-b from-sapphire-blue to-blue-800 rounded-full h-12 md:h-16 mr-4 md:mr-6 shrink-0" />
          <div className="space-y-1">
            <h1 className="text-4xl md:text-5xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none">
              {season.name}
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 font-sans font-black uppercase tracking-[0.3em] opacity-60">
              {isCompleted ? "Completed League Season" : "Active League Season Detail"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/tournament')}
          className="rounded-xl border-slate-100 text-slate-500 font-bold hover:bg-slate-50 w-fit"
        >
          <ArrowLeft size={16} className="mr-2" /> 返回賽事列表
        </Button>
      </motion.header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 md:gap-16">

        {/* Left Column: Progress & Prizes (8 cols) */}
        <div className="xl:col-span-8 space-y-12">

          {/* Progress Card */}
          <motion.section variants={fadeInUp}>
            <Card className="no-line-card rounded-[2.5rem] bg-[#fbfcff] p-8 md:p-12 shadow-sm border border-slate-50 overflow-hidden relative group">
              <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700">
                <Timer size={200} />
              </div>
              <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                  <p className="text-[11px] uppercase font-sans tracking-widest text-primary-slate/50 font-black mb-2">Season Timeline</p>
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-black text-primary-navy tracking-tighter">
                    {isCompleted ? (
                      <>Season <span className="text-primary-slate/20">Ended</span></>
                    ) : !hasValidTimeline ? (
                      <>Time <span className="text-primary-slate/20">TBA</span></>
                    ) : (
                      <div className="flex items-baseline gap-2 md:gap-4 tabular-nums">
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rDays}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Days</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rHours.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Hrs</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rMinutes.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Min</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none text-sapphire-blue">{rSeconds.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-sapphire-blue/60 mt-2 font-black">Sec</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-xs md:text-sm font-sans font-black px-4 py-2 rounded-xl block mb-2 transition-all duration-300",
                    isCompleted ? "bg-amber-100 text-amber-700" : "bg-sapphire-blue/5 text-sapphire-blue"
                  )}>
                    {isCompleted ? "🏆 賽季已結束" : `${progress.toFixed(2)}% 進度`}
                  </span>
                </div>

              </div>
              <div className="relative z-10">
                <Progress value={progress} className="h-4 bg-slate-100 rounded-full" />
                <div className="flex justify-between mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>{formatLocalTime(season.start_date, 'yyyy/MM/dd')} Start</span>
                  <span>{formatLocalTime(season.end_date, 'yyyy/MM/dd')} Deadline</span>
                </div>
              </div>
            </Card>
          </motion.section>

          {/* Prizes Grid */}
          <section className="space-y-6">
            <motion.h2 variants={fadeInUp} className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 font-sans border-b border-slate-50 pb-4 inline-block">Season Rewards</motion.h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {[1, 2, 3].map((rank) => {
                const prize = (season.prizes || []).find((p: any) => p.rank === rank);
                return (
                  <motion.div key={rank} variants={itemVariants} className="relative mt-4 group">
                    <div className={cn(
                      "absolute -top-3 -left-3 size-12 rounded-2xl bg-white/90 backdrop-blur-md flex items-center justify-center font-display font-black shadow-lg border z-20 transform group-hover:scale-110 transition-transform",
                      rank === 1 ? "text-olympic-gold border-amber-100" : rank === 2 ? "text-slate-400 border-slate-100" : "text-orange-600 border-orange-100"
                    )}>
                      {rank === 1 ? <Crown size={20} /> : rank}
                    </div>

                    <Card className="no-line-card rounded-[2.5rem] bg-white border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-primary-navy/5 transition-all duration-700 relative p-0 h-full flex flex-col">
                      <div className="h-48 relative overflow-hidden bg-slate-50">
                        {prize?.image_url ? (
                          <img src={prize.image_url} alt={prize.item_name} className="size-full object-cover transform group-hover:scale-110 transition-transform duration-1000" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-slate-200">
                            <Trophy size={64} />
                          </div>
                        )}
                      </div>
                      <div className="p-6 text-center flex-1">
                        <span className="text-xs uppercase font-sans font-black text-sapphire-blue tracking-tighter block mb-2">
                          {rank === 1 ? "Champion" : rank === 2 ? "Runner-up" : "Third Place"}
                        </span>
                        <h4 className="font-display font-bold text-primary-navy text-lg leading-tight mb-2">
                          {prize?.item_name || "即將公布"}
                        </h4>
                        <p className="text-xs text-slate-500 font-sans">
                          {prize?.quantity ? `數量: ${prize.quantity}` : "神秘驚喜獎項"}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>

        </div>

        {/* Right Column: Mini Leaderboard (4 cols) */}
        <div className="xl:col-span-4 space-y-12">
          <section className="space-y-6">
            <motion.div variants={fadeInUp} className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-xl text-primary-navy font-display font-black">Live Standings</h2>
              <Trophy size={20} className="text-primary-navy/20" />
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {topPlayers.map((player: any, idx: number) => (
                <motion.div
                  key={player.player_id}
                  variants={itemVariants}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('inspect', player.player_id);
                    setSearchParams(newParams);
                  }}
                  className="flex items-center gap-4 p-4 rounded-3xl bg-[#fbfcff] hover:bg-slate-50 transition-colors border border-slate-100 relative overflow-visible group mt-2 cursor-pointer"
                >
                  <div className={cn(
                    "absolute -left-3 -top-3 size-10 md:size-12 rounded-2xl flex items-center justify-center font-display font-black text-xl shrink-0 transition-all shadow-md z-20 border-2 border-white",
                    idx === 0 ? "bg-olympic-gold text-white" : "bg-white text-primary-slate"
                  )}>
                    {player.rank}
                  </div>
                  <div className="flex-1 pl-8 flex items-center gap-4">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.player_name}
                        className="size-10 md:size-12 rounded-full object-cover shadow-sm bg-slate-50 border border-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="size-10 md:size-12 rounded-full bg-gradient-to-br from-sapphire-blue/10 to-blue-500/10 flex items-center justify-center border border-sapphire-blue/20 shadow-inner shrink-0">
                        <span className="text-sm md:text-base font-display font-black text-sapphire-blue">
                          {player.player_name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <h4 className="font-sans font-black text-primary-navy text-sm md:text-base">{player.player_name}</h4>
                      <p className="text-[10px] md:text-xs uppercase font-sans font-bold text-slate-500 tracking-wider mt-0.5">
                        {player.win_rate} Win Rate • {player.department}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-lg md:text-xl text-primary-navy">{Math.round(player.season_lp)}</span>
                  </div>
                </motion.div>
              ))}

              {topPlayers.length === 0 && (
                <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                  目前尚無比賽數據
                </div>
              )}

              <Button
                onClick={() => navigate(`/leaderboard?season_id=${id}`)}
                className="w-full h-14 rounded-2xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-widest group shadow-xl shadow-primary-navy/20"
              >
                查看完整排行榜 <ExternalLink size={16} className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-12 animate-pulse">
      <div className="flex items-center gap-6">
        <Skeleton className="w-3 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
        <div className="xl:col-span-8 space-y-12">
          <Skeleton className="h-64 rounded-[2.5rem]" />
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-[2.5rem]" />
            <Skeleton className="h-80 rounded-[2.5rem]" />
            <Skeleton className="h-80 rounded-[2.5rem]" />
          </div>
        </div>
        <div className="xl:col-span-4 space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
