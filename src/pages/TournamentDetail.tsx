import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { players } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, MapPin, Scale, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants, fadeInUp, pageVariants } from '@/lib/animations';

export function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetch("http://localhost:8000/api/tournaments")
      .then(res => res.json())
      .then(data => {
        const found = data.find((t: any) => t.id === id) || data[0];
        setTournament(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!tournament || tournament.status === 'completed') return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center font-bold text-slate-400">載入賽事中...</div>;
  }

  if (!tournament) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400 font-bold">找不到該賽事資訊</p>
        <button onClick={() => navigate('/tournament')} className="px-6 py-2 bg-sapphire-blue text-white rounded-xl">返回列表</button>
      </div>
    );
  }

  const isCompleted = tournament.status === 'completed';

  const sDate = tournament.start_date || tournament.startDate;
  const eDate = tournament.end_date || tournament.endDate;
  
  const hasValidTimeline = Boolean(sDate && eDate);
  const start = hasValidTimeline ? new Date(sDate) : new Date();
  const end = hasValidTimeline ? new Date(eDate) : new Date();

  let totalDuration = 1;
  let elapsed = 0;
  let progress = 0;
  let diffTime = 0;

  if (hasValidTimeline) {
    totalDuration = end.getTime() - start.getTime();
    if (totalDuration <= 0) totalDuration = 1; // 避免除以 0
    elapsed = now.getTime() - start.getTime();
    progress = isCompleted ? 100 : Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    diffTime = Math.max(0, end.getTime() - now.getTime());
  }

  const rDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const rHours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
  const rMinutes = Math.floor((diffTime / 1000 / 60) % 60);
  const rSeconds = Math.floor((diffTime / 1000) % 60);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 bg-white min-h-screen"
    >
      {/* Header */}
      <motion.header variants={fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-2 md:w-3 bg-gradient-to-b from-sapphire-blue to-blue-800 rounded-full h-12 md:h-16 mr-4 md:mr-6 shrink-0" />
          <div className="space-y-1">
            <h1 className="text-4xl md:text-5xl text-primary-navy font-display tracking-tighter font-black uppercase leading-none">
              {tournament.title}
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 font-sans font-black uppercase tracking-[0.3em] opacity-60">Active Tournament Details</p>
          </div>
        </div>
      </motion.header>

      {/* Main Content Grid (Responsive) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 md:gap-16">

        {/* Left Column: Stats & Information (8 cols) */}
        <div className="xl:col-span-8 space-y-12">

          {/* Season Progress Card */}
          <motion.section variants={fadeInUp}>
            <Card className="no-line-card rounded-[2.5rem] bg-[#fbfcff] p-8 md:p-12 shadow-sm border border-slate-50 overflow-hidden relative group">
              <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700">
                <Trophy size={200} />
              </div>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-[11px] uppercase font-sans tracking-widest text-primary-slate/50 font-black mb-2">Tournament Timeline</p>
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-black text-primary-navy tracking-tighter">
                    {isCompleted ? (
                      <>Tournament <span className="text-primary-slate/20">Ended</span></>
                    ) : !hasValidTimeline ? (
                      <>Time <span className="text-primary-slate/20">TBA</span></>
                    ) : (
                      <div className="flex items-baseline gap-2 md:gap-4 tabular-nums">
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rDays}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Days</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rHours.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Hrs</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none">{rMinutes.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-slate-400 mt-2 font-black">Min</span>
                        </div>
                        <span className="text-primary-slate/20 pb-4 md:pb-6">:</span>
                        <div className="flex flex-col items-center">
                          <span className="leading-none text-sapphire-blue">{rSeconds.toString().padStart(2, '0')}</span>
                          <span className="text-[10px] md:text-xs uppercase font-sans tracking-widest text-sapphire-blue/60 mt-2 font-black">Sec</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-xs md:text-sm font-sans font-black px-4 py-2 rounded-xl block mb-2 transition-all duration-300",
                    isCompleted ? "bg-amber-100 text-amber-700" : "bg-sapphire-blue/5 text-sapphire-blue"
                  )}>
                    {isCompleted ? "🏆 賽事已結束" : `${progress.toFixed(2)}% 進度`}
                  </span>
                </div>
              </div>
              <Progress value={progress} className="h-4 bg-slate-100 rounded-full" />
            </Card>
          </motion.section>

          {/* Tournament Detailed Information */}
          <motion.section variants={fadeInUp} className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 font-sans border-b border-slate-50 pb-4 inline-block">Technical Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col gap-4 p-6 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-sapphire-blue w-fit">
                  <Calendar size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-500 tracking-widest">Duration</p>
                  <p className="text-sm md:text-base font-sans font-extrabold text-primary-navy mt-1">Jan 1st - Mar 31st</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-6 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-sapphire-blue w-fit">
                  <MapPin size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-500 tracking-widest">Office Location</p>
                  <p className="text-sm md:text-base font-sans font-extrabold text-primary-navy mt-1">Building B, Main Hall</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-6 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-sapphire-blue w-fit">
                  <Scale size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-sans font-black text-slate-500 tracking-widest">Comp. Rules</p>
                  <p className="text-xs font-sans font-bold text-primary-navy mt-1">Stardard ITTF (Best of 5)</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/40 p-10 rounded-[2.5rem] border border-slate-50">
              <h4 className="font-display font-black text-primary-navy text-xl md:text-2xl mb-4">Official Participation Guidelines</h4>
              <p className="text-sm md:text-base text-primary-slate/60 font-sans leading-relaxed">
                {tournament.rules}
              </p>
            </div>
          </motion.section>

          {/* Large Prizes Grid */}
          <section className="space-y-6">
            <motion.h2 variants={fadeInUp} className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 font-sans border-b border-slate-50 pb-4 inline-block">Official Rewards</motion.h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {(tournament.prizes || []).map((prize: any, idx: number) => (
                <motion.div key={prize.position || idx} variants={itemVariants} className="relative mt-4 group">
                  <div className="absolute -top-3 -left-3 size-12 rounded-2xl bg-white/90 backdrop-blur-md flex items-center justify-center font-display font-black shadow-lg border border-slate-100 z-20 transform group-hover:scale-110 transition-transform">
                    {prize.position}
                  </div>

                  <Card className="no-line-card rounded-[2.5rem] bg-white border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-primary-navy/5 transition-all duration-700 relative p-0">
                    <div className="h-56 relative overflow-hidden">
                      <img src={prize.image} alt={prize.item} className="size-full object-cover transform group-hover:scale-110 transition-transform duration-1000" />
                    </div>
                    <div className="p-6 text-center">
                      <span className="text-xs uppercase font-sans font-black text-sapphire-blue tracking-tighter block mb-2">{prize.label}</span>
                      <h4 className="font-display font-bold text-primary-navy text-lg leading-tight mb-2">{prize.item}</h4>
                      <p className="text-xs text-slate-500 font-sans">{prize.description}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </section>

        </div>

        <div className="xl:col-span-4 space-y-12">
          <section className="space-y-6">
            <motion.div variants={fadeInUp} className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-xl text-primary-navy font-display font-black">Season Rankings</h2>
              <Trophy size={20} className="text-primary-navy/20" />
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {players.slice(0, 5).map((player, idx) => (
                <motion.div
                  key={player.id}
                  variants={itemVariants}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('inspect', player.id);
                    setSearchParams(newParams);
                  }}
                  className="flex items-center gap-4 p-4 rounded-3xl bg-[#fbfcff] hover:bg-slate-50 transition-colors border border-slate-100 relative overflow-visible group mt-2 cursor-pointer"
                >
                  <div className={cn(
                    "absolute -left-3 -top-3 size-10 md:size-12 rounded-2xl flex items-center justify-center font-display font-black text-xl shrink-0 transition-all shadow-md z-20 border-2 border-white",
                    idx === 0 ? "bg-olympic-gold text-white" : "bg-white text-primary-slate"
                  )}>
                    {player.rank}
                  </div>
                  <div className="flex-1 pl-8 flex items-center gap-4">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="size-10 md:size-12 rounded-full object-cover shadow-sm bg-slate-50 border border-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="size-10 md:size-12 rounded-full bg-gradient-to-br from-sapphire-blue/10 to-blue-500/10 flex items-center justify-center border border-sapphire-blue/20 shadow-inner shrink-0">
                        <span className="text-sm md:text-base font-display font-black text-sapphire-blue">
                          {player.name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <h4 className="font-sans font-black text-primary-navy text-sm md:text-base">{player.name}</h4>
                      <p className="text-[10px] md:text-xs uppercase font-sans font-bold text-slate-500 tracking-wider mt-0.5">
                        WR {player.stats.winRate}% • {player.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-lg md:text-xl text-primary-navy">{player.rating.toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
