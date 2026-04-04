import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { TournamentSkeleton } from '@/components/TournamentSkeleton';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function Tournament() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tournamentList, setTournamentList] = useState<any[]>([]);
  const [seasonList, setSeasonList] = useState<any[]>([]);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    setIsLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("http://localhost:8000/api/tournaments"),
        fetch("http://localhost:8000/api/seasons")
      ]);
      
      if (tRes.ok) setTournamentList(await tRes.json());
      if (sRes.ok) setSeasonList(await sRes.json());
    } catch (err) {
      console.error("Failed to fetch tournaments", err);
    } finally {
      setIsLoading(false);
    }
  };

  const ongoing = tournamentList.filter(t => t.status === 'ongoing');
  const other = tournamentList.filter(t => t.status !== 'ongoing');

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <TournamentSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pb-24 pt-8 md:pt-12 px-6 space-y-12 bg-[#fbfcfe] min-h-screen"
        >
          <motion.header variants={fadeInUp} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 md:w-3 bg-gradient-to-b from-sapphire-blue to-blue-800 rounded-full h-12 md:h-16 mr-4 md:mr-6 shrink-0" />
              <div className="space-y-1">
                <h1 className="text-4xl md:text-5xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none">Tournaments & Seasons</h1>
                <p className="text-[10px] md:text-xs text-slate-400 font-sans font-black uppercase tracking-[0.3em] opacity-60">Competitive Events</p>
              </div>
            </div>
          </motion.header>
          
          {/* League Seasons Section */}
          <section className="space-y-6">
            <motion.h3 variants={fadeInUp} className="font-display font-black text-xl text-primary-navy px-1">League Seasons 積分賽季</motion.h3>
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {seasonList.map(s => (
                <motion.div key={s.id} variants={itemVariants}>
                  <Card 
                    onClick={() => navigate(`/season/${s.id}`)}
                    className="no-line-card rounded-3xl bg-[#111c2d] p-6 hover:bg-[#1a2b45] transition-all cursor-pointer group shadow-lg border border-[#1a2b45] text-white relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <Trophy size={80} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-sapphire-blue/20 text-sapphire-blue flex items-center justify-center">
                          <Trophy size={24} />
                        </div>
                        <div>
                          <h4 className="font-display font-black text-lg tracking-tight">{s.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn(
                                "text-[9px] uppercase font-sans tracking-widest px-2 py-0.5 border-none",
                                s.status === 'active' ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                            )}>
                                {s.status === 'active' ? 'Active' : 'Completed'}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400">
                                {new Date(s.start_date).toLocaleDateString()} Start
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={20} className="text-white/20 group-hover:text-sapphire-blue transition-all group-hover:translate-x-2" />
                    </div>
                  </Card>
                </motion.div>
              ))}
              {seasonList.length === 0 && (
                <div className="col-span-2 py-10 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                    目前尚無正式賽季
                </div>
              )}
            </motion.div>
          </section>

          {/* Ongoing Tournament Hero */}
          {ongoing.map((t) => (
            <motion.section 
              key={t.id} 
              variants={fadeInUp}
              onClick={() => navigate(`/tournament/${t.id}`)} 
              className="cursor-pointer"
            >
              <div className="bg-[#111c2d] rounded-4xl p-8 text-white relative overflow-hidden shadow-2xl shadow-sapphire-blue/10 border border-[#1a2b45] group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                  <Trophy size={150} />
                </div>
                <Badge className="bg-olympic-gold text-white text-xs uppercase font-sans tracking-widest px-4 py-1.5 mb-4 border-none shadow-lg shadow-olympic-gold/20">
                  Live Now
                </Badge>
                <h2 className="text-3xl md:text-4xl font-display font-black mb-3 tracking-tight">{t.title}</h2>
                <div className="flex items-center gap-6 text-xs font-sans font-bold opacity-60 mb-8 uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Calendar size={16} /> Created {new Date(t.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-2"><Trophy size={16} /> Exclusive Event</span>
                </div>
                <div className="w-full bg-sapphire-blue text-white rounded-2xl py-5 text-center font-sans font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-sapphire-blue/40 transform group-hover:translate-y-[-4px] transition-transform">
                  View Tournament Detail
                </div>
              </div>
            </motion.section>
          ))}

          {/* List */}
          <section className="space-y-6">
            <motion.h3 variants={fadeInUp} className="font-display font-black text-xl text-primary-navy px-1">Exclusive Tournaments 獨立錦標賽</motion.h3>
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {other.map(t => (
                <motion.div key={t.id} variants={itemVariants}>
                  <Card 
                    onClick={() => navigate(`/tournament/${t.id}`)}
                    className="no-line-card rounded-3xl bg-white p-5 hover:bg-slate-50 transition-all cursor-pointer group shadow-sm border border-[#f0f2f5] hover:shadow-xl hover:shadow-slate-200/50"
                  >
                    <CardContent className="p-0 flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="size-14 rounded-2xl bg-slate-100/50 text-slate-400 flex items-center justify-center group-hover:bg-sapphire-blue group-hover:text-white transition-colors duration-500">
                          <Calendar size={24} />
                        </div>
                        <div>
                          <h4 className="font-display font-black text-lg text-primary-navy tracking-tight">{t.title}</h4>
                          <p className="text-xs uppercase font-sans tracking-widest text-slate-400 mt-1 font-bold">
                            {t.status} — {new Date(t.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={20} className="text-primary-slate/20 group-hover:text-sapphire-blue transition-all group-hover:translate-x-2" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {tournamentList.length === 0 && (
                <div className="py-20 text-center text-slate-400">
                    目前尚無專屬錦標賽
                </div>
              )}
            </motion.div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
