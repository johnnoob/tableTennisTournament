import { useState } from 'react';
import { players } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HallOfFame() {
  const [selectedTournament, setSelectedTournament] = useState('2025-autumn');
  const [mode, setMode] = useState<'singles' | 'doubles'>('singles');

  const sortedPlayers = [...players].sort((a, b) => {
    const rA = mode === 'doubles' ? (a.doublesRating ?? 0) : a.rating;
    const rB = mode === 'doubles' ? (b.doublesRating ?? 0) : b.rating;
    return rB - rA;
  });

  const topThree = sortedPlayers.slice(0, 3);
  const others = sortedPlayers.slice(3);

  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 bg-white min-h-screen font-sans">
      
      {/* Header - Editorial Style */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-7xl mx-auto w-full">
        <div className="space-y-1">
          <p className="text-xs md:text-xs font-black text-electric-blue uppercase tracking-[0.2em]">Institutional Records</p>
          <h1 className="text-3xl md:text-5xl text-primary-navy font-display font-black tracking-tight">歷屆賽事榮譽榜</h1>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex bg-[#fbfcff] p-1 rounded-xl border border-slate-100 self-end">
            <button 
              onClick={() => setMode('singles')}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                mode === 'singles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              單打英雄榜
            </button>
            <button 
              onClick={() => setMode('doubles')}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                mode === 'doubles' ? "bg-white text-primary-navy shadow-sm ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              雙打英雄榜
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Select Season</label>
            <Select value={selectedTournament} onValueChange={(val) => setSelectedTournament(val || '2025-autumn')}>
              <SelectTrigger className="w-full md:w-[260px] bg-[#fbfcff] border-slate-100 rounded-xl h-12 px-4 font-sans font-bold text-sm text-primary-navy shadow-sm">
                <SelectValue placeholder="Select Season" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 font-sans font-bold">
                <SelectItem value="2025-autumn">2025 秋季長官盃</SelectItem>
                <SelectItem value="2025-spring">2025 春季公開賽</SelectItem>
                <SelectItem value="all-time">All-Time Ranking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Podium Section - Shortened Pillar Style (-25% Height) */}
      <section className="max-w-5xl mx-auto w-full pt-16">
        <div className="flex items-end justify-center gap-2 md:gap-8 md:min-h-[320px]">
          
          {/* Rank 2 (Left) - Silver Pillar Optimization */}
          <div className="flex flex-col items-center gap-6 w-1/3 md:w-56 group hover:scale-[1.05] transition-all duration-500 cursor-pointer animate-in slide-in-from-bottom-8 delay-100">
             <div className="relative p-2 rounded-full bg-linear-to-tr from-[#757575] via-[#E0E0E0] to-[#F5F5F5] shadow-lg">
                <div className="rounded-full bg-slate-50">
                   <img src={topThree[1].avatar} alt={topThree[1].name} className="size-16 md:size-32 rounded-full object-cover shadow-inner" />
                </div>
                <div className="absolute bottom-0 -right-2 size-7 md:size-10 rounded-full bg-[#9E9E9E] border-2 md:border-4 border-white flex items-center justify-center font-display font-black text-white text-xs md:text-sm shadow-md">2</div>
             </div>
             <div className="w-full h-32 md:h-44 bg-[#E0E0E0]/10 rounded-t-4xl md:rounded-t-[3rem] shadow-sm border-t border-x border-slate-200/50 flex flex-col items-center justify-start pt-6 md:pt-10 px-2 group-hover:bg-[#E0E0E0]/20 transition-colors">
                <h3 className="font-sans font-black text-primary-navy text-xs md:text-base text-center truncate w-full">{topThree[1].name} {topThree[1].username}</h3>
                <span className="font-display font-black text-lg md:text-3xl text-primary-navy mt-1 md:mt-2">
                  {(mode === 'doubles' ? (topThree[1].doublesRating ?? topThree[1].rating) : topThree[1].rating).toLocaleString()}
                </span>
             </div>
          </div>

          {/* Rank 1 (Center) - Gold Pillar Optimization */}
          <div className="flex flex-col items-center gap-8 w-1/3 md:w-64 z-10 group hover:scale-[1.05] transition-all duration-500 cursor-pointer animate-in slide-in-from-bottom-12">
             <div className="relative p-2 rounded-full bg-linear-to-tr from-[#BF953F] via-[#F3E5AB] to-[#FEF9E7] shadow-2xl">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
                   <div className="bg-neon-orange p-2 rounded-lg shadow-lg shadow-neon-orange/20 border-2 border-white transform rotate-45">
                      <Trophy size={18} className="text-white transform -rotate-45" />
                   </div>
                </div>
                <div className="rounded-full bg-slate-50">
                   <img src={topThree[0].avatar} alt={topThree[0].name} className="size-24 md:size-44 rounded-full object-cover shadow-inner" />
                </div>
                <div className="absolute bottom-0 -right-2 size-9 md:size-12 rounded-full bg-neon-orange border-2 md:border-4 border-white flex items-center justify-center font-display font-black text-white text-sm md:text-lg shadow-md">1</div>
             </div>
             <div className="w-full h-44 md:h-64 bg-primary-navy rounded-t-[2.5rem] md:rounded-t-[3.5rem] shadow-2xl shadow-primary-navy/20 flex flex-col items-center justify-start pt-6 md:pt-10 px-2 group-hover:bg-primary-navy/95 transition-colors">
                <h3 className="font-sans font-black text-white/40 text-xs md:text-base text-center truncate w-full">{topThree[0].name} {topThree[0].username}</h3>
                <span className="font-display font-black text-2xl md:text-5xl text-white mt-1 md:mt-2 tracking-tighter">
                  {(mode === 'doubles' ? (topThree[0].doublesRating ?? topThree[0].rating) : topThree[0].rating).toLocaleString()}
                </span>
                <div className="mt-4 md:mt-6 px-3 py-1.5 md:px-5 md:py-2.5 bg-neon-orange/10 border border-neon-orange/20 rounded-full">
                   <span className="text-[8px] md:text-xs font-black text-neon-orange uppercase tracking-[0.2em]">Season Champion</span>
                </div>
             </div>
          </div>

          {/* Rank 3 (Right) - Bronze Pillar Optimization */}
          <div className="flex flex-col items-center gap-6 w-1/3 md:w-56 group hover:scale-[1.05] transition-all duration-500 cursor-pointer animate-in slide-in-from-bottom-6 delay-200">
             <div className="relative p-2 rounded-full bg-linear-to-tr from-[#8E6E3E] via-[#CD7F32] to-[#FFE4D1] shadow-lg">
                <div className="rounded-full bg-slate-50">
                   <img src={topThree[2].avatar} alt={topThree[2].name} className="size-16 md:size-32 rounded-full object-cover shadow-inner" />
                </div>
                <div className="absolute bottom-0 -right-2 size-7 md:size-10 rounded-full bg-[#CD7F32] border-2 md:border-4 border-white flex items-center justify-center font-display font-black text-white text-xs md:text-sm shadow-md">3</div>
             </div>
             <div className="w-full h-24 md:h-36 bg-[#CD7F32]/10 rounded-t-4xl md:rounded-t-[3.5rem] shadow-sm border-t border-x border-[#CD7F32]/20 flex flex-col items-center justify-start pt-6 md:pt-10 px-2 group-hover:bg-[#CD7F32]/15 transition-colors">
                <h3 className="font-sans font-black text-primary-navy/60 text-xs md:text-base text-center truncate w-full">{topThree[2].name} {topThree[2].username}</h3>
                <span className="font-display font-black text-lg md:text-3xl text-primary-navy mt-1 md:mt-2">
                  {(mode === 'doubles' ? (topThree[2].doublesRating ?? topThree[2].rating) : topThree[2].rating).toLocaleString()}
                </span>
             </div>
          </div>

        </div>
      </section>

      {/* Full Rankings Table (Rank 4+) */}
      <section className="max-w-7xl mx-auto w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h2 className="text-xl md:text-2xl text-primary-navy font-display font-black">賽事完整排行 (Rank 4+)</h2>
           </div>
           <span className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Total 124 Participants</span>
        </div>

        {/* Desktop Table View (Rank 4+) */}
        <div className="hidden md:block overflow-x-auto">
           <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-10 py-5 text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Rank</th>
                    <th className="px-8 py-5 text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Player</th>
                    <th className="px-8 py-5 text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Department / Unit</th>
                    <th className="px-8 py-5 text-center text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Win/Loss Record</th>
                    <th className="px-10 py-5 text-right text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Final Score</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {others.map((player, idx) => (
                    <tr key={player.id} className="group hover:bg-slate-50/40 transition-colors">
                       <td className="px-10 py-6">
                          <span className="text-xl font-display font-black text-primary-navy/40 group-hover:text-primary-navy transition-colors">
                             {(idx + 4).toString().padStart(2, '0')}
                          </span>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <img src={player.avatar} alt={player.name} className="size-12 rounded-full object-cover border-2 border-white shadow-sm" />
                             <span className="font-sans font-black text-primary-navy">{player.name}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <span className="text-xs font-bold text-primary-slate/60">{player.department}</span>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="text-xs font-black text-primary-navy">
                             {mode === 'doubles' ? (player.doublesStats?.wins ?? 0) : player.stats.wins}W 
                             <span className="text-slate-500 mx-1">-</span> 
                             {mode === 'doubles' ? (player.doublesStats?.losses ?? 0) : player.stats.losses}L
                          </div>
                       </td>
                       <td className="px-10 py-6 text-right">
                          <span className="text-xl font-display font-black text-primary-navy tracking-tight">
                            {(mode === 'doubles' ? (player.doublesRating ?? player.rating) : player.rating).toLocaleString()}
                          </span>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Mobile Ranking List View (Rank 4+) - High Density Optimization */}
        <div className="md:hidden divide-y divide-slate-50">
           {others.map((player, idx) => (
              <div key={player.id} className="flex items-center gap-4 py-6 px-5 active:bg-slate-50 transition-colors">
                 {/* Rank Index */}
                 <div className="w-6 shrink-0">
                    <span className="text-base font-display font-black text-primary-navy/20 tracking-tighter">
                       {(idx + 4).toString().padStart(2, '0')}
                    </span>
                 </div>
                 
                 {/* Avatar & Name + Department */}
                 <div className="flex items-center gap-4 flex-1 min-w-0">
                    <img src={player.avatar} alt={player.name} className="size-12 rounded-full object-cover border-2 border-slate-50 shadow-sm shrink-0" />
                    <div className="flex flex-col min-w-0">
                       <span className="text-base font-black text-primary-navy truncate leading-tight">{player.name}</span>
                       <span className="text-xs font-bold text-slate-500 truncate mt-1 tracking-tight">
                          {player.department?.split(' / ')[1] || player.department}
                       </span>
                    </div>
                 </div>

                 {/* Performance (Score + Win/Loss) */}
                 <div className="text-right shrink-0 flex flex-col items-end">
                    <div className="text-lg font-display font-black text-primary-navy leading-none tracking-tighter">
                       {(mode === 'doubles' ? (player.doublesRating ?? player.rating) : player.rating).toLocaleString()}
                    </div>
                    <div className="text-xs font-black text-emerald-500/80 uppercase tracking-tight mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                       {mode === 'doubles' ? (player.doublesStats?.wins ?? 0) : player.stats.wins}W <span className="opacity-30 mx-0.5">-</span> {mode === 'doubles' ? (player.doublesStats?.losses ?? 0) : player.stats.losses}L
                    </div>
                 </div>
              </div>
           ))}
        </div>

        <div className="p-8 flex justify-center border-t border-slate-50">
           <Button variant="ghost" className="group text-electric-blue font-sans font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 py-6 px-8 rounded-2xl">
              View More Rankings
              <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
           </Button>
        </div>
      </section>

      {/* Footer Meta */}
      <footer className="max-w-7xl mx-auto w-full pt-4 pb-12 flex flex-col md:flex-row justify-between items-center text-xs font-bold text-slate-500 gap-6">
         <div className="flex items-center gap-8">
            <span className="text-primary-navy uppercase tracking-widest">Precision Arena</span>
            <span>© 2024 Precision Arena. National Governing Body of Competitive Table Tennis.</span>
         </div>
         <div className="flex items-center gap-6 uppercase tracking-widest">
            <a href="#" className="hover:text-primary-navy">Privacy Policy</a>
            <a href="#" className="hover:text-primary-navy">Terms of Service</a>
            <a href="#" className="hover:text-primary-navy">Institutional Governance</a>
            <a href="#" className="hover:text-primary-navy">Contact Support</a>
         </div>
      </footer>

    </div>
  );
}
