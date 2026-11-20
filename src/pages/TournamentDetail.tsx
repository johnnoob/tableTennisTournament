import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { Trophy, Scale, Calendar, ArrowLeft, ExternalLink, Clock } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import apiClient from '@/utils/apiClient';
import type { LeaderboardResponse, RawLeaderboardItem } from '@/types/api.types';

interface TournamentPrizeItem {
  position?: string | number;
  image_url?: string;
  item_name?: string;
  label?: string;
  description?: string;
}

interface TournamentDetailItem {
  id: string;
  title: string;
  status: string;
  start_date?: string;
  startDate?: string;
  end_date?: string;
  endDate?: string;
  rules?: string;
  prizes?: TournamentPrizeItem[];
}

export function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tournaments, isPending: loading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await apiClient.get<TournamentDetailItem[]>('/tournaments');
      return res.data;
    }
  });

  const { data: lbData } = useQuery({
    queryKey: ['leaderboard', 'tournament-top5'],
    queryFn: async () => {
      const res = await apiClient.get<LeaderboardResponse>('/leaderboard');
      return res.data;
    },
  });
  const topPlayers: RawLeaderboardItem[] = (lbData?.leaderboard || [])
    .filter((p) => p.rank !== '-')
    .slice(0, 5);

  const tournament = tournaments?.find((t) => t.id === id) || tournaments?.[0];
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!tournament || tournament.status === 'completed') return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  if (loading) {
    return <div className="arena-page flex items-center justify-center font-bold text-slate-400">載入賽事中...</div>;
  }

  if (!tournament) {
    return (
      <div className="arena-page flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-500 font-bold">找不到該賽事資訊</p>
        <Button type="button" onClick={() => navigate('/tournament')}>返回賽事中心</Button>
      </div>
    );
  }

  const isCompleted = tournament.status === 'completed';
  const statusLabel =
    tournament.status === 'registering'
      ? '報名中'
      : tournament.status === 'ongoing'
        ? '進行中'
        : '已結束';

  const sDate = tournament.start_date || tournament.startDate;
  const eDate = tournament.end_date || tournament.endDate;

  const hasValidTimeline = Boolean(sDate && eDate);
  const start = sDate && eDate ? new Date(sDate) : new Date();
  const end = sDate && eDate ? new Date(eDate) : new Date();

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

  const rulesText = String(tournament.rules || '');
  const externalUrlMatch = rulesText.match(/https?:\/\/[^\s)]+/);
  const externalUrl = externalUrlMatch ? externalUrlMatch[0] : null;

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
          title={tournament.title}
          subtitle="Active Tournament Details"
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/tournament')}
              className="rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 w-fit"
            >
              <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> 返回賽事中心
            </Button>
          }
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10">
        {/* Left Column */}
        <div className="xl:col-span-8 space-y-8 md:space-y-10">
          <motion.section variants={fadeInUp}>
            <Card className="arena-surface p-6 sm:p-8 md:p-10 overflow-hidden relative group">
              <div className="absolute -top-8 -right-8 p-4 opacity-5 group-hover:rotate-12 group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                <Trophy size={180} aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 relative z-10">
                <div>
                  <p className="text-xs uppercase font-sans tracking-widest text-slate-500 font-black mb-2">
                    賽事時間軸
                  </p>
                  <div className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-primary-navy tracking-tight">
                    {isCompleted ? (
                      <>賽事已 <span className="text-slate-300">結束</span></>
                    ) : !hasValidTimeline ? (
                      <>時間 <span className="text-slate-300">待定</span></>
                    ) : (
                      <div className="flex items-baseline gap-2 sm:gap-3.5 tabular-nums">
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rDays}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-slate-400 mt-1.5 font-black">Days</span>
                        </div>
                        <span className="text-slate-300 pb-3">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rHours.toString().padStart(2, '0')}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-slate-400 mt-1.5 font-black">Hrs</span>
                        </div>
                        <span className="text-slate-300 pb-3">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rMinutes.toString().padStart(2, '0')}</span>
                          <span className="text-xs uppercase font-sans tracking-wider text-slate-400 mt-1.5 font-black">Min</span>
                        </div>
                        <span className="text-slate-300 pb-3">:</span>
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
                    isCompleted ? 'bg-amber-100 text-amber-700' : 'bg-sapphire-blue/10 text-sapphire-blue'
                  )}
                >
                  {isCompleted ? '🏆 賽事已結束' : hasValidTimeline ? `${progress.toFixed(1)}% 進度` : statusLabel}
                </span>
              </div>
              <Progress value={progress} className="h-3.5 bg-slate-200/70 rounded-full relative z-10" />
            </Card>
          </motion.section>

          <motion.section variants={fadeInUp} className="space-y-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-sans border-b border-slate-100 pb-3 inline-block">
              賽事資訊
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/70 text-sapphire-blue w-fit">
                  <Calendar size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-400 tracking-wider">活動期間</p>
                  <p className="text-sm font-sans font-extrabold text-primary-navy mt-1 tabular-nums">
                    {hasValidTimeline
                      ? `${formatLocalTime(sDate, 'yyyy/MM/dd')} - ${formatLocalTime(eDate, 'yyyy/MM/dd')}`
                      : '依社團公告另行通知'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/70 text-sapphire-blue w-fit">
                  <Clock size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-400 tracking-wider">目前狀態</p>
                  <p className="text-sm font-sans font-extrabold text-primary-navy mt-1">{statusLabel}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70">
                <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/70 text-sapphire-blue w-fit">
                  <Scale size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-400 tracking-wider">賽事性質</p>
                  <p className="text-sm font-sans font-bold text-primary-navy mt-1">獨立錦標賽活動</p>
                </div>
              </div>
            </div>

            <div className="arena-surface p-6 sm:p-8 space-y-4">
              <h3 className="font-display font-black text-primary-navy text-lg sm:text-xl">
                參賽辦法與說明
              </h3>
              <p className="text-sm text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                {tournament.rules || '依官方賽事公告辦理。'}
              </p>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white text-xs font-black tracking-wide transition-colors"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  開啟賽程 / 賽事詳細連結
                </a>
              )}
            </div>
          </motion.section>

          {(tournament.prizes || []).length > 0 && (
            <section className="space-y-5">
              <motion.h2
                variants={fadeInUp}
                className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-sans border-b border-slate-100 pb-3 inline-block"
              >
                賽事獎勵
              </motion.h2>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-5"
              >
                {(tournament.prizes || []).map((prize, idx) => (
                  <motion.div key={prize.position || idx} variants={itemVariants} className="relative mt-2 group">
                    <div className="absolute -top-2.5 -left-2.5 size-10 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-center font-display font-black shadow-md border border-slate-200 z-20">
                      {prize.position}
                    </div>

                    <Card className="arena-card overflow-hidden group hover:shadow-md transition-all p-0">
                      <div className="h-44 relative overflow-hidden bg-slate-50">
                        <img
                          src={prize.image_url}
                          alt={prize.item_name}
                          className="size-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                      <div className="p-5 text-center">
                        <span className="text-xs uppercase font-sans font-black text-sapphire-blue tracking-wider block mb-1.5">
                          {prize.label}
                        </span>
                        <h4 className="font-display font-bold text-primary-navy text-base leading-snug mb-1.5">
                          {prize.item_name}
                        </h4>
                        <p className="text-xs text-slate-500 font-sans">{prize.description}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}
        </div>

        {/* Right Column — 真實排行榜前五強 */}
        <div className="xl:col-span-4 space-y-6">
          <section className="space-y-5">
            <motion.div variants={fadeInUp} className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg sm:text-xl text-primary-navy font-display font-black">本季種子實力榜 Top 5</h2>
              <Trophy size={18} className="text-slate-300" aria-hidden="true" />
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {topPlayers.length > 0 ? (
                topPlayers.map((player, idx) => (
                  <motion.button
                    type="button"
                    key={player.player_id}
                    variants={itemVariants}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('inspect', player.player_id);
                      setSearchParams(newParams);
                    }}
                    className="w-full text-left flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 transition-colors border border-slate-200/70 relative overflow-visible group mt-2 cursor-pointer"
                  >
                    <div
                      className={cn(
                        'absolute -left-2 -top-2.5 size-8 sm:size-9 rounded-xl flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm z-20 border-2 border-white tabular-nums',
                        idx === 0 ? 'bg-olympic-gold text-white' : 'bg-white text-slate-600'
                      )}
                    >
                      {player.rank}
                    </div>
                    <div className="flex-1 pl-5 flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        src={player.avatar_url}
                        name={player.player_name}
                        className="size-10 rounded-full border border-slate-200 text-sm"
                      />
                      <div className="min-w-0">
                        <h4 className="font-sans font-black text-primary-navy text-sm truncate group-hover:text-sapphire-blue transition-colors">
                          {player.player_name}
                        </h4>
                        <p className="text-xs font-sans font-bold text-slate-400 truncate mt-0.5 tabular-nums">
                          勝率 {player.win_rate} • {player.department || '一般同仁'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-display font-black text-lg text-primary-navy tabular-nums">
                        {Math.round(player.global_mmr).toLocaleString()}
                      </span>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 font-bold text-xs arena-surface border-dashed">
                  目前尚無賽季排名資料
                </div>
              )}
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
