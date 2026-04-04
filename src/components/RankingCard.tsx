import type { Player } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, TrendingUp, Building2, Shield, Trophy, Medal, Award, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// 段位徽章邏輯 (保持與全域一致)
const getTierBadge = (mmr: number) => {
  if (mmr >= 2000) return { name: '菁英 (Elite)', icon: <Shield size={14} />, color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-amber-500/20' };
  if (mmr >= 1700) return { name: '金牌 (Gold)', icon: <Trophy size={14} />, color: 'bg-amber-100 text-amber-700 border-amber-300' };
  if (mmr >= 1400) return { name: '銀牌 (Silver)', icon: <Medal size={14} />, color: 'bg-slate-100 text-slate-600 border-slate-300' };
  return { name: '銅牌 (Bronze)', icon: <Award size={14} />, color: 'bg-orange-50 text-orange-700 border-orange-200' };
};

interface RankingCardProps {
  player: Player;
  variant?: 'featured' | 'standard';
  mode?: 'singles' | 'doubles';
}

export function RankingCard({ player, variant = 'standard', mode = 'singles' }: Readonly<RankingCardProps>) {
  const isFeatured = variant === 'featured';

  // Dynamic stats based on mode
  const isDoubles = mode === 'doubles';
  const displayRating = isDoubles ? (player.doublesRating ?? player.rating) : player.rating;
  const displayRank = isDoubles ? (player.doublesRank ?? player.rank) : player.rank;
  const displayStats = isDoubles ? (player.doublesStats ?? player.stats) : player.stats;
  const careerMMR = player.mmr || player.rating || 1200; // 生涯實力
  const tier = getTierBadge(careerMMR);

  return (
    <Link to={`?inspect=${player.id}`} className="block group">
      <Card className={cn(
        "no-line-card relative transition-all duration-300 overflow-visible",
        isFeatured ? "rounded-3xl bg-primary-navy text-white p-6 mt-6 shadow-xl shadow-sapphire-blue/10" : "rounded-2xl bg-white group-hover:bg-slate-50 p-4 mt-4 shadow-sm"
      )}>
        {/* Rank Badge floating outside top left */}
        <div className={cn(
          "absolute -left-4 -top-4 flex items-center justify-center font-display font-black rounded-full shadow-2xl z-20 border-4 border-white transform transition-transform group-hover:scale-110",
          isFeatured ? "size-16 text-2xl bg-olympic-gold text-white" : "size-12 text-xl bg-sapphire-blue text-white"
        )}>
          {displayRank}
        </div>

        <CardContent className="p-0 flex flex-col pt-3 pl-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-5">
              <div className="relative">
                <img
                  src={player.avatar}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  className={cn("rounded-full object-cover transition-all group-hover:ring-2 group-hover:ring-offset-2",
                    isFeatured ? "size-20 border-white/30 group-hover:ring-white shadow-2xl" : "size-12 border-transparent group-hover:ring-sapphire-blue")}
                />
                {player.isVerified && (
                  <div className={cn(
                    "absolute -bottom-1 -right-1 rounded-full p-1 shadow-lg",
                    isFeatured ? "bg-sapphire-blue text-white ring-2 ring-primary-navy" : "bg-[#d8e3fb] text-[#111c2d]"
                  )}>
                    <ShieldCheck size={14} />
                  </div>
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <h3 className={cn("font-display group-hover:text-sapphire-blue transition-colors font-black truncate max-w-[120px] md:max-w-none", isFeatured ? "text-xl md:text-3xl group-hover:text-white" : "text-base md:text-lg")}>{player.name}</h3>
                  {isFeatured && (
                    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-widest shadow-sm", tier.color)}>
                      {tier.icon} {tier.name}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 mt-0.5 md:mt-1">
                  <span className="text-[11px] md:text-sm opacity-60 font-sans font-bold tracking-wide truncate">@{player.username}</span>
                  {isFeatured && player.department && (
                    <span className="text-[9px] md:text-[11px] opacity-50 font-sans flex items-center gap-1.5 uppercase tracking-wider font-bold truncate">
                      <Building2 size={10} className="text-sapphire-blue md:size-[12px]" />
                      {player.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={cn(
                "font-display font-black tracking-tighter leading-none",
                isFeatured ? "text-3xl md:text-5xl text-white" : "text-2xl md:text-3xl text-primary-navy"
              )}>
                {displayRating}
              </div>
              <p className="text-[9px] md:text-[10px] uppercase underline underline-offset-4 decoration-olympic-gold/50 tracking-[0.2em] md:tracking-[0.3em] font-sans font-black opacity-60 mt-1 md:mt-2 flex items-center gap-1 md:gap-2 justify-end">
                本季積分
                <TrendingUp size={10} className={isFeatured ? "text-olympic-gold md:size-[12px]" : "text-sapphire-blue md:size-[12px]"} />
              </p>
              {isFeatured && (
                <div className="mt-4 flex flex-col items-end">
                  <div className="flex items-center gap-2 text-white/40 font-black tracking-widest text-[10px] md:text-xs">
                    <span>生涯積分: {careerMMR}</span>
                    <Star size={10} className="text-olympic-gold" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className={cn(
            "grid grid-cols-3 items-center gap-3 mt-8 pt-6 border-t pb-2",
            isFeatured ? "border-white/10 mr-6" : "border-slate-100 pr-2"
          )}>
            <div className="space-y-1">
              <p className="text-[9px] md:text-[10px] uppercase font-sans font-black opacity-50 tracking-[0.2em]">Win Rate</p>
              <p className={cn("font-display font-black text-xl md:text-2xl", isFeatured ? "text-white" : "text-primary-navy")}>
                {String(displayStats.winRate).replace('%', '')}%
              </p>
            </div>
            <div className={cn("space-y-1 pl-4 md:pl-6 border-l", isFeatured ? "border-white/10" : "border-slate-100")}>
              <p className="text-[9px] md:text-[10px] uppercase font-sans font-black opacity-50 tracking-[0.2em]">Matches</p>
              <p className={cn("font-display font-black text-xl md:text-2xl", isFeatured ? "text-white" : "text-primary-navy")}>
                {(displayStats.wins || 0) + (displayStats.losses || 0)}
              </p>
            </div>
            <div className="ml-auto">
              <div className="text-right">
                <p className="text-[9px] md:text-[10px] uppercase font-sans font-black opacity-50 tracking-[0.2em] mb-1">Record</p>
                <div className="flex gap-2 text-[10px] md:text-sm font-sans font-black">
                  <span className="text-olympic-gold whitespace-nowrap">{displayStats.wins || 0} <span className="text-[9px] opacity-70">W</span></span>
                  <span className={cn("whitespace-nowrap", isFeatured ? "text-slate-400" : "text-slate-500")}>{(displayStats.losses || 0)} <span className="text-[9px] opacity-70">L</span></span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
