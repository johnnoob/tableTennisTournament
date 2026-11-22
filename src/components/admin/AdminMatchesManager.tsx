import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gavel,
  Loader2,
  Pencil,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin';
import type { AdminMatchItem, AdminMatchPlayer } from '@/types/admin';
import { inferMatchFormat, validateMatchScore, type MatchFormat } from '@/lib/matchScore';
import { cn, formatLocalTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ScoreInputSection } from '@/components/ScoreInputSection';

type MatchStatusFilter = 'attention' | 'disputed' | 'pending' | 'confirmed' | 'all';
type MatchTypeFilter = 'all' | 'singles' | 'doubles';
type ConfirmMode = 'as_is' | 'edit';

interface AdminMatchesManagerProps {
  initialStatus?: string;
  onUpdate: () => void;
}

const VALID_FILTERS: ReadonlyArray<MatchStatusFilter> = [
  'attention',
  'disputed',
  'pending',
  'confirmed',
  'all',
];

const QUICK_VOID_REASONS = [
  '雙方誤報重複紀錄',
  '比分登記錯誤且無法協調',
  '未實際完賽先行送出',
];

function resolveInitialStatus(raw?: string): MatchStatusFilter {
  if (raw && (VALID_FILTERS as ReadonlyArray<string>).includes(raw)) {
    return raw as MatchStatusFilter;
  }
  return 'attention';
}

function formatTeamLabel(players: AdminMatchPlayer[]): string {
  return players.map((p) => p.name).join(' / ');
}

function formatSigned(val?: number | null): string | null {
  if (val === null || val === undefined || val === 0) return null;
  const rounded = Math.round(val * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function AdminMatchesManager({ initialStatus, onUpdate }: AdminMatchesManagerProps) {
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>(() =>
    resolveInitialStatus(initialStatus)
  );
  const [typeFilter, setTypeFilter] = useState<MatchTypeFilter>('all');
  const [search, setSearch] = useState('');

  // Confirm / Edit Score Modal State
  const [confirmMatch, setConfirmMatch] = useState<AdminMatchItem | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('as_is');
  const [editScoreA, setEditScoreA] = useState(2);
  const [editScoreB, setEditScoreB] = useState(0);
  const [editFormat, setEditFormat] = useState<MatchFormat>('BO3');
  const [confirmNote, setConfirmNote] = useState('');

  // Void / Rollback Modal State
  const [voidMatch, setVoidMatch] = useState<AdminMatchItem | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'matches', statusFilter],
    queryFn: () => adminApi.getMatches(statusFilter, 80),
  });

  const counts = data?.counts ?? {
    disputed: 0,
    pending: 0,
    overdue: 0,
    confirmed: 0,
    total: 0,
  };

  const filteredMatches = useMemo(() => {
    const items = data?.matches ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((m) => {
      if (typeFilter !== 'all' && m.match_type !== typeFilter) return false;
      if (q) {
        const names = [
          ...m.team_a.map((p) => p.name),
          ...m.team_b.map((p) => p.name),
          m.reported_by_name,
          m.season_name,
        ]
          .join(' ')
          .toLowerCase();
        if (!names.includes(q)) return false;
      }
      return true;
    });
  }, [data, typeFilter, search]);

  const forceConfirmMutation = useMutation({
    mutationFn: ({
      matchId,
      payload,
    }: {
      matchId: string;
      payload: Parameters<typeof adminApi.forceConfirmMatch>[1];
    }) => adminApi.forceConfirmMatch(matchId, payload),
    onSuccess: (res) => {
      onUpdate();
      setConfirmMatch(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('強制裁決失敗', { description: err.message });
    },
  });

  const voidMatchMutation = useMutation({
    mutationFn: ({
      matchId,
      reason,
    }: {
      matchId: string;
      reason?: string;
    }) => adminApi.voidMatch(matchId, reason ? { reason } : {}),
    onSuccess: (res) => {
      onUpdate();
      setVoidMatch(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('撤銷對戰失敗', { description: err.message });
    },
  });

  const openConfirmModal = (match: AdminMatchItem, mode: ConfirmMode) => {
    setConfirmMatch(match);
    setConfirmMode(mode);
    setEditScoreA(match.score_a);
    setEditScoreB(match.score_b);
    setEditFormat(inferMatchFormat(match.score_a, match.score_b));
    setConfirmNote('');
  };

  const openVoidModal = (match: AdminMatchItem) => {
    setVoidMatch(match);
    setVoidReason('');
  };

  const scoreValidation = validateMatchScore(editScoreA, editScoreB, editFormat);

  const handleConfirmSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirmMatch || forceConfirmMutation.isPending) return;

    if (confirmMode === 'edit' && !scoreValidation.valid) {
      toast.error(scoreValidation.message);
      return;
    }

    forceConfirmMutation.mutate({
      matchId: confirmMatch.id,
      payload: {
        ...(confirmMode === 'edit' ? { score_a: editScoreA, score_b: editScoreB } : {}),
        ...(confirmNote.trim() ? { reason: confirmNote.trim() } : {}),
      },
    });
  };

  const handleVoidSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!voidMatch || voidMatchMutation.isPending) return;
    voidMatchMutation.mutate({
      matchId: voidMatch.id,
      reason: voidReason.trim() || undefined,
    });
  };

  const statusTabs: Array<{ key: MatchStatusFilter; label: string; count: number }> = [
    { key: 'attention', label: '需處理', count: counts.disputed + counts.pending },
    { key: 'disputed', label: '申訴中', count: counts.disputed },
    { key: 'pending', label: '待確認', count: counts.pending },
    { key: 'confirmed', label: '已結算', count: counts.confirmed },
    { key: 'all', label: '全部對戰', count: counts.total },
  ];

  const isVoidSettled = voidMatch
    ? voidMatch.status === 'confirmed' || voidMatch.status === 'completed'
    : false;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top 4-Card KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('disputed')}
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl bg-card border text-left transition-all active:scale-[0.98] flex items-center gap-3',
            statusFilter === 'disputed'
              ? 'border-rose-500 ring-2 ring-rose-500/20'
              : counts.disputed > 0
                ? 'border-rose-300/80 dark:border-rose-500/35'
                : 'border-border'
          )}
        >
          <div className="size-10 rounded-xl bg-rose-100/80 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground truncate">爭議申訴</p>
            <p className="text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
              {counts.disputed}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl bg-card border text-left transition-all active:scale-[0.98] flex items-center gap-3',
            statusFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-border'
          )}
        >
          <div className="size-10 rounded-xl bg-amber-100/80 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground truncate">
              待確認 {counts.overdue > 0 ? `(超時 ${counts.overdue})` : ''}
            </p>
            <p className="text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
              {counts.pending}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('confirmed')}
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl bg-card border text-left transition-all active:scale-[0.98] flex items-center gap-3',
            statusFilter === 'confirmed'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-border'
          )}
        >
          <div className="size-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground truncate">已結算對戰</p>
            <p className="text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
              {counts.confirmed}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl bg-card border text-left transition-all active:scale-[0.98] flex items-center gap-3',
            statusFilter === 'all'
              ? 'border-sapphire-blue ring-2 ring-sapphire-blue/20'
              : 'border-border'
          )}
        >
          <div className="size-10 rounded-xl bg-sapphire-blue/10 dark:bg-blue-500/15 text-sapphire-blue dark:text-blue-400 flex items-center justify-center shrink-0">
            <Scale size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground truncate">總對戰紀錄</p>
            <p className="text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
              {counts.total}
            </p>
          </div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border-border shadow-xs space-y-3">
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'min-h-10 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap border',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface-subtle border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[11px] font-display font-black tabular-nums leading-none',
                    active
                      ? 'bg-white/20 text-white'
                      : tab.key === 'disputed' && tab.count > 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                        : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋選手姓名、報分者或賽季..."
              aria-label="搜尋對戰"
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue"
            />
            {search && (
              <button
                type="button"
                aria-label="清除搜尋"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 p-1 rounded-xl bg-secondary border border-border shrink-0 sm:w-56">
            {([
              { key: 'all', label: '全部' },
              { key: 'singles', label: '單打' },
              { key: 'doubles', label: '雙打' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTypeFilter(opt.key)}
                className={cn(
                  'min-h-9 rounded-lg text-xs font-black transition-all',
                  typeFilter === opt.key
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Matches List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-sapphire-blue" size={32} />
          <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            載入對戰清單中...
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <Card className="p-10 sm:p-12 rounded-2xl border-border text-center space-y-2">
          <CheckCircle2 size={36} className="mx-auto text-emerald-500/60" aria-hidden="true" />
          <p className="text-base font-display font-black text-foreground">
            {statusFilter === 'attention' ? '目前沒有待處理或申訴中的對戰' : '找不到符合條件的對戰紀錄'}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            {statusFilter === 'attention'
              ? '若需要撤銷或回滾已結算賽果，可切換上方頁籤至「已結算」。'
              : '請嘗試調整上方狀態篩選或搜尋條件。'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {isFetching && (
            <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-1">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              正在同步最新對戰狀態...
            </div>
          )}

          {filteredMatches.map((m) => {
            const isDisputed = m.status === 'disputed';
            const isPending = m.status === 'pending';
            const isSettled = m.status === 'confirmed' || m.status === 'completed';
            const aWon = m.score_a > m.score_b;
            const teamADelta = formatSigned(m.team_a[0]?.mmr_delta);
            const teamBDelta = formatSigned(m.team_b[0]?.mmr_delta);
            const aIsReporter = m.team_a.some((p) => p.id === m.reported_by_id);

            return (
              <Card
                key={m.id}
                className={cn(
                  'rounded-2xl border shadow-xs overflow-hidden flex items-stretch',
                  isDisputed
                    ? 'border-rose-300/80 dark:border-rose-500/35'
                    : isPending && m.is_overdue
                      ? 'border-amber-300/80 dark:border-amber-500/35'
                      : 'border-border'
                )}
              >
                {/* Semantic Left Accent Rail */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'w-1.5 shrink-0',
                    isDisputed
                      ? 'bg-rose-500'
                      : isPending
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  )}
                />

                <div className="flex-1 min-w-0 p-3.5 sm:p-4 space-y-3">
                  {/* Top Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isDisputed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 leading-none">
                          <ShieldAlert size={12} aria-hidden="true" />
                          爭議申訴
                        </span>
                      ) : isPending ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 leading-none">
                            <Clock size={12} aria-hidden="true" />
                            待確認
                          </span>
                          {m.is_overdue && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 leading-none">
                              已超時 ({data?.auto_confirm_hours ?? 48}h+)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 leading-none">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          已結算
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-black text-muted-foreground leading-none">
                        {m.match_type === 'doubles' ? '雙打' : '單打'} · {m.format}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-muted-foreground tabular-nums">
                      {formatLocalTime(m.created_at, 'MM/dd HH:mm')}
                    </span>
                  </div>

                  {/* Dispute Reason Callout */}
                  {isDisputed && (
                    <div className="rounded-xl bg-rose-50/90 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/30 px-3.5 py-2.5 flex items-start gap-2">
                      <AlertTriangle
                        size={15}
                        className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-200 leading-relaxed break-words">
                        申訴說明：{m.dispute_reason || '選手已提交異議並暫停自動結算，請向雙方確認實際比分後裁決。'}
                      </p>
                    </div>
                  )}

                  {/* Responsive 3-Column Scoreboard */}
                  <div className="bg-surface-subtle/75 border border-border/70 rounded-2xl p-3 sm:p-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                    {/* Team A */}
                    <div className="min-w-0 flex flex-col items-start gap-1.5">
                      <div className={cn('flex items-center', m.team_a.length > 1 && '-space-x-2.5')}>
                        {m.team_a.map((p) => (
                          <PlayerAvatar
                            key={p.id}
                            src={p.avatar_url}
                            name={p.name}
                            className="size-9 sm:size-10 rounded-xl border-2 border-card text-xs"
                          />
                        ))}
                      </div>
                      <div className="min-w-0 w-full">
                        <p className={cn('text-xs sm:text-sm font-display truncate', aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground')}>
                          {formatTeamLabel(m.team_a)}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {aIsReporter && (
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                              A 隊 · 報分方
                            </span>
                          )}
                          {isSettled && teamADelta && (
                            <span
                              className={cn(
                                'text-xs font-display font-black tabular-nums',
                                (m.team_a[0]?.mmr_delta ?? 0) >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {teamADelta} ELO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Center Score */}
                    <div className="flex flex-col items-center justify-center shrink-0 px-2">
                      <div className="px-3 py-1.5 rounded-xl bg-card border border-border font-display font-black text-xl sm:text-2xl tabular-nums leading-none flex items-center gap-1">
                        <span className={aWon ? 'text-foreground' : 'text-muted-foreground/55'}>
                          {m.score_a}
                        </span>
                        <span className="text-muted-foreground/40 text-sm">:</span>
                        <span className={!aWon ? 'text-foreground' : 'text-muted-foreground/55'}>
                          {m.score_b}
                        </span>
                      </div>
                    </div>

                    {/* Team B */}
                    <div className="min-w-0 flex flex-col items-end text-right gap-1.5">
                      <div className={cn('flex items-center justify-end', m.team_b.length > 1 && '-space-x-2.5')}>
                        {m.team_b.map((p) => (
                          <PlayerAvatar
                            key={p.id}
                            src={p.avatar_url}
                            name={p.name}
                            className="size-9 sm:size-10 rounded-xl border-2 border-card text-xs"
                          />
                        ))}
                      </div>
                      <div className="min-w-0 w-full">
                        <p className={cn('text-xs sm:text-sm font-display truncate', !aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground')}>
                          {formatTeamLabel(m.team_b)}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap mt-0.5">
                          {!aIsReporter && (
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                              B 隊 · 報分方
                            </span>
                          )}
                          {isSettled && teamBDelta && (
                            <span
                              className={cn(
                                'text-xs font-display font-black tabular-nums',
                                (m.team_b[0]?.mmr_delta ?? 0) >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {teamBDelta} ELO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1 border-t border-border/60">
                    <p className="text-xs font-bold text-muted-foreground truncate">
                      由 <span className="text-foreground font-black">{m.reported_by_name}</span> 報分 · {m.season_name}
                    </p>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      {isSettled ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openVoidModal(m)}
                          className="w-full sm:w-auto min-h-10 px-4 rounded-xl border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-black text-xs sm:text-sm gap-1.5"
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          撤銷並回滾積分
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openVoidModal(m)}
                            className="flex-1 sm:flex-initial min-h-10 px-3.5 rounded-xl border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-bold text-xs sm:text-sm gap-1.5"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            駁回刪除
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openConfirmModal(m, 'edit')}
                            className="flex-1 sm:flex-initial min-h-10 px-3.5 rounded-xl border-border font-bold text-xs sm:text-sm gap-1.5"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            改分並結算
                          </Button>
                          <Button
                            type="button"
                            onClick={() => openConfirmModal(m, 'as_is')}
                            className="w-full sm:w-auto min-h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs sm:text-sm gap-1.5 border-none"
                          >
                            <Gavel size={15} aria-hidden="true" />
                            強制確認結算
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal 1: Force Confirm / Edit Score & Settle */}
      <ResponsiveFormModal
        open={!!confirmMatch}
        onOpenChange={(open) => {
          if (!open && !forceConfirmMutation.isPending) setConfirmMatch(null);
        }}
        size="md"
        tone="success"
        icon={<Gavel size={18} />}
        title={confirmMode === 'edit' ? '修正比分並裁決結算' : '強制確認並結算對戰'}
        description="裁決後系統將立即計算雙方 ELO、更新賽季排行並通知參賽選手。"
        onSubmit={handleConfirmSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={forceConfirmMutation.isPending}
              onClick={() => setConfirmMatch(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                forceConfirmMutation.isPending ||
                (confirmMode === 'edit' && !scoreValidation.valid)
              }
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm"
            >
              {forceConfirmMutation.isPending
                ? '結算中...'
                : confirmMode === 'edit'
                  ? `以 ${editScoreA}:${editScoreB} 裁決結算`
                  : '確認強制結算'}
            </Button>
          </>
        }
      >
        {confirmMatch && (
          <div className="space-y-4">
            {/* Matchup Recap */}
            <div className="bg-surface-subtle border border-border rounded-2xl p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-muted-foreground block">A 隊</span>
                <span className="text-sm font-black text-foreground truncate block">
                  {formatTeamLabel(confirmMatch.team_a)}
                </span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-card border border-border font-display font-black text-lg tabular-nums shrink-0">
                {confirmMode === 'edit'
                  ? `${editScoreA} : ${editScoreB}`
                  : `${confirmMatch.score_a} : ${confirmMatch.score_b}`}
              </div>
              <div className="min-w-0 flex-1 text-right">
                <span className="text-[11px] font-bold text-muted-foreground block">B 隊</span>
                <span className="text-sm font-black text-foreground truncate block">
                  {formatTeamLabel(confirmMatch.team_b)}
                </span>
              </div>
            </div>

            {/* Mode Switch */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary border border-border gap-1">
              <button
                type="button"
                onClick={() => setConfirmMode('as_is')}
                className={cn(
                  'min-h-10 rounded-lg text-xs font-black transition-all',
                  confirmMode === 'as_is'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                維持原比分 ({confirmMatch.score_a}:{confirmMatch.score_b})
              </button>
              <button
                type="button"
                onClick={() => setConfirmMode('edit')}
                className={cn(
                  'min-h-10 rounded-lg text-xs font-black transition-all',
                  confirmMode === 'edit'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                修正比分後結算
              </button>
            </div>

            {confirmMode === 'edit' && (
              <div className="space-y-3">
                <ScoreInputSection
                  format={editFormat}
                  onFormatChange={setEditFormat}
                  scoreA={editScoreA}
                  scoreB={editScoreB}
                  onScoreAChange={setEditScoreA}
                  onScoreBChange={setEditScoreB}
                  sideALabel="A 隊"
                  sideBLabel="B 隊"
                  winBadgeLabel="A 勝"
                  lossBadgeLabel="B 勝"
                />
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    'rounded-xl border px-3.5 py-2.5 text-xs font-bold',
                    scoreValidation.tone === 'valid'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/12 dark:border-emerald-500/30 dark:text-emerald-300'
                      : scoreValidation.tone === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/12 dark:border-rose-500/30 dark:text-rose-300'
                        : 'bg-surface-subtle border-border text-muted-foreground'
                  )}
                >
                  {scoreValidation.valid
                    ? `${editFormat} · ${editScoreA > editScoreB ? 'A 隊獲勝' : 'B 隊獲勝'}`
                    : scoreValidation.message}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="admin-confirm-note" className="arena-label">
                裁決備註（選填）
              </label>
              <input
                id="admin-confirm-note"
                type="text"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="例如：已與雙方確認實際比分為 2:1"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 2: Void Pending / Atomic Rollback Settled Match */}
      <ResponsiveFormModal
        open={!!voidMatch}
        onOpenChange={(open) => {
          if (!open && !voidMatchMutation.isPending) setVoidMatch(null);
        }}
        size="md"
        tone="danger"
        icon={isVoidSettled ? <RotateCcw size={18} /> : <Trash2 size={18} />}
        title={isVoidSettled ? '撤銷比賽並原子回滾積分' : '駁回並移除待確認報分'}
        description={
          isVoidSettled
            ? '將精準退回本場所有選手增減的 ELO 積分、出賽數、勝場與曲線紀錄。'
            : '移除該筆誤報或無效對戰紀錄，此操作不影響選手積分。'
        }
        onSubmit={handleVoidSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={voidMatchMutation.isPending}
              onClick={() => setVoidMatch(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={voidMatchMutation.isPending}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm"
            >
              {voidMatchMutation.isPending
                ? '處理中...'
                : isVoidSettled
                  ? '確認撤銷並回滾'
                  : '確認駁回刪除'}
            </Button>
          </>
        }
      >
        {voidMatch && (
          <div className="space-y-4">
            {/* Target Match Recap */}
            <div className="bg-surface-subtle border border-border rounded-2xl p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground truncate">
                  {formatTeamLabel(voidMatch.team_a)} vs {formatTeamLabel(voidMatch.team_b)}
                </p>
                <p className="text-xs font-bold text-muted-foreground mt-0.5">
                  {formatLocalTime(voidMatch.created_at, 'yyyy/MM/dd HH:mm')} · {voidMatch.season_name}
                </p>
              </div>
              <span className="font-display font-black text-xl tabular-nums text-foreground shrink-0">
                {voidMatch.score_a} : {voidMatch.score_b}
              </span>
            </div>

            {isVoidSettled && (
              <div className="rounded-2xl bg-rose-50/80 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/30 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black text-xs sm:text-sm">
                  <ShieldAlert size={16} aria-hidden="true" />
                  <span>將精準回滾以下選手積分與賽季戰績：</span>
                </div>
                <div className="space-y-1.5">
                  {[...voidMatch.team_a, ...voidMatch.team_b].map((p) => {
                    const rbVal =
                      p.mmr_delta !== null && p.mmr_delta !== undefined
                        ? -p.mmr_delta
                        : null;
                    const rbStr = formatSigned(rbVal);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-card/85 rounded-xl px-3 py-2 text-xs"
                      >
                        <span className="font-bold text-foreground truncate">{p.name}</span>
                        <span
                          className={cn(
                            'font-display font-black tabular-nums',
                            (rbVal ?? 0) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          )}
                        >
                          回滾 {rbStr || '0'} ELO · 出賽 -1
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="admin-void-reason" className="arena-label">
                撤銷 / 駁回原因（選填，將顯示於選手通知）
              </label>
              <input
                id="admin-void-reason"
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="例如：雙方重複送出報分"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_VOID_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setVoidReason(preset)}
                    className="px-2.5 py-1 rounded-lg bg-secondary/70 border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </ResponsiveFormModal>
    </div>
  );
}
