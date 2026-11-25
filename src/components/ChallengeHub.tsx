import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Flag,
  History,
  MapPin,
  Plus,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ChallengeModal } from '@/components/ChallengeModal';
import { cn } from '@/lib/utils';
import {
  buildChallengeShareText,
  DECLINE_REASON_PRESETS,
  downloadChallengeIcs,
  formatChallengeDateTimeLabel,
} from '@/lib/challengeUtils';
import { formatSmartMatchTime } from '@/lib/matchDate';
import {
  useAcceptChallenge,
  useCancelChallenge,
  useCompleteChallenge,
  useDeclineChallenge,
  useMyChallenges,
} from '@/hooks/useChallenges';
import apiClient from '@/utils/apiClient';
import type {
  ChallengeItem,
  ChallengePlayer,
  ChallengeReportedMatch,
} from '@/types/api.types';

interface SimpleUserOption {
  id: string;
  name: string;
  department?: string | null;
}

interface ChallengeHubProps {
  currentUserId?: string;
  onInspectPlayer: (playerId: string) => void;
  onReportChallenge: (challenge: ChallengeItem) => void;
}

function PlayerChip({
  player,
  onInspect,
  placeholder,
}: {
  player?: ChallengePlayer | null;
  onInspect: (id: string) => void;
  placeholder?: string;
}) {
  if (!player) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-secondary/80 border border-dashed border-border text-[11px] font-bold text-muted-foreground">
        {placeholder || '現場湊咖'}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onInspect(player.id)}
      className="inline-flex items-center gap-1.5 pr-2 pl-1 py-0.5 rounded-lg bg-card border border-border hover:border-sapphire-blue/50 transition-colors max-w-full"
    >
      <PlayerAvatar src={player.avatar} name={player.name} className="size-5 rounded-md text-[10px]" />
      <span className="text-xs font-black text-foreground truncate">{player.name}</span>
    </button>
  );
}

const HISTORY_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: '已完賽', cls: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  declined: { label: '已婉拒', cls: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' },
  cancelled: { label: '已取消', cls: 'bg-secondary text-muted-foreground' },
  expired: { label: '已過期', cls: 'bg-secondary text-muted-foreground' },
};

function InlineTeamNames({
  players,
  won,
  onInspect,
}: {
  players: ChallengePlayer[];
  won: boolean;
  onInspect: (id: string) => void;
}) {
  if (players.length === 0) {
    return <span className="text-muted-foreground text-sm">待定</span>;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center flex-wrap gap-0.5 min-w-0 text-sm',
        won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
      )}
    >
      {players.map((p, idx) => (
        <span key={p.id} className="inline-flex items-center min-w-0">
          {idx > 0 && <span className="text-muted-foreground/50 mx-0.5">/</span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(p.id);
            }}
            className="hover:text-sapphire-blue transition-colors truncate max-w-[150px] sm:max-w-[200px]"
          >
            {p.name}
          </button>
        </span>
      ))}
    </span>
  );
}

function ChallengeReportedMatchesPanel({
  matches,
  expectedCount,
  currentUserId,
  onInspectPlayer,
  onNavigateMatch,
  onNavigateHistory,
}: {
  matches?: ChallengeReportedMatch[];
  expectedCount: number;
  currentUserId?: string;
  onInspectPlayer: (id: string) => void;
  onNavigateMatch: (matchId: string) => void;
  onNavigateHistory: () => void;
}) {
  const list = matches ?? [];

  if (list.length === 0) {
    return (
      <div className="rounded-xl bg-card/85 border border-border/80 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground font-medium">
          此約戰累計已報 {expectedCount} 場，無法自動比對到對應歷史場次（可能已被管理員刪除）。
        </span>
        <button
          type="button"
          onClick={onNavigateHistory}
          className="inline-flex items-center gap-1 text-sapphire-blue hover:underline font-semibold shrink-0"
        >
          <span>前往對戰歷史</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card/90 border border-border/80 overflow-hidden">
      <div className="px-3.5 py-2.5 bg-surface-subtle/70 border-b border-border/60 flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold text-muted-foreground">
        <span>已關聯約戰場次明細（共 {list.length} 場）</span>
        <span className="hidden sm:inline text-xs font-medium">點擊「定位」可在對戰歷史查看完整紀錄</span>
      </div>
      <div className="divide-y divide-border/60">
        {list.map((m, idx) => {
          const aWon = m.winner_team === 'A';
          const isPending = m.status === 'pending';
          const isDisputed = m.status === 'disputed';
          const inA = currentUserId
            ? m.team_a.some((p) => String(p.id) === String(currentUserId))
            : false;
          const inB = currentUserId
            ? m.team_b.some((p) => String(p.id) === String(currentUserId))
            : false;
          const viewerInMatch = inA || inB;
          const viewerWon = (inA && aWon) || (inB && !aWon);
          const absElo = m.mmr_exchanged != null ? Math.round(m.mmr_exchanged) : null;

          return (
            <div
              key={m.id}
              className="px-3.5 py-3 flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 text-sm hover:bg-surface-subtle/40 transition-colors"
            >
              {/* 左：場次編號與對戰時間 */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-secondary border border-border/70 text-xs font-display font-bold text-muted-foreground tabular-nums">
                  #{idx + 1}
                </span>
                <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums">
                  {formatSmartMatchTime(m.created_at)}
                </span>
                {m.format === 'BO5' && (
                  <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none">
                    BO5
                  </span>
                )}
              </div>

              {/* 中：對陣雙方與比分 */}
              <div className="flex items-center gap-2.5 flex-wrap min-w-0 flex-1">
                <InlineTeamNames players={m.team_a} won={aWon} onInspect={onInspectPlayer} />
                <span className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-border/80 font-display font-bold text-sm sm:text-base tabular-nums shrink-0 leading-none">
                  <span className={aWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                    {m.score_a}
                  </span>
                  <span className="text-muted-foreground/45 mx-1">:</span>
                  <span className={!aWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                    {m.score_b}
                  </span>
                </span>
                <InlineTeamNames players={m.team_b} won={!aWon} onInspect={onInspectPlayer} />
              </div>

              {/* 右：結算狀態與跳轉定位 */}
              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                {isPending ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-semibold">
                    待確認
                  </span>
                ) : isDisputed ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/25 text-xs font-semibold">
                    申訴中
                  </span>
                ) : absElo !== null && absElo > 0 ? (
                  viewerInMatch ? (
                    <span
                      className={cn(
                        'font-display font-bold text-sm tabular-nums whitespace-nowrap',
                        viewerWon
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {viewerWon ? `+${absElo}` : `-${absElo}`} 分
                    </span>
                  ) : (
                    <span className="font-display font-bold text-sm text-muted-foreground tabular-nums">
                      ±{absElo} 分
                    </span>
                  )
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    已確認
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onNavigateMatch(m.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 min-h-8 rounded-lg bg-card hover:bg-secondary border border-border text-xs sm:text-sm font-semibold text-sapphire-blue dark:text-blue-300 transition-colors shrink-0"
                >
                  <span>定位</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChallengeHub({
  currentUserId,
  onInspectPlayer,
  onReportChallenge,
}: ChallengeHubProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isFocusHighlighted, setIsFocusHighlighted] = useState(false);

  const [counterTarget, setCounterTarget] = useState<ChallengeItem | null>(null);
  const [declineOpenId, setDeclineOpenId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [selectedAcceptPartners, setSelectedAcceptPartners] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [expandedChallengeIds, setExpandedChallengeIds] = useState<Record<string, boolean>>({});

  const toggleChallengeMatches = (challengeId: string) => {
    setExpandedChallengeIds((prev) => ({
      ...prev,
      [challengeId]: !prev[challengeId],
    }));
  };

  const navigateToMatch = (matchId: string) => {
    navigate(`/history?matchId=${encodeURIComponent(matchId)}`);
  };

  const { data } = useMyChallenges(Boolean(currentUserId));
  const acceptMutation = useAcceptChallenge();
  const declineMutation = useDeclineChallenge();
  const cancelMutation = useCancelChallenge();
  const completeMutation = useCompleteChallenge();

  const activeList = data?.active ?? [];
  const historyList = data?.history ?? [];

  const needsPartnerOptions = activeList.some(
    (ch) =>
      ch.can_accept &&
      ch.match_type === 'doubles' &&
      ch.my_role === 'challenged' &&
      !ch.challenged_partner
  );

  const { data: userOptions = [] } = useQuery<SimpleUserOption[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<SimpleUserOption[]>('/users');
      return res.data;
    },
    enabled: Boolean(currentUserId && needsPartnerOptions),
  });

  useEffect(() => {
    if (searchParams.get('focus') !== 'challenges') return;
    const raf = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsFocusHighlighted(true);
    });
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    const timer = window.setTimeout(() => setIsFocusHighlighted(false), 2600);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [searchParams, setSearchParams]);

  if (!currentUserId || (activeList.length === 0 && historyList.length === 0)) {
    return null;
  }

  const handleCopyShare = async (ch: ChallengeItem) => {
    const text = buildChallengeShareText(ch);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已複製戰帖內容，可直接貼到 LINE 群組！');
    } catch {
      toast.error('複製失敗，請手動選取複製');
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-label="我的約戰戰帖"
      className={cn(
        'rounded-2xl md:rounded-3xl border bg-card p-4 sm:p-5 space-y-3.5 shadow-xs transition-all duration-500',
        isFocusHighlighted
          ? 'border-smash-orange ring-2 ring-smash-orange/25'
          : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-smash-orange/15 text-smash-orange flex items-center justify-center shrink-0">
            <Swords size={16} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-foreground leading-tight">
              約戰與挑戰看板
            </h2>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
              約定時間開打，賽後一鍵帶入名單報分
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(data?.pending_response_count ?? 0) > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-smash-orange text-white text-xs font-display font-bold tabular-nums">
              {data?.pending_response_count} 筆待回應
            </span>
          )}
          {historyList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              aria-expanded={showHistory}
              className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <History size={14} aria-hidden="true" />
              <span>歷史 ({historyList.length})</span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn('transition-transform duration-200', showHistory && 'rotate-180')}
              />
            </button>
          )}
        </div>
      </div>

      {activeList.length > 0 && (
        <div className="space-y-3">
          {activeList.map((ch) => {
            const isAccepted = ch.status === 'accepted';
            const isAwaiting = ch.awaiting_my_response;
            const otherRep =
              ch.my_role === 'challenger' || ch.my_role === 'challenger_partner'
                ? ch.challenged
                : ch.challenger;

            const statusBadge = isAwaiting
              ? {
                  text: ch.status === 'countered' ? '對方改約時間' : '待你回應戰帖',
                  cls: 'bg-smash-orange/15 text-smash-orange border-smash-orange/30',
                }
              : isAccepted
                ? {
                    text:
                      ch.reported_matches_count > 0
                        ? `約戰成立 · 已報 ${ch.reported_matches_count} 場`
                        : '約戰已成立',
                    cls: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                  }
                : {
                    text: `等待 ${otherRep?.name || '對方'} 回應`,
                    cls: 'bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-300 border-sapphire-blue/25',
                  };

            const takenSlotIds = new Set(
              [
                ch.challenger?.id,
                ch.challenged?.id,
                ch.challenger_partner?.id,
                ch.challenged_partner?.id,
              ].filter((v): v is string => Boolean(v))
            );
            const acceptPartnerChoices = userOptions.filter((u) => !takenSlotIds.has(u.id));
            const pickedPartnerId = selectedAcceptPartners[ch.id] || '';
            const isDeclineOpen = declineOpenId === ch.id;
            const hasReportedMatches =
              ch.reported_matches_count > 0 || (ch.reported_matches?.length ?? 0) > 0;
            const isMatchesExpanded = Boolean(expandedChallengeIds[ch.id]);

            return (
              <div
                key={ch.id}
                className={cn(
                  'rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-colors',
                  isAwaiting
                    ? 'bg-orange-50/50 dark:bg-orange-500/[0.06] border-smash-orange/40'
                    : isAccepted
                      ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.06] border-emerald-500/35'
                      : 'bg-surface-subtle/80 border-border'
                )}
              >
                {/* 頂部狀態與約定時間列 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isAccepted && hasReportedMatches ? (
                      <button
                        type="button"
                        aria-expanded={isMatchesExpanded}
                        onClick={() => toggleChallengeMatches(ch.id)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-black hover:bg-emerald-500/20 transition-colors cursor-pointer',
                          statusBadge.cls,
                        )}
                      >
                        <span>{statusBadge.text}</span>
                        <ChevronDown
                          size={13}
                          aria-hidden="true"
                          className={cn('transition-transform duration-200', isMatchesExpanded && 'rotate-180')}
                        />
                      </button>
                    ) : (
                      <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-black', statusBadge.cls)}>
                        {statusBadge.text}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[11px] font-black text-foreground">
                      {ch.match_type === 'doubles' ? '雙打' : '單打'} · {ch.format}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-xs font-display font-black text-foreground tabular-nums">
                    <Clock size={13} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                    <span>{formatChallengeDateTimeLabel(ch.proposed_at)}</span>
                  </div>
                </div>

                {/* 對戰雙方名單 */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlayerChip player={ch.challenger} onInspect={onInspectPlayer} />
                    {ch.match_type === 'doubles' && (
                      <>
                        <span className="text-xs font-black text-muted-foreground">/</span>
                        <PlayerChip
                          player={ch.challenger_partner}
                          onInspect={onInspectPlayer}
                          placeholder="現場湊咖"
                        />
                      </>
                    )}
                  </div>

                  <span className="px-1.5 text-xs font-display font-black text-muted-foreground italic">VS</span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlayerChip player={ch.challenged} onInspect={onInspectPlayer} />
                    {ch.match_type === 'doubles' && (
                      <>
                        <span className="text-xs font-black text-muted-foreground">/</span>
                        <PlayerChip
                          player={ch.challenged_partner}
                          onInspect={onInspectPlayer}
                          placeholder="現場湊咖"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* 地點與喊話 */}
                {(ch.location || ch.message) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {ch.location && (
                      <span className="inline-flex items-center gap-1 font-bold text-foreground/85">
                        <MapPin size={12} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                        {ch.location}
                      </span>
                    )}
                    {ch.message && <span className="font-medium italic">「{ch.message}」</span>}
                  </div>
                )}

                {/* 雙打受邀代表接受前可順便選搭檔（選填） */}
                {ch.can_accept &&
                  ch.match_type === 'doubles' &&
                  ch.my_role === 'challenged' &&
                  !ch.challenged_partner &&
                  userOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <label
                        htmlFor={`accept-partner-${ch.id}`}
                        className="text-[11px] font-black text-muted-foreground inline-flex items-center gap-1"
                      >
                        <Users size={12} aria-hidden="true" />
                        指定你的雙打搭檔（選填）：
                      </label>
                      <select
                        id={`accept-partner-${ch.id}`}
                        value={pickedPartnerId}
                        onChange={(e) =>
                          setSelectedAcceptPartners((prev) => ({ ...prev, [ch.id]: e.target.value }))
                        }
                        className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-bold text-foreground"
                      >
                        <option value="">現場湊咖（不指定）</option>
                        {acceptPartnerChoices.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                            {u.department ? ` (${u.department})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* 婉拒理由展開面板 */}
                {isDeclineOpen && (
                  <div className="rounded-xl bg-card border border-border p-3 space-y-2.5">
                    <p className="text-xs font-black text-foreground">回覆婉拒原因（選填）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DECLINE_REASON_PRESETS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setDeclineReason(reason)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors',
                            declineReason === reason
                              ? 'bg-rose-500/15 border-rose-400 text-rose-700 dark:text-rose-300'
                              : 'bg-surface-subtle border-border text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      maxLength={100}
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="或自行輸入簡短說明..."
                      className="arena-input h-9 text-xs"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeclineOpenId(null);
                          setDeclineReason('');
                        }}
                        className="h-8 text-xs font-bold"
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={declineMutation.isPending}
                        onClick={async () => {
                          await declineMutation.mutateAsync({
                            challengeId: ch.id,
                            reason: declineReason.trim() || null,
                          });
                          setDeclineOpenId(null);
                          setDeclineReason('');
                        }}
                        className="h-8 text-xs font-black"
                      >
                        確定婉拒
                      </Button>
                    </div>
                  </div>
                )}

                {/* 底部操作列 */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {ch.can_accept && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={acceptMutation.isPending}
                      onClick={() =>
                        acceptMutation.mutate({
                          challengeId: ch.id,
                          challengedPartnerId: pickedPartnerId || null,
                        })
                      }
                      className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black gap-1.5"
                    >
                      <Check size={14} aria-hidden="true" />
                      接受挑戰
                    </Button>
                  )}

                  {ch.can_counter && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCounterTarget(ch)}
                      className="h-9 px-3 rounded-xl text-xs font-black gap-1.5"
                    >
                      <Clock size={13} aria-hidden="true" />
                      改約時間
                    </Button>
                  )}

                  {ch.can_decline && !isDeclineOpen && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeclineOpenId(ch.id);
                        setDeclineReason('');
                      }}
                      className="h-9 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 gap-1"
                    >
                      <X size={13} aria-hidden="true" />
                      婉拒
                    </Button>
                  )}

                  {ch.can_report && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onReportChallenge(ch)}
                      className="h-9 px-3.5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white text-xs font-black gap-1.5 shadow-xs"
                    >
                      <Plus size={14} aria-hidden="true" />
                      {ch.reported_matches_count > 0 ? '繼續報分' : '開始報分'}
                    </Button>
                  )}

                  {ch.can_complete &&
                    (ch.reported_matches_count > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={completeMutation.isPending}
                        onClick={() => completeMutation.mutate(ch.id)}
                        className="h-9 px-3 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 text-xs font-black gap-1"
                      >
                        <CheckCircle2 size={13} aria-hidden="true" />
                        結束約戰
                      </Button>
                    ) : confirmCompleteId === ch.id ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={completeMutation.isPending}
                          onClick={async () => {
                            await completeMutation.mutateAsync(ch.id);
                            setConfirmCompleteId(null);
                          }}
                          className="h-9 px-3 rounded-xl text-xs font-black"
                        >
                          確定直接結束
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmCompleteId(null)}
                          className="h-9 px-2.5 rounded-xl text-xs font-bold"
                        >
                          返回
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmCompleteId(ch.id)}
                        className="h-9 px-3 rounded-xl text-xs font-bold gap-1"
                      >
                        <Flag size={13} aria-hidden="true" />
                        結束約戰
                      </Button>
                    ))}

                  {isAccepted && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyShare(ch)}
                        className="h-9 px-3 rounded-xl text-xs font-bold gap-1"
                      >
                        <Copy size={13} aria-hidden="true" />
                        複製戰帖
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadChallengeIcs(ch)}
                        className="h-9 px-3 rounded-xl text-xs font-bold gap-1"
                      >
                        <CalendarPlus size={13} aria-hidden="true" />
                        行事曆
                      </Button>
                    </>
                  )}

                  {ch.can_cancel &&
                    (confirmCancelId === ch.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={cancelMutation.isPending}
                          onClick={async () => {
                            await cancelMutation.mutateAsync(ch.id);
                            setConfirmCancelId(null);
                          }}
                          className="h-8 px-2.5 rounded-lg text-xs font-black"
                        >
                          確定取消
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmCancelId(null)}
                          className="h-8 px-2 rounded-lg text-xs font-bold"
                        >
                          保留
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmCancelId(ch.id)}
                        className="h-9 px-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-600 ml-auto"
                      >
                        取消戰帖
                      </Button>
                    ))}
                </div>

                {hasReportedMatches && isMatchesExpanded && (
                  <ChallengeReportedMatchesPanel
                    matches={ch.reported_matches}
                    expectedCount={ch.reported_matches_count}
                    currentUserId={currentUserId}
                    onInspectPlayer={onInspectPlayer}
                    onNavigateMatch={navigateToMatch}
                    onNavigateHistory={() => navigate('/history')}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 近期已結束/已取消戰帖紀錄（可收合） */}
      {showHistory && historyList.length > 0 && (
        <div className="pt-3 border-t border-border/80 space-y-2.5">
          <p className="text-sm font-bold text-foreground/80">近 14 天戰帖紀錄</p>
          <div className="rounded-2xl border border-border/80 bg-card divide-y divide-border/70 overflow-hidden">
            {historyList.map((ch) => {
              const badge = HISTORY_STATUS_BADGE[ch.status] || {
                label: ch.status,
                cls: 'bg-secondary text-muted-foreground',
              };
              const reportedCount = ch.reported_matches?.length || ch.reported_matches_count || 0;
              const hasMatches = reportedCount > 0;
              const isExpanded = Boolean(expandedChallengeIds[ch.id]);
              const teamALabel =
                ch.match_type === 'doubles' && ch.challenger_partner
                  ? `${ch.challenger?.name} / ${ch.challenger_partner.name}`
                  : ch.challenger?.name;
              const teamBLabel =
                ch.match_type === 'doubles' && ch.challenged_partner
                  ? `${ch.challenged?.name} / ${ch.challenged_partner.name}`
                  : ch.challenged?.name;

              return (
                <div
                  key={ch.id}
                  className={cn(
                    'transition-colors',
                    hasMatches && isExpanded
                      ? 'bg-emerald-50/35 dark:bg-emerald-500/[0.04]'
                      : 'hover:bg-surface-subtle/50',
                  )}
                >
                  {hasMatches ? (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleChallengeMatches(ch.id)}
                      className="w-full flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-3 sm:px-4 min-h-12 text-left text-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0', badge.cls)}>
                          {badge.label}
                        </span>
                        <span className="text-sm sm:text-[15px] font-semibold text-foreground truncate">
                          {teamALabel} vs {teamBLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-xs font-bold shrink-0">
                          <span>{reportedCount} 場</span>
                          <ChevronDown
                            size={14}
                            aria-hidden="true"
                            className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
                          />
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums shrink-0 ml-auto">
                        {formatChallengeDateTimeLabel(ch.proposed_at)}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-3 sm:px-4 min-h-12 text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0', badge.cls)}>
                          {badge.label}
                        </span>
                        <span className="text-sm sm:text-[15px] font-semibold text-foreground truncate">
                          {teamALabel} vs {teamBLabel}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums shrink-0 ml-auto">
                        {formatChallengeDateTimeLabel(ch.proposed_at)}
                      </span>
                    </div>
                  )}

                  {hasMatches && isExpanded && (
                    <div className="px-3 pb-3 pt-1.5 sm:px-4 border-t border-border/60 bg-surface-subtle/35">
                      <ChallengeReportedMatchesPanel
                        matches={ch.reported_matches}
                        expectedCount={ch.reported_matches_count}
                        currentUserId={currentUserId}
                        onInspectPlayer={onInspectPlayer}
                        onNavigateMatch={navigateToMatch}
                        onNavigateHistory={() => navigate('/history')}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {counterTarget && (
        <ChallengeModal
          open={Boolean(counterTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setCounterTarget(null);
          }}
          mode="counter"
          challenge={counterTarget}
        />
      )}
    </section>
  );
}
