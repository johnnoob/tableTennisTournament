import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '@/utils/apiClient';
import { MatchItem } from '@/components/MatchItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Trophy, XCircle, LayoutGrid, Loader2, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { MatchHistorySkeleton } from '@/components/MatchHistorySkeleton';
import { useAuthStore } from '@/store/authStore';

const PAGE_SIZE = 15;

export function MatchHistory() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMatches = useCallback(async (newFilter: 'all' | 'win' | 'loss', newOffset: number, append: boolean) => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }

    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await apiClient.get(
        `/users/me/matches?limit=${PAGE_SIZE}&offset=${newOffset}&result_filter=${newFilter}`
      );
      const data = res.data;
      setMatches(prev => append ? [...prev, ...data.matches] : data.matches);
      setTotal(data.total);
      setHasMore(data.hasMore);

      // 如果是第一次載入且篩選為 'all'，同步更新近況摘要用的數據
      if (newFilter === 'all' && newOffset === 0) {
        setRecentMatches(data.matches.slice(0, 5));
      }
    } catch (err) {
      console.error('無法取得對戰紀錄', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchMatches(filter, 0, false);
  }, [filter, fetchMatches]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchMatches(filter, newOffset, true);
  };

  const displayed = searchQuery
    ? matches.filter(m =>
      [...(m.player1 || []), ...(m.opponent || [])].some((p: any) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    : matches;

  // 根據「獨立的近況紀錄」計算固定數據 (不受 Timeline Filter 影響)
  const stats = useMemo(() => {
    // 使用 recentMatches 確保切換篩選器時數據保持不變
    const wins = recentMatches.filter(m => m.result === 'win').length;
    const losses = recentMatches.length - wins;
    const winRate = recentMatches.length > 0 ? Math.round((wins / recentMatches.length) * 100) : 0;

    // 計算近5場戰績 (Form Guide)
    const recentForm = recentMatches.map(m => m.result === 'win' ? 'W' : 'L');

    // 🌟 近五場積分變動計算 (及時回報近五場表現)
    const netMmr = recentMatches.reduce((acc, m) => {
      const isTeamA = m.player1?.some((p: any) => String(p.id) === String(user?.id));
      const change = isTeamA ? (m.mmrChange?.[0] || 0) : (m.mmrChange?.[1] || 0);
      return acc + change;
    }, 0);

    return { wins, losses, winRate, recentForm, netMmr, totalMatches: recentMatches.length };
  }, [recentMatches, user?.id]);

  return (
    <AnimatePresence mode="wait">
      {loading && offset === 0 ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MatchHistorySkeleton />
        </motion.div>
      ) : (
        <div className="min-h-screen bg-[#fbfcfe] w-full">
          <motion.div
            key="content"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="pb-24 pt-8 px-6 max-w-[1400px] mx-auto w-full"
          >
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

              {/* 左側主內容區 */}
              <div className="flex-1 space-y-8 min-w-0">
                <motion.header variants={fadeInUp} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 md:w-3 bg-gradient-to-b from-sapphire-blue to-blue-800 rounded-full h-12 md:h-16 mr-4 md:mr-6 shrink-0" />
                    <div className="space-y-1">
                      <h1 className="text-4xl md:text-5xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none">對戰紀錄</h1>
                      <p className="text-[10px] md:text-xs text-slate-400 font-sans font-black uppercase tracking-[0.3em] opacity-60">
                        Match History · {total} 場
                      </p>
                    </div>
                  </div>
                </motion.header>

                <motion.div variants={fadeInUp} className="bg-white/50 backdrop-blur-sm p-4 rounded-[2.5rem] border border-slate-100/50 space-y-4">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sapphire-blue transition-colors" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="搜尋對手姓名..."
                      className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-sans outline-none border border-slate-100 shadow-sm focus:border-sapphire-blue/20 focus:ring-4 focus:ring-sapphire-blue/5 transition-all text-primary-navy font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {(['all', 'win', 'loss'] as const).map(f => (
                      <Button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          "rounded-full px-5 py-0 h-9 text-xs uppercase font-sans tracking-widest font-bold transition-all shrink-0",
                          filter === f
                            ? f === 'all'
                              ? "bg-primary-navy text-white shadow-lg shadow-primary-navy/20"
                              : f === 'win'
                                ? "bg-sapphire-blue text-white shadow-lg shadow-sapphire-blue/20"
                                : "bg-primary-slate text-white shadow-lg shadow-primary-slate/20"
                            : "bg-white text-primary-navy border border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        {f === 'all' && <><LayoutGrid size={12} className="mr-2 inline" /> All</>}
                        {f === 'win' && <><Trophy size={12} className="mr-2 inline" /> Wins</>}
                        {f === 'loss' && <><XCircle size={12} className="mr-2 inline" /> Losses</>}
                      </Button>
                    ))}
                  </div>
                </motion.div>

                <section className="space-y-6">
                  <motion.div variants={fadeInUp} className="flex items-center gap-4 py-2 text-slate-500 opacity-100">
                    <span className="text-xs uppercase font-sans font-bold tracking-[0.2em] text-primary-navy shrink-0">
                      Match Timeline
                    </span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </motion.div>

                  {displayed.length === 0 ? (
                    <motion.div variants={fadeInUp} className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <Trophy size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">
                        {searchQuery ? '找不到符合搜尋的比賽' : filter !== 'all' ? `尚無${filter === 'win' ? '勝利' : '敗戰'}紀錄` : '尚無任何對戰紀錄'}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-4"
                    >
                      {displayed.map((match: any) => (
                        <motion.div key={match.id} variants={itemVariants}>
                          <MatchItem match={match} />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </section>

                {hasMore && !loading && !searchQuery && (
                  <motion.div variants={fadeInUp} className="pt-4 pb-12">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full rounded-2xl border-none bg-white shadow-sm py-8 text-[11px] font-bold uppercase tracking-widest text-primary-navy hover:bg-slate-50 transition-all font-sans gap-3 shadow-slate-100"
                    >
                      {loadingMore ? (
                        <><Loader2 size={14} className="animate-spin" /> 載入中...</>
                      ) : (
                        `載入更多 (還有 ${total - offset - PAGE_SIZE > 0 ? total - offset - PAGE_SIZE : 0} 場)`
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>

              {/* 右側統計欄位 */}
              <div className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last mb-8 lg:mb-0 lg:mt-32">
                <div className="lg:sticky lg:top-32 space-y-6">

                  <Card className="rounded-[2.5rem] border-slate-100 shadow-sm bg-slate-50 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-50">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-primary-navy flex items-center gap-2">
                        <Activity size={16} className="text-sapphire-blue" />
                        個人近況摘要
                      </CardTitle>
                      <p className="text-xs text-slate-400 font-bold tracking-wider mt-1">
                        基於最近 {stats.totalMatches} 場比賽
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">勝率 (Win Rate)</span>
                          <span className="text-2xl font-display font-black text-primary-navy leading-none">{stats.winRate}%</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                            style={{ width: `${stats.winRate}%` }}
                          />
                          <div
                            className="h-full bg-rose-400 transition-all duration-1000 ease-out"
                            style={{ width: `${100 - stats.winRate}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                          <span className="text-emerald-600">{stats.wins} Wins</span>
                          <span className="text-rose-500">{stats.losses} Losses</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">近期表現 (Last 5)</span>
                        <div className="flex items-center gap-2">
                          {stats.recentForm.length > 0 ? stats.recentForm.map((result, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex-1 py-2 rounded-xl flex items-center justify-center text-sm font-black font-display text-white shadow-sm",
                                result === 'W' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-400 shadow-rose-400/20"
                              )}
                            >
                              {result}
                            </div>
                          )) : (
                            <div className="text-sm text-slate-300 font-bold tracking-widest">無足夠數據</div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-full", stats.netMmr >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500")}>
                            {stats.netMmr >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">近 5 場積分變動</span>
                        </div>
                        <span className={cn("text-xl font-display font-black", stats.netMmr >= 0 ? "text-emerald-600" : "text-rose-500")}>
                          {stats.netMmr > 0 ? `+${stats.netMmr}` : stats.netMmr}
                        </span>
                      </div>

                    </CardContent>
                  </Card>

                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
