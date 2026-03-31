import { useState } from 'react';
import { matches, currentUser } from '@/data/mockData';
import type { Match } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { ReportScore } from '@/components/ReportScore';
import { Clock, ChevronDown, Check, X, ShieldAlert, Zap, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to format remaining time
const getRemainingTimeStr = (expiresAtStr?: string) => {
  if (!expiresAtStr) return '24h 00m'; // Default fallback
  const expiresAt = new Date(expiresAtStr).getTime();
  const now = new Date().getTime();
  const diffHours = (expiresAt - now) / (1000 * 60 * 60);
  
  if (diffHours < 0) return '已逾期 (Expired)';
  const h = Math.floor(diffHours);
  const m = Math.floor((diffHours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export function PendingActions() {
  const pendingMatches = matches.filter(m => m.status === 'pending');
  if (pendingMatches.length === 0) return null;

  // Split into two groups based on our design strategy
  const actionRequired = pendingMatches.filter(m => m.submittedBy !== currentUser.id && m.submittedBy);
  const waitingOnOthers = pendingMatches.filter(m => m.submittedBy === currentUser.id);

  return (
    <div className="space-y-3 md:space-y-4 mb-2 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {actionRequired.length > 0 && <ActionRequiredGroup matches={actionRequired} />}
      {waitingOnOthers.length > 0 && <WaitingOnOthersGroup matches={waitingOnOthers} />}
    </div>
  );
}

// Group 1: Action Required (High Priority, Red)
function ActionRequiredGroup({ matches }: { matches: Match[] }) {
  // Only show top 3 initially to save space, user can expand if there are somehow many
  const [expanded, setExpanded] = useState(false);
  const displayMatches = expanded ? matches : matches.slice(0, 3);
  const hasMore = matches.length > 3;

  return (
    <div className="bg-red-50/50 border-2 border-red-100 rounded-[2rem] overflow-hidden shadow-sm shadow-red-100/30">
      <div className="bg-red-100/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldAlert className="text-red-500 relative z-10" size={24} />
            <div className="absolute inset-0 bg-red-400 blur-md opacity-30 animate-pulse rounded-full" />
          </div>
          <div>
            <h3 className="font-display font-black text-red-600 text-lg leading-tight uppercase tracking-wide">
              Action Required
            </h3>
            <span className="text-xs font-bold text-red-500/70 tracking-widest uppercase block -mt-0.5">
              待您確認賽果 ({matches.length})
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-3 md:p-4 space-y-3">
        {displayMatches.map(match => (
          <ActionMatchCard key={match.id} match={match} />
        ))}
        
        {hasMore && (
           <Button 
             variant="ghost" 
             onClick={() => setExpanded(!expanded)} 
             className="w-full text-red-500 hover:text-red-600 hover:bg-red-50/50 text-xs font-black uppercase tracking-widest mt-2"
           >
             {expanded ? "折疊顯示" : `查看其餘 ${matches.length - 3} 筆`}
           </Button>
        )}
      </div>
    </div>
  );
}

function ActionMatchCard({ match }: { match: Match }) {
  const opponentPlayer = match.opponent;
  const isLoss = match.score[0] < match.score[1]; 
  const lpChange = match.mmrChange[0];
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  if (isDisputing) {
    return (
      <div className="bg-white rounded-3xl p-4 md:p-5 flex flex-col gap-3 border border-rose-100 shadow-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
        <h4 className="font-bold text-slate-700 text-sm">提出異議：與 {opponentPlayer.name} 的賽果</h4>
        <textarea 
          className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300 transition-all font-medium text-slate-700 placeholder:text-slate-400"
          placeholder="請簡述異議原因（例如：比分登錄錯誤、尚未完賽等）..."
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={() => setIsDisputing(false)} className="text-slate-500 hover:bg-slate-100 font-bold tracking-widest text-xs uppercase h-9 rounded-xl">返回</Button>
          <Button 
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold tracking-widest text-xs uppercase h-9 px-5 rounded-xl shadow-sm border-none shadow-rose-500/20"
            disabled={!disputeReason.trim()}
          >
            送出異議
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border border-red-50 shadow-sm relative overflow-hidden group">
      {/* Decorative pulse line for urgency */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-400 group-hover:bg-red-500 transition-colors" />

      {/* Opponent & Score Info */}
      <div className="flex items-center gap-4 flex-1">
        <img 
          src={opponentPlayer.avatar} 
          alt={opponentPlayer.name} 
          className="size-12 md:size-14 rounded-2xl object-cover shadow-sm bg-slate-50" 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <span className="font-sans font-black text-primary-navy truncate text-sm md:text-base">
                對戰：{opponentPlayer.name}
             </span>
             <span className={cn(
               "text-xs md:text-sm font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
               isLoss ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-emerald-50 border-emerald-100 text-emerald-600"
             )}>
               {isLoss ? 'LOSS' : 'WIN'}
             </span>
          </div>
          <div className="flex items-center gap-3">
             <span className="font-display font-black text-2xl md:text-3xl tracking-tighter text-slate-700 leading-none">
                {match.score[0]} <span className="text-slate-300 font-sans mx-0.5">:</span> {match.score[1]}
             </span>
             <div className="h-6 w-px bg-slate-100" />
             <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">LP Effect</span>
                <span className={cn("text-xs md:text-sm font-display font-black leading-none", lpChange < 0 ? 'text-rose-500' : 'text-emerald-500')}>
                   {lpChange > 0 ? `+${lpChange}` : lpChange}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between md:justify-end mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-50 md:border-none">
        
        {/* Countdown */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg shrink-0">
           <Clock size={14} className="text-red-500" />
           <span className="text-xs font-black font-display text-red-600 tabular-nums leading-none tracking-wide mt-0.5">
             倒數 {getRemainingTimeStr(match.expiresAt)}
           </span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsDisputing(true)}
            className="size-10 rounded-xl border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 bg-white"
          >
            <X size={18} strokeWidth={3} />
          </Button>
          <Button className="h-10 px-4 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-black text-sm tracking-widest shadow-lg shadow-primary-navy/20 gap-2 border-none">
            <Check size={16} strokeWidth={3} className="text-emerald-400" />
            確認
          </Button>
        </div>
      </div>
    </div>
  );
}

// Group 2: Waiting on Opponent (Low Priority, Collapsible)
function WaitingOnOthersGroup({ matches }: { matches: Match[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden transition-all duration-300 hover:bg-slate-100/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
           <Zap className="text-slate-400" size={18} />
           <span className="text-sm font-black text-slate-600 tracking-wide">
             {matches.length} 筆賽果等待對方確認中 <span className="hidden md:inline text-xs font-bold text-slate-400 ml-2">(時限後將自動生效)</span>
           </span>
        </div>
        <ChevronDown 
          size={20} 
          className={cn("text-slate-400 transition-transform duration-300", isOpen && "rotate-180")} 
        />
      </button>

      <div className={cn(
        "grid transition-all duration-300 ease-in-out", 
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
           <div className="px-3 pb-3 pt-0 space-y-2">
               {matches.map(match => {
                 const isLoss = match.score[0] < match.score[1];
                 
                 return (
                 <div key={match.id} className="bg-white rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm border border-slate-50 gap-3">
                    <div className="flex items-center gap-3">
                       <img src={match.opponent.avatar} alt={match.opponent.name} className="size-8 rounded-lg grayscale opacity-60" />
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-slate-600">{match.opponent.name}</span>
                         <span className={cn(
                           "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                           isLoss ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
                         )}>
                           {isLoss ? 'LOSS' : 'WIN'}
                         </span>
                       </div>
                       <span className="text-xs font-black text-slate-400 tracking-widest ml-1">{match.score[0]} : {match.score[1]}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                       <div className="text-[11px] font-bold text-slate-400 tabular-nums flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md shrink-0">
                          <Clock size={12} />
                          生效剩餘 {getRemainingTimeStr(match.expiresAt)}
                       </div>
                       <div className="flex items-center gap-1 shrink-0">
                         <ReportScore 
                           editMode
                           initialOpponentId={match.opponent.id}
                           initialScoreA={match.score[0]}
                           initialScoreB={match.score[1]}
                           trigger={
                             <Button variant="ghost" size="icon" className="size-8 rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100 transition-colors" title="修改賽果">
                               <Pencil size={15} />
                             </Button>
                           }
                         />
                         <Button variant="ghost" size="icon" className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="撤回申報">
                           <Trash2 size={15} />
                         </Button>
                       </div>
                    </div>
                 </div>
                 );
               })}
           </div>
        </div>
      </div>
    </div>
  );
}
