import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useThrottledCallback } from '@tanstack/react-pacer';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/utils/apiClient';
import { MatchItem } from '@/components/MatchItem';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Trophy, XCircle, LayoutGrid, Activity, TrendingUp, TrendingDown, LogIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { MatchHistorySkeleton } from '@/components/MatchHistorySkeleton';
import { useAuth } from '@/hooks/useAuth';
import type { MatchFeedItem, MatchHistoryResponse } from '@/types/api.types';

const PAGE_SIZE = 15;

export function MatchHistory() {
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'singles' | 'doubles'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 列表主查詢（支援結果、單雙打、跨頁關鍵字搜尋）
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery<MatchHistoryResponse>({
    queryKey: ['matches', 'history', filter, matchTypeFilter, debouncedSearch],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
        result_filter: filter,
        match_type: matchTypeFilter,
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const res = await apiClient.get<MatchHistoryResponse>(`/users/me/matches?${params.toString()}`);
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: !!user,
  });

  // 獨立抓最近 5 場固定資料供右側摘要使用（不因切換篩選而歸零）
  const { data: summaryData } = useQuery<MatchHistoryResponse>({
    queryKey: ['matches', 'history', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<MatchHistoryResponse>('/users/me/matches?limit=5&offset=0&result_filter=all');
      return res.data;
    },
    enabled: !!user,
  });

  const matches = data ? data.pages.flatMap((page) => page.matches) : [];
  const total = data?.pages[0]?.total || 0;
  const loading = isAuthLoading || (!!user && isPending);

  const handleLoadMore = useThrottledCallback(() => {
    fetchNextPage();
  }, { wait: 500 });

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    if (node && hasNextPage && !loading) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          handleLoadMore();
        }
      }, { threshold: 0, rootMargin: '100px' });
      observerRef.current.observe(node);
    }
  }, [hasNextPage, loading, isFetchingNextPage, handleLoadMore]);

  const stats = useMemo(() => {
    const recentMatches = summaryData?.matches?.slice(0, 5) || [];
    const wins = recentMatches.filter((m) => m.result === 'win').length;
    const losses = recentMatches.length - wins;
    const winRate = recentMatches.length > 0 ? Math.round((wins / recentMatches.length) * 100) : 0;
    const recentForm = recentMatches.map((m) => (m.result === 'win' ? 'W' : 'L'));
    const netMmr = recentMatches.reduce((acc, m) => {
      const isTeamA = m.player1?.some((p) => String(p.id) === String(user?.id));
      const change = isTeamA ? (m.mmrChange?.[0] || 0) : (m.mmrChange?.[1] || 0);
      return acc + change;
    }, 0);

    return { wins, losses, winRate, recentForm, netMmr, totalMatches: recentMatches.length };
  }, [summaryData, user?.id]);

  // 未登入狀態：顯示乾淨的登入引導，不再無限卡在 Skeleton
  if (!isAuthLoading && !user) {
    return (
      <div className="arena-page">
        <PageHeader title="對戰紀錄" subtitle="Match History · Personal Logs" />
        <div className="arena-surface p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="size-16 rounded-2xl bg-primary-navy/10 text-primary-navy flex items-center justify-center mx-auto">
            <Trophy size={30} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-display font-black text-primary-navy">登入後查看個人對戰紀錄</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            登入 Google 帳號即可查詢歷史勝敗場次、積分變動明細，並隨時發起一鍵再戰。
          </p>
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="h-11 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm gap-2"
          >
            <LogIn size={16} aria-hidden="true" />
            立即登入戰情室
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
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
          className="arena-page"
        >
          <motion.div variants={fadeInUp}>
            <PageHeader
              title="對戰紀錄"
              subtitle={`Match History · 共 ${total} 場`}
            />
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
            {/* 左側主內容區 */}
            <div className="flex-1 space-y-6 min-w-0 w-full">
              <motion.div variants={fadeInUp} className="arena-surface p-3 sm:p-4 space-y-3">
                <div className="relative group">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sapphire-blue transition-colors pointer-events-none"
                    size={16}
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    aria-label="搜尋對手或隊友姓名、單位"
                    autoComplete="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋對手或隊友姓名、單位..."
                    className="arena-input pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="清除搜尋"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* 勝負篩選 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    {(['all', 'win', 'loss'] as const).map((f) => (
                      <Button
                        type="button"
                        key={f}
                        aria-pressed={filter === f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          'rounded-xl px-4 h-9 text-xs font-sans tracking-wider font-bold transition-all shrink-0',
                          filter === f
                            ? f === 'all'
                              ? 'bg-primary-navy text-white shadow-sm'
                              : f === 'win'
                                ? 'bg-sapphire-blue text-white shadow-sm'
                                : 'bg-slate-700 text-white shadow-sm'
                            : 'bg-white text-primary-navy border border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        {f === 'all' && <><LayoutGrid size={13} className="mr-1.5 inline" aria-hidden="true" /> 全部</>}
                        {f === 'win' && <><Trophy size={13} className="mr-1.5 inline" aria-hidden="true" /> 勝場</>}
                        {f === 'loss' && <><XCircle size={13} className="mr-1.5 inline" aria-hidden="true" /> 敗場</>}
                      </Button>
                    ))}
                  </div>

                  {/* 單 / 雙打賽制篩選 */}
                  <div
                    role="group"
                    aria-label="篩選賽制"
                    className="inline-flex p-0.5 rounded-xl bg-white border border-slate-200/80 shrink-0"
                  >
                    {([
                      { id: 'all', label: '全賽制' },
                      { id: 'singles', label: '單打' },
                      { id: 'doubles', label: '雙打' },
                    ] as const).map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        aria-pressed={matchTypeFilter === t.id}
                        onClick={() => setMatchTypeFilter(t.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-black transition-all',
                          matchTypeFilter === t.id
                            ? 'bg-primary-navy text-white shadow-xs'
                            : 'text-slate-500 hover:text-primary-navy'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              <section className="space-y-4">
                <div className="flex items-center gap-4 px-1">
                  <span className="text-xs uppercase font-sans font-black tracking-[0.18em] text-slate-500 shrink-0">
                    時間軸紀錄
                  </span>
                  <div className="h-px bg-slate-200/80 flex-1" />
                </div>

                {matches.length === 0 ? (
                  <div className="text-center py-16 arena-surface border-dashed">
                    <Trophy size={32} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                    <p className="text-slate-500 font-bold text-sm">
                      {debouncedSearch
                        ? `找不到符合「${debouncedSearch}」的比賽`
                        : filter !== 'all' || matchTypeFilter !== 'all'
                          ? '此篩選條件下尚無對戰紀錄'
                          : '尚無任何對戰紀錄'}
                    </p>
                  </div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {matches.map((match: MatchFeedItem) => (
                      <motion.div key={match.id} variants={itemVariants}>
                        <MatchItem match={match} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </section>

              {/* Infinite Scroll Sentinel */}
              <div
                key={`${filter}-${matchTypeFilter}-${debouncedSearch}`}
                ref={sentinelRef}
                className="w-full flex flex-col items-center justify-center py-10 gap-3 min-h-[80px]"
              >
                <AnimatePresence>
                  {(isFetchingNextPage || (hasNextPage && loading)) && (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="size-2 rounded-full bg-sapphire-blue"
                          />
                        ))}
                      </div>
                      <span className="text-xs font-display font-black uppercase tracking-widest text-slate-400">
                        載入更多紀錄...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!hasNextPage && matches.length > 0 && (
                  <div className="flex items-center gap-3 text-slate-300 py-2">
                    <div className="w-10 h-px bg-slate-200" />
                    <Trophy size={13} aria-hidden="true" />
                    <span className="text-xs font-display font-bold uppercase tracking-widest text-slate-400">
                      已顯示所有對戰紀錄
                    </span>
                    <div className="w-10 h-px bg-slate-200" />
                  </div>
                )}
              </div>
            </div>

            {/* 右側近況摘要 */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last">
              <div className="lg:sticky lg:top-8">
                <Card className="arena-surface overflow-hidden shadow-xs">
                  <CardHeader className="pb-3 border-b border-slate-200/70">
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-primary-navy flex items-center gap-2">
                      <Activity size={16} className="text-sapphire-blue" aria-hidden="true" />
                      個人近況摘要
                    </CardTitle>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      基於最近 {stats.totalMatches} 場比賽
                    </p>
                  </CardHeader>
                  <CardContent className="p-5 space-y-6">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">勝率</span>
                        <span className="text-2xl font-display font-black text-primary-navy leading-none tabular-nums">
                          {stats.winRate}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                          style={{ width: `${stats.winRate}%` }}
                        />
                        <div
                          className="h-full bg-rose-400 transition-all duration-700 ease-out"
                          style={{ width: `${100 - stats.winRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-black tabular-nums">
                        <span className="text-emerald-600">{stats.wins} 勝</span>
                        <span className="text-rose-500">{stats.losses} 敗</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                        近期表現 (近 5 場)
                      </span>
                      <div className="flex items-center gap-2">
                        {stats.recentForm.length > 0 ? (
                          stats.recentForm.map((result: string, idx: number) => (
                            <div
                              key={idx}
                              className={cn(
                                'flex-1 py-2 rounded-xl flex items-center justify-center text-sm font-black font-display text-white shadow-xs',
                                result === 'W' ? 'bg-emerald-500' : 'bg-rose-500'
                              )}
                            >
                              {result}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 font-bold">尚無足夠數據</div>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl flex items-center justify-between border border-slate-200/80">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'p-2 rounded-xl',
                            stats.netMmr >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                          )}
                        >
                          {stats.netMmr >= 0 ? <TrendingUp size={15} aria-hidden="true" /> : <TrendingDown size={15} aria-hidden="true" />}
                        </div>
                        <span className="text-xs font-black text-slate-600">近 5 場積分變動</span>
                      </div>
                      <span
                        className={cn(
                          'text-lg font-display font-black tabular-nums',
                          stats.netMmr >= 0 ? 'text-emerald-600' : 'text-rose-500'
                        )}
                      >
                        {stats.netMmr > 0 ? `+${stats.netMmr}` : stats.netMmr}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
