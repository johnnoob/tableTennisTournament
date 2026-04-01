import { useParams, useNavigate } from 'react-router-dom';
import { tournaments, players } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, MapPin, Scale, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const tournament = tournaments.find(t => t.id === id) || tournaments[0];
  
  const start = new Date(tournament.startDate).getTime();
  const end = new Date(tournament.endDate).getTime();
  const now = new Date('2026-03-24').getTime(); 
  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 bg-white min-h-screen">
      {/* Header */}
      <header className="flex items-center gap-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-2xl bg-slate-50 shadow-sm border border-slate-100 p-6 md:p-8"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={22} className="text-primary-navy" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-5xl text-primary-navy font-display tracking-tight font-black">
            {tournament.title}
          </h1>
          <p className="text-xs md:text-xs text-slate-500 uppercase tracking-[0.3em] font-sans font-black mt-2">Active Tournament Details</p>
        </div>
      </header>

      {/* Main Content Grid (Responsive) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 md:gap-16">
        
        {/* Left Column: Stats & Information (8 cols) */}
        <div className="xl:col-span-8 space-y-12">
          
          {/* Season Progress Card */}
          <section>
            <Card className="no-line-card rounded-[2.5rem] bg-[#fbfcff] p-8 md:p-12 shadow-sm border border-slate-50 overflow-hidden relative group">
              <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700">
                 <Trophy size={200} />
              </div>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-[11px] uppercase font-sans tracking-widest text-primary-slate/50 font-black mb-2">Season Status</p>
                  <h3 className="text-4xl md:text-6xl font-display font-black text-primary-navy tracking-tighter">
                    {daysLeft} Days <span className="text-primary-slate/20">Remains</span>
                  </h3>
                </div>
                <div className="text-right">
                   <span className="text-xs md:text-sm font-sans font-black text-sapphire-blue bg-sapphire-blue/5 px-4 py-2 rounded-xl">
                     {Math.round(progress)}% Season Compete
                   </span>
                </div>
              </div>
              <Progress value={progress} className="h-4 bg-slate-100 rounded-full" />
            </Card>
          </section>

          {/* Tournament Detailed Information */}
          <section className="space-y-6">
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
          </section>

          {/* Large Prizes Grid */}
          <section className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 font-sans border-b border-slate-50 pb-4 inline-block">Official Rewards</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tournament.prizes.map((prize) => (
                <div key={prize.position} className="relative mt-4 group">
                  {/* Floating Trophy Badge - Now outside overflow-hidden Card */}
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
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Right Column: Leaderboard Section (4 cols) */}
        <div className="xl:col-span-4 space-y-12">
          
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-xl text-primary-navy font-display font-black">Season Rankings</h2>
              <Trophy size={20} className="text-primary-navy/20" />
            </div>
            
            <div className="space-y-4">
              {players.slice(0, 5).map((player, idx) => (
                <div key={player.id} className="flex items-center gap-4 p-4 rounded-3xl bg-[#fbfcff] hover:bg-slate-50 transition-colors border border-slate-100 relative overflow-visible group mt-2">
                  <div className={cn(
                    "absolute -left-3 -top-3 size-10 md:size-12 rounded-2xl flex items-center justify-center font-display font-black text-xl shrink-0 transition-all shadow-md z-20 border-2 border-white",
                    idx === 0 ? "bg-olympic-gold text-white" : "bg-white text-primary-slate"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 pl-8">
                     <h4 className="font-sans font-black text-primary-navy text-sm md:text-base">{player.name}</h4>
                     <p className="text-xs uppercase font-sans font-bold text-slate-500 tracking-wider">
                       WR {player.stats.winRate}% • {player.title}
                     </p>
                  </div>
                  <div className="text-right">
                     <span className="font-display font-black text-lg md:text-xl text-primary-navy">{player.rating.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              
              {/* Removed: Join Season Now Button */}
            </div>
          </section>

          {/* Removed: Social / Activity Box */}

        </div>

      </div>

    </div>
  );
}
