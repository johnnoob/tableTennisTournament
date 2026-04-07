import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Clock, ChevronDown, Check, X, ShieldAlert, Zap, Pencil, Trash2, CheckCircle2, Trophy } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// 統一的 Pending Match 資料形狀（從後端 API 回傳）
interface PendingPlayer {
  id: string;
  name: string;
  avatar: string;
}

interface PendingMatch {
  id: string;
  date: string;
  score: [number, number];
  result: string;
  status: string;
  type: string;
  mmrChange: [number, number];
  player1: PendingPlayer[];
  opponent: PendingPlayer[];
  submittedBy?: string;
  expiresAt?: string;
}

// Helper to format remaining time
const getRemainingTimeStr = (expiresAtStr?: string) => {
  if (!expiresAtStr) return '--:--';
  const expiresAt = new Date(expiresAtStr).getTime();
  const now = Date.now();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) return '已逾期';
  
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export function PendingActions() {
  const { data: currentUser } = useAuth();

  // 🌟 使用 React Query 撈取待確認清單
  const { data: pendingMatches = [] } = useQuery({
    queryKey: ['matches', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<PendingMatch[]>("/matches/pending");
      return res.data;
    },
    enabled: !!currentUser,
    refetchInterval: 10000, // 每 10 秒自動刷新一次，確保即時性
  });

  if (pendingMatches.length === 0) return null;

  const actionRequired = pendingMatches.filter(m => m.submittedBy !== currentUser?.id && m.submittedBy);
  const waitingOnOthers = pendingMatches.filter(m => m.submittedBy === currentUser?.id);

  return (
    <div className="space-y-3 md:space-y-4 mb-2 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {actionRequired.length > 0 && <ActionRequiredGroup matches={actionRequired} />}
      {waitingOnOthers.length > 0 && <WaitingOnOthersGroup matches={waitingOnOthers} />}
    </div>
  );
}

// Group 1: Action Required (High Priority, Red)
function ActionRequiredGroup({ matches }: { matches: PendingMatch[] }) {
  // Only show top 3 initially to save space, user can expand if there are somehow many
  const [expanded, setExpanded] = useState(false);
  const displayMatches = expanded ? matches : matches.slice(0, 3);
  const hasMore = matches.length > 3;

  return (
    <div className="bg-red-50/50 border-2 border-red-100 rounded-4xl overflow-hidden shadow-sm shadow-red-100/30">
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

function ActionMatchCard({ match }: { match: PendingMatch }) {
  const queryClient = useQueryClient();
  const opponentPlayers = match.opponent;
  const isLoss = match.score[1] < match.score[0];
  const lpChange = match.mmrChange[1];
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  // Confirmation state
  const [open, setOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const handleConfirmAction = async () => {
    setIsConfirming(true);
    try {
      await apiClient.post(`/matches/${match.id}/confirm`);
      // 🌟 核心數據刷新
      queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['matches', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'rivals'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'partners'] });
      
      setIsConfirming(false);
      setIsSuccess(true);
    } catch (err: any) {
      alert("發生錯誤: " + err.message);
      setIsConfirming(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setTimeout(() => {
      setIsSuccess(false);
    }, 300);
  };

  const confirmationContent = (
    <div className="px-6 py-4 space-y-6">
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100/30 relative z-10">
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 animate-pulse rounded-full" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-2xl font-display font-black text-primary-navy tracking-tight">已確認戰果！</h3>
            <p className="text-sm font-medium text-slate-500 px-10">感謝您的確認，賽果現在正式生效並更新排名。</p>
          </div>

          {/* Match Receipt Card */}
          <div className="w-full bg-slate-50/80 border border-slate-100 rounded-3xl p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Trophy size={80} />
            </div>

            <div className="flex items-center justify-between relative z-10">
              {/* Player 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "flex transition-all",
                  match.player1.length > 1 ? "-space-x-3" : ""
                )}>
                  {match.player1.map((p, i) => (
                    <div key={p.id || i} className={cn(
                      "size-12 rounded-2xl p-0.5 border-2 z-10",
                      isLoss ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                    )}>
                      <img src={p.avatar} className="size-full rounded-xl object-cover" alt={p.name} />
                    </div>
                  ))}
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest truncate w-24 text-center">
                  {match.player1.length > 1 ? match.player1.map(p => p.name?.split(' ')[0] || '?').join('/') : match.player1[0]?.name}
                </span>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center">
                <div className="text-4xl font-display font-black text-primary-navy tabular-nums tracking-tighter">
                  {match.score[0]} : {match.score[1]}
                </div>
                <div className={cn(
                  "mt-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                  !isLoss ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}>
                  {!isLoss ? " Victory " : " Defeat "}
                </div>
              </div>

              {/* Opponent (Me) */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "flex transition-all",
                  opponentPlayers.length > 1 ? "-space-x-3" : ""
                )}>
                  {opponentPlayers.map((p, i) => (
                    <div key={p.id || i} className={cn(
                      "size-12 rounded-2xl p-0.5 border-2 z-10",
                      !isLoss ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                    )}>
                      <img src={p.avatar} className="size-full rounded-xl object-cover" alt={p.name} />
                    </div>
                  ))}
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest truncate w-24 text-center">
                  {opponentPlayers.length > 1 ? opponentPlayers.map(p => p.name?.split(' ')[0] || '?').join('/') : opponentPlayers[0]?.name}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-dashed border-slate-200 flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Timestamp</span>
                <span>LP Change</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">
                  {formatLocalTime(new Date().toISOString(), 'yyyy-MM-dd HH:mm')}
                </span>
                <span className={cn("text-sm font-display font-black", lpChange < 0 ? 'text-rose-500' : 'text-emerald-500')}>
                  {lpChange > 0 ? `+${lpChange}` : lpChange} LP
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={closeDialog}
            className="w-full h-14 rounded-[1.5rem] bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-widest uppercase transition-all shadow-xl shadow-primary-navy/20"
          >
            關閉視窗
          </Button>
        </div>
      ) : (
        <div className="space-y-8 py-4">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-8 md:gap-12">
              <div className="flex flex-col items-center gap-3">
                <div className={cn("flex -space-x-4 transition-all")}>
                  {match.player1.map((p, i) => (
                    <div key={p.id || i} className="size-16 md:size-20 rounded-4xl border-4 border-white shadow-xl overflow-hidden relative z-10">
                      <img src={p.avatar} className="size-full object-cover" alt={p.name} />
                    </div>
                  ))}
                </div>
                <span className="text-sm font-black text-primary-navy tracking-widest uppercase">
                  {match.player1.length > 1 ? match.player1.map(p => p.name?.split(' ')[0] || '?').join('/') : match.player1[0]?.name}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-5xl md:text-7xl font-display font-black text-slate-200 tracking-tighter leading-none mb-2">VS</span>
                <div className="h-1.5 w-12 bg-sapphire-blue/10 rounded-full" />
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className={cn("flex -space-x-4 transition-all")}>
                  {opponentPlayers.map((p, i) => (
                    <div key={p.id || i} className="size-16 md:size-20 rounded-4xl border-4 border-white shadow-xl overflow-hidden relative z-10">
                      <img src={p.avatar} className="size-full object-cover" alt={p.name} />
                    </div>
                  ))}
                </div>
                <span className="text-sm font-black text-primary-navy tracking-widest uppercase">
                  {opponentPlayers.length > 1 ? opponentPlayers.map(p => p.name?.split(' ')[0] || '?').join('/') : opponentPlayers[0]?.name}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-50 border border-slate-100 rounded-4xl p-6 text-center space-y-4">
              <span className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Final Registered Score</span>
              <div className="text-6xl font-display font-black text-primary-navy tabular-nums tracking-tighter">
                {match.score[0]} : {match.score[1]}
              </div>
              <div className={cn(
                "inline-flex items-center gap-2 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest ring-4",
                !isLoss ? "bg-emerald-500 text-white ring-emerald-500/10" : "bg-rose-500 text-white ring-rose-500/10"
              )}>
                {isLoss ? `你輸了 (${lpChange} LP)` : `你贏了 (+${lpChange} LP)`}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleConfirmAction}
              disabled={isConfirming}
              className="w-full h-16 rounded-[1.5rem] bg-emerald-500 hover:bg-emerald-600 text-white font-display font-black text-lg tracking-widest uppercase transition-all shadow-xl shadow-emerald-500/20"
            >
              {isConfirming ? "處理中..." : "我確認，賽果無誤"}
            </Button>
            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
              確認即代表您同意此賽果，MMR 將立即計算。
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isDisputing) {
    return (
      <div className="bg-white rounded-3xl p-4 md:p-5 flex flex-col gap-3 border border-rose-100 shadow-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
        <h4 className="font-bold text-slate-700 text-sm">提出異議：對戰戰績</h4>
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
        <div className={cn("flex transition-all", opponentPlayers.length > 1 ? "-space-x-4" : "")}>
          {opponentPlayers.map((p, i) => (
            <img
              key={p.id || i}
              src={p.avatar}
              alt={p.name}
              className="size-12 md:size-14 rounded-2xl object-cover shadow-sm bg-slate-50 border-2 border-white relative z-10"
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-sans font-black text-primary-navy truncate text-xs md:text-base uppercase tracking-tight">
              {opponentPlayers.length > 1 ? opponentPlayers.map(p => p.name?.split(' ')[0] || '?').join(' / ') : opponentPlayers[0]?.name}
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

          {isDesktop ? (
            <Dialog open={open} onOpenChange={(val) => { if (!isConfirming) setOpen(val) }}>
              <DialogTrigger
                render={
                  <Button className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm tracking-widest shadow-lg shadow-emerald-500/20 gap-2 border-none transition-all active:scale-95">
                    <Check size={16} strokeWidth={3} />
                    確認
                  </Button>
                }
              />
              <DialogContent className="max-w-2xl p-0 overflow-hidden border-none bg-white">
                <DialogHeader className="p-8 pb-0">
                  <DialogTitle className="flex items-center gap-3 text-emerald-600">
                    <CheckCircle2 className="text-emerald-500" />
                    {isSuccess ? "申報完成" : "確認賽果"}
                  </DialogTitle>
                  <DialogDescription>
                    {isSuccess
                      ? "您的賽果已成功紀錄，積分與排名已即時更新。"
                      : "請再次檢查比分與勝敗是否正確，確認後無法撤回。"}
                  </DialogDescription>
                </DialogHeader>
                {confirmationContent}
              </DialogContent>
            </Dialog>
          ) : (
            <Drawer open={open} onOpenChange={(val) => { if (!isConfirming) setOpen(val) }}>
              <DrawerTrigger asChild>
                <Button className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm tracking-widest shadow-lg shadow-emerald-500/20 gap-2 border-none">
                  <Check size={16} strokeWidth={3} />
                  確認
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-0 border-none bg-white max-h-[96vh] flex flex-col">
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <DrawerHeader className="p-6 pb-2 text-center">
                    <DrawerTitle className="flex items-center justify-center gap-3 text-emerald-600">
                      <CheckCircle2 className="text-emerald-500" size={20} />
                      {isSuccess ? "申報完成" : "確認賽果"}
                    </DrawerTitle>
                    <DrawerDescription>
                      {isSuccess
                        ? "您的戰果已成功紀錄與生效"
                        : "確認無誤後請按下確認按鈕"}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="pb-12 pb-safe">
                    {confirmationContent}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      </div>
    </div>
  );
}

// Group 2: Waiting on Opponent (Low Priority, Collapsible)
function WaitingOnOthersGroup({ matches: initialMatches }: { matches: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const matches = initialMatches; // 現在直接使用從外部傳入的 matches，由 React Query 控制

  const doDelete = async (matchId: string) => {
    setDeletingId(matchId);
    try {
      await apiClient.delete(`/matches/${matchId}`);
      // 🌟 立即刷新清單與相關數據
      queryClient.invalidateQueries({ queryKey: ['matches'] }); // 寬泛一點包含 pending/recent
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] }); // 涵蓋 stats/rivals/partners
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    } catch (error: any) {
      alert('撤回失敗：' + (error.response?.data?.detail || '未知網路錯誤'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = () => {
    // 🌟 修改成功後直接刷新清單
    queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
  };

  if (matches.length === 0) return null;

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
              const isDeleting = deletingId === match.id;

              return (
                <div key={match.id} className={cn("bg-white rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm border border-slate-50 gap-3 transition-all", isDeleting && "opacity-40 pointer-events-none")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex -space-x-3 transition-all")}>
                      {match.opponent.map((p: any, i: number) => (
                        <img key={p.id || i} src={p.avatar} alt={p.name} referrerPolicy="no-referrer" className="size-8 rounded-lg grayscale opacity-60 border border-white" />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] md:text-sm font-bold text-slate-600 uppercase">
                        {match.opponent.length > 1 ? match.opponent.map((p: any) => p.name?.split(' ')[0] || '?').join('/') : match.opponent[0]?.name}
                      </span>
                      <span className={cn(
                        "text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
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
                      {/* 🖊️ 修改比分 */}
                      <EditScoreButton match={match} onSuccess={handleEditSuccess} />
                      {/* 🗑️ 撤回申報 */}
                      <DeleteConfirmButton
                        match={match}
                        isDeleting={isDeleting}
                        onConfirm={() => doDelete(match.id)}
                      />
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

// 撤回確認 — 自訂 Dialog/Drawer 組件（取代 window.confirm）
function DeleteConfirmButton({ match, isDeleting, onConfirm }: {
  match: any;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isLoss = match.score[0] < match.score[1];

  const handleConfirm = () => {
    setOpen(false);
    setTimeout(() => onConfirm(), 150); // 讓 Dialog 先關上再觸發刪除動畫
  };

  const confirmContent = (
    <div className="px-6 pb-8 space-y-6">
      {/* Match Preview Card */}
      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex items-center gap-4">
        <div className="flex -space-x-3">
          {match.opponent.map((p: any, i: number) => (
            <img
              key={p.id || i}
              src={p.avatar}
              alt={p.name}
              referrerPolicy="no-referrer"
              className="size-10 rounded-xl border-2 border-white shadow-sm object-cover"
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-black text-primary-navy uppercase tracking-tight truncate">
              {match.opponent.length > 1
                ? match.opponent.map((p: any) => p.name?.split(' ')[0] || '?').join(' / ')
                : match.opponent[0]?.name}
            </span>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shrink-0",
              isLoss ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
            )}>
              {isLoss ? 'LOSS' : 'WIN'}
            </span>
          </div>
          <span className="text-xs font-black text-slate-400 tabular-nums">
            {match.score[0]} : {match.score[1]}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Score</span>
          <span className="text-xl font-display font-black text-primary-navy tabular-nums">
            {match.score[0]}:{match.score[1]}
          </span>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
        <div className="size-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">!</div>
        <p className="text-xs font-bold text-rose-700 leading-relaxed">
          撤回後，對方將不再收到待確認通知。<br />
          <span className="text-rose-500">此動作無法復原。</span>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleConfirm}
          className="w-full h-13 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-display font-black tracking-widest uppercase transition-all shadow-xl shadow-rose-500/25 gap-2 border-none"
        >
          <Trash2 size={16} strokeWidth={2.5} />
          確認撤回申報
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          className="w-full h-12 rounded-2xl border-slate-100 text-slate-500 font-bold hover:bg-slate-50 transition-all"
        >
          取消，繼續等待
        </Button>
      </div>
    </div>
  );

  return isDesktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="撤回申報"
        >
          <Trash2 size={15} />
        </Button>
      } />
      <DialogContent className="max-w-sm p-0 border-none bg-white overflow-hidden">
        <DialogHeader className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-2xl bg-rose-100 flex items-center justify-center">
              <Trash2 size={18} className="text-rose-500" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-xl font-display font-black text-primary-navy tracking-tight">
              撤回申報
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 font-medium leading-relaxed">
            您確定要撤回這筆待確認賽果嗎？
          </DialogDescription>
        </DialogHeader>
        {confirmContent}
      </DialogContent>
    </Dialog>
  ) : (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="撤回申報"
        >
          <Trash2 size={15} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="p-0 border-none bg-white">
        {/* Pull bar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-0" />
        <DrawerHeader className="px-6 pt-6 pb-4 text-center">
          <div className="size-16 rounded-3xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} className="text-rose-500" strokeWidth={2} />
          </div>
          <DrawerTitle className="text-2xl font-display font-black text-primary-navy tracking-tight">
            撤回申報
          </DrawerTitle>
          <DrawerDescription className="text-slate-500 font-medium leading-relaxed">
            您確定要撤回這筆待確認賽果嗎？
          </DrawerDescription>
        </DrawerHeader>
        {confirmContent}
      </DrawerContent>
    </Drawer>
  );
}

// 修改比分 — 獨立的小 Dialog 組件
function EditScoreButton({ match, onSuccess }: { match: any; onSuccess: (id: string, a: number, b: number) => void }) {
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState<number>(match.score[0]);
  const [scoreB, setScoreB] = useState<number>(match.score[1]);
  const [saving, setSaving] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const handleSave = async () => {
    if (scoreA === scoreB) return alert('比分不得相同');
    setSaving(true);
    try {
      await apiClient.patch(`/matches/${match.id}`, { score_a: scoreA, score_b: scoreB });
      onSuccess(match.id, scoreA, scoreB);
      setOpen(false);
    } catch (error: any) {
      alert('修改失敗：' + (error.response?.data?.detail || '未知網路錯誤'));
    } finally {
      setSaving(false);
    }
  };

  const editContent = (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-center gap-6">
        {/* Score A */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">我方</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setScoreA(Math.max(0, scoreA - 1))} className="size-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-lg transition-all active:scale-95">−</button>
            <span className="text-4xl font-display font-black text-primary-navy tabular-nums w-10 text-center">{scoreA}</span>
            <button onClick={() => setScoreA(Math.min(3, scoreA + 1))} className="size-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-lg transition-all active:scale-95">+</button>
          </div>
        </div>
        <span className="text-3xl font-display font-black text-slate-200 mt-6">:</span>
        {/* Score B */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">對方</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setScoreB(Math.max(0, scoreB - 1))} className="size-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-lg transition-all active:scale-95">−</button>
            <span className="text-4xl font-display font-black text-primary-navy tabular-nums w-10 text-center">{scoreB}</span>
            <button onClick={() => setScoreB(Math.min(3, scoreB + 1))} className="size-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-black text-lg transition-all active:scale-95">+</button>
          </div>
        </div>
      </div>
      <Button
        onClick={handleSave}
        disabled={saving || scoreA === scoreB}
        className="w-full h-12 rounded-2xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-widest transition-all disabled:opacity-30 shadow-xl shadow-primary-navy/20"
      >
        {saving ? '儲存中...' : '確認修改'}
      </Button>
    </div>
  );

  return isDesktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="size-8 rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100 transition-colors" title="修改賽果">
          <Pencil size={15} />
        </Button>
      } />
      <DialogContent className="max-w-sm p-0 border-none bg-white overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-primary-navy"><Pencil size={18} className="text-sapphire-blue" /> 修改比分</DialogTitle>
          <DialogDescription>修改後對方仍需確認。</DialogDescription>
        </DialogHeader>
        {editContent}
      </DialogContent>
    </Dialog>
  ) : (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100 transition-colors" title="修改賽果">
          <Pencil size={15} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="p-0 border-none bg-white">
        <DrawerHeader className="p-6 pb-2 text-center">
          <DrawerTitle className="flex items-center justify-center gap-2 text-primary-navy"><Pencil size={18} className="text-sapphire-blue" /> 修改比分</DrawerTitle>
          <DrawerDescription>修改後對方仍需確認。</DrawerDescription>
        </DrawerHeader>
        {editContent}
      </DrawerContent>
    </Drawer>
  );
}
