import { tournaments } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Tournament() {
  const navigate = useNavigate();

  return (
    <div className="pb-24 pt-8 px-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-[#fbfcfe] min-h-screen">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-primary-navy font-display tracking-tight font-bold">Tournaments</h1>
          <p className="text-xs text-primary-slate/50 mt-1 uppercase tracking-[0.2em] font-sans font-semibold">Active & Upcoming</p>
        </div>
      </header>

      {/* Recommended/Ongoing Tournament Hero */}
      {tournaments.filter(t => t.status === 'ongoing').map(t => (
        <section key={t.id} onClick={() => navigate(`/tournament/${t.id}`)} className="cursor-pointer">
          <div className="bg-[#111c2d] rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-electric-blue/10 border border-[#1a2b45]">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Trophy size={100} />
            </div>
            <Badge className="bg-neon-orange text-white text-xs uppercase font-sans tracking-widest px-3 py-1 mb-4 border-none">
              Live Now
            </Badge>
            <h2 className="text-2xl font-display font-black mb-2">{t.title}</h2>
            <div className="flex items-center gap-4 text-[11px] font-sans font-bold opacity-60 mb-6 uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Ends Mar 31</span>
              <span className="flex items-center gap-1.5"><Trophy size={14} /> $50,000 Pool</span>
            </div>
            <div className="w-full bg-electric-blue text-white rounded-2xl py-4 text-center font-sans font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-electric-blue/20">
              View Tournament Detail
            </div>
          </div>
        </section>
      ))}

      {/* List */}
      <section className="space-y-4">
        <h3 className="font-display font-bold text-lg text-primary-navy px-1">Upcoming Events</h3>
        <div className="space-y-3">
          {tournaments.filter(t => t.status === 'upcoming').map(t => (
            <Card key={t.id} className="no-line-card rounded-2xl bg-white p-4 hover:bg-slate-50 transition-all cursor-pointer group shadow-sm border border-[#f0f2f5]">
              <CardContent className="p-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-slate-100/50 text-primary-slate flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-primary-navy">{t.title}</h4>
                    <p className="text-xs uppercase font-sans tracking-widest text-slate-500 mt-1 font-bold">
                      {t.startDate} — {t.endDate}
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-primary-slate/20 group-hover:text-electric-blue transition-all group-hover:translate-x-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
