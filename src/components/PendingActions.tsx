import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ScoreInputSection } from '@/components/ScoreInputSection';
import { inferMatchFormat, validateMatchScore, type MatchFormat } from '@/lib/matchScore';
import {
  formatSignedDelta,
  formatTeamNames,
  getMatchPerspective,
  getRemainingTimeStr,
  groupPendingMatches,
  type MatchupGroup,
  type PendingMatch,
} from '@/lib/pendingMatchGroups';
import {
  Clock,
  ChevronDown,
  Check,
  CheckCheck,
  Crosshair,
  Flag,
  X,
  ShieldAlert,
  Zap,
  Pencil,
  Trash2,
  CheckCircle2,
  Trophy,
} from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';

interface BatchConfirmResponse {
  message: string;
  confirmed_count: number;
  current_user_total_delta: number;
  current_user_new_mmr: number;
}

function invalidateMatchSettlementQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
  queryClient.invalidateQueries({ queryKey: ['matches', 'recent'] });
  queryClient.invalidateQueries({ queryKey: ['matches', 'history'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['users', 'me', 'stats'] });
  queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
  queryClient.invalidateQueries({ queryKey: ['authUser'] });
  queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  queryClient.invalidateQueries({ queryKey: ['users', 'me', 'rivals'] });
  queryClient.invalidateQueries({ queryKey: ['users', 'me', 'partners'] });
}

export function PendingActions() {
  const { data: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMatchId = searchParams.get('matchId');

  const clearTargetHighlight = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('matchId');
    setSearchParams(next, { replace: true });
  };

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
    m.opponent.some((p) => String(p.id) === String(currentUser?.id));

  const actionRequired = pendingMatches.filter(isOpponentSide);
  const waitingOnOthers = pendingMatches.filter((m) => !isOpponentSide(m));

  return (
    <div className="space-y-3 md:space-y-4 mb-2 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {actionRequired.length > 0 && (
        <ActionRequiredGroup
          matches={actionRequired}
          currentUserId={currentUser?.id}
          targetMatchId={targetMatchId}
          onClearHighlight={clearTargetHighlight}
        />
      )}
      {waitingOnOthers.length > 0 && (
        <WaitingOnOthersGroup
          matches={waitingOnOthers}
          currentUserId={currentUser?.id}
          targetMatchId={targetMatchId}
          onClearHighlight={clearTargetHighlight}
        />
      )}
    </div>
  );
}

// Group 1: Action Required (High Priority, Rose)
function ActionRequiredGroup({
  matches,
  currentUserId,
  targetMatchId,
  onClearHighlight,
}: {
  matches: PendingMatch[];
  currentUserId?: string;
  targetMatchId?: string | null;
  onClearHighlight?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissedHighlightId, setDismissedHighlightId] = useState<string | null>(null);
  const [batchAllOpen, setBatchAllOpen] = useState(false);

  const groups = useMemo(
    () => groupPendingMatches(matches, 'confirm', currentUserId),
    [matches, currentUserId],
  );

  const hasHighlightedInHiddenGroups = Boolean(
    targetMatchId &&
      groups.slice(3).some((g) => g.matches.some((m) => String(m.id) === String(targetMatchId))),
  );
  const effectiveExpanded =
    expanded ||
    Boolean(
      hasHighlightedInHiddenGroups &&
        targetMatchId &&
        dismissedHighlightId !== targetMatchId,
    );

  const displayGroups = effectiveExpanded ? groups : groups.slice(0, 3);
  const hasMore = groups.length > 3;

  return (
    <div className="bg-rose-50/50 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-500/30 rounded-2xl md:rounded-3xl overflow-hidden shadow-xs">
      <div className="bg-rose-100/60 dark:bg-rose-900/30 px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <ShieldAlert className="text-rose-600 dark:text-rose-400 relative z-10" size={22} aria-hidden="true" />
            <div className="absolute inset-0 bg-rose-400 blur-md opacity-25 animate-pulse rounded-full" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-black text-rose-600 dark:text-rose-400 text-base md:text-lg leading-tight tracking-wide">
              待您確認賽果 ({matches.length})
            </h3>
            <span className="text-xs font-bold text-rose-500/85 dark:text-rose-300/80 tracking-wider uppercase block">
              {groups.length < matches.length
                ? `Action Required · 已整併為 ${groups.length} 組對戰`
                : 'Action Required'}
            </span>
          </div>
        </div>

        {groups.length >= 2 && (
          <>
            <Button
              type="button"
              onClick={() => setBatchAllOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs tracking-wide shadow-xs gap-1.5 border-none shrink-0"
            >
              <CheckCheck size={15} aria-hidden="true" />
              全部確認 ({matches.length})
            </Button>

            <BatchConfirmModal
              open={batchAllOpen}
              onOpenChange={setBatchAllOpen}
              mode="all"
              groups={groups}
              currentUserId={currentUserId}
            />
          </>
        )}
      </div>

      <div className="p-3 md:p-4 space-y-3">
        {displayGroups.map((group) =>
          group.matches.length === 1 ? (
            <SingleActionMatchCard
              key={group.key}
              match={group.matches[0]}
              group={group}
              currentUserId={currentUserId}
              targetMatchId={targetMatchId}
              onClearHighlight={onClearHighlight}
            />
          ) : (
            <GroupedActionMatchCard
              key={group.key}
              group={group}
              currentUserId={currentUserId}
              targetMatchId={targetMatchId}
              onClearHighlight={onClearHighlight}
            />
          ),
        )}

        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (effectiveExpanded) {
                setExpanded(false);
                if (hasHighlightedInHiddenGroups && targetMatchId) {
                  setDismissedHighlightId(targetMatchId);
                }
              } else {
                setExpanded(true);
              }
            }}
            className="w-full text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50/60 dark:hover:bg-rose-500/15 text-xs font-black uppercase tracking-widest mt-1"
          >
            {effectiveExpanded ? '折疊顯示' : `查看其餘 ${groups.length - 3} 組對戰`}
          </Button>
        )}
      </div>
    </div>
  );
}

// Single-match confirmation card (shown when a matchup group has only 1 match)
function SingleActionMatchCard({
  match,
  group,
  currentUserId,
  targetMatchId,
  onClearHighlight,
}: {
  match: PendingMatch;
  group: MatchupGroup;
  currentUserId?: string;
  targetMatchId?: string | null;
  onClearHighlight?: () => void;
}) {
  const queryClient = useQueryClient();
  const info = getMatchPerspective(match, 'confirm', currentUserId);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isHighlighted = Boolean(
    targetMatchId && String(match.id) === String(targetMatchId),
  );

  useEffect(() => {
    if (!isHighlighted || !cardRef.current) return;
    const timer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isHighlighted]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const confirmResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmResetTimerRef.current !== null) {
        window.clearTimeout(confirmResetTimerRef.current);
      }
    };
  }, []);

  const handleConfirmAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsConfirming(true);
    try {
      await apiClient.post(`/matches/${match.id}/confirm`, undefined, { skipGlobalErrorToast: true });
      invalidateMatchSettlementQueries(queryClient);

      setIsConfirming(false);
      setIsSuccess(true);
      toast.success('賽果確認完成，積分已即時更新');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const errorMessage = detail || (err instanceof Error ? err.message : '網路連線錯誤');
      toast.error('確認失敗：' + errorMessage);
      setIsConfirming(false);
    }
  };

  const handleConfirmOpenChange = (nextOpen: boolean) => {
    if (isConfirming) return;
    if (confirmResetTimerRef.current !== null) {
      window.clearTimeout(confirmResetTimerRef.current);
      confirmResetTimerRef.current = null;
    }
    setConfirmOpen(nextOpen);
    if (!nextOpen && isSuccess) {
      confirmResetTimerRef.current = window.setTimeout(() => {
        setIsSuccess(false);
        confirmResetTimerRef.current = null;
      }, 250);
    }
  };

  const matchupSummaryCard = (
    <div className="bg-surface-subtle/80 border border-border rounded-2xl p-4 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-2 right-2 opacity-[0.04] pointer-events-none" aria-hidden="true">
        <Trophy size={72} />
      </div>

      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* My Side */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <div className={cn('flex items-center justify-center', info.myTeam.length > 1 && '-space-x-3')}>
            {info.myTeam.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className={cn(
                  'size-12 rounded-xl border-2 text-sm',
                  info.isWin ? 'border-emerald-500' : 'border-card',
                )}
              />
            ))}
          </div>
          <span className="text-xs font-black text-foreground truncate max-w-full text-center">
            {formatTeamNames(info.myTeam)}
          </span>
        </div>

        {/* Center Score */}
        <div className="flex flex-col items-center shrink-0 px-2">
          <div className="text-3xl sm:text-4xl font-display font-black text-foreground tabular-nums">
            {info.myScore} : {info.rivalScore}
          </div>
          <span
            className={cn(
              'mt-1 px-2.5 py-0.5 rounded-full text-xs font-black',
              info.isWin ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white',
            )}
          >
            {info.isWin ? '你勝' : '你敗'}
          </span>
        </div>

        {/* Rival Side */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <div className={cn('flex items-center justify-center', info.rivalTeam.length > 1 && '-space-x-3')}>
            {info.rivalTeam.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className={cn(
                  'size-12 rounded-xl border-2 text-sm',
                  info.isLoss ? 'border-emerald-500' : 'border-card',
                )}
              />
            ))}
          </div>
          <span className="text-xs font-black text-foreground truncate max-w-full text-center">
            {formatTeamNames(info.rivalTeam)}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-dashed border-border flex items-center justify-between text-xs">
        <span className="font-bold text-muted-foreground">
          {isSuccess ? '確認時間 · ' + formatLocalTime(new Date().toISOString(), 'yyyy-MM-dd HH:mm') : '預估積分變動'}
        </span>
        <span
          className={cn(
            'text-sm font-display font-black tabular-nums',
            info.myDelta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {formatSignedDelta(info.myDelta)} ELO
        </span>
      </div>
    </div>
  );

  return (
    <div
      id={`pending-match-${match.id}`}
      ref={cardRef}
      className={cn(
        'bg-card rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border shadow-xs relative overflow-hidden group transition-all',
        isHighlighted
          ? 'border-sapphire-blue ring-2 ring-sapphire-blue/60 dark:ring-blue-400/60 shadow-md bg-sapphire-blue/[0.03]'
          : 'border-rose-200/70 dark:border-rose-500/30',
      )}
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 w-1 transition-colors',
          isHighlighted ? 'bg-sapphire-blue' : 'bg-rose-400 group-hover:bg-rose-500',
        )}
      />

      {/* Rival & Score Info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn('flex shrink-0', group.rivalTeam.length > 1 && '-space-x-3')}>
          {group.rivalTeam.map((p, i) => (
            <PlayerAvatar
              key={p.id || i}
              src={p.avatar}
              name={p.name}
              className="size-12 md:size-14 rounded-2xl border-2 border-card shadow-xs text-sm"
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {isHighlighted && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-1.5 rounded-full bg-sapphire-blue text-white text-[11px] font-black leading-none">
              <Crosshair size={11} aria-hidden="true" />
              <span>通知指定待確認場次 · #{String(match.id).slice(0, 4)}</span>
              {onClearHighlight && (
                <button
                  type="button"
                  onClick={onClearHighlight}
                  aria-label="清除通知定位"
                  className="ml-0.5 hover:opacity-80"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-sans font-black text-foreground truncate text-sm md:text-base tracking-tight">
              對手：{formatTeamNames(group.rivalTeam)}
            </span>
            <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground shrink-0">
              {group.type === 'doubles' ? '雙打' : '單打'}
            </span>
            <span
              className={cn(
                'text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0',
                info.isLoss
                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300',
              )}
            >
              {info.isLoss ? '敗' : '勝'}
            </span>
          </div>
          {group.type === 'doubles' && group.partner && (
            <p className="text-xs font-bold text-muted-foreground mb-1 truncate">
              搭檔：{group.partner.name}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="font-display font-black text-2xl md:text-3xl tracking-tight text-foreground leading-none tabular-nums">
              {info.myScore} <span className="text-muted-foreground/45 font-sans mx-0.5">:</span> {info.rivalScore}
            </span>
            <div className="h-6 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground leading-none mb-1">預估變動</span>
              <span
                className={cn(
                  'text-xs md:text-sm font-display font-black leading-none tabular-nums',
                  info.myDelta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {formatSignedDelta(info.myDelta)} 分
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown & Actions */}
      <div className="flex items-center gap-2 justify-between md:justify-end pt-3 md:pt-0 border-t border-border md:border-none">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/15 rounded-lg shrink-0">
          <Clock size={14} className="text-rose-500 dark:text-rose-400" aria-hidden="true" />
          <span className="text-xs font-black font-display text-rose-600 dark:text-rose-300 tabular-nums leading-none tracking-wide">
            倒數 {getRemainingTimeStr(match.expiresAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <DisputeMatchModal
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            match={match}
            currentUserId={currentUserId}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="提出異議"
                title="提出異議"
                className="size-10 rounded-xl border-border text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/40 bg-card"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" className="size-4.5" />
              </Button>
            }
          />

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
                  className="w-full sm:w-auto h-11 px-8 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm"
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
                    className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={isConfirming}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm shadow-sm"
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
                  <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={32} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <p className="text-base font-display font-black text-foreground">賽果確認完成！</p>
                </div>
              )}

              {matchupSummaryCard}

              {!isSuccess && (
                <p className="text-xs text-muted-foreground font-medium text-center">
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

// Grouped multi-match confirmation card (Part A)
function GroupedActionMatchCard({
  group,
  currentUserId,
  targetMatchId,
  onClearHighlight,
}: {
  group: MatchupGroup;
  currentUserId?: string;
  targetMatchId?: string | null;
  onClearHighlight?: () => void;
}) {
  const [excludedIds, setExcludedIds] = useState<Record<string, boolean>>({});
  const [showAllRows, setShowAllRows] = useState(false);
  const [dismissedHighlightId, setDismissedHighlightId] = useState<string | null>(null);
  const [disputeMatch, setDisputeMatch] = useState<PendingMatch | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const containsHighlighted = Boolean(
    targetMatchId && group.matches.some((m) => String(m.id) === String(targetMatchId)),
  );
  const hasHighlightedInHiddenRows = Boolean(
    targetMatchId &&
      group.matches.slice(5).some((m) => String(m.id) === String(targetMatchId)),
  );
  const effectiveShowAllRows =
    showAllRows ||
    Boolean(
      hasHighlightedInHiddenRows &&
        targetMatchId &&
        dismissedHighlightId !== targetMatchId,
    );

  useEffect(() => {
    if (!containsHighlighted || !targetMatchId || !effectiveShowAllRows) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`pending-match-${targetMatchId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [containsHighlighted, targetMatchId, effectiveShowAllRows]);

  const selectedMatches = useMemo(
    () => group.matches.filter((m) => !excludedIds[m.id]),
    [group.matches, excludedIds],
  );

  const selectedGroups = useMemo(
    () =>
      selectedMatches.length > 0
        ? groupPendingMatches(selectedMatches, 'confirm', currentUserId)
        : [],
    [selectedMatches, currentUserId],
  );

  const toggleMatch = (id: string) => {
    setExcludedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleMatches = effectiveShowAllRows ? group.matches : group.matches.slice(0, 5);
  const allSelected = selectedMatches.length === group.matches.length;

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border shadow-xs relative overflow-hidden transition-all',
        containsHighlighted
          ? 'border-sapphire-blue ring-2 ring-sapphire-blue/50 dark:ring-blue-400/50'
          : 'border-rose-200/70 dark:border-rose-500/30',
      )}
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 w-1',
          containsHighlighted ? 'bg-sapphire-blue' : 'bg-rose-400',
        )}
      />

      {/* Matchup Header */}
      <div className="p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={cn('flex shrink-0', group.rivalTeam.length > 1 && '-space-x-3')}>
            {group.rivalTeam.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className="size-11 md:size-12 rounded-2xl border-2 border-card shadow-xs text-sm"
              />
            ))}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans font-black text-foreground truncate text-sm md:text-base tracking-tight">
                對手：{formatTeamNames(group.rivalTeam)}
              </span>
              <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground shrink-0">
                {group.type === 'doubles' ? '雙打' : '單打'}
              </span>
              {group.type === 'doubles' && group.partner && (
                <span className="text-xs font-bold text-muted-foreground truncate">
                  · 搭檔：{group.partner.name}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs font-bold">
              <span className="text-foreground font-black">共 {group.matches.length} 場</span>
              <span className="text-muted-foreground">
                你{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-black">{group.wins} 勝</span>{' '}
                <span className="text-rose-600 dark:text-rose-400 font-black">{group.losses} 敗</span>
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span
                className={cn(
                  'font-display font-black tabular-nums',
                  group.estimatedTotalDelta < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                預估合計 {formatSignedDelta(group.estimatedTotalDelta)} 分
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/15 rounded-lg shrink-0 self-start sm:self-center">
          <Clock size={14} className="text-rose-500 dark:text-rose-400" aria-hidden="true" />
          <span className="text-xs font-black font-display text-rose-600 dark:text-rose-300 tabular-nums leading-none tracking-wide">
            最快倒數 {getRemainingTimeStr(group.earliestExpiresAt)}
          </span>
        </div>
      </div>

      {/* Compact Match Rows */}
      <div className="px-3.5 md:px-4 pb-3 space-y-1.5">
        {visibleMatches.map((m, idx) => {
          const info = getMatchPerspective(m, 'confirm', currentUserId);
          const isSelected = !excludedIds[m.id];
          const isRowHighlighted = Boolean(
            targetMatchId && String(m.id) === String(targetMatchId),
          );

          return (
            <div
              key={m.id}
              id={`pending-match-${m.id}`}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-all',
                isRowHighlighted
                  ? 'ring-2 ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/10 dark:bg-blue-500/20 border-sapphire-blue/50'
                  : isSelected
                    ? 'bg-surface-subtle/70 border-border/80'
                    : 'bg-background/50 border-border/40 opacity-55',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggleMatch(m.id)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire-blue/30 rounded-lg"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-border bg-card text-transparent',
                  )}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="w-6 text-xs font-display font-black text-muted-foreground tabular-nums shrink-0">
                  #{idx + 1}
                </span>
                <span className="font-display font-black text-base text-foreground tabular-nums shrink-0">
                  {info.myScore} : {info.rivalScore}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-black uppercase px-1.5 py-0.5 rounded-md border shrink-0',
                    info.isLoss
                      ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300',
                  )}
                >
                  {info.isLoss ? '敗' : '勝'}
                </span>
                <span className="hidden sm:inline text-xs font-bold text-muted-foreground tabular-nums">
                  {formatLocalTime(m.date, 'HH:mm')}
                </span>
                {isRowHighlighted && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sapphire-blue text-white text-[10px] font-black leading-none shrink-0">
                    <Crosshair size={10} aria-hidden="true" />
                    通知指定
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {isRowHighlighted && onClearHighlight && (
                  <button
                    type="button"
                    onClick={onClearHighlight}
                    aria-label="清除通知定位"
                    title="清除通知定位"
                    className="size-6 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
                <span
                  className={cn(
                    'text-xs font-display font-black tabular-nums',
                    info.myDelta < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {formatSignedDelta(info.myDelta)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDisputeMatch(m)}
                  aria-label={`對第 ${idx + 1} 場提出異議`}
                  title="對此場提出異議"
                  className="size-7 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15"
                >
                  <Flag size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}

        {group.matches.length > 5 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (effectiveShowAllRows) {
                setShowAllRows(false);
                if (hasHighlightedInHiddenRows && targetMatchId) {
                  setDismissedHighlightId(targetMatchId);
                }
              } else {
                setShowAllRows(true);
              }
            }}
            className="w-full h-8 text-xs font-black text-muted-foreground hover:text-foreground"
          >
            {effectiveShowAllRows ? '收合部分場次' : `展開其餘 ${group.matches.length - 5} 場`}
          </Button>
        )}
      </div>

      {/* Group Footer */}
      <div className="px-3.5 md:px-4 py-3 bg-surface-subtle/60 border-t border-border/70 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-muted-foreground">
          {allSelected ? (
            <span>已全選 {group.matches.length} 場 · 單場有誤可取消勾選</span>
          ) : (
            <button
              type="button"
              onClick={() => setExcludedIds({})}
              className="font-black text-sapphire-blue hover:underline"
            >
              重新全選 ({selectedMatches.length}/{group.matches.length})
            </button>
          )}
        </div>

        <Button
          type="button"
          disabled={selectedMatches.length === 0}
          onClick={() => setConfirmOpen(true)}
          className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm tracking-wide shadow-sm gap-1.5 border-none disabled:opacity-40"
        >
          <Check size={16} strokeWidth={3} aria-hidden="true" />
          {allSelected
            ? `一鍵確認全部 (${group.matches.length} 場)`
            : `確認已選 (${selectedMatches.length} 場)`}
        </Button>
      </div>

      <DisputeMatchModal
        open={!!disputeMatch}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDisputeMatch(null);
        }}
        match={disputeMatch}
        currentUserId={currentUserId}
      />

      <BatchConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        mode="group"
        groups={selectedGroups}
        currentUserId={currentUserId}
        onSettled={() => setExcludedIds({})}
      />
    </div>
  );
}

// Batch confirmation modal shared by per-group batch CTA (Part A) and header Confirm All CTA (Part C)
function BatchConfirmModal({
  open,
  onOpenChange,
  mode,
  groups,
  currentUserId,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'group' | 'all';
  groups: MatchupGroup[];
  currentUserId?: string;
  onSettled?: () => void;
}) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = useMemo(() => {
    const allMatches: PendingMatch[] = [];
    let totalWins = 0;
    let totalLosses = 0;
    let estimatedTotalDelta = 0;

    for (const group of groups) {
      allMatches.push(...group.matches);
      totalWins += group.wins;
      totalLosses += group.losses;
      estimatedTotalDelta += group.estimatedTotalDelta;
    }

    return {
      allMatches,
      totalCount: allMatches.length,
      totalWins,
      totalLosses,
      estimatedTotalDelta: Math.round(estimatedTotalDelta * 10) / 10,
    };
  }, [groups]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleBatchConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (summary.totalCount === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<BatchConfirmResponse>(
        '/matches/confirm-batch',
        { match_ids: summary.allMatches.map((m) => m.id) },
        { skipGlobalErrorToast: true },
      );

      invalidateMatchSettlementQueries(queryClient);
      onOpenChange(false);
      onSettled?.();

      const data = res.data;
      toast.success(
        `已完成 ${data.confirmed_count} 場賽果結算（實際 ${formatSignedDelta(data.current_user_total_delta)} ELO，目前積分 ${Math.round(data.current_user_new_mmr)}）`,
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr?.response?.status;
      const detail = axiosErr?.response?.data?.detail;
      const errorMessage = detail || (err instanceof Error ? err.message : '網路連線錯誤');
      toast.error('批次確認失敗：' + errorMessage);

      if (status === 400 || status === 404) {
        queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      tone="success"
      icon={<CheckCheck size={18} />}
      title={mode === 'all' ? '全部批次確認賽果' : '批次確認同組賽果'}
      description={`共 ${summary.totalCount} 場待結算對戰，確認後將依時間順序逐場即時結算 ELO 積分。`}
      onSubmit={handleBatchConfirm}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || summary.totalCount === 0}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm shadow-sm gap-1.5"
          >
            <CheckCheck size={16} aria-hidden="true" />
            {isSubmitting ? '結算中...' : `確認結算 (${summary.totalCount} 場)`}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {/* Aggregate Summary Strip */}
        <div className="bg-surface-subtle/90 border border-border rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="font-black text-foreground">合計 {summary.totalCount} 場</span>
            <span>·</span>
            <span>
              你 <span className="text-emerald-600 dark:text-emerald-400 font-black">{summary.totalWins} 勝</span>{' '}
              <span className="text-rose-600 dark:text-rose-400 font-black">{summary.totalLosses} 敗</span>
            </span>
          </div>
          <span
            className={cn(
              'text-sm font-display font-black tabular-nums',
              summary.estimatedTotalDelta < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            預估約 {formatSignedDelta(summary.estimatedTotalDelta)} ELO
          </span>
        </div>

        {/* Scrollable Matchup Groups Breakdown */}
        <div className="max-h-[44vh] overflow-y-auto space-y-2.5 pr-1">
          {groups.map((group) => (
            <div key={group.key} className="bg-card border border-border rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn('flex shrink-0', group.rivalTeam.length > 1 && '-space-x-2.5')}>
                    {group.rivalTeam.map((p, i) => (
                      <PlayerAvatar
                        key={p.id || i}
                        src={p.avatar}
                        name={p.name}
                        className="size-8 rounded-xl border border-border text-xs"
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-black text-foreground truncate block">
                      對手：{formatTeamNames(group.rivalTeam)}
                    </span>
                    {group.type === 'doubles' && group.partner && (
                      <span className="text-[11px] font-bold text-muted-foreground block truncate">
                        搭檔：{group.partner.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-black text-muted-foreground shrink-0">
                  {group.matches.length} 場
                </span>
              </div>

              <div className="space-y-1">
                {group.matches.map((m, idx) => {
                  const info = getMatchPerspective(m, 'confirm', currentUserId);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-subtle/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-display font-black text-muted-foreground w-6 tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="font-display font-black text-sm text-foreground tabular-nums">
                          {info.myScore} : {info.rivalScore}
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded font-black text-[11px]',
                            info.isWin
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                          )}
                        >
                          {info.isWin ? '你勝' : '你敗'}
                        </span>
                        <span className="text-muted-foreground font-bold tabular-nums">
                          {formatLocalTime(m.date, 'HH:mm')}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'font-display font-black tabular-nums',
                          info.myDelta < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {formatSignedDelta(info.myDelta)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground font-medium text-center">
          連打多場將依建立時間順序逐場結算真實 ELO（實際變動以結算當下為準），確認後無法撤回。
        </p>
      </div>
    </ResponsiveFormModal>
  );
}

// Reusable Dispute Modal for both single & grouped match rows
function DisputeMatchModal({
  open,
  onOpenChange,
  trigger,
  match,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactElement;
  match: PendingMatch | null;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const disputeFieldId = useId();

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setDisputeReason('');
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleaned = disputeReason.trim();
    if (!cleaned || !match || isSubmitting) {
      if (!cleaned) toast.error('請填寫異議原因');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ message: string }>(
        `/matches/${match.id}/dispute`,
        { reason: cleaned },
        { skipGlobalErrorToast: true },
      );
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(res.data.message || '已提交異議，自動結算已暫停並通知管理員處理');
      setIsSubmitting(false);
      onOpenChange(false);
      setDisputeReason('');
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error('送出異議失敗：' + (detail || '請稍後再試'));
      setIsSubmitting(false);
    }
  };

  const info = match ? getMatchPerspective(match, 'confirm', currentUserId) : null;

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      size="md"
      tone="danger"
      icon={<ShieldAlert size={18} />}
      title="提出賽果異議"
      description="送出後將立即暫停自動結算，並通知對手與管理員協助裁決。"
      onSubmit={handleDisputeSubmit}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || disputeReason.trim().length < 2}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm disabled:opacity-40"
          >
            {isSubmitting ? '送出中...' : '送出異議'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {info && (
          <div className="bg-surface-subtle border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-sm font-bold text-foreground truncate block">
                對手：{formatTeamNames(info.rivalTeam)}
              </span>
              {info.type === 'doubles' && info.partner && (
                <span className="text-xs font-bold text-muted-foreground truncate block">
                  搭檔：{info.partner.name}
                </span>
              )}
            </div>
            <span className="font-display font-black text-lg text-foreground tabular-nums shrink-0">
              {info.myScore} : {info.rivalScore}
            </span>
          </div>
        )}
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
            className="arena-textarea min-h-28 text-base sm:text-sm"
          />
        </div>
      </div>
    </ResponsiveFormModal>
  );
}

// Group 2: Waiting on Opponent (Collapsible & Matchup-Grouped - Part B)
function WaitingOnOthersGroup({
  matches,
  currentUserId,
  targetMatchId,
  onClearHighlight,
}: {
  matches: PendingMatch[];
  currentUserId?: string;
  targetMatchId?: string | null;
  onClearHighlight?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedHighlightId, setDismissedHighlightId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const containsHighlighted = Boolean(
    targetMatchId && matches.some((m) => String(m.id) === String(targetMatchId)),
  );
  const effectiveOpen =
    isOpen ||
    Boolean(
      containsHighlighted &&
        targetMatchId &&
        dismissedHighlightId !== targetMatchId,
    );

  useEffect(() => {
    if (!containsHighlighted || !targetMatchId || !effectiveOpen) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`pending-match-${targetMatchId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [containsHighlighted, targetMatchId, effectiveOpen]);

  const groups = useMemo(
    () => groupPendingMatches(matches, 'waiting', currentUserId),
    [matches, currentUserId],
  );

  const doDelete = async (matchId: string) => {
    setDeletingId(matchId);
    try {
      await apiClient.delete(`/matches/${matchId}`, { skipGlobalErrorToast: true });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  if (matches.length === 0) return null;

  return (
    <div className="bg-surface-subtle/80 border border-border rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-300">
      <button
        type="button"
        aria-expanded={effectiveOpen}
        onClick={() => {
          if (effectiveOpen) {
            setIsOpen(false);
            if (containsHighlighted && targetMatchId) {
              setDismissedHighlightId(targetMatchId);
            }
          } else {
            setIsOpen(true);
          }
        }}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire-blue/25"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Zap className="text-muted-foreground shrink-0" size={18} aria-hidden="true" />
          <span className="text-sm font-black text-foreground tracking-wide">
            {matches.length} 筆賽果等待對方確認中{' '}
            <span className="hidden md:inline text-xs font-bold text-muted-foreground ml-2">
              (時限後將自動生效)
            </span>
          </span>
          {groups.length < matches.length && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
              {groups.length} 組對戰
            </span>
          )}
          {containsHighlighted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sapphire-blue text-white text-[10px] font-black leading-none">
              <Crosshair size={10} aria-hidden="true" />
              含通知場次
            </span>
          )}
        </div>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={cn('text-muted-foreground transition-transform duration-300 shrink-0', effectiveOpen && 'rotate-180')}
        />
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          effectiveOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-0 space-y-2.5">
            {groups.map((group) => {
              if (group.matches.length === 1) {
                const match = group.matches[0];
                const info = getMatchPerspective(match, 'waiting', currentUserId);
                const isDeleting = deletingId === match.id;
                const canManage = !currentUserId || match.submittedBy === currentUserId;
                const isRowHighlighted = Boolean(
                  targetMatchId && String(match.id) === String(targetMatchId),
                );

                return (
                  <div
                    key={group.key}
                    id={`pending-match-${match.id}`}
                    className={cn(
                      'bg-card rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs border gap-3 transition-all',
                      isRowHighlighted
                        ? 'border-sapphire-blue ring-2 ring-sapphire-blue/60 bg-sapphire-blue/[0.04]'
                        : 'border-border',
                      isDeleting && 'opacity-40 pointer-events-none',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex shrink-0', group.rivalTeam.length > 1 && '-space-x-2.5')}>
                        {group.rivalTeam.map((p, i) => (
                          <PlayerAvatar
                            key={p.id || i}
                            src={p.avatar}
                            name={p.name}
                            className="size-8 rounded-lg border border-border text-xs grayscale opacity-75"
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-xs md:text-sm font-bold text-foreground truncate">
                            {formatTeamNames(group.rivalTeam)}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-black uppercase px-1.5 py-0.5 rounded-md shrink-0',
                              info.isLoss
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
                            )}
                          >
                            {info.isLoss ? '敗' : '勝'}
                          </span>
                          <span className="text-sm font-display font-black text-foreground tabular-nums ml-1 shrink-0">
                            {info.myScore} : {info.rivalScore}
                          </span>
                          {isRowHighlighted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sapphire-blue text-white text-[10px] font-black leading-none shrink-0">
                              <Crosshair size={10} aria-hidden="true" />
                              通知指定
                              {onClearHighlight && (
                                <button
                                  type="button"
                                  onClick={onClearHighlight}
                                  aria-label="清除通知定位"
                                  className="ml-0.5 hover:opacity-80"
                                >
                                  <X size={10} aria-hidden="true" />
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                        {group.type === 'doubles' && group.partner && (
                          <span className="text-[11px] font-bold text-muted-foreground block truncate">
                            搭檔：{group.partner.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                      <div className="text-xs font-bold text-muted-foreground tabular-nums flex items-center gap-1 bg-secondary px-2.5 py-1 rounded-lg shrink-0">
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
                        <span className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-bold shrink-0">
                          隊友已申報
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={group.key}
                  className="bg-card rounded-2xl p-3 shadow-xs border border-border space-y-2.5"
                >
                  {/* Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex shrink-0', group.rivalTeam.length > 1 && '-space-x-2.5')}>
                        {group.rivalTeam.map((p, i) => (
                          <PlayerAvatar
                            key={p.id || i}
                            src={p.avatar}
                            name={p.name}
                            className="size-8 rounded-lg border border-border text-xs grayscale opacity-75"
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs md:text-sm font-black text-foreground truncate">
                            {formatTeamNames(group.rivalTeam)}
                          </span>
                          <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground shrink-0">
                            {group.type === 'doubles' ? '雙打' : '單打'}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            共 {group.matches.length} 場 · {group.wins}勝 {group.losses}敗
                          </span>
                        </div>
                        {group.type === 'doubles' && group.partner && (
                          <span className="text-[11px] font-bold text-muted-foreground block truncate">
                            搭檔：{group.partner.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-bold text-muted-foreground tabular-nums flex items-center gap-1 bg-secondary px-2.5 py-1 rounded-lg shrink-0 self-start sm:self-center">
                      <Clock size={12} aria-hidden="true" />
                      最快生效剩餘 {getRemainingTimeStr(group.earliestExpiresAt)}
                    </div>
                  </div>

                  {/* Compact Per-Match Rows */}
                  <div className="divide-y divide-border/60">
                    {group.matches.map((match, idx) => {
                      const info = getMatchPerspective(match, 'waiting', currentUserId);
                      const isDeleting = deletingId === match.id;
                      const canManage = !currentUserId || match.submittedBy === currentUserId;
                      const isRowHighlighted = Boolean(
                        targetMatchId && String(match.id) === String(targetMatchId),
                      );

                      return (
                        <div
                          key={match.id}
                          id={`pending-match-${match.id}`}
                          className={cn(
                            'py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 transition-all rounded-xl',
                            isRowHighlighted &&
                              'ring-2 ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/10 dark:bg-blue-500/20 px-2 my-1',
                            isDeleting && 'opacity-40 pointer-events-none',
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                            <span className="w-6 text-xs font-display font-black text-muted-foreground tabular-nums shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-display font-black text-foreground tabular-nums shrink-0">
                              {info.myScore} : {info.rivalScore}
                            </span>
                            <span
                              className={cn(
                                'text-[11px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0',
                                info.isLoss
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
                              )}
                            >
                              {info.isLoss ? '敗' : '勝'}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                              {formatLocalTime(match.date, 'HH:mm')}
                            </span>
                            {isRowHighlighted && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sapphire-blue text-white text-[10px] font-black leading-none shrink-0">
                                <Crosshair size={10} aria-hidden="true" />
                                通知指定
                                {onClearHighlight && (
                                  <button
                                    type="button"
                                    onClick={onClearHighlight}
                                    aria-label="清除通知定位"
                                    className="ml-0.5 hover:opacity-80"
                                  >
                                    <X size={10} aria-hidden="true" />
                                  </button>
                                )}
                              </span>
                            )}
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
                            <span className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-bold shrink-0">
                              隊友已申報
                            </span>
                          )}
                        </div>
                      );
                    })}
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
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const handleConfirmSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOpen(false);
    if (confirmTimerRef.current !== null) {
      window.clearTimeout(confirmTimerRef.current);
    }
    confirmTimerRef.current = window.setTimeout(() => {
      confirmTimerRef.current = null;
      onConfirm();
    }, 150);
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
          className="size-9 rounded-xl text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
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
            className="w-full sm:w-auto h-11 px-4 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消，繼續等待
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm gap-1.5"
          >
            <Trash2 size={15} aria-hidden="true" />
            確認撤回申報
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-surface-subtle border border-border rounded-2xl p-4 flex items-center gap-3.5">
          <div className={cn('flex shrink-0', match.opponent.length > 1 && '-space-x-2.5')}>
            {match.opponent.map((p, i) => (
              <PlayerAvatar
                key={p.id || i}
                src={p.avatar}
                name={p.name}
                className="size-10 rounded-xl border-2 border-card shadow-xs text-xs"
              />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-foreground truncate">
                {formatTeamNames(match.opponent)}
              </span>
              <span
                className={cn(
                  'text-xs font-black uppercase px-1.5 py-0.5 rounded-md shrink-0',
                  isLoss
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
                )}
              >
                {isLoss ? '敗' : '勝'}
              </span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">待確認賽果</span>
          </div>
          <span className="text-xl font-display font-black text-foreground tabular-nums shrink-0">
            {match.score[0]} : {match.score[1]}
          </span>
        </div>

        <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3.5 py-3">
          <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-bold text-rose-700 dark:text-rose-300 leading-relaxed">
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
      await apiClient.patch(
        `/matches/${match.id}`,
        { score_a: scoreA, score_b: scoreB },
        { skipGlobalErrorToast: true },
      );
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
          className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={saving || !validation.valid}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm shadow-sm disabled:opacity-35"
          >
            {saving ? '儲存中...' : '儲存修改'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 對手摘要卡 */}
        <div className="bg-surface-subtle/80 border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('flex shrink-0', match.opponent.length > 1 && '-space-x-2.5')}>
              {match.opponent.map((p, i) => (
                <PlayerAvatar
                  key={p.id || i}
                  src={p.avatar}
                  name={p.name}
                  className="size-9 rounded-xl border border-border text-xs"
                />
              ))}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-muted-foreground block">對手</span>
              <span className="text-sm font-black text-foreground truncate block">
                {formatTeamNames(match.opponent)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-muted-foreground block">目前比分</span>
            <span className="text-xl font-display font-black text-foreground tabular-nums">
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
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/12 dark:border-emerald-500/30 dark:text-emerald-300'
              : validation.tone === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/12 dark:border-rose-500/30 dark:text-rose-300'
                : 'bg-surface-subtle border-border text-muted-foreground',
          )}
        >
          {validation.message}
        </div>
      </div>
    </ResponsiveFormModal>
  );
}
