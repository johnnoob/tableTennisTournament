import { useState, useEffect } from 'react';
import { currentUser, players, matches, nemesis, minions } from '@/data/mockData';
import type { Match, RivalryItem } from '@/data/mockData';
import { RankingCard } from '@/components/RankingCard';
import { MatchItem } from '@/components/MatchItem';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { Bell, Search, Plus, Skull, Crown, ChevronLeft, ChevronRight, Trophy, Info, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportScore } from '@/components/ReportScore';
import { PendingActions } from '@/components/PendingActions';

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
    <section className="animate-in fade-in slide-in-from-left-4 duration-1000 delay-150">
      <div 
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="bg-primary-navy rounded-[2rem] p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl shadow-primary-navy/20 relative overflow-hidden group"
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
  
  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white">
      
      {/* Header - Desktop Optimized */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-5xl text-primary-navy font-display tracking-tight font-black">Overview</h1>
          <p className="text-sm md:text-base text-slate-500 mt-2 uppercase tracking-[0.2em] font-sans font-bold">Season 4 • Week 12 • Active</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-2xl bg-slate-50 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all p-6">
            <Search size={22} className="text-primary-navy" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-2xl bg-slate-50 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all p-6 relative">
            <Bell size={22} className="text-primary-navy" />
            <span className="absolute top-4 right-4 size-3 bg-olympic-gold rounded-full border-[3px] border-white shadow-sm" />
          </Button>
        </div>
      </header>
      
      {/* 🚀 插入全新的社團公告輪播區塊 */}
      <AnnouncementBanner />

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12">
        
        {/* Left Column: Stats & Hero (8 cols) */}
        <div className="xl:col-span-8 space-y-10">
          
          {/* Pending Actions (High Priority) */}
          <PendingActions />

          <section className="transform transition-transform hover:scale-[1.01] duration-500">
             <RankingCard player={currentUser} variant="featured" />
          </section>

          <section className="bg-[#fbfcff] p-6 md:p-8 rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden min-h-[400px]">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl md:text-2xl text-primary-navy font-display font-bold px-2">MMR Trend</h2>
               <div className="flex gap-2">
                 {['1W', '1M', '3M', 'ALL'].map(tab => (
                   <Button key={tab} variant="ghost" className="text-xs font-black h-8 px-3 rounded-lg hover:bg-white hover:shadow-sm">
                     {tab}
                   </Button>
                 ))}
               </div>
             </div>
             <StatsChart />
          </section>

          {/* Recent Matches Feed - Moved to main column for full width */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-xl md:text-2xl text-primary-navy font-display font-bold px-2">Recent Feed</h2>
              <Button variant="link" className="text-sapphire-blue text-xs font-black uppercase tracking-[0.2em] p-0 h-auto">History</Button>
            </div>
            <div className="space-y-4">
              {matches.slice(0, 3).map((match: Match) => (
                <div key={match.id} className="transform transition-all active:scale-[0.98]">
                  <MatchItem match={match} />
                </div>
              ))}
            </div>
          </section>

          {/* New Section: Rivalry Insights (Nemesis & Minions) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Nemesis Card */}
             <div className="rounded-[2.5rem] bg-red-50/40 p-8 border border-red-100/50 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
                      <Skull size={24} className="text-white" />
                   </div>
                   <div>
                      <h3 className="text-xl font-display font-black text-primary-navy">天敵 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Nemesis</span></h3>
                   </div>
                </div>
                <div className="space-y-3">
                   {nemesis.map((item) => (
                      <RivalRow key={item.id} {...item} type="nemesis" />
                   ))}
                </div>
             </div>

             {/* Minions Card */}
             <div className="rounded-[2.5rem] bg-green-50/40 p-8 border border-green-100/50 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/20">
                      <Crown size={24} className="text-white" />
                   </div>
                   <div>
                      <h3 className="text-xl font-display font-black text-primary-navy">手下敗將 <span className="text-sm uppercase text-slate-500 ml-2 tracking-widest font-sans">Minions</span></h3>
                   </div>
                </div>
                <div className="space-y-3">
                   {minions.map((item) => (
                      <RivalRow key={item.id} {...item} type="minions" />
                   ))}
                </div>
             </div>
          </section>
        </div>

        {/* Right Column: Secondary Info (4 cols) */}
        <div className="xl:col-span-4 space-y-10">
          
          {/* Top Competition */}
          <section className="space-y-6 pt-0">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-xl text-primary-navy font-display font-bold">Top Rivals</h2>
              <div className="flex bg-slate-50 p-1 rounded-xl">
                 <button 
                  onClick={() => setRivalMode('singles')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    rivalMode === 'singles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600"
                  )}
                 >
                    Singles
                 </button>
                 <button 
                  onClick={() => setRivalMode('doubles')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    rivalMode === 'doubles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600"
                  )}
                 >
                    Doubles
                 </button>
              </div>
            </div>
            <div className="space-y-4">
              {players.slice(0, 3).map(player => (
                <div key={player.id} className="hover:translate-x-1 transition-transform">
                   <RankingCard player={player} mode={rivalMode} />
                </div>
              ))}
              <Button className="w-full bg-slate-50 hover:bg-slate-100 text-primary-navy border border-slate-100/50 py-7 rounded-3xl font-sans font-black text-xs uppercase tracking-widest">
                Full Member List
              </Button>
            </div>
          </section>

        </div>
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <ReportScore 
        trigger={
          <Button className="lg:hidden fixed bottom-24 right-6 size-14 rounded-full bg-sapphire-blue shadow-lg shadow-sapphire-blue/40 border-none group transition-all duration-300 hover:scale-105 active:scale-95">
            <Plus size={28} className="text-white transform group-hover:rotate-90 transition-transform duration-300" />
          </Button>
        }
      />

    </div>
  );
}

function RivalRow({ name, avatar, winRate, type }: RivalryItem & { type: 'nemesis' | 'minions' }) {
   return (
      <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100/50 group hover:shadow-md transition-all">
         <img src={avatar} alt={name} className="size-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-100" />
         <span className="flex-1 font-sans font-black text-primary-navy text-sm">{name}</span>
         <span className={cn(
            "font-display font-black text-lg",
            type === 'nemesis' ? 'text-red-500' : 'text-green-500'
         )}>
            {winRate}% <span className="text-sm uppercase text-slate-500 ml-1">WR</span>
         </span>
      </div>
   );
}
