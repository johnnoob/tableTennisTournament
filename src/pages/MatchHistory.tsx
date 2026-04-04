import { useState, useEffect, useCallback } from 'react';
import { MatchItem } from '@/components/MatchItem';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, SlidersHorizontal, Trophy, XCircle, LayoutGrid, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { MatchHistorySkeleton } from '@/components/MatchHistorySkeleton';

const PAGE_SIZE = 15;

export function MatchHistory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
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
      const res = await fetch(
        `http://localhost:8000/api/users/me/matches?limit=${PAGE_SIZE}&offset=${newOffset}&result_filter=${newFilter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      setMatches(prev => append ? [...prev, ...data.matches] : data.matches);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('無法取得對戰紀錄', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 初次載入 & 篩選切換時重置
  useEffect(() => {
    setOffset(0);
    fetchMatches(filter, 0, false);
  }, [filter, fetchMatches]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchMatches(filter, newOffset, true);
  };

  // 本地搜尋只在前端過濾（姓名）
  const displayed = searchQuery
    ? matches.filter(m =>
        [...(m.player1 || []), ...(m.opponent || [])].some((p: any) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : matches;

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
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pb-24 pt-8 px-6 space-y-8 min-h-screen bg-[#fbfcfe]"
        >
          <motion.header variants={fadeInUp} className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft size={18} className="text-primary-navy" />
                </Button>
                <div>
                  <h1 className="text-3xl text-primary-navy font-display tracking-tight font-black">對戰紀錄</h1>
                  <p className="text-xs text-primary-slate/50 mt-1 uppercase tracking-[0.2em] font-sans font-semibold">
                    Match History · {total} 場
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border border-slate-100">
                <SlidersHorizontal size={18} className="text-primary-navy" />
              </Button>
            </div>

            {/* Search & Filter Pills */}
            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sapphire-blue transition-colors" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜尋對手姓名..."
                  className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-sans outline-none border border-transparent shadow-sm focus:border-sapphire-blue/20 focus:ring-4 focus:ring-sapphire-blue/5 transition-all text-primary-navy font-bold"
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
            </div>
          </motion.header>

          {/* Match Timeline */}
          <section className="space-y-6">
            <motion.div variants={fadeInUp} className="flex items-center gap-4 py-2 text-slate-500 opacity-100">
              <span className="text-xs uppercase font-sans font-bold tracking-[0.2em] text-primary-navy shrink-0">
                Match Timeline
              </span>
              <div className="h-px bg-primary-navy flex-1" />
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

          {/* Load More */}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
