import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ScoreInputSection } from '@/components/ScoreInputSection';
import { inferMatchFormat, validateMatchScore, type MatchFormat } from '@/lib/matchScore';
import { Clock, ChevronDown, Check, X, ShieldAlert, Zap, Pencil, Trash2, CheckCircle2, Trophy } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';

// 統一的 Pending Match 資料形狀（從後端 API 回傳）
interface PendingPlayer {
  id: string;
  name: string;
  avatar?: string | null;
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

const formatTeamNames = (players: PendingPlayer[]) =>
  players.length > 1
    ? players.map((p) => p.name?.split(' ')[0] || '?').join(' / ')
    : players[0]?.name || '未知選手';

export function PendingActions() {
  const { data: currentUser } = useAuth();

  const { data: pendingMatches = [] } = useQuery({
    queryKey: ['matches', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<PendingMatch[]>('/matches/pending');
      return res.data;
    },
    enabled: !!currentUser,
    refetchInterval: 10000,
  });

  if (pendingMatches.length === 0) return null;

  const isOpponentSide = (m: PendingMatch) =>
    m.opponent.some((p) => p.id === currentUser?.id);

  const actionRequired = pendingMatches.filter(isOpponentSide);
  const waitingOnOthers = pendingMatches.filter((m) => !isOpponentSide(m));

  return (
    <div className="space-y-3 md:space-y-4 mb-2 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {actionRequired.length > 0 && <ActionRequiredGroup matches={actionRequired} />}
      {waitingOnOthers.length > 0 && (
        <WaitingOnOthersGroup matches={waitingOnOthers} currentUserId={currentUser?.id} />
      )}
    </div>
  );
}

// Group 1: Action Required (High Priority, Rose)
function ActionRequiredGroup({ matches }: { matches: PendingMatch[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayMatches = expanded ? matches : matches.slice(0, 3);
  const hasMore = matches.length > 3;

  return (
    <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl md:rounded-3xl overflow-hidden shadow-xs">
      <div className="bg-rose-100/60 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldAlert className="text-rose-600 relative z-10" size={22} aria-hidden="true" />
            <div className="absolute inset-0 bg-rose-400 blur-md opacity-25 animate-pulse rounded-full" />
          </div>
          <div>
            <h3 className="font-display font-black text-rose-600 text-base md:text-lg leading-tight tracking-wide">
              待您確認賽果 ({matches.length})
            </h3>
            <span className="text-xs font-bold text-rose-500/80 tracking-wider uppercase block">
              Action Required
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-3">
        {displayMatches.map((match) => (
          <ActionMatchCard key={match.id} match={match} />
        ))}

        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50/60 text-xs font-black uppercase tracking-widest mt-2"
          >
            {expanded ? '折疊顯示' : `查看其餘 ${matches.length - 3} 筆`}
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

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Dispute modal state
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const disputeFieldId = useId();

  const handleConfirmAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsConfirming(true);
    try {
      await apiClient.post(`/matches/${match.id}/confirm`);
      queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['matches', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'rivals'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'partners'] });

      setIsConfirming(false);
      setIsSuccess(true);
      toast.success('賽果確認完成，積分已即時更新');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '網路連線錯誤';
      toast.error('確認失敗：' + errorMessage);
      setIsConfirming(false);
    }
  };

  const handleConfirmOpenChange = (nextOpen: boolean) => {
    if (isConfirming) return;
    setConfirmOpen(nextOpen);
    if (!nextOpen && isSuccess) {
      setTimeout(() => setIsSuccess(false), 250);
    }
  };

  const handleDisputeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      toast.error('請填寫異議原因');
      return;
    }
    toast.info('線上異議單功能建置中，請先直接聯繫對手修改比分或撤回申報');
    setDisputeOpen(false);
    setDisputeReason('');
  };

  const matchupSummaryCard = (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-2 right-2 opacity-[0.04] pointer-events-none" aria-hidden="true">
        <Trophy size={72} />
      </div>

      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* Player 1 (Reporter side) */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <div className={cn('flex items-center justify-center', match.player1.length > 1 && '-space-x-3')}>
            {match.player1.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className={cn(
                  'size-12 rounded-xl border-2 text-sm',
                  isLoss ? 'border-emerald-500' : 'border-white'
                )}
              />
            ))}
          </div>
          <span className="text-xs font-black text-primary-navy truncate max-w-full text-center">
            {formatTeamNames(match.player1)}
          </span>
        </div>

        {/* Center Score */}
        <div className="flex flex-col items-center shrink-0 px-2">
          <div className="text-3xl sm:text-4xl font-display font-black text-primary-navy tabular-nums">
            {match.score[0]} : {match.score[1]}
          </div>
          <span
            className={cn(
              'mt-1 px-2.5 py-0.5 rounded-full text-xs font-black',
              !isLoss ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            )}
          >
            {isLoss ? '你敗' : '你勝'}
          </span>
        </div>

        {/* My side (Opponent in pending payload) */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <div className={cn('flex items-center justify-center', opponentPlayers.length > 1 && '-space-x-3')}>
            {opponentPlayers.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className={cn(
                  'size-12 rounded-xl border-2 text-sm',
                  !isLoss ? 'border-emerald-500' : 'border-white'
                )}
              />
            ))}
          </div>
          <span className="text-xs font-black text-primary-navy truncate max-w-full text-center">
            {formatTeamNames(opponentPlayers)}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">
          {isSuccess ? '確認時間 · ' + formatLocalTime(new Date().toISOString(), 'yyyy-MM-dd HH:mm') : '預估積分變動'}
        </span>
        <span
          className={cn(
            'text-sm font-display font-black tabular-nums',
            lpChange < 0 ? 'text-rose-600' : 'text-emerald-600'
          )}
        >
          {lpChange > 0 ? `+${lpChange}` : lpChange} ELO
        </span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border border-rose-100 shadow-xs relative overflow-hidden group">
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-400 group-hover:bg-rose-500 transition-colors" />

      {/* Opponent & Score Info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn('flex shrink-0', opponentPlayers.length > 1 && '-space-x-3')}>
          {opponentPlayers.map((p, i) => (
            <PlayerAvatar
              key={p.id || i}
              src={p.avatar}
              name={p.name}
              className="size-12 md:size-14 rounded-2xl border-2 border-white shadow-xs text-sm"
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-sans font-black text-primary-navy truncate text-sm md:text-base tracking-tight">
              {formatTeamNames(opponentPlayers)}
            </span>
            <span
              className={cn(
                'text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0',
                isLoss ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              )}
            >
              {isLoss ? 'LOSS' : 'WIN'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display font-black text-2xl md:text-3xl tracking-tight text-slate-700 leading-none tabular-nums">
              {match.score[0]} <span className="text-slate-300 font-sans mx-0.5">:</span> {match.score[1]}
            </span>
            <div className="h-6 w-px bg-slate-100" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 leading-none mb-1">預估變動</span>
              <span
                className={cn(
                  'text-xs md:text-sm font-display font-black leading-none tabular-nums',
                  lpChange < 0 ? 'text-rose-600' : 'text-emerald-600'
                )}
              >
                {lpChange > 0 ? `+${lpChange}` : lpChange} 分
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown & Actions */}
      <div className="flex items-center gap-2 justify-between md:justify-end pt-3 md:pt-0 border-t border-slate-100 md:border-none">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-lg shrink-0">
          <Clock size={14} className="text-rose-500" aria-hidden="true" />
          <span className="text-xs font-black font-display text-rose-600 tabular-nums leading-none tracking-wide">
            倒數 {getRemainingTimeStr(match.expiresAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 提出異議 Modal */}
          <ResponsiveFormModal
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            size="md"
            tone="danger"
            icon={<ShieldAlert size={18} />}
            title="提出賽果異議"
            description="若比分有誤或尚未完賽，請說明問題並通知對方更正。"
            onSubmit={handleDisputeSubmit}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="提出異議"
                title="提出異議"
                className="size-10 rounded-xl border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 bg-white"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </Button>
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDisputeOpen(false)}
                  className="w-full lg:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={!disputeReason.trim()}
                  className="w-full lg:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm disabled:opacity-40"
                >
                  送出異議
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-primary-navy truncate">
                  {formatTeamNames(opponentPlayers)}
                </span>
                <span className="font-display font-black text-lg text-primary-navy tabular-nums shrink-0">
                  {match.score[0]} : {match.score[1]}
                </span>
              </div>
              <div>
                <label htmlFor={disputeFieldId} className="arena-label">
                  異議原因 <span aria-hidden="true" className="text-rose-500">*</span>
                </label>
                <textarea
                  id={disputeFieldId}
                  name="disputeReason"
                  required
                  placeholder="請簡述異議原因（例如：比分登錄錯誤、實際局數為 2:1 等）..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="arena-textarea min-h-28"
                />
              </div>
            </div>
          </ResponsiveFormModal>

          {/* 確認賽果 Modal */}
          <ResponsiveFormModal
            open={confirmOpen}
            onOpenChange={handleConfirmOpenChange}
            size="md"
            tone="success"
            icon={<CheckCircle2 size={18} />}
            title={isSuccess ? '賽果已正式生效' : '確認賽果'}
            description={
              isSuccess
                ? '感謝您的確認，積分與排行榜已即時更新。'
                : '請再次核對比分與積分變動，確認後無法撤回。'
            }
            onSubmit={!isSuccess ? handleConfirmAction : undefined}
            trigger={
              <Button
                type="button"
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm tracking-wide shadow-sm gap-1.5 border-none transition-all active:scale-95"
              >
                <Check size={16} strokeWidth={3} aria-hidden="true" />
                確認
              </Button>
            }
            footer={
              isSuccess ? (
                <Button
                  type="button"
                  onClick={() => handleConfirmOpenChange(false)}
                  className="w-full lg:w-auto h-11 px-8 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-sm"
                >
                  完成
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isConfirming}
                    onClick={() => handleConfirmOpenChange(false)}
                    className="w-full lg:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={isConfirming}
                    className="w-full lg:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm shadow-sm"
                  >
                    {isConfirming ? '處理中...' : '確認，賽果無誤'}
                  </Button>
                </>
              )
            }
          >
            <div className="space-y-4">
              {isSuccess && (
                <div className="flex flex-col items-center justify-center py-2 space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={32} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <p className="text-base font-display font-black text-primary-navy">賽果確認完成！</p>
                </div>
              )}

              {matchupSummaryCard}

              {!isSuccess && (
                <p className="text-xs text-slate-500 font-medium text-center">
                  確認即代表同意此戰績，系統將立即計算並套用 MMR 積分。
                </p>
              )}
            </div>
          </ResponsiveFormModal>
        </div>
      </div>
    </div>
  );
}

// Group 2: Waiting on Opponent (Collapsible)
function WaitingOnOthersGroup({ matches, currentUserId }: { matches: PendingMatch[]; currentUserId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const doDelete = async (matchId: string) => {
    setDeletingId(matchId);
    try {
      await apiClient.delete(`/matches/${matchId}`);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast.success('已撤回比賽申報');
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error('撤回失敗：' + (detail || '未知網路錯誤'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
  };

  if (matches.length === 0) return null;

  return (
    <div className="bg-slate-50 border border-slate-200/70 rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-300">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire-blue/25"
      >
        <div className="flex items-center gap-3">
          <Zap className="text-slate-400" size={18} aria-hidden="true" />
          <span className="text-sm font-black text-slate-600 tracking-wide">
            {matches.length} 筆賽果等待對方確認中{' '}
            <span className="hidden md:inline text-xs font-bold text-slate-400 ml-2">(時限後將自動生效)</span>
          </span>
        </div>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={cn('text-slate-400 transition-transform duration-300', isOpen && 'rotate-180')}
        />
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-0 space-y-2">
            {matches.map((match) => {
              const isLoss = match.score[0] < match.score[1];
              const isDeleting = deletingId === match.id;
              const canManage = !currentUserId || match.submittedBy === currentUserId;

              return (
                <div
                  key={match.id}
                  className={cn(
                    'bg-white rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs border border-slate-100 gap-3 transition-all',
                    isDeleting && 'opacity-40 pointer-events-none'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('flex shrink-0', match.opponent.length > 1 && '-space-x-2.5')}>
                      {match.opponent.map((p, i) => (
                        <PlayerAvatar
                          key={p.id || i}
                          src={p.avatar}
                          name={p.name}
                          className="size-8 rounded-lg border border-slate-200 text-xs grayscale opacity-75"
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs md:text-sm font-bold text-slate-700 truncate">
                        {formatTeamNames(match.opponent)}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-black uppercase px-1.5 py-0.5 rounded-md shrink-0',
                          isLoss ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                        )}
                      >
                        {isLoss ? 'LOSS' : 'WIN'}
                      </span>
                    </div>
                    <span className="text-sm font-display font-black text-primary-navy tabular-nums ml-1 shrink-0">
                      {match.score[0]} : {match.score[1]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    <div className="text-xs font-bold text-slate-400 tabular-nums flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg shrink-0">
                      <Clock size={12} aria-hidden="true" />
                      生效剩餘 {getRemainingTimeStr(match.expiresAt)}
                    </div>
                    {canManage ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <EditScoreButton match={match} onSuccess={handleEditSuccess} />
                        <DeleteConfirmButton
                          match={match}
                          isDeleting={isDeleting}
                          onConfirm={() => doDelete(match.id)}
                        />
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold shrink-0">
                        隊友已申報
                      </span>
                    )}
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

// 撤回確認 Modal
function DeleteConfirmButton({
  match,
  isDeleting,
  onConfirm,
}: {
  match: PendingMatch;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isLoss = match.score[0] < match.score[1];

  const handleConfirmSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOpen(false);
    setTimeout(() => onConfirm(), 150);
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={setOpen}
      size="sm"
      tone="danger"
      icon={<Trash2 size={18} />}
      title="撤回申報"
      description="確定要撤回這筆待確認賽果嗎？"
      onSubmit={handleConfirmSubmit}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          aria-label="撤回申報"
          title="撤回申報"
          className="size-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={15} aria-hidden="true" />
        </Button>
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full lg:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
          >
            取消，繼續等待
          </Button>
          <Button
            type="submit"
            className="w-full lg:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm gap-1.5"
          >
            <Trash2 size={15} aria-hidden="true" />
            確認撤回申報
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
          <div className={cn('flex shrink-0', match.opponent.length > 1 && '-space-x-2.5')}>
            {match.opponent.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className="size-10 rounded-xl border-2 border-white shadow-xs text-xs"
              />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-primary-navy truncate">
                {formatTeamNames(match.opponent)}
              </span>
              <span
                className={cn(
                  'text-xs font-black uppercase px-1.5 py-0.5 rounded-md shrink-0',
                  isLoss ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                )}
              >
                {isLoss ? 'LOSS' : 'WIN'}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400">待確認賽果</span>
          </div>
          <span className="text-xl font-display font-black text-primary-navy tabular-nums shrink-0">
            {match.score[0]} : {match.score[1]}
          </span>
        </div>

        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
          <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-bold text-rose-700 leading-relaxed">
            撤回後將取消這筆對戰紀錄並停止倒數通知，此動作無法復原。
          </p>
        </div>
      </div>
    </ResponsiveFormModal>
  );
}

// 修改比分 Modal — 與 ReportScore 共用同一套 ScoreInputSection
function EditScoreButton({
  match,
  onSuccess,
}: {
  match: PendingMatch;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState<number>(match.score[0]);
  const [scoreB, setScoreB] = useState<number>(match.score[1]);
  const [format, setFormat] = useState<MatchFormat>(() => inferMatchFormat(match.score[0], match.score[1]));
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setScoreA(match.score[0]);
      setScoreB(match.score[1]);
      setFormat(inferMatchFormat(match.score[0], match.score[1]));
    }
  };

  const validation = validateMatchScore(scoreA, scoreB, format);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/matches/${match.id}`, { score_a: scoreA, score_b: scoreB });
      onSuccess();
      toast.success(`已更新比分為 ${scoreA} : ${scoreB}`);
      setOpen(false);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error('修改失敗：' + (detail || '未知網路錯誤'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={handleOpenChange}
      size="md"
      tone="default"
      icon={<Pencil size={18} />}
      title="修改比分"
      description="修改後將以新比分重新等待對方確認。"
      onSubmit={handleSave}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="修改比分"
          title="修改賽果"
          className="size-9 rounded-xl text-slate-400 hover:text-primary-navy hover:bg-slate-100 transition-colors"
        >
          <Pencil size={15} aria-hidden="true" />
        </Button>
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setOpen(false)}
            className="w-full lg:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={saving || !validation.valid}
            className="w-full lg:w-auto h-11 px-6 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-sm shadow-sm disabled:opacity-35"
          >
            {saving ? '儲存中...' : '儲存修改'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 對手摘要卡 */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('flex shrink-0', match.opponent.length > 1 && '-space-x-2.5')}>
              {match.opponent.map((p, i) => (
                <PlayerAvatar
                  key={p.id || i}
                  src={p.avatar}
                  name={p.name}
                  className="size-9 rounded-xl border border-slate-200 text-xs"
                />
              ))}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 block">對手</span>
              <span className="text-sm font-black text-primary-navy truncate block">
                {formatTeamNames(match.opponent)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-slate-400 block">目前比分</span>
            <span className="text-xl font-display font-black text-primary-navy tabular-nums">
              {scoreA} : {scoreB}
            </span>
          </div>
        </div>

        {/* 與 ReportScore 一致的比分輸入器 */}
        <ScoreInputSection
          format={format}
          onFormatChange={setFormat}
          scoreA={scoreA}
          scoreB={scoreB}
          onScoreAChange={setScoreA}
          onScoreBChange={setScoreB}
        />

        {/* 即時狀態回饋 */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl border px-3.5 py-2.5 text-xs font-bold',
            validation.tone === 'valid'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : validation.tone === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
          )}
        >
          {validation.message}
        </div>
      </div>
    </ResponsiveFormModal>
  );
}
