import { useState } from 'react';
import { Search, Trophy, Medal, Shield, Award, ChevronDown, Crown } from 'lucide-react';
import { players } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 🌟 核心邏輯：將隱藏 MMR 轉換為段位徽章
const getTierBadge = (mmr: number) => {
  if (mmr >= 2000) return { name: '菁英 (Elite)', icon: <Shield size={16} />, color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-olympic-gold/20' };
  if (mmr >= 1700) return { name: '金牌 (Gold)', icon: <Trophy size={16} />, color: 'bg-amber-100 text-amber-700 border-amber-300' };
  if (mmr >= 1400) return { name: '銀牌 (Silver)', icon: <Medal size={16} />, color: 'bg-slate-100 text-slate-600 border-slate-300' };
  return { name: '銅牌 (Bronze)', icon: <Award size={16} />, color: 'bg-orange-50 text-orange-700 border-orange-200' };
};

export function Leaderboard() {
  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('singles');
  const [searchTerm, setSearchTerm] = useState('');

  // 模擬：根據賽季分 (Season LP) 排序，而非 MMR
  // 注意：這裡假設 mockData 中有 seasonLP 欄位，若無則暫時用 rating 模擬並加上亂數，
  // 實務上由 FastAPI 後端直接回傳依照 seasonLP 排好序的陣列
  const sortedPlayers = [...players]
    .map(p => ({ ...p, seasonLP: Math.floor(p.rating * 0.8) })) // 模擬賽季分
    .sort((a, b) => b.seasonLP - a.seasonLP)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.department && p.department.includes(searchTerm)));

  return (
    <div className="pb-24 pt-8 md:pt-12 px-4 md:px-12 space-y-8 animate-in fade-in duration-700 bg-slate-50/30 min-h-screen">
      
      {/* 頁面標題區 */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl text-primary-navy font-display tracking-tight font-black uppercase italic">
            Hall of Fame
          </h1>
          <p className="text-sm md:text-base text-slate-500 mt-2 uppercase tracking-[0.2em] font-sans font-bold">
            Season 4 Official Rankings
          </p>
        </div>
      </header>

      {/* 控制列：賽制切換與搜尋 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
        <Tabs 
          value={matchType} 
          onValueChange={(val) => setMatchType(val as 'singles' | 'doubles')} 
          className="w-full md:w-auto"
        >
          <TabsList className="grid w-full md:w-[300px] grid-cols-2 rounded-xl p-1 bg-slate-50">
            <TabsTrigger value="singles" className="rounded-lg font-bold py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary-navy uppercase tracking-widest text-xs">
              單打排行榜
            </TabsTrigger>
            <TabsTrigger value="doubles" className="rounded-lg font-bold py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary-navy uppercase tracking-widest text-xs">
              雙打排行榜
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="搜尋同仁姓名或單位..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-olympic-gold/20 focus:border-olympic-gold transition-all font-bold text-slate-600 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 奧運轉播風 數據表格 */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest w-20 text-center">Rank</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Player</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tier Badge</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center hidden md:table-cell">Win Rate</th>
                <th className="py-5 px-6 text-xs font-black text-amber-600 uppercase tracking-widest text-right">Season LP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedPlayers.map((player, index) => {
                const rank = index + 1;
                const tier = getTierBadge(player.rating);
                
                // 前三名的特殊視覺處理
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                return (
                  <tr 
                    key={player.id} 
                    className={cn(
                      "group hover:bg-slate-50/50 transition-colors",
                      isTop1 && "bg-amber-50/30 hover:bg-amber-50/50"
                    )}
                  >
                    {/* 1. 排名 */}
                    <td className="py-4 px-6 text-center">
                      <div className={cn(
                        "font-display font-black text-xl tabular-nums",
                        isTop1 ? "text-olympic-gold text-3xl" : 
                        isTop2 ? "text-slate-400 text-2xl" : 
                        isTop3 ? "text-orange-400 text-2xl" : "text-slate-300"
                      )}>
                        {rank}
                      </div>
                    </td>

                    {/* 2. 選手資訊 */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img 
                            src={player.avatar} 
                            alt={player.name} 
                            className={cn(
                              "size-12 rounded-xl object-cover shadow-sm",
                              isTop1 ? "ring-2 ring-amber-400 ring-offset-2" : "border border-slate-100"
                            )}
                          />
                          {isTop1 && (
                            <div className="absolute -top-2 -right-2 bg-olympic-gold text-white p-1 rounded-full shadow-md">
                              <Crown size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-sans font-black text-base transition-colors group-hover:text-amber-600 uppercase tracking-wide",
                            isTop1 ? "text-amber-700" : "text-primary-navy"
                          )}>
                            {player.name}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {player.department || 'Taiwan District Office'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. 段位徽章 (取代精確 MMR) */}
                    <td className="py-4 px-6">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-widest",
                        tier.color
                      )}>
                        {tier.icon}
                        {tier.name}
                      </div>
                    </td>

                    {/* 4. 勝率 (桌機版顯示) */}
                    <td className="py-4 px-6 text-center hidden md:table-cell">
                      <span className="font-display font-black text-lg text-slate-600 tabular-nums">
                        {player.stats.winRate}%
                      </span>
                    </td>

                    {/* 5. 賽季排行分 (排序基準，最高亮) */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex flex-col items-end justify-center">
                        <span className={cn(
                          "font-display font-black text-2xl tabular-nums leading-none",
                          isTop1 ? "text-amber-600 text-3xl" : "text-primary-navy"
                        )}>
                          {player.seasonLP}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          LP Points
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedPlayers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest">沒有找到符合的同仁</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* 表格底部資訊 */}
        <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Shield size={12} />
             段位徽章由隱藏 MMR 換算，賽季分決定最終排名。
           </p>
           <button className="text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest flex items-center gap-1">
              查看積分規則 <ChevronDown size={14} />
           </button>
        </div>
      </div>

    </div>
  );
}
