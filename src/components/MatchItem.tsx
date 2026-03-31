import type { Match } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface MatchItemProps {
  match: Match;
}

export function MatchItem({ match }: Readonly<MatchItemProps>) {
  const getStatusConfig = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return { label: 'COMPLETED', color: 'bg-slate-50 text-slate-500 border-slate-100' };
      case 'pending':
        return { label: 'PENDING', color: 'bg-amber-50 text-amber-600 border-amber-100' };
      case 'disputed':
        return { label: 'DISPUTED', color: 'bg-rose-50 text-rose-600 border-rose-100' };
      default:
        return { label: 'UNKNOWN', color: 'bg-slate-50 text-slate-500' };
    }
  };

  const status = getStatusConfig(match.status);
  const p1Change = match.mmrChange?.[0] || 0;
  const p2Change = match.mmrChange?.[1] || 0;

  return (
    <Card className="no-line-card rounded-[2.5rem] bg-white p-6 md:p-8 shadow-sm border border-slate-50 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="p-0 space-y-6 md:space-y-4">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2 md:gap-3 text-sm md:text-sm font-black uppercase tracking-widest text-slate-500">
            <span>{match.date}</span>
            <span className="text-slate-200 text-lg leading-none">•</span>
            <span className="text-electric-blue/70">{match.tournament || 'DIVISION I'}</span>
          </div>
          <Badge variant="secondary" className={cn("px-4 py-1.5 rounded-full text-sm font-black border tracking-widest shadow-none", status.color)}>
            {status.label}
          </Badge>
        </div>

        {/* Dashboard Arena View - Optimized for Mobile Horizontal */}
        <div className="flex items-center justify-between gap-3 md:gap-4 relative overflow-hidden">
           
           {/* Player 1 - Left Section */}
           <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              <div className="relative shrink-0">
                 <img src={match.player1?.avatar} alt={match.player1?.name} className="size-12 md:size-20 rounded-xl md:rounded-[1.5rem] object-cover border-2 border-slate-100 shadow-sm" />
              </div>
              <div className="flex flex-col min-w-0">
                 <span className="font-display font-black text-primary-navy text-sm md:text-xl truncate leading-tight uppercase tracking-tight">
                    {match.player1?.name}
                 </span>
                 <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn("text-sm font-black font-display", p1Change > 0 ? "text-emerald-600" : "text-rose-500")}>
                       {p1Change > 0 ? `+${p1Change}` : p1Change} LP
                    </span>
                    <TrendingUp size={12} strokeWidth={3} className={cn(p1Change > 0 ? "text-emerald-500" : "text-rose-400 rotate-180")} />
                 </div>
              </div>
           </div>

           {/* Central Score Display */}
           <div className="flex flex-col items-center justify-center px-2 md:px-4 shrink-0">
              <div className="flex items-center gap-1.5 md:gap-3">
                 <span className="text-2xl md:text-5xl font-display font-black text-primary-navy tracking-tighter leading-none">
                    {match.score[0]}
                 </span>
                 <span className="text-slate-200 text-base md:text-2xl font-black">:</span>
                 <span className="text-2xl md:text-5xl font-display font-black text-primary-navy tracking-tighter leading-none">
                    {match.score[1]}
                 </span>
              </div>
              <div className="mt-1.5 md:mt-3 px-2 py-0.5 md:px-3 md:py-1 bg-slate-50 rounded-sm md:rounded-md">
                 <span className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">
                   {match.score[0] + match.score[1] >= 5 ? 'BO5' : 'BO3'}
                 </span>
              </div>
           </div>

           {/* Player 2 - Right Section */}
           <div className="flex items-center justify-end gap-3 md:gap-4 flex-1 min-w-0 text-right">
              <div className="flex flex-col min-w-0 order-1">
                 <span className="font-display font-black text-primary-navy text-sm md:text-xl truncate leading-tight uppercase tracking-tight">
                    {match.opponent?.name}
                 </span>
                 <div className="flex items-center justify-end gap-1.5 mt-1">
                    <span className={cn("text-sm font-black font-display", p2Change > 0 ? "text-emerald-600" : "text-rose-500")}>
                       {p2Change > 0 ? `+${p2Change}` : p2Change} LP
                    </span>
                    <TrendingDown size={12} strokeWidth={3} className={cn(p2Change < 0 ? "text-rose-400" : "text-emerald-500 rotate-180")} />
                 </div>
              </div>
              <div className="relative shrink-0 order-2">
                 <img src={match.opponent?.avatar} alt={match.opponent?.name} className="size-12 md:size-20 rounded-xl md:rounded-[1.5rem] object-cover border-2 border-slate-100 shadow-sm" />
              </div>
           </div>
        </div>

        {/* Dispute Action Button */}
        {match.status === 'disputed' && (
          <div className="pt-4 flex justify-center">
             <Button variant="outline" className="w-full max-w-sm bg-rose-50/20 text-rose-600 border-rose-100 hover:bg-rose-50 hover:text-rose-700 rounded-2xl py-6 font-sans font-black text-sm uppercase tracking-widest gap-2 shadow-none">
                <Scale size={16} />
                檢視申訴細節
             </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
