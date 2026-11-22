import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useThrottledCallback } from '@tanstack/react-pacer';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '@/utils/apiClient';
import { MatchItem, MatchSeriesItem } from '@/components/MatchItem';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Trophy,
  XCircle,
  LayoutGrid,
  Activity,
  TrendingUp,
  TrendingDown,
  LogIn,
  X,
  UserCheck,
  Globe,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants } from '@/lib/animations';
import { useAuth } from '@/hooks/useAuth';
import { clusterMatchesIntoSeries, groupMatchesByDate } from '@/lib/matchDate';
import type { MatchFeedItem, MatchHistoryResponse } from '@/types/api.types';

const PAGE_SIZE = 50;

export function MatchHistory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user, isLoading: isAuthLoading } = useAuth();

  const rawScope = searchParams.get('scope');
  const highlightMatchId = searchParams.get('matchId');
  const scope: 'mine' | 'all' =
    rawScope === 'all' ? 'all' : rawScope === 'mine' ? 'mine' : user ? 'mine' : 'all';

  const setScope = (nextScope: 'mine' | 'all') => {
    const next = new URLSearchParams(searchParams);
    next.set('scope', nextScope);
    setSearchParams(next, { replace: true });
  };

  const clearHighlightMatch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('matchId');
    setSearchParams(next, { replace: true });
  };

  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'singles' | 'doubles'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clusterSeriesEnabled, setClusterSeriesEnabled] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // 1. 個人戰績基底快取 (一次載入 50 筆，切換篩選 0ms 秒切)
  const myBaseQuery = useInfiniteQuery<MatchHistoryResponse>({
    queryKey: ['matches', 'history', 'mine-base', user?.id],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<MatchHistoryResponse>(
        `/users/me/matches?limit=${PAGE_SIZE}&offset=${pageParam}&result_filter=all&match_type=all`,
      );
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!user,
  });

  // 2. 全部戰報基底快取 (同時預熱，切換「個人戰績 / 全部戰報」也 0ms 秒切)
  const allBaseQuery = useInfiniteQuery<MatchHistoryResponse>({
    queryKey: ['matches', 'history', 'all-base'],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<MatchHistoryResponse>(
        `/matches/history?limit=${PAGE_SIZE}&offset=${pageParam}&status_filter=all&match_type=all`,
      );
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
  });

  const activeBaseQuery = scope === 'mine' ? myBaseQuery : allBaseQuery;

  const baseMatches = useMemo(
    () => (activeBaseQuery.data ? activeBaseQuery.data.pages.flatMap((page) => page.matches) : []),
    [activeBaseQuery.data],
  );

  // 當總場次超過已載入頁數 (> 50 場) 且使用者套用篩選/搜尋時，才在背景向後端補齊更早的符合場次
  const activeOutcomeFilter = scope === 'mine' ? resultFilter : statusFilter;
  const hasActiveFilters =
    activeOutcomeFilter !== 'all' || matchTypeFilter !== 'all' || debouncedSearch !== '';
  const needsServerFallback = Boolean(activeBaseQuery.hasNextPage && hasActiveFilters);

  const filteredQuery = useInfiniteQuery<MatchHistoryResponse>({
    queryKey: [
      'matches',
      'history',
      'filtered',
      scope,
      scope === 'mine' ? user?.id : 'public',
      activeOutcomeFilter,
      matchTypeFilter,
      debouncedSearch,
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
        match_type: matchTypeFilter,
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      if (scope === 'mine') {
        params.set('result_filter', resultFilter);
        const res = await apiClient.get<MatchHistoryResponse>(
          `/users/me/matches?${params.toString()}`,
        );
        return res.data;
      }

      params.set('status_filter', statusFilter);
      const res = await apiClient.get<MatchHistoryResponse>(
        `/matches/history?${params.toString()}`,
      );
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    placeholderData: keepPreviousData,
    enabled: needsServerFallback && (scope === 'all' || !!user),
  });

  const serverMatches = useMemo(
    () => (filteredQuery.data ? filteredQuery.data.pages.flatMap((page) => page.matches) : []),
    [filteredQuery.data],
  );

  const usingServerResults =
    needsServerFallback && Boolean(filteredQuery.data) && !filteredQuery.isPlaceholderData;
  const sourceMatches = usingServerResults ? serverMatches : baseMatches;

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sourceMatches.filter((m) => {
      if (scope === 'mine') {
        if (resultFilter !== 'all' && m.result !== resultFilter) return false;
      } else {
        if (statusFilter === 'confirmed' && m.status !== 'confirmed' && m.status !== 'completed') {
          return false;
        }
        if (statusFilter === 'pending' && m.status !== 'pending') return false;
      }

      if (matchTypeFilter !== 'all' && m.type !== matchTypeFilter) return false;

      if (q) {
        const players = [...(m.player1 || []), ...(m.opponent || [])];
        const hit = players.some(
          (p) =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.department || '').toLowerCase().includes(q),
        );
        if (!hit) return false;
      }

      return true;
    });
  }, [sourceMatches, scope, resultFilter, statusFilter, matchTypeFilter, searchQuery]);

  const currentUserId = user?.id ? String(user.id) : null;

  // Mechanism 1 + 2: 依日期分段並計算當日戰績與同組連打收疊
  const dateSections = useMemo(() => {
    const groups = groupMatchesByDate(filteredMatches);

    return groups.map((group) => {
      const clusters = clusterMatchesIntoSeries(group.items);
      let wins = 0;
      let losses = 0;
      let netDelta = 0;

      if (scope === 'mine') {
        for (const m of group.items) {
          if (m.result === 'win') wins += 1;
          else if (m.result === 'loss') losses += 1;

          const isSettled = m.status === 'confirmed' || m.status === 'completed';
          if (isSettled && currentUserId) {
            const isTeamA = m.player1?.some((p) => String(p.id) === currentUserId);
            const delta = isTeamA ? m.mmrChange?.[0] || 0 : m.mmrChange?.[1] || 0;
            netDelta += delta;
          }
        }
      }

      return {
        ...group,
        clusters,
        wins,
        losses,
        netDelta: Math.round(netDelta * 10) / 10,
      };
    });
  }, [filteredMatches, scope, currentUserId]);

  const totalClusterCount = useMemo(
    () => dateSections.reduce((sum, s) => sum + s.clusters.length, 0),
    [dateSections],
  );

  const allDatesCollapsed =
    dateSections.length > 0 && dateSections.every((s) => Boolean(collapsedDates[s.key]));

  const toggleDateCollapsed = (dateKey: string) => {
    setCollapsedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const toggleAllDates = () => {
    if (allDatesCollapsed) {
      setCollapsedDates({});
    } else {
      const next: Record<string, boolean> = {};
      for (const s of dateSections) {
        next[s.key] = true;
      }
      setCollapsedDates(next);
    }
  };

  const activeScrollQuery = needsServerFallback ? filteredQuery : activeBaseQuery;
  const hasMorePages = Boolean(activeScrollQuery.hasNextPage);
  const isFetchingMore = activeScrollQuery.isFetchingNextPage;

  const isListLoading =
    scope === 'mine'
      ? isAuthLoading || (!!user && myBaseQuery.isPending && baseMatches.length === 0)
      : allBaseQuery.isPending && baseMatches.length === 0;

  const isSyncingOlderMatches =
    needsServerFallback && (filteredQuery.isFetching || filteredQuery.isPlaceholderData);

  const handleLoadMore = useThrottledCallback(() => {
    if (needsServerFallback) {
      filteredQuery.fetchNextPage();
    } else {
      activeBaseQuery.fetchNextPage();
    }
  }, { wait: 500 });

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();

      if (node && hasMorePages && !isListLoading) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && !isFetchingMore) {
              handleLoadMore();
            }
          },
          { threshold: 0, rootMargin: '120px' },
        );
        observerRef.current.observe(node);
      }
    },
    [hasMorePages, isListLoading, isFetchingMore, handleLoadMore],
  );

  const stats = useMemo(() => {
    const recentMatches = myBaseQuery.data?.pages[0]?.matches.slice(0, 5) || [];
    const wins = recentMatches.filter((m) => m.result === 'win').length;
    const losses = recentMatches.length - wins;
    const winRate = recentMatches.length > 0 ? Math.round((wins / recentMatches.length) * 100) : 0;
    const recentForm = recentMatches.map((m) => (m.result === 'win' ? 'W' : 'L'));
    const netMmr = recentMatches.reduce((acc, m) => {
      const isTeamA = m.player1?.some((p) => String(p.id) === String(user?.id));
      const change = isTeamA ? m.mmrChange?.[0] || 0 : m.mmrChange?.[1] || 0;
      return acc + change;
    }, 0);

    return { wins, losses, winRate, recentForm, netMmr, totalMatches: recentMatches.length };
  }, [myBaseQuery.data, user?.id]);

  const myTotal = myBaseQuery.data?.pages[0]?.total;
  const allTotal = allBaseQuery.data?.pages[0]?.total;
  const displayedTotal = usingServerResults
    ? filteredQuery.data?.pages[0]?.total ?? filteredMatches.length
    : activeBaseQuery.hasNextPage && (hasActiveFilters || searchQuery.trim() !== '')
      ? `${filteredMatches.length}+`
      : filteredMatches.length;

  const highlightMatchFound = Boolean(
    highlightMatchId &&
      filteredMatches.some((m) => String(m.id) === String(highlightMatchId)),
  );
  const allLoadedHasHighlight = Boolean(
    highlightMatchId &&
      allBaseQuery.data?.pages.some((page) =>
        page.matches.some((m) => String(m.id) === String(highlightMatchId)),
      ),
  );

  const resetAllFilters = () => {
    setResultFilter('all');
    setStatusFilter('all');
    setMatchTypeFilter('all');
    setSearchQuery('');
  };

  const headerSubtitle =
    scope === 'mine'
      ? `Personal Match History · ${typeof myTotal === 'number' ? `共 ${displayedTotal} 場` : '與我相關'}`
      : `All-Club Match Feed · ${typeof allTotal === 'number' ? `共 ${displayedTotal} 場` : '全部戰報'}`;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="arena-page"
    >
      <PageHeader
        title="對戰紀錄"
        subtitle={headerSubtitle}
      />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
        {/* 左側主內容區（搜尋與篩選列固定不卸載，切換條件絕不重新整理頁面） */}
        <div className="flex-1 space-y-5 min-w-0 w-full">
          <div className="arena-surface p-3 sm:p-4 space-y-3">
            {/* Scope + Folding Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/70">
              <div
                role="tablist"
                aria-label="切換對戰紀錄範圍"
                className="inline-flex p-1 rounded-2xl bg-secondary border border-border w-full sm:w-auto"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={scope === 'mine'}
                  onClick={() => setScope('mine')}
                  className={cn(
                    'flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap',
                    scope === 'mine'
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <UserCheck size={14} aria-hidden="true" />
                  <span>個人戰績</span>
                  {typeof myTotal === 'number' && (
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-xs font-display font-black tabular-nums text-muted-foreground whitespace-nowrap">
                      {myTotal}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={scope === 'all'}
                  onClick={() => setScope('all')}
                  className={cn(
                    'flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap',
                    scope === 'all'
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Globe size={14} aria-hidden="true" />
                  <span>全部戰報</span>
                  {typeof allTotal === 'number' && (
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-xs font-display font-black tabular-nums text-muted-foreground whitespace-nowrap">
                      {allTotal}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <button
                  type="button"
                  aria-pressed={clusterSeriesEnabled}
                  onClick={() => setClusterSeriesEnabled((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs sm:text-sm font-black transition-colors whitespace-nowrap',
                    clusterSeriesEnabled
                      ? 'bg-sapphire-blue/10 border-sapphire-blue/30 text-sapphire-blue dark:bg-blue-500/15 dark:border-blue-400/30 dark:text-blue-300'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Layers size={13} aria-hidden="true" />
                  <span>同組連打收疊</span>
                </button>

                {dateSections.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllDates}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-border bg-card hover:bg-secondary text-xs sm:text-sm font-black text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    {allDatesCollapsed ? (
                      <>
                        <ChevronDown size={14} aria-hidden="true" />
                        <span>展開全部日期</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp size={14} aria-hidden="true" />
                        <span>收合全部日期</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="relative group">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-sapphire-blue transition-colors pointer-events-none"
                size={16}
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label={scope === 'mine' ? '搜尋對手或隊友姓名、單位' : '搜尋參賽同仁姓名、單位'}
                autoComplete="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  scope === 'mine'
                    ? '搜尋對手或隊友姓名、單位...'
                    : '搜尋參賽同仁姓名、單位...'
                }
                className="arena-input pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="清除搜尋"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {scope === 'mine' ? (
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                  {(['all', 'win', 'loss'] as const).map((f) => (
                    <Button
                      type="button"
                      key={f}
                      aria-pressed={resultFilter === f}
                      onClick={() => setResultFilter(f)}
                      className={cn(
                        'rounded-xl px-4 h-9 text-xs font-sans tracking-wider font-bold transition-all shrink-0',
                        resultFilter === f
                          ? f === 'all'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : f === 'win'
                              ? 'bg-sapphire-blue text-white shadow-sm'
                              : 'bg-slate-700 text-white shadow-sm'
                          : 'bg-card text-foreground border border-border hover:bg-secondary',
                      )}
                    >
                      {f === 'all' && <><LayoutGrid size={13} className="mr-1.5 inline" aria-hidden="true" /> 全部</>}
                      {f === 'win' && <><Trophy size={13} className="mr-1.5 inline" aria-hidden="true" /> 勝場</>}
                      {f === 'loss' && <><XCircle size={13} className="mr-1.5 inline" aria-hidden="true" /> 敗場</>}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                  {(['all', 'confirmed', 'pending'] as const).map((s) => (
                    <Button
                      type="button"
                      key={s}
                      aria-pressed={statusFilter === s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        'rounded-xl px-4 h-9 text-xs font-sans tracking-wider font-bold transition-all shrink-0',
                        statusFilter === s
                          ? s === 'all'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : s === 'confirmed'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-amber-600 text-white shadow-sm'
                          : 'bg-card text-foreground border border-border hover:bg-secondary',
                      )}
                    >
                      {s === 'all' && <><LayoutGrid size={13} className="mr-1.5 inline" aria-hidden="true" /> 全部</>}
                      {s === 'confirmed' && <><CheckCircle2 size={13} className="mr-1.5 inline" aria-hidden="true" /> 已確認</>}
                      {s === 'pending' && <><Clock size={13} className="mr-1.5 inline" aria-hidden="true" /> 待確認</>}
                    </Button>
                  ))}
                </div>
              )}

              {/* 單 / 雙打賽制篩選 */}
              <div
                role="group"
                aria-label="篩選賽制"
                className="inline-flex p-0.5 rounded-xl bg-card border border-border shrink-0"
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
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="space-y-4">
            {highlightMatchId && !isListLoading && (
              <div
                className={cn(
                  'rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs',
                  highlightMatchFound
                    ? 'bg-sapphire-blue/8 border-sapphire-blue/30 text-foreground dark:bg-blue-500/12 dark:border-blue-400/30'
                    : 'bg-amber-50/80 border-amber-200/80 text-amber-900 dark:bg-amber-500/12 dark:border-amber-500/30 dark:text-amber-200',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 font-bold">
                  <Crosshair
                    size={15}
                    className={cn(
                      'shrink-0',
                      highlightMatchFound ? 'text-sapphire-blue dark:text-blue-300' : 'text-amber-600 dark:text-amber-300',
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {highlightMatchFound
                      ? `已自動展開並定位至通知場次 #${highlightMatchId.slice(0, 4)}`
                      : `尚未在目前清單中找到通知場次 #${highlightMatchId.slice(0, 4)}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap ml-auto">
                  {!highlightMatchFound && hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="h-7 px-2.5 rounded-lg bg-card border border-border font-black text-foreground hover:bg-secondary transition-colors"
                    >
                      清除篩選條件
                    </button>
                  )}
                  {!highlightMatchFound && scope === 'mine' && allLoadedHasHighlight && (
                    <button
                      type="button"
                      onClick={() => setScope('all')}
                      className="h-7 px-2.5 rounded-lg bg-sapphire-blue text-white font-black hover:bg-blue-700 transition-colors"
                    >
                      切換至全部戰報
                    </button>
                  )}
                  {!highlightMatchFound && hasMorePages && (
                    <button
                      type="button"
                      disabled={isFetchingMore}
                      onClick={() => handleLoadMore()}
                      className="h-7 px-2.5 rounded-lg bg-card border border-border font-black text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      {isFetchingMore ? '載入中...' : '載入更早對戰'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearHighlightMatch}
                    className="h-7 px-2.5 rounded-lg bg-card/80 border border-border/80 font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <span>清除定位</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {scope === 'mine' && !isAuthLoading && !user ? (
              <div className="arena-surface p-8 sm:p-12 text-center space-y-4">
                <div className="size-14 rounded-2xl bg-sapphire-blue/12 text-sapphire-blue flex items-center justify-center mx-auto">
                  <Trophy size={26} aria-hidden="true" />
                </div>
                <h2 className="text-lg sm:text-xl font-display font-black text-foreground">
                  登入後查看個人對戰紀錄
                </h2>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-md mx-auto">
                  登入後即可查詢專屬勝負明細、積分加減與搭檔數據；您也可以先切換上方「全部戰報」瀏覽所有對戰動態。
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="h-10 px-5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm gap-2"
                  >
                    <LogIn size={16} aria-hidden="true" />
                    立即登入戰情室
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setScope('all')}
                    className="h-10 px-5 rounded-xl border-border text-foreground font-bold text-sm gap-1.5"
                  >
                    <Globe size={15} aria-hidden="true" />
                    先看全部戰報
                  </Button>
                </div>
              </div>
            ) : isListLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-14 arena-surface border-dashed space-y-2">
                <Trophy size={30} className="mx-auto text-muted-foreground/40 mb-2" aria-hidden="true" />
                <p className="text-muted-foreground font-bold text-sm">
                  {isSyncingOlderMatches
                    ? '正在搜尋更早的對戰紀錄...'
                    : searchQuery.trim()
                      ? `找不到符合「${searchQuery.trim()}」的比賽`
                      : hasActiveFilters
                        ? '此篩選條件下尚無對戰紀錄'
                        : scope === 'mine'
                          ? '尚無任何個人對戰紀錄'
                          : '目前尚無任何對戰紀錄'}
                </p>
              </div>
            ) : (
              <div className={cn('space-y-3.5 transition-opacity duration-200', isSyncingOlderMatches && 'opacity-70')}>
                {clusterSeriesEnabled && totalClusterCount < filteredMatches.length && (
                  <p className="text-xs font-bold text-muted-foreground px-1">
                    已為您將同日同組連打收疊為 {totalClusterCount} 組（原 {filteredMatches.length} 場），點擊任一日期標題亦可折疊。
                  </p>
                )}

                {dateSections.map((dateSection) => {
                  const containsHighlightedMatch = Boolean(
                    highlightMatchId &&
                      dateSection.items.some((m) => String(m.id) === String(highlightMatchId)),
                  );
                  const isCollapsed = containsHighlightedMatch
                    ? false
                    : Boolean(collapsedDates[dateSection.key]);

                  return (
                    <div key={dateSection.key} className="space-y-2">
                      {/* Mechanism 2: Clickable Date Accordion Header */}
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleDateCollapsed(dateSection.key)}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-surface-subtle/80 hover:bg-secondary border border-border/80 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <ChevronDown
                            size={16}
                            aria-hidden="true"
                            className={cn(
                              'text-muted-foreground transition-transform duration-200 shrink-0',
                              isCollapsed && '-rotate-90',
                            )}
                          />
                          <span className="text-sm sm:text-base font-display font-black tracking-wide text-foreground whitespace-nowrap">
                            {dateSection.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-card border border-border text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                            {dateSection.items.length} 場
                          </span>
                          {clusterSeriesEnabled &&
                            dateSection.clusters.length < dateSection.items.length && (
                              <span className="text-xs font-bold text-sapphire-blue dark:text-blue-300 whitespace-nowrap">
                                收疊為 {dateSection.clusters.length} 組
                              </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 text-xs sm:text-sm font-black tabular-nums whitespace-nowrap">
                          {scope === 'mine' && (
                            <div className="flex items-center gap-1.5">
                              <span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {dateSection.wins}勝
                                </span>{' '}
                                <span className="text-rose-500 dark:text-rose-400">
                                  {dateSection.losses}敗
                                </span>
                              </span>
                              {dateSection.netDelta !== 0 && (
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded-md text-xs font-display font-black whitespace-nowrap',
                                    dateSection.netDelta > 0
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                      : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                                  )}
                                >
                                  {dateSection.netDelta > 0
                                    ? `+${dateSection.netDelta}`
                                    : dateSection.netDelta}{' '}
                                  分
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                            {isCollapsed ? '展開' : '收合'}
                          </span>
                        </div>
                      </button>

                      {!isCollapsed && (
                        clusterSeriesEnabled ? (
                          scope === 'mine' ? (
                            <div className="space-y-2">
                              {dateSection.clusters.map((cluster) => (
                                <MatchSeriesItem
                                  key={cluster.key}
                                  cluster={cluster}
                                  variant="personal"
                                  timeDisplay="clock"
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-border/70">
                              {dateSection.clusters.map((cluster) => (
                                <MatchSeriesItem
                                  key={cluster.key}
                                  cluster={cluster}
                                  variant="feed"
                                  timeDisplay="clock"
                                />
                              ))}
                            </div>
                          )
                        ) : scope === 'mine' ? (
                          <div className="space-y-2">
                            {dateSection.items.map((match: MatchFeedItem) => (
                              <MatchItem
                                key={match.id}
                                match={match}
                                variant="personal"
                                timeDisplay="clock"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-border/70">
                            {dateSection.items.map((match: MatchFeedItem) => (
                              <MatchItem
                                key={match.id}
                                match={match}
                                variant="feed"
                                timeDisplay="clock"
                              />
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Infinite Scroll Sentinel */}
          {(scope === 'all' || !!user) && !isListLoading && (
            <div
              key={`${scope}-${activeOutcomeFilter}-${matchTypeFilter}-${debouncedSearch}`}
              ref={sentinelRef}
              className="w-full flex flex-col items-center justify-center py-8 gap-3 min-h-[72px]"
            >
              <AnimatePresence>
                {isFetchingMore && (
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
                    <span className="text-xs font-display font-black uppercase tracking-widest text-muted-foreground">
                      載入更多紀錄...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!hasMorePages && filteredMatches.length > 0 && !isSyncingOlderMatches && (
                <div className="flex items-center gap-3 text-muted-foreground py-2">
                  <div className="w-10 h-px bg-border" />
                  <Trophy size={13} aria-hidden="true" />
                  <span className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground">
                    已顯示所有對戰紀錄
                  </span>
                  <div className="w-10 h-px bg-border" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右側近況摘要 */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last">
          <div className="lg:sticky lg:top-8">
            <Card className="arena-surface overflow-hidden shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity size={16} className="text-sapphire-blue" aria-hidden="true" />
                  個人近況摘要
                </CardTitle>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">
                  {user ? `基於最近 ${stats.totalMatches} 場個人比賽` : '登入後追蹤個人戰績走勢'}
                </p>
              </CardHeader>
              {user ? (
                <CardContent className="p-5 space-y-6">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">勝率</span>
                      <span className="text-2xl font-display font-black text-foreground leading-none tabular-nums">
                        {stats.winRate}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden flex">
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
                      <span className="text-emerald-600 dark:text-emerald-400">{stats.wins} 勝</span>
                      <span className="text-rose-500 dark:text-rose-400">{stats.losses} 敗</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                      近期表現 (近 5 場)
                    </span>
                    <div className="flex items-center gap-2">
                      {stats.recentForm.length > 0 ? (
                        stats.recentForm.map((result: string, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              'flex-1 py-2 rounded-xl flex items-center justify-center text-sm font-black font-display text-white shadow-xs',
                              result === 'W' ? 'bg-emerald-500' : 'bg-rose-500',
                            )}
                          >
                            {result}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground font-bold">尚無足夠數據</div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-card rounded-2xl flex items-center justify-between border border-border">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'p-2 rounded-xl',
                          stats.netMmr >= 0
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400',
                        )}
                      >
                        {stats.netMmr >= 0 ? (
                          <TrendingUp size={15} aria-hidden="true" />
                        ) : (
                          <TrendingDown size={15} aria-hidden="true" />
                        )}
                      </div>
                      <span className="text-xs font-black text-muted-foreground">近 5 場積分變動</span>
                    </div>
                    <span
                      className={cn(
                        'text-lg font-display font-black tabular-nums',
                        stats.netMmr >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {stats.netMmr > 0 ? `+${stats.netMmr}` : stats.netMmr}
                    </span>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-5 space-y-3 text-center">
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    登入戰情室即可自動統計您的近期勝率、連勝連敗態勢與 ELO 積分浮動。
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full h-10 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-xs gap-1.5"
                  >
                    <LogIn size={14} aria-hidden="true" />
                    登入查看個人摘要
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
