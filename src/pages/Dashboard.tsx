import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RankingCard } from '@/components/RankingCard';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MatchItem } from '@/components/MatchItem';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Search, Skull, Crown, ChevronLeft, ChevronRight, Trophy, Info, Timer, Medal, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PendingActions } from '@/components/PendingActions';
import { UserProfileSettings } from '@/components/UserProfileSettings';
import { useAuthStore } from '@/store/authStore';

// 📢 公告假資料 (未來可由 FastAPI 後端提供)
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

// 📢 智慧動態輪播看板元件
function AnnouncementBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const current = announcements[currentIndex];


  const nextMsg = () => setCurrentIndex((prev) => (prev + 1) % announcements.length);
  const prevMsg = () => setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);

  // 🌟 強制啟動：自動輪播邏輯 (5秒切換一次，具備滑鼠移入暫停)
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

        {/* 背景奧運風裝飾浮水印 */}
        <div className="absolute -right-10 -top-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
          {current.type === 'tournament' ? <Trophy size={250} /> : <Info size={250} />}
        </div>

        {/* 左側：內容區 */}
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

        {/* 右側：按鈕與控制區 */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4 relative z-10 shrink-0 border-t border-white/10 md:border-none pt-4 md:pt-0">

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* 桌機版切換按鈕：直接放在主按鈕旁邊，避免被裁切 */}
            <div className="hidden md:flex items-center gap-1.5 mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onClick={prevMsg} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/5 shadow-lg backdrop-blur-md">
                <ChevronLeft size={18} strokeWidth={3} />
              </button>
              <button onClick={nextMsg} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/5 shadow-lg backdrop-blur-md">
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>

            {/* 手機版切換按鈕：維持原本位置 */}
            <div className="flex md:hidden items-center gap-1">
              <button onClick={prevMsg} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMsg} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <ChevronRight size={16} />
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

        {/* 底部輪播進度指示器 (Dots) */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {announcements.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/20"
              )}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

export function Dashboard() {
  const [rivalMode, setRivalMode] = useState<'singles' | 'doubles'>('singles');

  // 🌟 從倉庫拿取全域的使用者資料
  const { user } = useAuthStore();

  // 🌟 本地狀態：儲存最新的比賽陣列
  const [recentFeed, setRecentFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  // 🌟 用來存戰力資料的 State
  const [myStats, setMyStats] = useState<any>(null);
  const [chartInterval, setChartInterval] = useState<string>('recent'); // 🌟 新增：目前選中的圖表維度
  // 🌟 用來裝天敵與提款機的狀態
  const [rivals, setRivals] = useState<{ nemesis: any[], minions: any[] }>({ nemesis: [], minions: [] });
  // 🌟 新增：用來裝黃金搭檔與豬隊友的狀態
  const [partners, setPartners] = useState<{ golden_partners: any[], worst_partners: any[] }>({ golden_partners: [], worst_partners: [] });
  // 🌟 新增：從後端排行榜API抓Top Rivals
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  // 🌟 1. 新增一個「重新整理觸發器」
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🌟 2. 加入全域事件監聽，當聽到 'match_updated' 時，觸發器 +1
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
        // 抓取 Recent Feed (原本的)
        const feedRes = await fetch("http://localhost:8000/api/matches/recent", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (feedRes.ok) setRecentFeed(await feedRes.json());

        // 🌟 2. 抓取我的戰力指標與折線圖資料
        const statsRes = await fetch("http://localhost:8000/api/users/me/stats", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (statsRes.ok) setMyStats(await statsRes.json());

        // 🌟 2. 新增：抓取宿命對決資料
        const rivalsRes = await fetch("http://localhost:8000/api/users/me/rivals", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (rivalsRes.ok) setRivals(await rivalsRes.json());

        // 🌟 3. 新增：抓取搭檔資料
        const partnersRes = await fetch("http://localhost:8000/api/users/me/partners", {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (partnersRes.ok) setPartners(await partnersRes.json());

        // 🌟 4. 抓取排行榜 Top 3 (替代前端 mockData)
        const leaderRes = await fetch("http://localhost:8000/api/leaderboard");
        if (leaderRes.ok) {
          const leaderData = await leaderRes.json();
          // 把後端格式轉成 RankingCard 元件需要的格式
          const mapped = (leaderData.leaderboard || []).slice(0, 3).map((p: any) => ({
            id: p.player_id,
            name: p.player_name,
            username: p.player_name,
            rank: p.rank,
            rating: Math.round(p.season_lp), // 直接使用後端回傳的賽季積分 (已包含基礎分)
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

  // 🌟 將抓取 Stats 的邏輯獨立出來，並監聽 chartInterval 的變化
  useEffect(() => {
    const fetchStats = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) return;
      try {
        // 發送帶有 interval 參數的請求
        const statsRes = await fetch(`http://localhost:8000/api/users/me/stats?interval=${chartInterval}`, {
          headers: { "Authorization": `Bearer ${savedToken}` }
        });
        if (statsRes.ok) setMyStats(await statsRes.json());
      } catch (err) {
        console.error("無法連線後端抓取資料", err);
      }
    };
    fetchStats();
  }, [chartInterval, refreshTrigger]); // 當按鈕切換時，自動重新 Fetch

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
          key="dashboard"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
              },
            },
          }}
          className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 bg-white"
        >
          {/* Header - Desktop Optimized */}
          <motion.header
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 }
            }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl md:text-5xl text-primary-navy font-display tracking-tight font-black">{user.name}</h1>
              <p className="text-sm md:text-base text-slate-500 mt-2 uppercase tracking-[0.2em] font-sans font-bold">Season 4 • Week 12 • Active</p>
            </div>
            {/* Dashboard Header 替換右側按鈕區 */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" className="hidden md:flex rounded-2xl bg-slate-50 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all p-6">
                <Search size={22} className="text-primary-navy" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-xl md:rounded-2xl bg-slate-50 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all md:p-6 relative">
                <Bell size={20} className="md:size-22 text-primary-navy" />
                <span className="absolute top-2 right-2 md:top-4 md:right-4 size-2.5 md:size-3 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
              </Button>

              {/* 手機版專屬：右上角個人設定入口 */}
              <div className="lg:hidden ml-1">
                <UserProfileSettings
                  trigger={
                    <button className="size-10 rounded-xl overflow-hidden border-2 border-slate-200 active:scale-95 transition-all shadow-sm">
                      <img src={user.avatar} alt={user.name} className="size-full object-cover" />
                    </button>
                  }
                />
              </div>
            </div>
          </motion.header>

          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.98 },
              show: { opacity: 1, scale: 1 }
            }}
          >
            {/* 🚀 插入全新的社團公告輪播區塊 */}
            <AnnouncementBanner />
          </motion.div>

          {/* Main Responsive Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12">

            {/* Left Column: Stats & Hero (8 cols) */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: -10 },
                show: { opacity: 1, x: 0 }
              }}
              className="xl:col-span-8 space-y-10"
            >

              {/* Pending Actions (High Priority) */}
              <PendingActions />

              <section className="transform transition-transform hover:scale-[1.01] duration-500">
                <RankingCard player={{
                  ...user,
                  rating: myStats?.lp || 1200, // 本季 LP
                  mmr: user.mmr || 1200,      // 生涯 MMR
                  rank: myStats?.rank || '-',
                  stats: {
                    winRate: myStats?.win_rate || "0%",
                    wins: myStats?.wins || 0,
                    losses: myStats?.losses || 0,
                    trend: myStats?.trend || "new"
                  }
                }} variant="featured" />
              </section>

              {/* 🌟 圖表區塊 */}
              <section className="bg-[#fbfcff] p-6 md:p-8 rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden min-h-[400px]">
                {/* 🌟 自訂的 Header 與控制列 */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                  <div>
                    <h4 className="font-display text-xl text-primary-navy">Performance Analytics</h4>
                    <p className="text-xs text-slate-500 mt-1 font-sans">MMR Progression</p>
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
                    <div className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 hidden sm:block",
                      (myStats?.pts_change || 0) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                    )}>
                      {myStats?.pts_change > 0 ? `+${myStats?.pts_change}` : myStats?.pts_change} PTS
                    </div>
                  </div>
                </div>
                <StatsChart
                  showCard={false}
                  showHeader={false}
                  data={myStats?.chart_data || []}
                />
              </section>

              {/* Recent Matches Feed */}
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <h2 className="text-xl md:text-2xl text-primary-navy font-display font-bold px-2">Recent Feed</h2>
                  <Button variant="link" className="text-sapphire-blue text-xs font-black uppercase tracking-[0.2em] p-0 h-auto">History</Button>
                </div>
                <div className="space-y-4">
                  {recentFeed.length > 0 ? (
                    recentFeed.map((match: any) => (
                      <div key={match.id} className="transform transition-all active:scale-[0.98]">
                        <MatchItem match={match} />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">目前還沒有人開打</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Nemesis & Partners... keeping original layout here */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 👿 Nemesis Card */}
                <div className="rounded-[2.5rem] bg-red-50/40 p-8 border border-red-100/50 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
                      <Skull size={24} className="text-white" />
                    </div>
                    <div><h3 className="text-xl font-display font-black text-primary-navy">天敵 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Nemesis</span></h3></div>
                  </div>
                  <div className="space-y-3">
                    {rivals.nemesis.length > 0 ? rivals.nemesis.map((item: any) => (<RivalRow key={item.id} {...item} type="nemesis" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無天敵資料</p>)}
                  </div>
                </div>
                {/* 👑 Minions Card */}
                <div className="rounded-[2.5rem] bg-green-50/40 p-8 border border-green-100/50 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/20">
                      <Crown size={24} className="text-white" />
                    </div>
                    <div><h3 className="text-xl font-display font-black text-primary-navy">手下敗將 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Minions</span></h3></div>
                  </div>
                  <div className="space-y-3">
                    {rivals.minions.length > 0 ? rivals.minions.map((item: any) => (<RivalRow key={item.id} {...item} type="minions" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無提款機資料</p>)}
                  </div>
                </div>
              </section>

              {/* Partners Section */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                {/* 🌟 Golden Partner Card */}
                <div className="rounded-[2.5rem] bg-amber-50/40 p-8 border border-amber-100/50 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Medal size={24} className="text-white" />
                    </div>
                    <div><h3 className="text-xl font-display font-black text-primary-navy">黃金搭檔 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Golden</span></h3></div>
                  </div>
                  <div className="space-y-3">
                    {partners.golden_partners.length > 0 ? partners.golden_partners.map((item: any) => (<PartnerRow key={item.id} {...item} type="golden" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無黃金搭檔資料</p>)}
                  </div>
                </div>
                {/* 🐷 Worst Partner Card */}
                <div className="rounded-[2.5rem] bg-slate-100/60 p-8 border border-slate-200/50 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-slate-600 flex items-center justify-center shadow-lg shadow-slate-600/20">
                      <Shield size={24} className="text-white" />
                    </div>
                    <div><h3 className="text-xl font-display font-black text-primary-navy">豬隊友 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Worst</span></h3></div>
                  </div>
                  <div className="space-y-3">
                    {partners.worst_partners.length > 0 ? partners.worst_partners.map((item: any) => (<PartnerRow key={item.id} {...item} type="worst" />)) : (<p className="text-sm text-slate-400 font-bold text-center py-4">尚無豬隊友資料</p>)}
                  </div>
                </div>
              </section>

            </motion.div>

            {/* Right Column: Secondary Info (4 cols) */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 10 },
                show: { opacity: 1, x: 0 }
              }}
              className="xl:col-span-4 space-y-10"
            >
              {/* Top Competition */}
              <section className="space-y-6 pt-0">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <h2 className="text-xl text-primary-navy font-display font-bold">Top Rivals</h2>
                  <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setRivalMode('singles')} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", rivalMode === 'singles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600")}>Singles</button>
                    <button onClick={() => setRivalMode('doubles')} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", rivalMode === 'doubles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600")}>Doubles</button>
                  </div>
                </div>
                <div className="space-y-4">
                  {topPlayers.length > 0 ? topPlayers.map(player => (
                    <div key={player.id} className="hover:translate-x-1 transition-transform">
                      <RankingCard player={player} mode={rivalMode} />
                    </div>
                  )) : (<div className="text-center py-6 text-slate-400 font-bold text-sm uppercase tracking-widest">排行榜載入中...</div>)}
                  <Button className="w-full bg-slate-50 hover:bg-slate-100 text-primary-navy border border-slate-100/50 py-7 rounded-3xl font-sans font-black text-xs uppercase tracking-widest">Full Member List</Button>
                </div>
              </section>
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
      {/* 加上 referrerPolicy 防 Google 擋圖 */}
      <img src={avatar || '/api/placeholder/150/150'} referrerPolicy="no-referrer" alt={name} className="size-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-100" />

      <div className="flex-1 flex flex-col">
        <span className="font-sans font-black text-primary-navy text-sm">{name}</span>
        {/* 🌟 新增副標題：顯示恩怨明細 */}
        <span className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
          交手 {matches} 次 • {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} LP
        </span>
      </div>

      <span className={cn(
        "font-display font-black text-lg",
        type === 'nemesis' ? 'text-red-500' : 'text-green-500'
      )}>
        {winRate}% <span className="text-sm uppercase text-slate-500 ml-1">WR</span>
      </span>
    </div>
  );
}

function PartnerRow({ name, avatar, winRate, matches, pointsExchanged, type }: any) {
  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100/50 group hover:shadow-md transition-all">
      <img src={avatar || '/api/placeholder/150/150'} referrerPolicy="no-referrer" alt={name} className="size-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-100" />

      <div className="flex-1 flex flex-col">
        <span className="font-sans font-black text-primary-navy text-sm">{name}</span>
        <span className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">
          搭檔 {matches} 次 • {pointsExchanged > 0 ? `+${pointsExchanged}` : pointsExchanged} LP
        </span>
      </div>

      <span className={cn(
        "font-display font-black text-lg",
        type === 'golden' ? 'text-amber-500' : 'text-slate-600'
      )}>
        {winRate}% <span className="text-sm uppercase text-slate-500 ml-1">WR</span>
      </span>
    </div>
  );
}
