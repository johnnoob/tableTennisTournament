import { useState } from 'react';
import { currentUser, players, matches, nemesis, minions } from '@/data/mockData';
import type { Match, RivalryItem } from '@/data/mockData';
import { RankingCard } from '@/components/RankingCard';
import { MatchItem } from '@/components/MatchItem';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { Bell, Search, Plus, Skull, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportScore } from '@/components/ReportScore';
import { PendingActions } from '@/components/PendingActions';

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
            <span className="absolute top-4 right-4 size-3 bg-neon-orange rounded-full border-[3px] border-white shadow-sm" />
          </Button>
        </div>
      </header>

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
              <Button variant="link" className="text-electric-blue text-xs font-black uppercase tracking-[0.2em] p-0 h-auto">History</Button>
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
          <Button className="lg:hidden fixed bottom-24 right-6 size-14 rounded-full bg-electric-blue shadow-lg shadow-electric-blue/40 border-none group transition-all duration-300 hover:scale-105 active:scale-95">
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
