import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Trophy, Calendar, ArrowRight, CalendarX, Inbox, Sparkles, Target, Zap, Users, Filter, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { TournamentSkeleton } from '@/components/TournamentSkeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn, formatLocalTime } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { useThrottledCallback } from '@tanstack/react-pacer';
import apiClient from '@/utils/apiClient';

function EmptyState({ icon: Icon, title, description, className }: { icon: any; title: string; description: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 rounded-2xl md:rounded-3xl bg-white border border-slate-200/80 shadow-xs relative overflow-hidden group',
        className
      )}
    >
      <div className="size-20 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-300 mb-6 relative z-10 group-hover:bg-sapphire-blue group-hover:text-white transition-all duration-500">
        <Icon size={36} strokeWidth={1.5} aria-hidden="true" />
        <Sparkles size={18} className="absolute -top-2 -right-2 text-olympic-gold" fill="currentColor" aria-hidden="true" />
      </div>

      <div className="space-y-2 text-center relative z-10">
        <h3 className="font-display font-black text-xl text-primary-navy tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-slate-400 font-medium max-w-[320px] leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

export function Tournament() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('seasons');
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(6);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { data: tournamentList = [], isPending: isTournamentsLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await apiClient.get('/tournaments');
      return res.data;
    }
  });

  const { data: seasonList = [], isPending: isSeasonsLoading } = useQuery({
    queryKey: ['seasons', 'list'],
    queryFn: async () => {
      const res = await apiClient.get('/seasons');
      return res.data;
    }
  });

  const isLoading = isTournamentsLoading || isSeasonsLoading;
  useEffect(() => {
    setVisibleCount(6);
  }, [tournamentStatusFilter, activeTab]);

  const filteredTournaments = tournamentList.filter((t: any) => {
    if (tournamentStatusFilter === 'all') return true;
    return t.status === tournamentStatusFilter;
  });

  const displayHeroTournaments = filteredTournaments.filter((t: any) => ['ongoing', 'registering'].includes(t.status));
  const displayStandardTournaments = filteredTournaments.filter((t: any) => !['ongoing', 'registering'].includes(t.status));

  const filteredSeasons = seasonList.filter((s: any) => {
    if (tournamentStatusFilter === 'all') return true;
    if (tournamentStatusFilter === 'ongoing') return s.status === 'active';
    if (tournamentStatusFilter === 'completed') return s.status === 'completed';
    if (tournamentStatusFilter === 'registering') return false;
    return true;
  });

  const hasMore = activeTab === 'seasons'
    ? filteredSeasons.length > visibleCount
    : displayStandardTournaments.length > visibleCount;

  const handleLoadMore = useThrottledCallback(() => {
    setVisibleCount(prev => prev + 6);
  }, { wait: 500 });

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (node && hasMore) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          handleLoadMore();
        }
      }, { threshold: 0, rootMargin: '50px' });

      observerRef.current.observe(node);
    }
  }, [isLoading, hasMore, visibleCount, handleLoadMore]);

  const filterColors = {
    all: { bg: 'bg-primary-navy', border: 'border-primary-navy', text: 'text-primary-navy' },
    registering: { bg: 'bg-olympic-gold', border: 'border-olympic-gold', text: 'text-amber-600' },
    ongoing: { bg: 'bg-sapphire-blue', border: 'border-sapphire-blue', text: 'text-sapphire-blue' },
    completed: { bg: 'bg-emerald-600', border: 'border-emerald-600', text: 'text-emerald-600' }
  };

  const categoryTabs = (
    <Tabs
      value={activeTab}
      className="w-full md:w-fit"
      onValueChange={(val) => {
        setActiveTab(val);
        if (val === 'seasons' && tournamentStatusFilter === 'registering') {
          setTournamentStatusFilter('all');
        }
      }}
    >
      <TabsList className="bg-slate-100/80 p-1 rounded-2xl h-12 w-full md:w-fit grid grid-cols-2 border border-slate-200/70">
        <TabsTrigger
          value="seasons"
          className="rounded-xl px-5 font-display font-black text-xs tracking-wider transition-all gap-2 data-[state=active]:bg-white data-[state=active]:text-sapphire-blue data-[state=active]:shadow-xs"
        >
          <Trophy size={15} aria-hidden="true" />
          積分賽季
        </TabsTrigger>
        <TabsTrigger
          value="exclusive"
          className="rounded-xl px-5 font-display font-black text-xs tracking-wider transition-all gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-xs"
        >
          <Target size={15} aria-hidden="true" />
          獨立錦標賽
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <TournamentSkeleton />
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
              title="賽事中心"
              subtitle="Precision Arena · Seasons & Tournaments"
              actions={categoryTabs}
            />
          </motion.div>

          {/* 狀態篩選列 */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center gap-2.5 py-3 border-y border-slate-200/70 overflow-x-auto no-scrollbar"
          >
            {[
              { id: 'all', cn: '全部', en: 'All', icon: Filter, colorKey: 'all' },
              { id: 'registering', cn: '報名中', en: 'Registering', icon: Zap, colorKey: 'registering' },
              { id: 'ongoing', cn: '進行中', en: 'Ongoing', icon: Trophy, colorKey: 'ongoing' },
              { id: 'completed', cn: '已結束', en: 'Completed', icon: CheckCircle2, colorKey: 'completed' }
            ].filter(f => activeTab === 'seasons' ? f.id !== 'registering' : true).map((filter) => {
              const styles = filterColors[filter.colorKey as keyof typeof filterColors];
              const isActive = tournamentStatusFilter === filter.id;

              return (
                <button
                  type="button"
                  key={filter.id}
                  onClick={() => setTournamentStatusFilter(filter.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-black text-xs tracking-wider transition-all border shrink-0 whitespace-nowrap',
                    isActive
                      ? `${styles.bg} text-white ${styles.border} shadow-sm`
                      : 'bg-white text-slate-500 border-slate-200/80 hover:border-slate-300 hover:text-primary-navy'
                  )}
                >
                  <filter.icon size={14} aria-hidden="true" className={cn(isActive ? 'text-white' : styles.text)} />
                  <span>
                    {filter.cn}
                    <span className="hidden md:inline ml-1 opacity-70 font-normal">({filter.en})</span>
                  </span>
                </button>
              );
            })}
          </motion.div>

          {/* Content Tabs */}
          <div className="w-full">
            <Tabs value={activeTab} className="w-full">
              {/* 1. Seasons Content Panel */}
              <TabsContent value="seasons" className="mt-0 focus-visible:outline-none space-y-6">
                <div className="flex items-center justify-between px-1">
                  <div className="space-y-0.5">
                    <h2 className="font-display font-black text-xl sm:text-2xl text-primary-navy tracking-tight">
                      積分賽季清單
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Zap size={13} className="text-olympic-gold" aria-hidden="true" />
                      季賽排行榜與段位積分結算
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 font-sans font-black border border-slate-200/80 px-3 py-1">
                    {filteredSeasons.length} 個賽季
                  </Badge>
                </div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5"
                >
                  {filteredSeasons.slice(0, visibleCount).map((s: any, idx: number) => (
                    <motion.div key={s.id || idx} variants={itemVariants}>
                      <Card
                        onClick={() => navigate(`/season/${s.id}`)}
                        className="arena-card p-6 hover:bg-slate-50/70 transition-all cursor-pointer group hover:border-sapphire-blue/30 hover:shadow-md relative overflow-hidden"
                      >
                        <div className="absolute -top-8 -right-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity text-sapphire-blue pointer-events-none">
                          <Trophy size={150} aria-hidden="true" />
                        </div>

                        <div className="flex flex-col space-y-5 relative z-10">
                          <div className="flex items-start justify-between">
                            <div className="size-13 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-500 flex items-center justify-center group-hover:bg-sapphire-blue group-hover:text-white group-hover:border-sapphire-blue transition-all">
                              <Trophy size={26} strokeWidth={1.6} aria-hidden="true" />
                            </div>
                            <ArrowRight size={20} aria-hidden="true" className="text-slate-300 group-hover:text-sapphire-blue transition-all group-hover:translate-x-1" />
                          </div>

                          <div className="space-y-3">
                            <h3 className="font-display font-black text-xl text-primary-navy tracking-tight group-hover:text-sapphire-blue transition-colors">
                              {s.name}
                            </h3>

                            <div className="flex items-center gap-2.5">
                              <Badge
                                className={cn(
                                  'text-xs uppercase font-sans tracking-wider px-2.5 py-0.5 border-none font-black',
                                  s.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                                )}
                              >
                                {s.status === 'active' ? '● 進行中' : '已結束'}
                              </Badge>
                              <span className="text-xs font-bold text-slate-400">Official Season</span>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 tabular-nums">
                              <span>
                                {formatLocalTime(s.start_date, 'yyyy/MM/dd')} - {formatLocalTime(s.end_date, 'yyyy/MM/dd')}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Users size={12} className="text-emerald-500" aria-hidden="true" />
                                {s.participants_count || 0} 人參賽
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>

                {filteredSeasons.length === 0 && (
                  <EmptyState
                    icon={CalendarX}
                    title="尚無對應賽季資料"
                    description={
                      tournamentStatusFilter === 'all'
                        ? '目前系統中還沒有官方賽季記錄。'
                        : `目前沒有狀態為「${tournamentStatusFilter === 'ongoing' ? '進行中' : '已結束'}」的賽季資料。`
                    }
                  />
                )}
              </TabsContent>

              {/* 2. Exclusive Tournaments Content Panel */}
              <TabsContent value="exclusive" className="mt-0 focus-visible:outline-none space-y-10">
                {displayHeroTournaments.length > 0 && (
                  <div className="space-y-5">
                    <div className="px-1">
                      <h2 className="font-display font-black text-xl sm:text-2xl text-primary-navy tracking-tight">
                        火熱進行中
                      </h2>
                      <p className="text-xs text-slate-400 font-bold">Live Now · 開放報名或進行中錦標賽</p>
                    </div>
                    <div className="space-y-5">
                      {displayHeroTournaments.map((t: any, idx: number) => (
                        <motion.section
                          key={t.id || idx}
                          variants={fadeInUp}
                          onClick={() => navigate(`/tournament/${t.id}`)}
                          className="cursor-pointer group"
                        >
                          <div className="bg-primary-navy rounded-2xl md:rounded-3xl p-6 sm:p-8 md:p-10 text-white relative overflow-hidden shadow-lg border border-slate-800 hover:border-sapphire-blue/50 transition-all">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 group-hover:scale-105 transition-all pointer-events-none">
                              <Trophy size={150} strokeWidth={1} aria-hidden="true" />
                            </div>

                            <div className="relative z-10 space-y-5">
                              <Badge className="bg-olympic-gold text-white text-xs uppercase font-sans font-black tracking-widest px-3.5 py-1 border-none">
                                {t.status === 'registering' ? '報名中' : '進行中'}
                              </Badge>

                              <div className="space-y-3">
                                <h3 className="text-2xl sm:text-4xl font-display font-black tracking-tight">
                                  {t.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-300">
                                  <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 tabular-nums">
                                    <Calendar size={14} className="text-sapphire-blue" aria-hidden="true" />
                                    {formatLocalTime(t.created_at, 'yyyy/MM/dd')}
                                  </span>
                                  <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                                    <Trophy size={14} className="text-olympic-gold" aria-hidden="true" />
                                    特別錦標賽
                                  </span>
                                </div>
                              </div>

                              <div className="pt-1">
                                <div className="inline-flex items-center gap-3 px-6 py-3 bg-sapphire-blue text-white rounded-xl font-sans font-black text-xs uppercase tracking-widest shadow-md group-hover:bg-blue-600 transition-colors">
                                  進入賽事詳情
                                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.section>
                      ))}
                    </div>
                  </div>
                )}

                {displayStandardTournaments.length > 0 && (
                  <div className="space-y-5">
                    <div className="px-1">
                      <h2 className="font-display font-black text-xl sm:text-2xl text-primary-navy tracking-tight">
                        {tournamentStatusFilter === 'all' ? '歷史錦標賽記錄' : '篩選結果'}
                      </h2>
                      <p className="text-xs text-slate-400 font-bold">
                        {tournamentStatusFilter === 'all' ? '歷屆獨立錦標賽總覽' : '符合目前篩選條件的錦標賽'}
                      </p>
                    </div>
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-1 2xl:grid-cols-2 gap-4"
                    >
                      {displayStandardTournaments.slice(0, visibleCount).map((t: any, idx: number) => (
                        <motion.div key={t.id || idx} variants={itemVariants}>
                          <Card
                            onClick={() => navigate(`/tournament/${t.id}`)}
                            className="arena-card p-5 hover:bg-slate-50/70 transition-all cursor-pointer group hover:border-sapphire-blue/30"
                          >
                            <CardContent className="p-0 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="size-14 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-400 flex items-center justify-center group-hover:bg-sapphire-blue group-hover:text-white transition-all shrink-0">
                                  <Calendar size={24} strokeWidth={1.5} aria-hidden="true" />
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                  <h4 className="font-display font-black text-lg text-primary-navy tracking-tight group-hover:text-sapphire-blue transition-colors truncate">
                                    {t.title}
                                  </h4>
                                  <div className="flex items-center gap-2.5">
                                    <Badge
                                      className={cn(
                                        'font-sans font-black text-xs uppercase tracking-wider px-2.5 py-0.5 border-none',
                                        t.status === 'registering'
                                          ? 'bg-amber-100 text-amber-700'
                                          : t.status === 'ongoing'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                      )}
                                    >
                                      {t.status}
                                    </Badge>
                                    <span className="text-xs font-bold text-slate-400 tabular-nums">
                                      {formatLocalTime(t.created_at, 'yyyy/MM/dd')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ArrowRight size={20} aria-hidden="true" className="text-slate-300 group-hover:text-sapphire-blue group-hover:translate-x-1 transition-all shrink-0" />
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                )}

                {filteredTournaments.length === 0 && (
                  <EmptyState
                    icon={Inbox}
                    title="目前尚無符合賽事"
                    description={`目前沒有狀態為「${
                      tournamentStatusFilter === 'registering' ? '報名中' :
                      tournamentStatusFilter === 'ongoing' ? '進行中' :
                      tournamentStatusFilter === 'all' ? '全部' : '已結束'
                    }」的錦標賽記錄。`}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div
            key={`${activeTab}-${tournamentStatusFilter}`}
            ref={sentinelRef}
            className="w-full flex flex-col items-center justify-center py-8 gap-3 min-h-[60px]"
          >
            <AnimatePresence>
              {hasMore && (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, y: 8 }}
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
                    載入更多賽事...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
