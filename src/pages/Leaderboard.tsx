import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Timer, Crown, History } from 'lucide-react';
import { getTierBadge } from '@/lib/ranking';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, pageVariants } from '@/lib/animations';
import { LeaderboardSkeleton } from '@/components/LeaderboardSkeleton';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/utils/apiClient';

export function Leaderboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuthStore();

  // 🌟 動態賽季狀態
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  const [realLeaderboard, setRealLeaderboard] = useState<any[]>([]);
  const [seasonName, setSeasonName] = useState<string>("讀取中...");
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 加入全域更新觸發器 (跟 Dashboard 一樣)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('match_updated', handleUpdate);
    return () => window.removeEventListener('match_updated', handleUpdate);
  }, []);

  // 🌟 1. 抓取所有賽季清單
  useEffect(() => {
    apiClient.get('/seasons')
      .then(res => {
        const data = res.data;
        setSeasons(data);
        
        // 🌟 優先讀取網址中的 season_id
        const urlSeasonId = searchParams.get('season_id');
        
        if (urlSeasonId) {
          setSelectedSeason(urlSeasonId);
        } else if (data.length > 0 && !selectedSeason) {
          setSelectedSeason(data[0].id);
        }
      })
      .catch(err => console.error("無法取得賽季清單", err));
  }, [refreshTrigger]);

  // 🌟 2. 抓取該賽季的排行榜
  useEffect(() => {
    if (!selectedSeason) return;

    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const url = selectedSeason !== 'all-time'
          ? `/leaderboard?season_id=${selectedSeason}`
          : "/leaderboard";

        const res = await apiClient.get(url);
        setRealLeaderboard(res.data.leaderboard || []);
        setSeasonName(res.data.season_name);
      } catch (err) {
        console.error("無法取得排行榜資料", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedSeason, refreshTrigger]);

  const currentSeasonObj = seasons.find(s => s.id === selectedSeason);
  const isSeasonEnded = currentSeasonObj?.status === 'completed';
  const isAllTime = selectedSeason === 'all-time';
  const showPodium = (isSeasonEnded || isAllTime) && !searchTerm;

  const sortedPlayers = useMemo(() => {
    return realLeaderboard.filter(p =>
      p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.department && p.department.includes(searchTerm))
    );
  }, [realLeaderboard, searchTerm]);

  const podiumPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.rank !== '-').slice(0, 3);
  }, [sortedPlayers]);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
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
          className="pb-24 pt-8 md:pt-12 px-4 md:px-12 space-y-8 bg-slate-50/30 min-h-screen relative"
        >
          <motion.header variants={fadeInUp} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 md:w-3 bg-gradient-to-b from-sapphire-blue to-blue-800 rounded-full h-12 md:h-16 mr-4 md:mr-6 shrink-0" />
              <div className="space-y-1">
                <h1 className="text-4xl md:text-5xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none">
                  {isAllTime ? "Hall of Fame" : "Leaderboard"}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-[10px] md:text-xs uppercase tracking-widest transition-colors",
                    isAllTime ? "bg-purple-100 text-purple-700" :
                    isSeasonEnded ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {isAllTime ? <Crown size={14} /> : <Timer size={14} />} {seasonName}
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-400 font-sans font-black uppercase tracking-[0.3em] opacity-60">
                    Precision Arena · Ranking System
                  </p>
                </div>
              </div>
            </div>
          </motion.header>

          <motion.div variants={fadeInUp} className="bg-white/50 backdrop-blur-sm p-3 rounded-[2.5rem] border border-slate-100/50 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <Select 
              value={selectedSeason} 
              onValueChange={(val) => {
                if (val) {
                  setSelectedSeason(val);
                  // 🌟 同步更新網址，讓重新整理或分享連結也能維持在同一賽季
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all-time') {
                    newParams.delete('season_id');
                  } else {
                    newParams.set('season_id', val);
                  }
                  setSearchParams(newParams);
                }
              }}
            >
              <SelectTrigger className="w-full md:w-64 h-12 bg-white border-slate-100 rounded-2xl font-bold text-primary-navy shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <History size={16} className="text-slate-400 shrink-0" />
                  <SelectValue placeholder="選擇賽季" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="font-bold">
                    {s.status === 'active' ? '🟢 ' : '🏆 '} {s.name}
                  </SelectItem>
                ))}
                <SelectItem value="all-time" className="font-bold">👑 All-Time 總榜</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="搜尋同仁姓名或單位..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sapphire-blue/20 focus:border-sapphire-blue transition-all font-bold text-slate-600 placeholder:text-slate-400 shadow-sm"
              />
            </div>
          </motion.div>

          {/* 榮譽頒獎台 */}
          {showPodium && podiumPlayers.length > 0 && (
            <motion.div 
              variants={fadeInUp}
              className="flex justify-center items-end h-64 md:h-72 gap-2 md:gap-4 mt-24 mb-16 relative"
            >
              {/* 2nd Place */}
              <div className="flex flex-col items-center relative z-10 w-24 md:w-32">
                {podiumPlayers[1] ? (
                  <>
                    <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300 cursor-pointer">
                      <img src={podiumPlayers[1].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-16 md:size-20 rounded-full border-4 border-slate-300 object-cover shadow-lg" alt="" />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-700 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">2</div>
                    </div>
                    <p className="font-black text-primary-navy text-sm truncate w-full text-center">{podiumPlayers[1].player_name}</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center mb-4">
                    <div className="size-16 md:size-20 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50/50">
                      <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                        <span className="text-xl font-bold">?</span>
                      </div>
                    </div>
                    <p className="mt-3 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Vacant</p>
                  </div>
                )}
                <div className="w-full h-24 md:h-32 bg-linear-to-t from-slate-200 to-slate-100 rounded-t-xl mt-4 border-t-4 border-slate-300 flex justify-center pt-4">
                  <span className="font-display font-black text-slate-400/50 text-2xl">II</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center relative z-20 w-28 md:w-40 -mt-8">
                {podiumPlayers[0] ? (
                  <>
                    <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300 cursor-pointer">
                      <Crown size={32} className="absolute -top-10 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce" />
                      <img src={podiumPlayers[0].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-20 md:size-24 rounded-full border-4 border-amber-400 object-cover shadow-xl" alt="" />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white size-7 md:size-9 rounded-full flex items-center justify-center font-black border-2 border-white">1</div>
                    </div>
                    <p className="font-black text-amber-600 text-base truncate w-full text-center">{podiumPlayers[0].player_name}</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center mb-4">
                    <div className="size-20 md:size-24 rounded-full border-2 border-dashed border-amber-200 flex items-center justify-center bg-amber-50/30">
                      <div className="size-10 rounded-full bg-amber-100/50 flex items-center justify-center text-amber-400">
                        <Crown size={20} />
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] font-black text-amber-400/60 uppercase tracking-[0.4em]">No.1 Vacancy</p>
                  </div>
                )}
                <div className="w-full h-32 md:h-44 bg-linear-to-t from-amber-200 to-amber-100 rounded-t-xl mt-4 border-t-4 border-amber-400 flex justify-center pt-4">
                  <span className="font-display font-black text-amber-500/30 text-4xl">I</span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center relative z-10 w-24 md:w-32">
                {podiumPlayers[2] ? (
                  <>
                    <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300 cursor-pointer">
                      <img src={podiumPlayers[2].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-16 md:size-20 rounded-full border-4 border-orange-300 object-cover shadow-lg" alt="" />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-300 text-orange-800 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">3</div>
                    </div>
                    <p className="font-black text-primary-navy text-sm truncate w-full text-center">{podiumPlayers[2].player_name}</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center mb-4">
                    <div className="size-16 md:size-20 rounded-full border-2 border-dashed border-orange-200 flex items-center justify-center bg-orange-50/50">
                      <div className="size-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-300">
                        <span className="text-xl font-bold">?</span>
                      </div>
                    </div>
                    <p className="mt-3 text-[9px] font-black text-orange-300 uppercase tracking-[0.3em]">Vacant</p>
                  </div>
                )}
                <div className="w-full h-20 md:h-24 bg-linear-to-t from-orange-100 to-orange-50 rounded-t-xl mt-4 border-t-4 border-orange-300 flex justify-center pt-4">
                  <span className="font-display font-black text-orange-800/20 text-xl">III</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* 數據表格 */}
          <div className="bg-white rounded-4xl border border-slate-100 shadow-sm relative z-20">
            <div className="no-scrollbar rounded-4xl">
              <table className="w-full text-left border-collapse">
                <thead className="z-30">
                  <tr className="border-b border-slate-100">
                    <th className="sticky top-0 py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest w-24 text-center bg-slate-50/90 backdrop-blur-md z-30">Rank</th>
                    <th className="sticky top-0 py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50/90 backdrop-blur-md z-30">Player</th>
                    <th className="sticky top-0 py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50/90 backdrop-blur-md z-30">Tier Badge</th>
                    {/* 新增戰績與近期狀態欄位 */}
                    <th className="sticky top-0 py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center hidden md:table-cell bg-slate-50/90 backdrop-blur-md z-30">Record</th>
                    <th className="sticky top-0 py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center hidden lg:table-cell bg-slate-50/90 backdrop-blur-md z-30">Recent Form</th>
                    <th className="sticky top-0 py-5 px-6 text-xs font-black uppercase tracking-widest text-right text-primary-navy bg-slate-50/90 backdrop-blur-md z-30">
                      {isAllTime ? "Total MMR" : "Season LP"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedPlayers.map((player) => {
                    const rank = player.rank;
                    const tier = getTierBadge(player.global_mmr);
                    const isTop1 = rank === 1 && showPodium;

                    return (
                      <tr
                        key={player.player_id}
                        onClick={() => {
                          const newParams = new URLSearchParams(searchParams);
                          newParams.set('inspect', player.player_id);
                          setSearchParams(newParams);
                        }}
                        className={cn(
                          "group hover:bg-slate-50/50 transition-all cursor-pointer active:scale-[0.99] relative",
                          isTop1 && "bg-amber-50/30",
                          currentUser?.id === player.player_id && "bg-sapphire-blue/5 border-l-4 border-sapphire-blue ring-1 ring-sapphire-blue/10"
                        )}
                      >
                        <td className="py-4 px-4 md:px-6 w-24">
                          <div className="flex flex-col items-center justify-center">
                            <span className={cn(
                              "font-display font-black text-xl tabular-nums leading-none",
                              rank <= 3 && showPodium ? "text-slate-400 text-2xl" : "text-slate-300"
                            )}>
                              {rank}
                            </span>
                            {/* Trend Indicator */}
                            {player.trend !== "0" && (
                              <span className={cn(
                                "text-[10px] font-black mt-1",
                                typeof player.trend === 'string' && player.trend.startsWith('+') ? "text-emerald-500" : "text-rose-500"
                              )}>
                                {typeof player.trend === 'string' && player.trend.startsWith('+') ? '▲' : '▼'} {String(player.trend).replace(/[+-]/, '')}
                              </span>
                            )}
                            {rank === 1 && player.trend === "0" && <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter mt-1 italic">☆ TOP</span>}
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6">
                          <div className="flex items-center gap-4">
                            <div className="relative shrink-0">
                              <img
                                src={player.avatar_url || '/api/placeholder/150/150'}
                                className="size-10 md:size-12 rounded-2xl object-cover border-2 border-white shadow-sm group-hover:scale-110 transition-transform"
                                alt=""
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-sans font-black text-primary-navy text-sm md:text-base truncate group-hover:text-sapphire-blue transition-colors">
                                {player.player_name}
                              </p>
                              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest truncate">
                                {player.department || "一般同仁"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6">
                          <div className="flex flex-col gap-1">
                            <div className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit shadow-sm",
                              tier.color
                            )}>
                              {tier.icon}
                              <span className="text-[10px] font-black uppercase tracking-widest">{tier.name}</span>
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 tracking-wider ml-1 uppercase">
                              Win Rate: {player.win_rate}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-center hidden md:table-cell">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-600 font-black text-sm">{player.wins}W</span>
                              <span className="text-slate-300 text-xs">-</span>
                              <span className="text-rose-600 font-black text-sm">{player.losses}L</span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{player.matches_played} Total</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-center hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1.5">
                            {player.recent_form && player.recent_form.length > 0 ? (
                                player.recent_form.map((result: string, idx: number) => (
                                  <div 
                                    key={idx} 
                                    className={cn(
                                      "size-2.5 rounded-full shadow-sm border border-white/50",
                                      result === 'W' ? "bg-emerald-500" : "bg-rose-500"
                                    )}
                                    title={result === 'W' ? 'Win' : 'Loss'}
                                  />
                                ))
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 uppercase italic opacity-40">No Data</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={cn(
                                "font-display font-black text-xl md:text-3xl tracking-tighter tabular-nums leading-none",
                                isTop1 ? "text-amber-600" : "text-primary-navy"
                            )}>
                              {Math.round(player.season_lp)}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">LP</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sortedPlayers.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center text-slate-300">
                <Search size={48} className="mb-4 opacity-20" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">找不到符合條件的人選</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}