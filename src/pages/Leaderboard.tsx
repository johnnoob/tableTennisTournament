import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Trophy, Medal, Shield, Award, ChevronDown, Timer, Crown, History, TrendingUp, User, Swords, Zap, ChevronUp, Minus } from 'lucide-react';
import { players } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// 段位徽章邏輯 (保持與全域一致)
const getTierBadge = (mmr: number) => {
  if (mmr >= 2000) return { name: '菁英 (Elite)', icon: <Shield size={16} />, color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-amber-500/20' };
  if (mmr >= 1700) return { name: '金牌 (Gold)', icon: <Trophy size={16} />, color: 'bg-amber-100 text-amber-700 border-amber-300' };
  if (mmr >= 1400) return { name: '銀牌 (Silver)', icon: <Medal size={16} />, color: 'bg-slate-100 text-slate-600 border-slate-300' };
  return { name: '銅牌 (Bronze)', icon: <Award size={16} />, color: 'bg-orange-50 text-orange-700 border-orange-200' };
};

// 🌟 模擬：產生排名的動能變化 (實務上這會由 FastAPI 後端計算後傳回)
const getMomentum = (playerId: string) => {
  // 利用 ID 字串來產生一個固定不變的假動能，讓畫面看起來更真實
  const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const mod = hash % 5; 
  
  if (mod === 0 || mod === 1) return { type: 'up', val: (hash % 3) + 1 }; // 綠色上升
  if (mod === 2) return { type: 'down', val: (hash % 2) + 1 };            // 紅色下降
  return { type: 'flat', val: 0 };                                        // 灰色持平
};

export function Leaderboard() {
  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('singles');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('s4');
  const [searchParams, setSearchParams] = useSearchParams();

  // 動態判斷賽季狀態
  const isSeasonEnded = selectedSeason === 's3'; // S3 已結算
  const isAllTime = selectedSeason === 'all-time'; // 總榜模式
  const showPodium = isSeasonEnded || isAllTime; // 結算季與總榜顯示頒獎台

  // 🌟 核心數據邏輯：根據選擇的賽季進行過濾與排序
  const sortedPlayers = useMemo(() => {
    return [...players]
      .map(p => {
        let lp = Math.floor(p.rating * 0.8);
        if (selectedSeason === 's3') lp = Math.floor(p.rating * 0.75 + Math.random() * 100); 
        return { ...p, seasonLP: lp };
      })
      .sort((a, b) => {
        return isAllTime ? b.rating - a.rating : b.seasonLP - a.seasonLP;
      })
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.department && p.department.includes(searchTerm)));
  }, [selectedSeason, searchTerm, isAllTime]);

  const top3 = sortedPlayers.slice(0, 3);
  
  return (
    <div className="pb-24 pt-8 md:pt-12 px-4 md:px-12 space-y-8 animate-in fade-in duration-700 bg-slate-50/30 min-h-screen relative">
      
      {/* 頁面標題區 */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl text-primary-navy font-display tracking-tight font-black uppercase italic flex items-center gap-4">
            {isAllTime ? "Hall of Fame" : "Leaderboard"}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors",
              isAllTime ? "bg-purple-100 text-purple-700" :
              isSeasonEnded ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-700"
            )}>
              {isAllTime ? <Crown size={12} /> : isSeasonEnded ? <Trophy size={12} /> : <Timer size={12} />}
              {isAllTime ? "All-Time Legends" : isSeasonEnded ? "Season 3 Completed" : "Season 4 Active"}
            </span>
          </div>
        </div>
      </header>

      {/* 控制列 */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl md:rounded-4xl border border-slate-100 shadow-sm relative z-30">
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <Select value={selectedSeason} onValueChange={(val) => val && setSelectedSeason(val)}>
            <SelectTrigger className="w-full sm:w-[220px] h-12 bg-slate-50 border-slate-200 rounded-xl font-bold text-primary-navy shadow-inner focus:ring-sapphire-blue/20">
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                <SelectValue placeholder="選擇賽季" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-xl font-sans">
              <SelectItem value="s4" className="font-bold text-emerald-700 focus:bg-emerald-50 focus:text-emerald-900 py-3">🟢 Season 4 (本季進行中)</SelectItem>
              <SelectItem value="s3" className="font-bold text-slate-600 focus:bg-slate-50 focus:text-slate-900 py-3">🏆 Season 3 (2025 秋季)</SelectItem>
              <div className="h-px bg-slate-100 my-1" />
              <SelectItem value="all-time" className="font-black text-amber-600 focus:bg-amber-50 focus:text-amber-900 py-3">👑 All-Time 總榜 (依實力分)</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={matchType} onValueChange={(val) => setMatchType(val as 'singles' | 'doubles')} className="w-full sm:w-auto">
            <TabsList className="grid w-full sm:w-[240px] grid-cols-2 rounded-xl p-1.5 bg-slate-50 h-12">
              <TabsTrigger value="singles" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary-navy uppercase tracking-widest text-xs">單打</TabsTrigger>
              <TabsTrigger value="doubles" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary-navy uppercase tracking-widest text-xs">雙打</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative w-full xl:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="搜尋同仁姓名或單位..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-sapphire-blue/20 focus:border-sapphire-blue transition-all font-bold text-slate-600 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 榮譽頒獎台 */}
      {showPodium && top3.length >= 3 && (
        <div className="flex justify-center items-end h-64 md:h-72 gap-2 md:gap-4 mt-12 mb-16 animate-in zoom-in-95 fade-in duration-700">
          <div className="flex flex-col items-center relative z-10 w-24 md:w-32">
            <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300">
              <img src={top3[1].avatar} className="size-16 md:size-20 rounded-full border-4 border-slate-300 object-cover shadow-lg" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-700 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">2</div>
            </div>
            <p className="font-black text-primary-navy text-sm truncate w-full text-center">{top3[1].name}</p>
            <div className="w-full h-24 md:h-32 bg-linear-to-t from-slate-200 to-slate-100 rounded-t-xl mt-4 border-t-4 border-slate-300 flex justify-center pt-4">
               <span className="font-display font-black text-slate-400/50 text-2xl">II</span>
            </div>
          </div>
          <div className="flex flex-col items-center relative z-20 w-28 md:w-40 -mt-8">
            <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300">
              <Crown size={32} className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce" />
              <img src={top3[0].avatar} className="size-20 md:size-24 rounded-full border-4 border-amber-400 object-cover shadow-xl" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white size-7 md:size-9 rounded-full flex items-center justify-center font-black border-2 border-white">1</div>
            </div>
            <p className="font-black text-amber-600 text-base truncate w-full text-center">{top3[0].name}</p>
            <div className="w-full h-32 md:h-44 bg-linear-to-t from-amber-200 to-amber-100 rounded-t-xl mt-4 border-t-4 border-amber-400 flex justify-center pt-4">
              <span className="font-display font-black text-amber-500/30 text-4xl">I</span>
            </div>
          </div>
          <div className="flex flex-col items-center relative z-10 w-24 md:w-32">
            <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300">
              <img src={top3[2].avatar} className="size-16 md:size-20 rounded-full border-4 border-orange-300 object-cover shadow-lg" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-300 text-orange-800 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">3</div>
            </div>
            <p className="font-black text-primary-navy text-sm truncate w-full text-center">{top3[2].name}</p>
            <div className="w-full h-20 md:h-24 bg-linear-to-t from-orange-100 to-orange-50 rounded-t-xl mt-4 border-t-4 border-orange-300 flex justify-center pt-4">
              <span className="font-display font-black text-orange-800/20 text-xl">III</span>
            </div>
          </div>
        </div>
      )}

      {/* 數據表格 */}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden relative z-20 animate-in slide-in-from-bottom-8 duration-700">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest w-20 text-center">Rank</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Player</th>
                <th className="py-5 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tier Badge</th>
                <th className="py-5 px-6 text-xs font-black uppercase tracking-widest text-right text-primary-navy">
                  {isAllTime ? "Total MMR" : "Season LP"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedPlayers.map((player, index) => {
                const rank = index + 1;
                const tier = getTierBadge(player.rating);
                const isTop1 = rank === 1 && showPodium;
                const momentum = getMomentum(player.id); // 取得該同仁的排名動能

                return (
                  <tr 
                    key={player.id} 
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('inspect', player.id);
                      setSearchParams(newParams);
                    }}
                    className={cn(
                      "group hover:bg-slate-50/50 transition-all cursor-pointer active:scale-[0.99]",
                      isTop1 && "bg-amber-50/30"
                    )}
                  >
                    {/* 🌟 升級版 Rank 欄位：結合名次與排名動能 */}
                    <td className="py-4 px-4 md:px-6 w-20 md:w-24">
                      <div className="flex flex-col items-center justify-center">
                        <span className={cn(
                          "font-display font-black text-xl tabular-nums leading-none", 
                          rank <= 3 && showPodium ? "text-slate-400 text-2xl" : "text-slate-300"
                        )}>
                          {rank}
                        </span>
                        
                        {/* 動能指示器 (Momentum Trend Indicator) */}
                        <div className={cn(
                          "flex items-center gap-0.5 mt-1.5 text-[10px] font-black tracking-tighter",
                          momentum.type === 'up' ? "text-emerald-500" : 
                          momentum.type === 'down' ? "text-rose-500" : "text-slate-300/60"
                        )}>
                          {momentum.type === 'up' && <ChevronUp size={12} strokeWidth={4} />}
                          {momentum.type === 'down' && <ChevronDown size={12} strokeWidth={4} />}
                          {momentum.type === 'flat' && <Minus size={10} strokeWidth={4} />}
                          {momentum.type !== 'flat' && <span>{momentum.val}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <img src={player.avatar} alt="" className="size-12 rounded-xl object-cover border border-slate-100 shadow-sm group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <span className={cn("font-sans font-black text-base uppercase tracking-wide group-hover:text-sapphire-blue transition-colors", isTop1 ? "text-amber-700" : "text-primary-navy")}>{player.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{player.department || 'Taiwan District Office'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-widest shadow-sm", tier.color)}>
                        {tier.icon} {tier.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex flex-col items-end justify-center">
                        <span className={cn("font-display font-black text-2xl tabular-nums leading-none", 
                          isTop1 ? "text-amber-600 text-3xl" : "text-primary-navy"
                        )}>
                          {isAllTime ? player.rating : player.seasonLP}
                        </span>
                        {isAllTime && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Hidden Rating</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
