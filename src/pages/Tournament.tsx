import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, ArrowRight, CalendarX, Inbox, Sparkles, Target, Zap, Users, Filter, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { TournamentSkeleton } from '@/components/TournamentSkeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn, formatLocalTime } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';

// Premium Empty State Component
function EmptyState({ icon: Icon, title, description, className }: { icon: any, title: string, description: string, className?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center py-20 px-8 rounded-[3rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/20 relative overflow-hidden group",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="size-24 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-300 mb-8 relative z-10 shadow-inner group-hover:bg-sapphire-blue group-hover:text-white transition-all duration-700 hover:rotate-6"
      >
        <Icon size={44} strokeWidth={1.2} />
        <motion.div 
           animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4], rotate: [0, 15, 0] }}
           transition={{ duration: 4, repeat: Infinity }}
           className="absolute -top-3 -right-3 text-amber-400"
        >
            <Sparkles size={24} fill="currentColor" />
        </motion.div>
      </motion.div>

      <div className="space-y-3 text-center relative z-10">
        <h3 className="font-display font-black text-2xl text-primary-navy tracking-tight uppercase italic">
          {title}
        </h3>
        <p className="text-sm text-slate-400 font-medium max-w-[320px] leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-10 flex gap-3 relative z-10">
          {[1,2,3,4].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-slate-100 group-hover:bg-sapphire-blue/30 transition-all duration-500 group-hover:scale-125" />
          ))}
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

  // Enhanced Filtering Logic for Tournaments
  const filteredTournaments = tournamentList.filter((t: any) => {
    if (tournamentStatusFilter === 'all') return true;
    return t.status === tournamentStatusFilter;
  });

  const displayHeroTournaments = filteredTournaments.filter((t: any) => ['ongoing', 'registering'].includes(t.status));
  const displayStandardTournaments = filteredTournaments.filter((t: any) => !['ongoing', 'registering'].includes(t.status));

  // Filtering Logic for Seasons
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

  // Stable Sentinel Ref using useCallback
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // Only attach the observer if we still have more content to load
    if (node && hasMore) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          setVisibleCount(prev => prev + 6);
        }
      }, { threshold: 0, rootMargin: '50px' }); 
      
      observerRef.current.observe(node);
    }
  }, [isLoading, hasMore, visibleCount]);

  // Color Mapping for Status Filter Buttons (Tailwind JIT safety)
  const filterColors = {
    'all': { bg: 'bg-primary-navy', border: 'border-primary-navy', text: 'text-primary-navy', shadow: 'shadow-primary-navy/20' },
    'registering': { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-500', shadow: 'shadow-amber-500/20' },
    'ongoing': { bg: 'bg-sapphire-blue', border: 'border-sapphire-blue', text: 'text-sapphire-blue', shadow: 'shadow-sapphire-blue/20' },
    'completed': { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500', shadow: 'shadow-emerald-500/20' }
  };

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
          <TournamentSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pb-20 pt-10 md:pt-16 px-6 lg:px-12 space-y-12 bg-white min-h-screen"
        >
          {/* Header Section */}
          <div className="flex flex-col space-y-8 max-w-7xl mx-auto w-full">
            <motion.header variants={fadeInUp} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center">
                <div className="w-2.5 md:w-3.5 bg-linear-to-b from-sapphire-blue to-blue-900 rounded-full h-14 md:h-20 mr-5 md:mr-8 shrink-0 shadow-lg shadow-sapphire-blue/20" />
                <div className="space-y-1.5">
                  <h1 className="text-5xl md:text-6xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none italic">Arena</h1>
                  <p className="text-[11px] md:text-sm text-slate-400 font-sans font-black uppercase tracking-[0.4em] opacity-80 pl-1">Champion's Proving Ground</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-6">
                 {/* Top Level Category Tabs */}
                 <Tabs defaultValue="seasons" className="w-full md:w-fit" onValueChange={(val) => {
                    setActiveTab(val);
                    if (val === 'seasons' && tournamentStatusFilter === 'registering') {
                      setTournamentStatusFilter('all');
                    }
                 }}>
                    <TabsList className="bg-slate-50 p-1.5 rounded-[1.25rem] h-14 md:h-16 w-full md:w-fit grid grid-cols-2 border border-slate-100 shadow-sm font-black">
                      <TabsTrigger 
                        value="seasons" 
                        className={cn(
                          "rounded-[1.1rem] px-10 font-display text-xs uppercase tracking-widest transition-all gap-2.5 outline-none data-[state=active]:bg-white data-[state=active]:text-sapphire-blue data-[state=active]:shadow-xl"
                        )}
                      >
                        <Trophy size={18} />
                        積分賽季
                      </TabsTrigger>
                      <TabsTrigger 
                        value="exclusive" 
                        className={cn(
                          "rounded-[1.1rem] px-10 font-display text-xs uppercase tracking-widest transition-all gap-2.5 outline-none data-[state=active]:bg-white data-[state=active]:text-amber-500 data-[state=active]:shadow-xl"
                        )}
                      >
                        <Target size={18} />
                        獨立錦標賽
                      </TabsTrigger>
                    </TabsList>
                 </Tabs>
              </div>
            </motion.header>

            {/* Global Status Filter Tabs/Chips */}
            <motion.div 
              variants={fadeInUp}
              className="flex items-center gap-3 px-2 py-4 border-y border-slate-100 overflow-x-auto no-scrollbar scroll-smooth"
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
                  <motion.button
                    key={filter.id}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTournamentStatusFilter(filter.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-display font-black text-[10px] md:text-xs uppercase tracking-[0.15em] transition-all border shadow-sm shrink-0 whitespace-nowrap",
                      isActive 
                        ? `${styles.bg} text-white ${styles.border} shadow-xl ${styles.shadow}` 
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600 hover:shadow-md"
                    )}
                  >
                    <filter.icon size={16} className={cn(isActive ? "text-white" : styles.text)} />
                    <span>
                      {filter.cn}
                      <span className="hidden md:inline ml-1 opacity-60">({filter.en})</span>
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Content Tabs */}
            <div className="w-full">
              <Tabs value={activeTab} className="w-full">
                {/* 1. Seasons Content Panel */}
                <TabsContent value="seasons" className="mt-0 focus-visible:outline-none space-y-12">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                       <div className="space-y-1">
                          <h3 className="font-display font-black text-3xl text-primary-navy tracking-tight italic">League Seasons</h3>
                          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest opacity-70">
                            <Zap size={14} className="text-amber-400" />
                            季賽排行榜與階級賽事系統
                          </div>
                       </div>
                       <Badge className="bg-slate-50 text-slate-400 font-sans font-black border-slate-100 px-4 py-1.5 uppercase tracking-tighter shadow-sm">
                          {filteredSeasons.length} Matches
                       </Badge>
                    </div>
                    
                    <motion.div 
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6"
                    >
                      {filteredSeasons.slice(0, visibleCount).map((s: any, idx: number) => (
                        <motion.div key={s.id || idx} variants={itemVariants}>
                          <Card 
                            onClick={() => navigate(`/season/${s.id}`)}
                            className="no-line-card rounded-[2.5rem] bg-white p-8 hover:bg-slate-50/50 transition-all cursor-pointer group shadow-lg shadow-slate-200/20 border border-slate-100 hover:border-sapphire-blue/20 hover:shadow-2xl hover:shadow-sapphire-blue/10 relative overflow-hidden"
                          >
                            <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 text-sapphire-blue">
                                <Trophy size={180} />
                            </div>
                            
                            <div className="flex flex-col space-y-6 relative z-10">
                              <div className="flex items-start justify-between">
                                <div className="size-16 rounded-[1.5rem] bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-sapphire-blue group-hover:text-white transition-all duration-500 shadow-inner group-hover:rotate-6">
                                  <Trophy size={32} strokeWidth={1.5} />
                                </div>
                                <ArrowRight size={24} className="text-slate-100 group-hover:text-sapphire-blue transition-all group-hover:translate-x-3" />
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-display font-black text-2xl text-primary-navy tracking-tight group-hover:text-sapphire-blue transition-colors">
                                  {s.name}
                                </h4>
                                
                                <div className="flex items-center gap-3">
                                  <Badge className={cn(
                                      "text-[10px] uppercase font-sans tracking-widest px-3 py-1 border-none font-black shadow-lg",
                                      s.status === 'active' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-slate-400 text-white shadow-slate-400/20"
                                  )}>
                                      {s.status === 'active' ? '● Active' : 'Completed'}
                                  </Badge>
                                  <div className="size-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] font-sans font-black text-slate-400 uppercase tracking-widest opacity-60">Official Season</span>
                                </div>

                                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100 mt-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70">
                                      {formatLocalTime(s.start_date, 'yyyy/MM/dd')} - {formatLocalTime(s.end_date, 'yyyy/MM/dd')}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70">
                                      <Users size={12} className="text-emerald-500" />
                                      {s.participants_count || 0} 參與者
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                    
                    {filteredSeasons.length === 0 && (
                      <div className="col-span-full">
                        <EmptyState 
                          icon={CalendarX} 
                          title="尚無對應賽季資料" 
                          description={
                            tournamentStatusFilter === 'all' 
                              ? "目前系統中還沒有官方賽季記錄。"
                              : `目前沒有狀態為「${
                                  tournamentStatusFilter === 'ongoing' ? '進行中' :
                                  tournamentStatusFilter === 'completed' ? '已結束' : '報名中'
                                }」的賽季資料。`
                          }
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* 2. Exclusive Tournaments Content Panel */}
                <TabsContent value="exclusive" className="mt-0 focus-visible:outline-none space-y-12">
                   {/* Ongoing Hero Section */}
                   {displayHeroTournaments.length > 0 && (
                     <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <div className="flex items-center justify-between px-2">
                          <div className="space-y-1">
                            <h3 className="font-display font-black text-3xl text-primary-navy tracking-tight italic">Live Now</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider opacity-60">熱門活動進行中</p>
                          </div>
                        </div>
                        {displayHeroTournaments.map((t: any, idx: number) => (
                          <motion.section 
                            key={t.id || idx} 
                            variants={fadeInUp}
                            onClick={() => navigate(`/tournament/${t.id}`)} 
                            className="cursor-pointer group"
                          >
                            <div className="bg-[#111c2d] rounded-[3.5rem] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl border border-[#1a2b45] hover:border-sapphire-blue/40 transition-all duration-700">
                              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-sapphire-blue/20 to-transparent skew-x-[-20deg] translate-x-20 group-hover:translate-x-0 transition-transform duration-1000" />
                              <div className="absolute top-0 right-0 p-12 opacity-15 group-hover:opacity-30 group-hover:scale-110 transition-all duration-1000">
                                <Trophy size={180} strokeWidth={1} />
                              </div>
                              
                              <div className="relative z-10 space-y-8">
                                <Badge className="bg-olympic-gold text-white text-[10px] uppercase font-sans font-black tracking-[.2em] px-6 py-2 border-none animate-pulse">
                                  Official Live
                                </Badge>

                                <div className="space-y-4">
                                  <h2 className="text-4xl md:text-6xl font-display font-black tracking-tighter italic">
                                    {t.title}
                                  </h2>
                                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-[11px] font-sans font-black opacity-60 uppercase tracking-[0.2em]">
                                    <span className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                      <Calendar size={18} className="text-sapphire-blue" />
                                      {formatLocalTime(t.created_at, 'yyyy/MM/dd')}
                                    </span>
                                    <span className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                      <Trophy size={18} className="text-olympic-gold" />
                                      Elite Exclusive
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-4">
                                   <div className="inline-flex items-center gap-6 px-12 py-5 bg-sapphire-blue text-white rounded-3xl font-sans font-black text-xs uppercase tracking-[0.3em] shadow-lg group-hover:bg-blue-600 transition-all">
                                      Enter Arena
                                      <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                   </div>
                                </div>
                              </div>
                            </div>
                          </motion.section>
                        ))}
                     </div>
                   )}

                   {/* Tournament Log Section */}
                   {displayStandardTournaments.length > 0 && (
                     <div className="space-y-8">
                        <div className="flex items-center justify-between px-2">
                          <div className="space-y-1">
                            <h3 className="font-display font-black text-3xl text-primary-navy tracking-tight">{tournamentStatusFilter === 'all' ? 'Tournament Log' : 'Filtered Results'}</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider opacity-60">
                               {tournamentStatusFilter === 'all' ? '歷史與一般錦標賽記錄' : '篩選後的賽事清單'}
                            </p>
                          </div>
                        </div>
                        <motion.div 
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="grid grid-cols-1 2xl:grid-cols-2 gap-5"
                        >
                          {displayStandardTournaments.slice(0, visibleCount).map((t: any, idx: number) => (
                            <motion.div key={t.id || idx} variants={itemVariants}>
                              <Card 
                                onClick={() => navigate(`/tournament/${t.id}`)}
                                className="no-line-card rounded-[2.5rem] bg-white p-6 hover:bg-slate-50 transition-all cursor-pointer group shadow-lg shadow-slate-200/10 border border-slate-100 hover:border-sapphire-blue/20"
                              >
                                <CardContent className="p-0 flex items-center justify-between">
                                  <div className="flex items-center gap-7">
                                    <div className="size-20 rounded-[2rem] bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-sapphire-blue group-hover:text-white transition-all duration-500 group-hover:rotate-6">
                                      <Calendar size={32} strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-2">
                                      <h4 className="font-display font-black text-2xl text-primary-navy tracking-tight group-hover:text-sapphire-blue transition-colors italic">{t.title}</h4>
                                      <div className="flex items-center gap-3">
                                          <Badge className={cn(
                                            "font-sans font-black text-[9px] uppercase tracking-widest px-3 py-1 border-none",
                                            t.status === 'registering' ? "bg-amber-100 text-amber-600" : 
                                            t.status === 'ongoing' ? "bg-blue-100 text-blue-600" : 
                                            "bg-emerald-100 text-emerald-600"
                                          )}>
                                              {t.status}
                                          </Badge>
                                          <div className="size-1 rounded-full bg-slate-200" />
                                          <p className="text-[10px] uppercase font-sans tracking-widest text-slate-400 font-black opacity-80">
                                              {formatLocalTime(t.created_at, 'yyyy/MM/dd')}
                                          </p>
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowRight size={24} className="text-slate-100 group-hover:text-sapphire-blue group-hover:translate-x-2 transition-all mr-2" />
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </motion.div>
                     </div>
                   )}

                   {/* Master Empty State for Exclusive Tab */}
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

            {/* Infinite Scroll Sentinel & Loading Indicator */}
            <div 
              key={`${activeTab}-${tournamentStatusFilter}`}
              ref={sentinelRef} 
              className="w-full flex flex-col items-center justify-center py-16 gap-4 min-h-[100px]"
            >
               <AnimatePresence>
                 {hasMore && (
                    <motion.div 
                      key="loader"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                           <motion.div 
                             key={i}
                             animate={{ 
                               scale: [1, 1.5, 1],
                               opacity: [0.3, 1, 0.3],
                             }}
                             transition={{ 
                               duration: 1, 
                               repeat: Infinity, 
                               delay: i * 0.2 
                             }}
                             className="size-2.5 rounded-full bg-sapphire-blue shadow-[0_0_15px_rgba(15,82,186,0.4)]"
                           />
                        ))}
                      </div>
                      <span className="text-[10px] font-display font-black uppercase tracking-[0.4em] text-slate-400 italic">
                         Syncing Arena Data...
                      </span>
                    </motion.div>
                 )}
               </AnimatePresence>
               
               {!hasMore && (activeTab === 'seasons' ? filteredSeasons.length > 0 : filteredTournaments.length > 0) && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="flex flex-col items-center gap-4 py-8"
                  >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-px bg-gradient-to-r from-transparent to-slate-200" />
                        <Trophy size={14} className="text-slate-300" />
                        <div className="w-12 h-px bg-gradient-to-l from-transparent to-slate-200" />
                     </div>
                     <span className="text-[9px] font-display font-bold uppercase tracking-[0.6em] text-slate-300">
                        Glory Awaits the Vigilant
                     </span>
                  </motion.div>
               )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
