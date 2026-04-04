import { tournaments } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';
import { TournamentSkeleton } from '@/components/TournamentSkeleton';
import { useState, useEffect } from 'react';

export function Tournament() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 模擬載入過程 (目前為 Mock Data)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
          className="pb-24 pt-8 px-6 space-y-6 bg-[#fbfcfe] min-h-screen"
        >
          <motion.header variants={fadeInUp} className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl text-primary-navy font-display tracking-tight font-bold">Tournaments</h1>
              <p className="text-xs text-primary-slate/50 mt-1 uppercase tracking-[0.2em] font-sans font-semibold">Active & Upcoming</p>
            </div>
          </motion.header>

          {/* Recommended/Ongoing Tournament Hero */}
          {tournaments.filter(t => t.status === 'ongoing').map((t) => (
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
                  <span className="flex items-center gap-2"><Calendar size={16} /> Ends Mar 31</span>
                  <span className="flex items-center gap-2"><Trophy size={16} /> $50,000 Pool</span>
                </div>
                <div className="w-full bg-sapphire-blue text-white rounded-2xl py-5 text-center font-sans font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-sapphire-blue/40 transform group-hover:translate-y-[-4px] transition-transform">
                  View Tournament Detail
                </div>
              </div>
            </motion.section>
          ))}

          {/* List */}
          <section className="space-y-6">
            <motion.h3 variants={fadeInUp} className="font-display font-black text-xl text-primary-navy px-1">Upcoming Events</motion.h3>
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {tournaments.filter(t => t.status === 'upcoming').map(t => (
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
                            {t.startDate} — {t.endDate}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={20} className="text-primary-slate/20 group-hover:text-sapphire-blue transition-all group-hover:translate-x-2" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
