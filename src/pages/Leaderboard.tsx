import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Trophy, Medal, Shield, Award, ChevronDown, Timer, Crown, History, ChevronUp, Minus, Star } from 'lucide-react';
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

export function Leaderboard() {
  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('singles');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // 🌟 動態賽季狀態
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  const [realLeaderboard, setRealLeaderboard] = useState<any[]>([]);
  const [seasonName, setSeasonName] = useState<string>("讀取中...");
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 加入全域更新觸發器 (跟 Dashboard 一樣)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('match_updated', handleUpdate);
    return () => window.removeEventListener('match_updated', handleUpdate);
  }, []);

  // 🌟 1. 抓取所有賽季清單
  useEffect(() => {
    fetch('http://localhost:8000/api/seasons')
      .then(res => res.json())
      .then(data => {
        setSeasons(data);
        // 如果還沒有選中賽季，或者剛載入，就預設選擇第一個 (最新的)
        if (data.length > 0 && !selectedSeason) {
          setSelectedSeason(data[0].id);
        }
      })
      .catch(err => console.error("無法取得賽季清單", err));
  }, [refreshTrigger]); // 當有人報分導致賽季推進時，選單也會自動更新

  // 🌟 2. 抓取該賽季的排行榜
  useEffect(() => {
    // 必須等到有 selectedSeason 才去抓資料
    if (!selectedSeason) return;

    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const url = selectedSeason !== 'all-time'
          ? `http://localhost:8000/api/leaderboard?season_id=${selectedSeason}`
          : "http://localhost:8000/api/leaderboard"; // 若未來實作總榜可用

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRealLeaderboard(data.leaderboard || []);
          setSeasonName(data.season_name);
        }
      } catch (err) {
        console.error("無法取得排行榜資料", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedSeason, refreshTrigger]); // 當切換賽季，或有人報分時，重新抓取

  // 🌟 3. 動態判斷當前選中賽季的狀態
  const currentSeasonObj = seasons.find(s => s.id === selectedSeason);
  const isSeasonEnded = currentSeasonObj?.status === 'completed';
  const isAllTime = selectedSeason === 'all-time';

  // 顯示頒獎台邏輯 (結算賽季才顯示，且沒有搜尋時)
  const showPodium = (isSeasonEnded || isAllTime) && !searchTerm;

  // 核心數據邏輯：根據選擇的賽季進行過濾與排序
  const sortedPlayers = useMemo(() => {
    return realLeaderboard.filter(p =>
      p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.department && p.department.includes(searchTerm))
    );
  }, [realLeaderboard, searchTerm]);

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
              {/* 🌟 動態顯示賽季名稱 */}
              {isAllTime ? "All-Time Legends" : isSeasonEnded ? `${seasonName} (已結算)` : `${seasonName} (進行中)`}
            </span>
          </div>
        </div>
      </header>

      {/* 控制列 */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl md:rounded-4xl border border-slate-100 shadow-sm relative z-30">

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          {/* 🌟 動態產生的下拉選單 */}
          <Select value={selectedSeason} onValueChange={(val) => val && setSelectedSeason(val)}>
            <SelectTrigger className="w-full sm:w-[260px] h-12 bg-slate-50 border-slate-200 rounded-xl font-bold text-primary-navy shadow-inner focus:ring-sapphire-blue/20">
              <div className="flex items-center gap-2 truncate">
                <History size={16} className="text-slate-400 shrink-0" />
                <SelectValue placeholder="選擇賽季" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-xl font-sans">
              {seasons.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  className={cn("py-3 font-bold", s.status === 'active' ? "text-emerald-700 focus:bg-emerald-50" : "text-slate-600 focus:bg-slate-50")}
                >
                  {s.status === 'active' ? '🟢 ' : '🏆 '} {s.name}
                </SelectItem>
              ))}
              {/* 保留 All-Time 選項 (若後端未來支援) */}
              {seasons.length > 0 && (
                <>
                  <div className="h-px bg-slate-100 my-1" />
                  <SelectItem value="all-time" className="font-black text-amber-600 focus:bg-amber-50 focus:text-amber-900 py-3">👑 All-Time 總榜 (依實力分)</SelectItem>
                </>
              )}
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
              <img src={top3[1].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-16 md:size-20 rounded-full border-4 border-slate-300 object-cover shadow-lg" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-700 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">2</div>
            </div>
            <p className="font-black text-primary-navy text-sm truncate w-full text-center">{top3[1].player_name}</p>
            <div className="w-full h-24 md:h-32 bg-linear-to-t from-slate-200 to-slate-100 rounded-t-xl mt-4 border-t-4 border-slate-300 flex justify-center pt-4">
              <span className="font-display font-black text-slate-400/50 text-2xl">II</span>
            </div>
          </div>
          <div className="flex flex-col items-center relative z-20 w-28 md:w-40 -mt-8">
            <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300">
              <Crown size={32} className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce" />
              <img src={top3[0].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-20 md:size-24 rounded-full border-4 border-amber-400 object-cover shadow-xl" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white size-7 md:size-9 rounded-full flex items-center justify-center font-black border-2 border-white">1</div>
            </div>
            <p className="font-black text-amber-600 text-base truncate w-full text-center">{top3[0].player_name}</p>
            <div className="w-full h-32 md:h-44 bg-linear-to-t from-amber-200 to-amber-100 rounded-t-xl mt-4 border-t-4 border-amber-400 flex justify-center pt-4">
              <span className="font-display font-black text-amber-500/30 text-4xl">I</span>
            </div>
          </div>
          <div className="flex flex-col items-center relative z-10 w-24 md:w-32">
            <div className="relative mb-4 hover:-translate-y-2 transition-transform duration-300">
              <img src={top3[2].avatar_url || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-16 md:size-20 rounded-full border-4 border-orange-300 object-cover shadow-lg" alt="" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-300 text-orange-800 size-6 md:size-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-white">3</div>
            </div>
            <p className="font-black text-primary-navy text-sm truncate w-full text-center">{top3[2].player_name}</p>
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
              {isLoading ? (
                <tr><td colSpan={4} className="py-16 text-center font-bold text-slate-400">資料讀取中...</td></tr>
              ) : sortedPlayers.map((player) => {

                // 🌟 使用後端給的真實資料欄位
                const rank = player.rank;
                // 將 season_lp 當作 MMR 傳入去算牌位
                const tier = getTierBadge(player.season_lp);
                const isTop1 = rank === 1 && showPodium;

                return (
                  <tr
                    key={player.player_id}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('inspect', player.player_id);
                      setSearchParams(newParams);
                    }}
                    className={cn(
                      "group hover:bg-slate-50/50 transition-all cursor-pointer active:scale-[0.99]",
                      isTop1 && "bg-amber-50/30"
                    )}
                  >
                    <td className="py-4 px-4 md:px-6 w-20 md:w-24">
                      <div className="flex flex-col items-center justify-center">
                        <span className={cn(
                          "font-display font-black text-xl tabular-nums leading-none",
                          rank <= 3 && showPodium ? "text-slate-400 text-2xl" : "text-slate-300"
                        )}>
                          {rank}
                        </span>

                        {/* 🌟 動能指示器 */}
                        <div className={cn(
                          "flex items-center gap-0.5 mt-1.5 text-[10px] font-black tracking-tighter",
                          player.trend === 'up' ? "text-emerald-500" :
                            player.trend === 'down' ? "text-rose-500" :
                              player.trend === 'new' ? "text-amber-500" : "text-slate-300/60"
                        )}>
                          {player.trend === 'up' && <ChevronUp size={12} strokeWidth={4} />}
                          {player.trend === 'down' && <ChevronDown size={12} strokeWidth={4} />}
                          {player.trend === 'same' && <Minus size={10} strokeWidth={4} />}
                          {player.trend === 'new' && <Star size={10} strokeWidth={4} />}

                          {player.trend === 'new' ? <span>NEW</span> :
                            player.trend !== 'same' ? <span>{player.rank_change}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <img src={player.avatar_url || '/api/placeholder/150/150'} alt="" referrerPolicy="no-referrer" className="size-12 rounded-xl object-cover border border-slate-100 shadow-sm group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <span className={cn("font-sans font-black text-base uppercase tracking-wide group-hover:text-sapphire-blue transition-colors", isTop1 ? "text-amber-700" : "text-primary-navy")}>{player.player_name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{player.department || '未設定單位'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-widest shadow-sm", tier.color)}>
                        {tier.icon} {tier.name}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 font-bold tracking-widest">
                        Win Rate: {player.win_rate}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex flex-col items-end justify-center">
                        <span className={cn("font-display font-black text-2xl tabular-nums leading-none",
                          isTop1 ? "text-amber-600 text-3xl" : "text-primary-navy"
                        )}>
                          {player.season_lp}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">LP</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* 找不到人的防呆提示 */}
              {sortedPlayers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest text-slate-400">沒有找到符合條件的同仁</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}