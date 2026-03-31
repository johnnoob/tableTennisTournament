import type { Player } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankingCardProps {
  player: Player;
  variant?: 'featured' | 'standard';
}

export function RankingCard({ player, variant = 'standard' }: Readonly<RankingCardProps>) {
  const isFeatured = variant === 'featured';

  return (
    <Card className={cn(
      "no-line-card relative transition-all duration-300 overflow-visible",
      isFeatured ? "rounded-3xl bg-primary-navy text-white p-6 mt-6 shadow-xl shadow-electric-blue/10" : "rounded-2xl bg-white hover:bg-slate-50 p-4 mt-4 shadow-sm"
    )}>
      {/* Rank Badge floating outside top left */}
      <div className={cn(
        "absolute -left-3 -top-3 size-12 flex items-center justify-center font-display font-black text-xl rounded-full shadow-lg z-20 border-4 border-white transform transition-transform group-hover:scale-110",
        isFeatured ? "bg-neon-orange text-white" : "bg-electric-blue text-white"
      )}>
        {player.rank}
      </div>

      <CardContent className="p-0 flex flex-col pt-3 pl-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={player.avatar} 
                alt={player.name} 
                className={cn("rounded-full object-cover border-2", isFeatured ? "size-16 border-white/20" : "size-12 border-transparent")}
              />
              {player.isVerified && (
                <div className={cn(
                  "absolute -bottom-1 -right-1 rounded-full p-1",
                  isFeatured ? "bg-electric-blue text-white" : "bg-[#d8e3fb] text-[#111c2d]" /* primary_fixed mapping */
                )}>
                  <ShieldCheck size={12} />
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className={cn("font-display", isFeatured ? "text-2xl" : "text-lg")}>{player.name}</h3>
                {isFeatured && (
                  <span className="bg-[#ffdbca] text-[#341100] text-[10px] px-2 py-0.5 rounded uppercase font-sans font-bold tracking-wider">
                    Pro
                  </span>
                )}
              </div>
              <span className="text-xs opacity-60 font-sans tracking-wide">{player.username}</span>
            </div>
          </div>

          <div className="text-right">
            <div className={cn(
              "text-3xl font-display font-bold tracking-tighter",
              isFeatured ? "text-white" : "text-primary-navy"
            )}>
              {player.rating}
            </div>
            <p className="text-[10px] uppercase tracking-widest font-sans opacity-50 flex items-center gap-1 justify-end">
              MMR
              <TrendingUp size={10} className={isFeatured ? "text-neon-orange" : "text-electric-blue"} />
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className={cn(
          "flex items-center gap-6 mt-6 pt-4 border-t",
          isFeatured ? "border-white/10" : "border-slate-100"
        )}>
          <div>
            <p className="text-[10px] uppercase font-sans opacity-60 tracking-wider">Win Rate</p>
            <p className="font-display font-bold text-lg">{player.stats.winRate}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-sans opacity-60 tracking-wider">Avg Score</p>
            <p className="font-display font-bold text-lg">{player.stats.avgScore}</p>
          </div>
          <div className="ml-auto flex gap-3 text-xs font-sans">
            <span className="opacity-80"><strong className={isFeatured ? "text-neon-orange" : "text-electric-blue"}>{player.stats.wins}</strong> W</span>
            <span className="opacity-60"><strong>{player.stats.losses}</strong> L</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
