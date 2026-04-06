import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy, Medal, Shield, Award,
  TrendingUp, Swords, Zap, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import apiClient from '@/utils/apiClient';

const getTierBadge = (mmr: number) => {
  if (mmr >= 2000) return { name: '菁英 (Elite)', icon: <Shield size={16} />, color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-amber-500/20' };
  if (mmr >= 1700) return { name: '金牌 (Gold)', icon: <Trophy size={16} />, color: 'bg-amber-100 text-amber-700 border-amber-300' };
  if (mmr >= 1400) return { name: '銀牌 (Silver)', icon: <Medal size={16} />, color: 'bg-slate-100 text-slate-600 border-slate-300' };
  return { name: '銅牌 (Bronze)', icon: <Award size={16} />, color: 'bg-orange-50 text-orange-700 border-orange-200' };
};

export function GlobalPlayerDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectingId = searchParams.get('inspect');
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 🌟 替換假資料，改用 State 儲存真實資料
  const [player, setPlayer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!inspectingId) {
      setPlayer(null);
      return;
    }

    const fetchPlayerProfile = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/users/${inspectingId}/profile`);
        setPlayer(res.data);
      } catch (err) {
        console.error("無法取得玩家資料", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerProfile();
  }, [inspectingId]);

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('inspect');
    setSearchParams(newParams);
  };

  if (!inspectingId) return null;

  const Content = () => {
    if (isLoading || !player) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
          <div className="size-10 border-4 border-slate-200 border-t-sapphire-blue rounded-full animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">讀取玩家檔案中...</p>
        </div>
      );
    }

    const tier = getTierBadge(player.rating);

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="bg-primary-navy p-3 md:p-8 text-white relative shrink-0">
          {isDesktop && (
            <button
              onClick={closeDrawer}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="size-5 text-white" />
            </button>
          )}
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 pointer-events-none">
            <Trophy size={80} className="md:size-[120px]" />
          </div>
          <div className="relative z-10 text-left">
            <div className="flex items-center gap-3 md:gap-5">
              <div className="relative">
                <img src={player.avatar || '/api/placeholder/150/150'} referrerPolicy="no-referrer" className="size-14 md:size-20 rounded-2xl md:rounded-3xl object-cover border-2 border-white/20 shadow-xl" alt="" />
              </div>
              <div>
                <h3 className="text-lg md:text-2xl font-display font-black tracking-wide text-white uppercase italic leading-tight">
                  {player.name}
                </h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-xs mt-0.5 md:mt-1">
                  {player.department || "未設定單位"}
                </p>
                <div className={cn(
                  "mt-1.5 md:mt-3 inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg border text-[8px] md:text-[10px] font-black uppercase tracking-widest",
                  tier.color
                )}>
                  {tier.icon}
                  {tier.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 md:p-6 space-y-6 md:y-8 bg-slate-50/50">
          {/* 基本數據 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-white border border-slate-100 flex flex-col items-center text-center shadow-sm">
              <TrendingUp size={16} className="text-emerald-500 mb-1" />
              <span className="text-lg md:text-xl font-display font-black text-primary-navy">{player.stats.winRate}%</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">生涯勝率</span>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-100 flex flex-col items-center text-center shadow-sm">
              <Swords size={16} className="text-sapphire-blue mb-1" />
              <span className="text-lg md:text-xl font-display font-black text-primary-navy">
                {player.stats.wins + player.stats.losses}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">總出賽數</span>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-100 flex flex-col items-center text-center shadow-sm">
              <Zap size={16} className="text-amber-500 mb-1" />
              <span className="text-lg md:text-xl font-display font-black text-primary-navy">{player.rating}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">目前積分</span>
            </div>
          </div>

          {/* 戰術裝備配置 */}
          <div className="space-y-3">
            <h4 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest ml-1">戰術裝備配置</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-3 md:p-4 shadow-sm">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">正手 (Forehand)</p>
                <p className="text-xs md:text-sm font-black text-primary-navy truncate">{player.racketConfig.forehand}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-3 md:p-4 shadow-sm">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">反手 (Backhand)</p>
                <p className="text-xs md:text-sm font-black text-primary-navy truncate">{player.racketConfig.backhand}</p>
              </div>
            </div>
          </div>

          {/* 進階戰情洞察 (搭檔與天敵) */}
          <div className="space-y-4">
            {player.goldenPartner && player.goldenPartner.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-amber-600/80 uppercase tracking-widest ml-1">最佳雙打搭檔</p>
                <div className="grid gap-2">
                  {player.goldenPartner.map((p: any) => (
                    <div key={p.id} className="bg-amber-50/50 border border-amber-100 rounded-xl md:rounded-2xl p-2.5 md:p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar} referrerPolicy="no-referrer" className="size-8 md:size-10 rounded-lg md:rounded-xl object-cover border border-amber-200" alt="" />
                        <span className="text-sm font-black text-primary-navy">{p.name}</span>
                      </div>
                      <span className="text-base md:text-lg font-display font-black text-amber-600">{p.winRate}% <span className="text-[10px] font-sans text-amber-400 uppercase">勝率</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {player.nemesis && player.nemesis.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-rose-600/80 uppercase tracking-widest ml-1">他的宿命天敵</p>
                <div className="grid gap-2">
                  {player.nemesis.map((p: any) => (
                    <div key={p.id} className="bg-rose-50/50 border border-rose-100 rounded-xl md:rounded-2xl p-2.5 md:p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar} referrerPolicy="no-referrer" className="size-8 md:size-10 rounded-lg md:rounded-xl object-cover border border-rose-200" alt="" />
                        <span className="text-sm font-black text-primary-navy">{p.name}</span>
                      </div>
                      <span className="text-base md:text-lg font-display font-black text-rose-600">{p.winRate}% <span className="text-[10px] font-sans text-rose-400 uppercase">勝率</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🌟 實力波動趨勢 (綁定專屬折線圖) */}
          <div className="space-y-3">
            <h4 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest ml-1">近期實力波動趨勢</h4>
            <div className="w-full bg-white rounded-xl md:rounded-2xl p-3 md:p-4 border border-slate-100 shadow-sm">
              <StatsChart data={player.chart_data} showCard={false} showHeader={false} height={isDesktop ? 180 : 150} />
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <Button className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl bg-primary-navy hover:bg-slate-800 text-white font-black tracking-widest shadow-xl group text-sm md:text-base">
            <Swords size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
            向他發起挑戰
          </Button>
        </div>
      </div>
    );
  };

  return isDesktop ? (
    <Sheet open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent className="w-[92vw] sm:max-w-md p-0 border-none bg-white lg:rounded-l-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
        <Content />
      </SheetContent>
    </Sheet>
  ) : (
    <Drawer open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
      <DrawerContent className="p-0 border-none bg-white rounded-t-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="mx-auto mt-4 h-1.5 w-[60px] shrink-0 rounded-full bg-slate-200" />
        <Content />
      </DrawerContent>
    </Drawer>
  );
}