import { useState } from 'react';
import { matches } from '@/data/mockData';
import type { Match } from '@/data/mockData';
import { MatchItem } from '@/components/MatchItem';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, SlidersHorizontal, Trophy, XCircle, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function MatchHistory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  
  const filteredMatches = matches.filter((m: Match) => {
    if (filter === 'all') return true;
    return m.result === filter;
  });

  return (
    <div className="pb-24 pt-8 px-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 min-h-screen bg-[#fbfcfe]">
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft size={18} className="text-primary-navy" />
              </Button>
              <div>
                <h1 className="text-3xl text-primary-navy font-display tracking-tight">最新賽果</h1>
                <p className="text-xs text-primary-slate/50 mt-1 uppercase tracking-[0.2em] font-sans font-semibold">Precision Arena Feed</p>
              </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border border-slate-100">
             <SlidersHorizontal size={18} className="text-primary-navy" />
          </Button>
        </div>

        {/* Search & Filter Pills */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sapphire-blue transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search opponent or event..." 
              className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-sans outline-none border border-transparent shadow-sm focus:border-sapphire-blue/20 focus:ring-4 focus:ring-sapphire-blue/5 transition-all text-primary-navy"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Button 
              onClick={() => setFilter('all')}
              className={cn(
                "rounded-full px-5 py-0 h-9 text-xs uppercase font-sans tracking-widest font-bold transition-all",
                filter === 'all' ? "bg-primary-navy text-white shadow-lg shadow-primary-navy/20" : "bg-white text-primary-navy border border-slate-100 hover:bg-slate-50"
              )}
            >
              <LayoutGrid size={12} className="mr-2" /> All
            </Button>
            <Button 
              onClick={() => setFilter('win')}
              className={cn(
                "rounded-full px-5 py-0 h-9 text-xs uppercase font-sans tracking-widest font-bold transition-all",
                filter === 'win' ? "bg-sapphire-blue text-white shadow-lg shadow-sapphire-blue/20" : "bg-white text-primary-navy border border-slate-100 hover:bg-slate-50"
              )}
            >
              <Trophy size={12} className="mr-2" /> Wins
            </Button>
            <Button 
              onClick={() => setFilter('loss')}
              className={cn(
                "rounded-full px-5 py-0 h-9 text-xs uppercase font-sans tracking-widest font-bold transition-all",
                filter === 'loss' ? "bg-primary-slate text-white shadow-lg shadow-primary-slate/20" : "bg-white text-primary-navy border border-slate-100 hover:bg-slate-50"
              )}
            >
              <XCircle size={12} className="mr-2" /> Losses
            </Button>
          </div>
        </div>
      </header>

      {/* Match Timeline */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 py-2 text-slate-500 opacity-100">
           <span className="text-xs uppercase font-sans font-bold tracking-[0.2em] text-primary-navy shrink-0">
             Match Timeline
           </span>
           <div className="h-px bg-primary-navy flex-1"></div>
        </div>

        <div className="space-y-4">
          {filteredMatches.map((match: Match) => (
            <MatchItem key={match.id} match={match} />
          ))}
          {filter === 'all' && matches.map((match: Match) => (
            <MatchItem key={`${match.id}-dup`} match={match} />
          ))}
        </div>
      </section>

      <div className="pt-4 pb-12">
        <Button variant="outline" className="w-full rounded-2xl border-none bg-white shadow-sm py-8 text-[11px] font-bold uppercase tracking-widest text-primary-navy hover:bg-slate-50 transition-all font-sans">
          Load More Matches
        </Button>
      </div>
    </div>
  );
}
