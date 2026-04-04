import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RankingCard } from '@/components/RankingCard';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MatchItem } from '@/components/MatchItem';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Search, Skull, Crown, ChevronLeft, ChevronRight, Trophy, Info, Timer, History, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PendingActions } from '@/components/PendingActions';
import { UserProfileSettings } from '@/components/UserProfileSettings';
import { useAuthStore } from '@/store/authStore';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';

// 📢 公告假資料
const announcements = [
  {
    id: '1',
    type: 'tournament',
    title: '2026 春季長官盃雙打邀請賽，現正開放登記！',
    description: '本季最大型賽事即將開打，請於本週五前完成搭檔登記與報名。',
    tag: '特殊賽事',
    urgency: 'high',
    actionText: '立即前往報名',
    date: '2天後截止'
  },
  {
    id: '2',
    type: 'system',
    title: '全新常態天梯制上線：免報名，隨時開打！',
    description: '中午吃完飯直接找人切磋，點擊右下角「+」送出比分，系統自動將您納入本季排行。',
    tag: '系統公告',
    urgency: 'normal',
    actionText: '了解天梯規則',
    date: '剛剛發布'
  }
];

function AnnouncementBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const current = announcements[currentIndex];

  const nextMsg = () => setCurrentIndex((prev) => (prev + 1) % announcements.length);
  const prevMsg = () => setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <section>
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="bg-primary-navy rounded-4xl p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl shadow-primary-navy/20 relative overflow-hidden group"
      >
        <div className="absolute -right-10 -top-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
          {current.type === 'tournament' ? <Trophy size={250} /> : <Info size={250} />}
        </div>

        <div className="flex items-start md:items-center gap-4 md:gap-6 relative z-10 flex-1 w-full">
          <div className={cn(
            "size-12 md:size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
            current.type === 'tournament' ? "bg-olympic-gold text-white shadow-olympic-gold/20" : "bg-sapphire-blue text-white shadow-sapphire-blue/20"
          )}>
            {current.type === 'tournament' ? <Trophy size={28} /> : <Info size={28} />}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-widest",
                current.type === 'tournament' ? "bg-olympic-gold/20 text-amber-400" : "bg-sapphire-blue/20 text-blue-300"
              )}>
                {current.tag}
              </span>
              {current.type === 'tournament' && (
                <span className="flex items-center gap-1 text-amber-400/80 text-[11px] font-bold">
                  <Timer size={12} /> {current.date}
                </span>
              )}
            </div>
            <h3 className="text-base md:text-xl font-display font-black text-white tracking-wide leading-tight truncate">
              {current.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-300 font-medium line-clamp-1 md:line-clamp-2">
              {current.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4 relative z-10 shrink-0 border-t border-white/10 md:border-none pt-4 md:pt-0">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-1.5 mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onClick={prevMsg} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/5 shadow-lg backdrop-blur-md">
                <ChevronLeft size={18} strokeWidth={3} />
              </button>
              <button onClick={nextMsg} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/5 shadow-lg backdrop-blur-md">
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>
            <Button className={cn(
              "flex-1 md:flex-none h-12 md:h-14 px-6 md:px-8 rounded-xl font-black text-sm tracking-widest transition-all active:scale-95 gap-2 border-none",
              current.type === 'tournament'
                ? "bg-olympic-gold hover:bg-amber-400 text-primary-navy shadow-lg shadow-olympic-gold/20"
                : "bg-white hover:bg-slate-100 text-primary-navy shadow-lg shadow-white/10"
            )}>
              {current.actionText}
              <ChevronRight size={18} strokeWidth={3} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [recentFeed, setRecentFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myStats, setMyStats] = useState<any>(null);
  const [chartInterval, setChartInterval] = useState<string>('recent');
  const [rivals, setRivals] = useState<{ nemesis: any[], minions: any[] }>({ nemesis: [], minions: [] });
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('match_updated', handleUpdate);
    return () => window.removeEventListener('match_updated', handleUpdate);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) {
        setFeedLoading(false);
        return;
      }

      try {
        const feedRes = await fetch("http://localhost:8000/api/matches/recent", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (feedRes.ok) setRecentFeed(await feedRes.json());

        const rivalsRes = await fetch("http://localhost:8000/api/users/me/rivals", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (rivalsRes.ok) setRivals(await rivalsRes.json());

        const leaderRes = await fetch("http://localhost:8000/api/leaderboard");
        if (leaderRes.ok) {
          const leaderData = await leaderRes.json();
          const mapped = (leaderData.leaderboard || []).slice(0, 3).map((p: any) => ({
            id: p.player_id,
            name: p.player_name,
            username: p.player_name,
            rank: p.rank,
            rating: Math.round(p.season_lp),
            mmr: p.global_mmr ? Math.round(p.global_mmr) : Math.round(p.season_lp),
            avatar: p.avatar_url || '/api/placeholder/150/150',
            isVerified: p.rank <= 2,
            department: p.department,
            stats: {
              wins: p.wins,
              losses: p.matches_played - p.wins,
              winRate: parseFloat(p.win_rate),
              avgScore: 0,
            },
          }));
          setTopPlayers(mapped);
        }
      } catch (err) {
        console.error("無法連線後端抓取資料", err);
      } finally {
        setFeedLoading(false);
      }
    };

    fetchDashboardData();
  }, [refreshTrigger]);

  useEffect(() => {
    const fetchStats = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) return;
      try {
        const statsRes = await fetch(`http://localhost:8000/api/users/me/stats?interval=${chartInterval}`, {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (statsRes.ok) setMyStats(await statsRes.json());
      } catch (err) {
        console.error("無法分析戰力資料", err);
      }
    };
    fetchStats();
  }, [chartInterval, refreshTrigger]);

  return (
    <AnimatePresence mode="wait">
      {feedLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DashboardSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-12 bg-white relative"
        >
          <motion.header variants={fadeInUp} className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl md:text-5xl text-primary-navy font-display tracking-tight font-black uppercase italic">
                {user.name}
              </h1>
              <div className="flex items-center gap-2 text-primary-slate text-sm font-sans font-bold opacity-60">
                <Timer size={14} /> Welcome Back · Season 4
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden md:block">
                <UserProfileSettings 
                  trigger={
                    <Button variant="ghost" size="icon" className="size-14 rounded-2xl bg-slate-50 shadow-sm border border-slate-100 hover:bg-slate-100 transition-all p-0 overflow-hidden">
                       <img src={user.avatar} className="size-full object-cover" />
                    </Button>
                  }
                />
              </div>
              <Button
                variant="ghost" 
                size="icon" 
                className="size-10 md:size-14 rounded-xl md:rounded-2xl bg-slate-50 shadow-sm border border-slate-100 hover:bg-slate-100 transition-colors relative"
              >
                <div className="absolute top-3 right-3 size-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                <Bell size={22} className="text-primary-navy" />
              </Button>
            </div>
          </motion.header>

          <motion.div variants={fadeInUp}>
             <AnnouncementBanner />
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 md:gap-16 items-start">
            <div className="xl:col-span-8 space-y-16">
              
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-16">
                <motion.div variants={itemVariants}><PendingActions /></motion.div>

                <motion.section variants={itemVariants}>
                  <RankingCard player={{
                    id: user.id,
                    name: user.name,
                    username: user.username || user.name,
                    avatar: user.avatar,
                    isVerified: user.isVerified,
                    department: user.department,
                    rating: myStats?.season_lp || 1200,
                    mmr: myStats?.global_mmr || user.mmr || 1200,
                    rank: myStats?.rank || '-',
                    stats: {
                      winRate: myStats?.win_rate || "0%",
                      wins: myStats?.wins || 0,
                      losses: myStats?.losses || 0,
                      avgScore: 0
                    }
                  }} variant="featured" />
                </motion.section>

                <motion.section variants={itemVariants} className="bg-[#fbfcff] p-6 md:p-8 rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden min-h-[400px]">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                    <div>
                      <h4 className="font-display text-xl text-primary-navy font-black tracking-tight">Performance Analytics</h4>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-sans font-black tracking-widest opacity-60">MMR Progression · Season Stats</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tabs value={chartInterval} onValueChange={setChartInterval} className="w-full sm:w-auto">
                        <TabsList className="grid w-full grid-cols-5 h-9 bg-slate-100/80 rounded-xl p-1">
                          <TabsTrigger value="recent" className="text-[10px] font-bold uppercase tracking-wider rounded-lg">10場</TabsTrigger>
                          <TabsTrigger value="hour" className="text-[10px] font-bold uppercase tracking-wider rounded-lg">小時</TabsTrigger>
                          <TabsTrigger value="day" className="text-[10px] font-bold uppercase tracking-wider rounded-lg">日</TabsTrigger>
                          <TabsTrigger value="month" className="text-[10px] font-bold uppercase tracking-wider rounded-lg">月</TabsTrigger>
                          <TabsTrigger value="quarter" className="text-[10px] font-bold uppercase tracking-wider rounded-lg">季</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                  <StatsChart
                    showCard={false}
                    showHeader={false}
                    data={myStats?.chart_data || []}
                  />
                </motion.section>

                <motion.section variants={itemVariants} className="space-y-8">
                  <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                      <h2 className="text-2xl text-primary-navy font-display font-black tracking-tight">Recent Feed</h2>
                      <p className="text-[10px] text-slate-400 uppercase font-sans font-black tracking-widest opacity-60">Match History · Live Updates</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-xs font-black uppercase tracking-widest text-sapphire-blue hover:bg-sapphire-blue/5 rounded-xl px-4"
                      onClick={() => navigate('/history')}
                    >
                      View All
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {recentFeed.length > 0 ? (
                      recentFeed.map((match: any) => (
                        <div key={match.id} className="transform transition-all active:scale-[0.98]">
                          <MatchItem match={match} />
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 bg-slate-50/50 rounded-4xl border border-dashed border-slate-100">
                        <History size={32} className="mx-auto text-slate-200 mb-4 opacity-20" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">目前還沒有對戰紀錄</p>
                      </div>
                    )}
                  </div>
                </motion.section>

                <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="rounded-[2.5rem] bg-red-50/40 p-8 border border-red-100/50 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
                        <Skull size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-display font-black text-primary-navy">Nemesis</h3>
                    </div>
                    <div className="space-y-3">
                      {rivals.nemesis.length > 0 ? rivals.nemesis.map((item: any) => (<RivalRow key={item.id} {...item} type="nemesis" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無天敵資料</p>)}
                    </div>
                  </div>
                  <div className="rounded-[2.5rem] bg-green-50/40 p-8 border border-green-100/50 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/20">
                        <Crown size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-display font-black text-primary-navy">Minions</h3>
                    </div>
                    <div className="space-y-3">
                      {rivals.minions.length > 0 ? rivals.minions.map((item: any) => (<RivalRow key={item.id} {...item} type="minions" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無提款機資料</p>)}
                    </div>
                  </div>
                </motion.section>
              </motion.div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="xl:col-span-4 space-y-16"
            >
              <motion.section variants={itemVariants} className="space-y-8">
                <div className="flex items-center justify-between px-1">
                  <div className="space-y-1">
                    <h2 className="text-2xl text-primary-navy font-display font-black tracking-tight">Top Rivals</h2>
                    <p className="text-[10px] text-slate-400 uppercase font-sans font-black tracking-widest opacity-60">Hall of Fame · Global MMR</p>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full bg-slate-50 text-primary-navy" onClick={() => navigate('/leaderboard')}>
                    <ArrowRight size={18} />
                  </Button>
                </div>
                <div className="space-y-4">
                  {topPlayers.length > 0 ? topPlayers.map(player => (
                    <div key={player.id} className="group cursor-pointer transform transition-all active:scale-[0.98]" onClick={() => navigate(`/leaderboard?inspect=${player.id}`)}>
                      <RankingCard player={player} />
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-slate-50/50 rounded-4xl border border-dashed border-slate-100">
                      <Search size={32} className="mx-auto text-slate-200 mb-4 opacity-20" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">載入中...</p>
                    </div>
                  )}
                  <Button onClick={() => navigate('/leaderboard')} className="w-full bg-white hover:bg-slate-50 text-primary-navy border border-slate-100 py-7 rounded-3xl font-sans font-black text-xs uppercase tracking-[0.2em]">
                    View Global Board
                  </Button>
                </div>
              </motion.section>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RivalRow({ name, avatar, winRate, matches, pointsExchanged, type }: any) {
  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100/50 group hover:shadow-md transition-all">
      <img src={avatar || '/api/placeholder/150/150'} referrerPolicy="no-referrer" alt={name} className="size-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-100" />
      <div className="flex-1 flex flex-col">
        <span className="font-sans font-black text-primary-navy text-sm">{name}</span>
        <span className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
          {matches} 次 • {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} LP
        </span>
      </div>
      <span className={cn("font-display font-black text-lg", type === 'nemesis' ? 'text-red-500' : 'text-green-500')}>
        {winRate}%
      </span>
    </div>
  );
}
