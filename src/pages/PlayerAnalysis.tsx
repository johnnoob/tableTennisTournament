import { useParams, useNavigate, Link } from 'react-router-dom';
import { players } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  Star,
  Skull,
  Crown,
  HandMetal,
  Target,
  Shield,
  Layers
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

export function PlayerAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const player = players.find(p => p.id === id) || players[0];

  // Mock data for the trend chart
  const trendData = [
    { name: 'M01', mmr: 2400 },
    { name: 'M05', mmr: 2450 },
    { name: 'M10', mmr: 2420 },
    { name: 'M15', mmr: 2580 },
    { name: 'M20', mmr: 2510 },
    { name: 'M25', mmr: 2650 },
    { name: 'M30', mmr: player.rating },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 animate-in fade-in duration-500">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="rounded-xl flex items-center gap-2 text-primary-navy hover:bg-slate-100"
        >
          <ArrowLeft size={18} />
          <span className="font-bold uppercase tracking-widest text-[10px]">Back</span>
        </Button>
        <h1 className="font-display font-black text-primary-navy uppercase tracking-tighter text-sm">Player Analysis</h1>
        <div className="w-20" /> {/* Spacer */}
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-8 md:space-y-12">

        {/* 1. Hero Card - Responsive Side-by-Side on Desktop */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center lg:items-start lg:text-left text-center gap-8 md:gap-12 relative overflow-hidden">
          <div className="relative group shrink-0">
            <div className="absolute inset-0 rounded-3xl bg-electric-blue/10 scale-110 blur-2xl group-hover:bg-electric-blue/20 transition-all duration-500" />
            <div className="relative size-40 md:size-56 rounded-[2rem] p-1 bg-gradient-to-tr from-electric-blue to-neon-orange overflow-hidden border-2 border-white shadow-2xl">
              <img
                src={player.avatar}
                alt={player.name}
                className="w-full h-full rounded-[1.8rem] object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-white rounded-full p-1.5 shadow-md border border-slate-50 z-10">
                <ShieldCheck size={24} className="text-electric-blue fill-electric-blue/10" />
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 md:space-y-8 relative py-2">
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 justify-center lg:justify-start">
                <span className="bg-electric-blue/10 text-electric-blue px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-electric-blue/5 self-center lg:self-auto">
                  Global Rank #{player.rank.toString().padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-4xl md:text-7xl font-display font-black text-primary-navy tracking-tight leading-[0.9] uppercase italic">
                {player.name}
              </h2>
              <p className="text-xs md:text-sm font-sans font-bold text-primary-slate/40 uppercase tracking-[0.2em]">
                Strategic Offense Specialist | {player.department || 'Taiwan District Office'}
              </p>
            </div>

          </div>
        </section>

        {/* 2. Stats Grid - Row of 4 on Desktop */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            label="Win Rate"
            value={player.stats.winRate}
            unit="%"
            icon={<Activity size={24} />}
            color="text-primary-navy"
            trend="-2.4% From Last week"
          />
          <StatCard
            label="Season Win %"
            value={player.stats.seasonWinRate || 0}
            unit="%"
            icon={<TrendingUp size={24} />}
            color="text-neon-orange"
            trend="+0.5% Consistency"
          />
          <StatCard
            label="Max Streak"
            value={player.stats.maxStreak || 0}
            unit="Wins"
            icon={<Zap size={24} />}
            color="text-electric-blue"
            trend="Active Streak: 4"
          />
          <StatCard
            label="Current MMR"
            value={player.rating.toLocaleString()}
            unit=""
            icon={<Star size={24} />}
            color="text-primary-navy"
            trend="Top 0.1% Globally"
          />
        </section>

        {/* 3. Middle Section: Trends & Equipment Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trends Chart (2/3 width) */}
          <section className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[12px] font-black text-primary-navy uppercase tracking-widest">Performance Trends</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Season 4 Metrics</p>
              </div>
              <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
                {['1W', '1M', 'ALL'].map(t => (
                  <button key={t} className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all", t === '1M' ? "bg-electric-blue text-white shadow-sm" : "text-slate-400 hover:text-primary-navy")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                  <Tooltip
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '16px' }}
                    itemStyle={{ fontWeight: 900, color: '#111c2d', fontSize: '14px' }}
                    cursor={{ stroke: '#0058be', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mmr"
                    stroke="#0058be"
                    strokeWidth={6}
                    dot={{ r: 8, fill: '#0058be', strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 12, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Equipment Specs (1/3 width) - Redesigned Layout */}
          <section className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-primary-navy" />
                <h4 className="text-[12px] font-black text-primary-navy uppercase tracking-widest">Equipment Specs</h4>
              </div>
              <HandMetal size={18} className="text-slate-200" />
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
              {/* Forehand Rubber Card */}
              <div className="group relative bg-slate-50/50 rounded-[2rem] p-6 border-l-4 border-red-500 hover:bg-red-50/30 transition-all cursor-default overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
                  <Target size={80} className="text-red-600 -rotate-12" />
                </div>
                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg tracking-widest uppercase">FH</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forehand Power</span>
                  </div>
                  <h5 className="text-xl font-display font-black text-primary-navy leading-tight tracking-tight uppercase italic group-hover:text-red-600 transition-colors">
                    {player.racketConfig?.forehand || '平面－澀性膠皮'}
                  </h5>
                  <div className="flex items-center gap-1.5">
                     <div className="size-1.5 rounded-full bg-red-500" />
                     <span className="text-[9px] font-bold text-slate-400 uppercase">Competitive Grade</span>
                  </div>
                </div>
              </div>

              {/* Backhand Rubber Card */}
              <div className="group relative bg-slate-50/50 rounded-[2rem] p-6 border-l-4 border-slate-900 hover:bg-slate-100 transition-all cursor-default overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
                  <Shield size={80} className="text-slate-900 -rotate-12" />
                </div>
                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-lg tracking-widest uppercase">BH</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Backhand Control</span>
                  </div>
                  <h5 className="text-xl font-display font-black text-primary-navy leading-tight tracking-tight uppercase italic group-hover:text-slate-700 transition-colors">
                    {player.racketConfig?.backhand || '平面－黏性膠皮'}
                  </h5>
                  <div className="flex items-center gap-1.5">
                     <div className="size-1.5 rounded-full bg-slate-900" />
                     <span className="text-[9px] font-bold text-slate-400 uppercase">Mastery Certified</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50">
               <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest text-center italic">
                 "Equipment tuned for high-precision competitive play"
               </p>
            </div>
          </section>
        </div>

        {/* 4. Nemesis & Prey Modules - Side by Side on Desktop */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Nemesis Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Skull size={18} className="text-red-500" />
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Primary Nemesis</h4>
              </div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Win Rate: Low</span>
            </div>
            <div className="space-y-4">
              {player.nemesis?.map((rival) => (
                <RivalCard key={rival.id} rival={rival} type="nemesis" />
              )) || (
                  <div className="text-center py-12 text-slate-200 font-bold uppercase text-[12px] tracking-widest bg-white rounded-[2.5rem] border border-dashed border-slate-200">No Data Available</div>
                )}
            </div>
          </div>

          {/* Prey Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-green-500" />
                <h4 className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Preferred Opponent</h4>
              </div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Win Rate: High</span>
            </div>
            <div className="space-y-4">
              {player.prey?.map((rival) => (
                <RivalCard key={rival.id} rival={rival} type="prey" />
              )) || (
                  <div className="text-center py-12 text-slate-200 font-bold uppercase text-[12px] tracking-widest bg-white rounded-[2.5rem] border border-dashed border-slate-200">No Data Available</div>
                )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

function StatCard({ label, value, unit, icon, color, trend }: { label: string, value: number | string, unit?: string, icon: React.ReactNode, color: string, trend?: string }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all cursor-default">
      <p className="text-[10px] font-black text-primary-slate/30 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <h3 className={cn("text-4xl font-display font-black tracking-tighter tabular-nums", color)}>{value}</h3>
        {unit && <span className="text-xs font-black text-slate-400 uppercase">{unit}</span>}
      </div>
      {trend && (
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-1">
          <Activity size={10} className="text-slate-300" />
          {trend}
        </p>
      )}
      <div className={cn("absolute right-6 top-8 opacity-[0.35] group-hover:opacity-[0.6] transition-opacity scale-150 rotate-12 transition-transform duration-500 group-hover:rotate-0", color)}>
        {icon}
      </div>
    </div>
  );
}

function RivalCard({ rival, type }: { rival: any, type: 'nemesis' | 'prey' }) {
  const isNemesis = type === 'nemesis';
  return (
    <Link to={`/player/${rival.id}`} className="block group">
      <div className="bg-white px-8 py-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6 hover:shadow-xl hover:-translate-y-1 transition-all">
        <div className="relative">
          <img src={rival.avatar} alt={rival.name} className="size-16 md:size-20 rounded-2xl object-cover border border-slate-100 shadow-sm transition-transform group-hover:scale-105" />
          <div className={cn("absolute -bottom-2 -right-2 size-6 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md", isNemesis ? "bg-red-500" : "bg-green-500")}>
            {isNemesis ? <Skull size={12} /> : <Crown size={12} />}
          </div>
        </div>
        <div className="flex-1">
          <h5 className="text-xl md:text-2xl font-display font-black text-primary-navy tracking-tight group-hover:text-electric-blue transition-colors italic uppercase">{rival.name}</h5>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg",
              isNemesis ? "text-red-500 bg-red-50" : "text-electric-blue bg-electric-blue/5"
            )}>
              {isNemesis ? "Negative Matchup" : "Preferred Prey"}
            </span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Region: Tokyo</span>
          </div>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-3xl md:text-4xl font-display font-black tracking-tighter leading-none italic",
            isNemesis ? "text-red-500" : "text-green-500"
          )}>
            {rival.winRate}%
          </p>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Win Probability</p>
        </div>
      </div>
    </Link>
  );
}

