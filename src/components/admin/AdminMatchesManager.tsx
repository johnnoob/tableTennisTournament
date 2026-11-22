import { useEffect, useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin';
import type {
  AdminMatchItem,
  AdminMatchPlayer,
  AdminUserItem,
} from '@/types/admin';
import { inferMatchFormat, validateMatchScore, type MatchFormat } from '@/lib/matchScore';
import { cn, formatLocalTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ResponsiveSelect, type ResponsiveSelectOption } from '@/components/ui/responsive-select';
import { ScoreInputSection } from '@/components/ScoreInputSection';

type MatchStatusFilter = 'attention' | 'disputed' | 'pending' | 'confirmed' | 'all';
type MatchTypeFilter = 'all' | 'singles' | 'doubles';
type ConfirmMode = 'as_is' | 'edit';
type BatchModalMode = 'overdue' | 'selected' | null;

interface AdminMatchesManagerProps {
  initialStatus?: string;
  onUpdate: () => void;
}

const PAGE_SIZE = 30;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>(() =>
    resolveInitialStatus(initialStatus)
  );
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<MatchTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirm / Edit Score (supports both pending/disputed force-confirm and settled in-place recalculation)
  const [confirmMatch, setConfirmMatch] = useState<AdminMatchItem | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('as_is');
  const [editScoreA, setEditScoreA] = useState(2);
  const [editScoreB, setEditScoreB] = useState(0);
  const [editFormat, setEditFormat] = useState<MatchFormat>('BO3');
  const [confirmNote, setConfirmNote] = useState('');

  // Void / Rollback Modal State
  const [voidMatch, setVoidMatch] = useState<AdminMatchItem | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Batch Force Confirm Modal State
  const [batchModalMode, setBatchModalMode] = useState<BatchModalMode>(null);
  const [batchNote, setBatchNote] = useState('');

  // Proxy Create Match Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeasonId, setCreateSeasonId] = useState('');
  const [createType, setCreateType] = useState<'singles' | 'doubles'>('singles');
  const [teamAP1, setTeamAP1] = useState('');
  const [teamAP2, setTeamAP2] = useState('');
  const [teamBP1, setTeamBP1] = useState('');
  const [teamBP2, setTeamBP2] = useState('');
  const [createScoreA, setCreateScoreA] = useState(2);
  const [createScoreB, setCreateScoreB] = useState(0);
  const [createFormat, setCreateFormat] = useState<MatchFormat>('BO3');
  const [createAutoSettle, setCreateAutoSettle] = useState(true);
  const [createNote, setCreateNote] = useState('');

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin', 'matches', statusFilter, seasonFilter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      adminApi.getMatches({
        statusFilter,
        seasonId: seasonFilter,
        offset: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, page) => sum + page.matches.length, 0);
    },
  });

  // Lazy-fetch active member list only when Proxy Report modal opens
  const { data: adminUsers = [], isLoading: isUsersLoading } = useQuery<AdminUserItem[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
    enabled: createOpen,
  });

  const firstPage = data?.pages[0];
  const counts = firstPage?.counts ?? {
    disputed: 0,
    pending: 0,
    overdue: 0,
    confirmed: 0,
    total: 0,
  };
  const filteredTotal = firstPage?.filtered_total ?? 0;
  const autoConfirmHours = firstPage?.auto_confirm_hours ?? 48;

  const seasonsList = useMemo(() => firstPage?.seasons ?? [], [firstPage]);

  const seasonFilterOptions: ResponsiveSelectOption[] = useMemo(
    () => [
      { value: 'all', label: '全部賽季' },
      ...seasonsList.map((s) => ({
        value: s.id,
        label: s.name || s.id,
        badge: s.status === 'active' ? '進行中' : '已結算',
      })),
    ],
    [seasonsList]
  );

  const createSeasonOptions: ResponsiveSelectOption[] = useMemo(
    () =>
      seasonsList.map((s) => ({
        value: s.id,
        label: s.name || s.id,
        badge: s.status === 'active' ? '進行中' : '已結算',
      })),
    [seasonsList]
  );

  const allMatches = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const combined: AdminMatchItem[] = [];
    for (const page of data.pages) {
      for (const m of page.matches) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          combined.push(m);
        }
      }
    }
    return combined;
  }, [data]);

  const filteredMatches = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allMatches.filter((m) => {
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
  }, [allMatches, typeFilter, search]);

  const highlightMatchId = searchParams.get('matchId');
  const highlightedMatchFound = Boolean(
    highlightMatchId &&
      filteredMatches.some((m) => String(m.id) === String(highlightMatchId)),
  );

  const clearHighlight = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('matchId');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!highlightedMatchFound || !highlightMatchId) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`admin-match-${highlightMatchId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightedMatchFound, highlightMatchId]);

  const selectableLoadedIds = useMemo(
    () =>
      filteredMatches
        .filter((m) => m.status === 'pending' || m.status === 'disputed')
        .map((m) => m.id),
    [filteredMatches]
  );

  const selectedValidIds = useMemo(() => {
    const allowed = new Set(selectableLoadedIds);
    return selectedIds.filter((id) => allowed.has(id));
  }, [selectedIds, selectableLoadedIds]);

  const activeUsers = useMemo(
    () => adminUsers.filter((u) => u.is_active),
    [adminUsers]
  );

  const buildPlayerOptions = (excludedIds: string[]): ResponsiveSelectOption[] => {
    const excluded = new Set(excludedIds.filter(Boolean));
    return activeUsers
      .filter((u) => !excluded.has(u.id))
      .map((u) => ({
        value: u.id,
        label: u.name,
        description: u.department || '未設定單位',
        badge: `${Math.round(u.global_mmr)}`,
      }));
  };

  const openInspect = (playerId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('inspect', playerId);
    setSearchParams(next);
  };

  const handleStatusChange = (nextStatus: MatchStatusFilter) => {
    setStatusFilter(nextStatus);
    setSelectedIds([]);
  };

  const handleSeasonChange = (nextSeason: string) => {
    setSeasonFilter(nextSeason);
    setSelectedIds([]);
  };

  const toggleSelectMatch = (matchId: string) => {
    setSelectedIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const toggleSelectAllLoaded = () => {
    const allSelected =
      selectableLoadedIds.length > 0 &&
      selectedValidIds.length === selectableLoadedIds.length;
    setSelectedIds(allSelected ? [] : selectableLoadedIds);
  };

  // Mutations
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
      setSelectedIds([]);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('強制裁決失敗', { description: err.message });
    },
  });

  const editSettledMutation = useMutation({
    mutationFn: ({
      matchId,
      payload,
    }: {
      matchId: string;
      payload: Parameters<typeof adminApi.editSettledMatch>[1];
    }) => adminApi.editSettledMatch(matchId, payload),
    onSuccess: (res) => {
      onUpdate();
      setConfirmMatch(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('更正重算失敗', { description: err.message });
    },
  });

  const voidMatchMutation = useMutation({
    mutationFn: ({ matchId, reason }: { matchId: string; reason?: string }) =>
      adminApi.voidMatch(matchId, reason ? { reason } : {}),
    onSuccess: (res) => {
      onUpdate();
      setVoidMatch(null);
      setSelectedIds([]);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('撤銷對戰失敗', { description: err.message });
    },
  });

  const batchConfirmMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.batchForceConfirmMatches>[0]) =>
      adminApi.batchForceConfirmMatches(payload),
    onSuccess: (res) => {
      onUpdate();
      setBatchModalMode(null);
      setSelectedIds([]);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('批次結算失敗', { description: err.message });
    },
  });

  const createMatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.createMatch>[0]) =>
      adminApi.createMatch(payload),
    onSuccess: (res) => {
      onUpdate();
      setCreateOpen(false);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('補登對戰失敗', { description: err.message });
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

  const openBatchModal = (mode: Exclude<BatchModalMode, null>) => {
    setBatchModalMode(mode);
    setBatchNote('');
  };

  const openCreateModal = () => {
    const activeSeason = seasonsList.find((s) => s.status === 'active');
    const fallbackSeason =
      seasonFilter !== 'all' ? seasonFilter : activeSeason?.id || seasonsList[0]?.id || '';
    setCreateSeasonId(fallbackSeason);
    setCreateType('singles');
    setTeamAP1('');
    setTeamAP2('');
    setTeamBP1('');
    setTeamBP2('');
    setCreateScoreA(2);
    setCreateScoreB(0);
    setCreateFormat('BO3');
    setCreateAutoSettle(true);
    setCreateNote('');
    setCreateOpen(true);
  };

  const confirmIsSettled = confirmMatch
    ? confirmMatch.status === 'confirmed' || confirmMatch.status === 'completed'
    : false;
  const scoreUnchanged = confirmMatch
    ? editScoreA === confirmMatch.score_a && editScoreB === confirmMatch.score_b
    : false;
  const scoreValidation = validateMatchScore(editScoreA, editScoreB, editFormat);

  const handleConfirmSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirmMatch) return;

    if (confirmIsSettled) {
      if (editSettledMutation.isPending) return;
      if (!scoreValidation.valid) {
        toast.error(scoreValidation.message);
        return;
      }
      if (scoreUnchanged) {
        toast.error('請設定與原比分不同的新局數');
        return;
      }
      editSettledMutation.mutate({
        matchId: confirmMatch.id,
        payload: {
          score_a: editScoreA,
          score_b: editScoreB,
          ...(confirmNote.trim() ? { reason: confirmNote.trim() } : {}),
        },
      });
      return;
    }

    if (forceConfirmMutation.isPending) return;
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

  const handleBatchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!batchModalMode || batchConfirmMutation.isPending) return;
    if (batchModalMode === 'overdue') {
      batchConfirmMutation.mutate({
        overdue_only: true,
        ...(seasonFilter !== 'all' ? { season_id: seasonFilter } : {}),
        ...(batchNote.trim() ? { reason: batchNote.trim() } : {}),
      });
    } else {
      batchConfirmMutation.mutate({
        match_ids: selectedValidIds,
        ...(batchNote.trim() ? { reason: batchNote.trim() } : {}),
      });
    }
  };

  // Create Match validation
  const createLineupError =
    !createSeasonId
      ? '請先選擇目標賽季'
      : createType === 'singles'
        ? !teamAP1 || !teamBP1
          ? '請選齊 A 隊與 B 隊兩位選手'
          : null
        : !teamAP1 || !teamAP2 || !teamBP1 || !teamBP2
          ? '雙打比賽請選齊兩隊共四位選手'
          : null;
  const createScoreValidation = validateMatchScore(
    createScoreA,
    createScoreB,
    createFormat,
    createLineupError
  );

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createMatchMutation.isPending) return;
    if (!createScoreValidation.valid) {
      toast.error(createScoreValidation.message);
      return;
    }
    createMatchMutation.mutate({
      season_id: createSeasonId,
      match_type: createType,
      team_a_p1_id: teamAP1,
      team_a_p2_id: createType === 'doubles' ? teamAP2 : null,
      team_b_p1_id: teamBP1,
      team_b_p2_id: createType === 'doubles' ? teamBP2 : null,
      score_a: createScoreA,
      score_b: createScoreB,
      auto_settle: createAutoSettle,
      ...(createNote.trim() ? { reason: createNote.trim() } : {}),
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

  const confirmBusy = forceConfirmMutation.isPending || editSettledMutation.isPending;

  const renderClickableTeam = (players: AdminMatchPlayer[], align: 'left' | 'right' = 'left') => (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-1',
        align === 'right' && 'justify-end'
      )}
    >
      {players.map((p, idx) => (
        <span key={p.id} className="inline-flex items-center">
          {idx > 0 && <span className="text-muted-foreground/45 mx-0.5">/</span>}
          <button
            type="button"
            onClick={() => openInspect(p.id)}
            className="hover:text-sapphire-blue transition-colors font-display"
          >
            {p.name}
          </button>
        </span>
      ))}
    </span>
  );

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Unified Command Header */}
      <div className="p-3.5 sm:p-4 border-b border-border bg-surface-subtle/40 space-y-3">
        {/* Row 1: Segmented Status Tabs + Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 p-1 rounded-xl bg-secondary/90 border border-border/80 w-full lg:w-fit">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleStatusChange(tab.key)}
                  className={cn(
                    'min-h-9 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[11px] font-display font-black tabular-nums leading-none',
                      tab.key === 'disputed' && tab.count > 0
                        ? 'bg-rose-500 text-white'
                        : active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/70 text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {counts.overdue > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => openBatchModal('overdue')}
                className="h-9 px-3 rounded-xl border-amber-300 dark:border-amber-500/35 bg-amber-50/80 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 font-black text-xs gap-1.5"
              >
                <Zap size={13} aria-hidden="true" />
                一鍵結算超時 ({counts.overdue})
              </Button>
            )}

            <Button
              type="button"
              onClick={openCreateModal}
              className="h-9 px-3.5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-xs gap-1.5 shadow-xs border-none"
            >
              <Plus size={14} aria-hidden="true" />
              代為補登
            </Button>

            {isFetching && !isLoading && (
              <Loader2 size={14} className="animate-spin text-sapphire-blue" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Row 2: Search + Season Select + Match Type Switch */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_210px_auto] gap-2.5 items-center">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋已載入選手姓名、報分者或賽季..."
              aria-label="搜尋對戰"
              className="arena-input pl-10 pr-9"
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

          <ResponsiveSelect
            value={seasonFilter}
            onValueChange={handleSeasonChange}
            options={seasonFilterOptions}
            title="依賽季篩選"
            description="限定檢視與批次處理指定賽季對戰"
            icon={<Calendar size={15} className="text-muted-foreground" />}
          />

          <div className="grid grid-cols-3 p-1 rounded-xl bg-secondary/90 border border-border/80 shrink-0 md:w-48">
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

        {/* Contextual Multi-Select Action Bar */}
        {selectedValidIds.length > 0 && (
          <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-200">
              <span>
                已選取 <strong className="font-display font-black tabular-nums">{selectedValidIds.length}</strong> 場
              </span>
              {selectableLoadedIds.length > 1 && (
                <button
                  type="button"
                  onClick={toggleSelectAllLoaded}
                  className="text-sapphire-blue dark:text-blue-300 font-black hover:underline"
                >
                  {selectedValidIds.length === selectableLoadedIds.length
                    ? '取消全選'
                    : `全選目前 ${selectableLoadedIds.length} 場待審`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                清除選取
              </button>
            </div>

            <Button
              type="button"
              onClick={() => openBatchModal('selected')}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs gap-1.5 border-none"
            >
              <CheckCheck size={14} aria-hidden="true" />
              批次強制結算 ({selectedValidIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* Highlight Deep-Link Status Bar */}
      {highlightMatchId && !isLoading && (
        <div
          className={cn(
            'px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs',
            highlightedMatchFound
              ? 'bg-sapphire-blue/10 text-foreground dark:bg-blue-500/15'
              : 'bg-amber-50/85 text-amber-900 dark:bg-amber-500/12 dark:text-amber-200',
          )}
        >
          <div className="flex items-center gap-2 font-bold min-w-0">
            <Crosshair
              size={14}
              className={cn(
                'shrink-0',
                highlightedMatchFound
                  ? 'text-sapphire-blue dark:text-blue-300'
                  : 'text-amber-600 dark:text-amber-300',
              )}
              aria-hidden="true"
            />
            <span>
              {highlightedMatchFound
                ? `已自動定位通知裁決場次 #${highlightMatchId.slice(0, 4)}`
                : `目前清單未顯示通知場次 #${highlightMatchId.slice(0, 4)}`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {!highlightedMatchFound && statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => handleStatusChange('all')}
                className="h-7 px-2.5 rounded-lg bg-sapphire-blue text-white font-black hover:bg-blue-700 transition-colors"
              >
                切換至「全部對戰」
              </button>
            )}
            {!highlightedMatchFound && statusFilter === 'all' && hasNextPage && (
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="h-7 px-2.5 rounded-lg bg-card border border-border font-black text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? '載入中...' : '載入更多對戰'}
              </button>
            )}
            <button
              type="button"
              onClick={clearHighlight}
              className="h-7 px-2.5 rounded-lg bg-card border border-border font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <span>清除定位</span>
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Matches Feed */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-sapphire-blue" size={32} />
          <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            載入對戰清單中...
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <CheckCircle2 size={36} className="mx-auto text-emerald-500/60" aria-hidden="true" />
          <p className="text-base font-display font-black text-foreground">
            {statusFilter === 'attention' ? '目前沒有待處理或申訴中的對戰' : '找不到符合條件的對戰紀錄'}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            {statusFilter === 'attention'
              ? '若需要更正或回滾已結算賽果，可切換至「已結算」頁籤；如需補登比賽可點擊右上方「代為補登」。'
              : '請嘗試調整上方狀態、賽季或搜尋條件。'}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/70">
            {filteredMatches.map((m) => {
              const isDisputed = m.status === 'disputed';
              const isPending = m.status === 'pending';
              const isSettled = m.status === 'confirmed' || m.status === 'completed';
              const isSelectable = isPending || isDisputed;
              const isSelected = isSelectable && selectedValidIds.includes(m.id);
              const isHighlighted = Boolean(
                highlightMatchId && String(m.id) === String(highlightMatchId),
              );
              const aWon = m.score_a > m.score_b;
              const teamADelta = formatSigned(m.team_a[0]?.mmr_delta);
              const teamBDelta = formatSigned(m.team_b[0]?.mmr_delta);
              const aIsReporter = m.team_a.some((p) => p.id === m.reported_by_id);

              const statusBorderClass = isHighlighted
                ? 'border-l-sapphire-blue'
                : isDisputed
                  ? 'border-l-rose-500'
                  : isPending
                    ? 'border-l-amber-400'
                    : 'border-l-emerald-500';

              const statusBadge = isDisputed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 leading-none">
                  爭議申訴
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 leading-none">
                  待確認
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 leading-none">
                  已結算
                </span>
              );

              return (
                <div
                  key={m.id}
                  id={`admin-match-${m.id}`}
                  className={cn(
                    'border-l-[3px] transition-all hover:bg-surface-subtle/35',
                    statusBorderClass,
                    isDisputed && !isHighlighted && 'bg-rose-50/20 dark:bg-rose-950/10',
                    isSelected && !isHighlighted && 'bg-emerald-50/30 dark:bg-emerald-500/8',
                    isHighlighted &&
                      'ring-2 ring-inset ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/[0.06] dark:bg-blue-500/[0.12]',
                  )}
                >
                  {isHighlighted && (
                    <div className="px-4 sm:px-5 py-1.5 bg-sapphire-blue/10 dark:bg-blue-500/18 border-b border-sapphire-blue/25 flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-black text-sapphire-blue dark:text-blue-300">
                        <Crosshair size={12} className="animate-pulse" aria-hidden="true" />
                        通知指定裁決場次 · #{String(m.id).slice(0, 4)}
                      </span>
                      <button
                        type="button"
                        onClick={clearHighlight}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>清除定位</span>
                        <X size={11} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {/* Desktop Row */}
                  <div className="hidden lg:flex items-center gap-4 px-5 py-4">
                    {/* Optional Selection Checkbox */}
                    {isSelectable && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`選取 ${formatTeamLabel(m.team_a)} 對 ${formatTeamLabel(m.team_b)}`}
                        onClick={() => toggleSelectMatch(m.id)}
                        className={cn(
                          'size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-border bg-card text-transparent hover:border-sapphire-blue'
                        )}
                      >
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                      </button>
                    )}

                    {/* Col 1: Status & Meta */}
                    <div className="w-[144px] shrink-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {statusBadge}
                        {isPending && m.is_overdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 leading-none">
                            超時 {autoConfirmHours}h+
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-muted-foreground">
                        {m.match_type === 'doubles' ? '雙打' : '單打'} · {m.format}
                      </p>
                      <p className="text-xs font-bold text-muted-foreground tabular-nums">
                        {formatLocalTime(m.created_at, 'MM/dd HH:mm')}
                      </p>
                    </div>

                    {/* Col 2: Horizontal Matchup + Optional Dispute Reason */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3.5">
                        {/* Team A (Right Aligned) */}
                        <div className="flex items-center justify-end gap-2.5 min-w-0">
                          <div className="min-w-0 text-right">
                            <div
                              className={cn(
                                'text-sm truncate',
                                aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground'
                              )}
                            >
                              {renderClickableTeam(m.team_a, 'right')}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              {aIsReporter && (
                                <span className="text-[10px] font-black text-muted-foreground bg-secondary px-1.5 py-0.5 rounded leading-none">
                                  報分方
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
                                  {teamADelta}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={cn('flex shrink-0', m.team_a.length > 1 && '-space-x-2')}>
                            {m.team_a.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => openInspect(p.id)}
                                aria-label={`檢視 ${p.name} 戰情`}
                              >
                                <PlayerAvatar
                                  src={p.avatar_url}
                                  name={p.name}
                                  className={cn(
                                    'size-9 rounded-xl border border-border text-xs',
                                    aWon && 'ring-2 ring-emerald-500/35'
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Score Pill */}
                        <div className="px-3 py-1 rounded-xl bg-surface-subtle border border-border font-display font-black text-lg tabular-nums shrink-0 flex items-center gap-1 leading-none">
                          <span className={aWon ? 'text-foreground' : 'text-muted-foreground/55'}>
                            {m.score_a}
                          </span>
                          <span className="text-muted-foreground/40 text-sm">:</span>
                          <span className={!aWon ? 'text-foreground' : 'text-muted-foreground/55'}>
                            {m.score_b}
                          </span>
                        </div>

                        {/* Team B (Left Aligned) */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn('flex shrink-0', m.team_b.length > 1 && '-space-x-2')}>
                            {m.team_b.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => openInspect(p.id)}
                                aria-label={`檢視 ${p.name} 戰情`}
                              >
                                <PlayerAvatar
                                  src={p.avatar_url}
                                  name={p.name}
                                  className={cn(
                                    'size-9 rounded-xl border border-border text-xs',
                                    !aWon && 'ring-2 ring-emerald-500/35'
                                  )}
                                />
                              </button>
                            ))}
                          </div>

                          <div className="min-w-0 text-left">
                            <div
                              className={cn(
                                'text-sm truncate',
                                !aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground'
                              )}
                            >
                              {renderClickableTeam(m.team_b, 'left')}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {!aIsReporter && (
                                <span className="text-[10px] font-black text-muted-foreground bg-secondary px-1.5 py-0.5 rounded leading-none">
                                  報分方
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
                                  {teamBDelta}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] font-bold text-muted-foreground text-center">
                        {m.season_name} · 由 {m.reported_by_name} 報分
                      </p>

                      {isDisputed && (
                        <div className="rounded-xl bg-rose-50/90 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/30 px-3 py-2 flex items-start gap-2">
                          <AlertTriangle
                            size={14}
                            className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <p className="text-xs font-bold text-rose-800 dark:text-rose-200 break-words">
                            申訴說明：{m.dispute_reason || '選手已提交異議並暫停自動結算，等待管理員裁決。'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Col 3: Actions */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isSettled ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openConfirmModal(m, 'edit')}
                            className="h-9 px-3 rounded-xl border-border font-bold text-xs gap-1"
                          >
                            <Pencil size={13} aria-hidden="true" />
                            改分重算
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openVoidModal(m)}
                            className="h-9 px-3 rounded-xl border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-black text-xs gap-1"
                          >
                            <RotateCcw size={13} aria-hidden="true" />
                            撤銷回滾
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => openVoidModal(m)}
                            className="h-9 px-3 rounded-xl text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-bold text-xs gap-1"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                            駁回
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openConfirmModal(m, 'edit')}
                            className="h-9 px-3 rounded-xl border-border font-bold text-xs gap-1"
                          >
                            <Pencil size={13} aria-hidden="true" />
                            改分
                          </Button>
                          <Button
                            type="button"
                            onClick={() => openConfirmModal(m, 'as_is')}
                            className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs gap-1 border-none"
                          >
                            <Gavel size={13} aria-hidden="true" />
                            確認結算
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile Airy Row (2-Line Vertical Scoreboard) */}
                  <div className="lg:hidden p-4 space-y-3">
                    {/* Top Meta Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSelectable && (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label="選取此對戰"
                            onClick={() => toggleSelectMatch(m.id)}
                            className={cn(
                              'size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-border bg-card text-transparent'
                            )}
                          >
                            <Check size={13} strokeWidth={3} aria-hidden="true" />
                          </button>
                        )}
                        {statusBadge}
                        {isPending && m.is_overdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 leading-none">
                            超時 {autoConfirmHours}h+
                          </span>
                        )}
                        <span className="text-xs font-bold text-muted-foreground">
                          {m.match_type === 'doubles' ? '雙打' : '單打'} · {m.format}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
                        {formatLocalTime(m.created_at, 'MM/dd HH:mm')}
                      </span>
                    </div>

                    {/* Dispute Reason Callout */}
                    {isDisputed && (
                      <div className="rounded-xl bg-rose-50/90 dark:bg-rose-500/12 border border-rose-200 dark:border-rose-500/30 px-3 py-2 flex items-start gap-2">
                        <AlertTriangle
                          size={14}
                          className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200 leading-relaxed break-words">
                          申訴說明：{m.dispute_reason || '選手已提交異議並暫停自動結算，等待管理員裁決。'}
                        </p>
                      </div>
                    )}

                    {/* 2-Line Vertical Scoreboard */}
                    <div className="rounded-xl bg-surface-subtle/60 border border-border/70 px-3 py-2.5 space-y-2">
                      {/* Team A Line */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn('flex shrink-0', m.team_a.length > 1 && '-space-x-2')}>
                            {m.team_a.map((p) => (
                              <PlayerAvatar
                                key={p.id}
                                src={p.avatar_url}
                                name={p.name}
                                className="size-8 rounded-lg border border-border text-xs"
                              />
                            ))}
                          </div>
                          <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'text-sm',
                                aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground'
                              )}
                            >
                              {renderClickableTeam(m.team_a)}
                            </span>
                            {aIsReporter && (
                              <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                                報分
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
                                {teamADelta}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            aria-hidden="true"
                            className={cn('size-2 rounded-full', aWon ? 'bg-emerald-500' : 'bg-transparent')}
                          />
                          <span
                            className={cn(
                              'font-display font-black text-xl tabular-nums w-6 text-right leading-none',
                              aWon ? 'text-foreground' : 'text-muted-foreground/55'
                            )}
                          >
                            {m.score_a}
                          </span>
                        </div>
                      </div>

                      {/* Team B Line */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn('flex shrink-0', m.team_b.length > 1 && '-space-x-2')}>
                            {m.team_b.map((p) => (
                              <PlayerAvatar
                                key={p.id}
                                src={p.avatar_url}
                                name={p.name}
                                className="size-8 rounded-lg border border-border text-xs"
                              />
                            ))}
                          </div>
                          <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'text-sm',
                                !aWon ? 'font-black text-foreground' : 'font-bold text-muted-foreground'
                              )}
                            >
                              {renderClickableTeam(m.team_b)}
                            </span>
                            {!aIsReporter && (
                              <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                                報分
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
                                {teamBDelta}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            aria-hidden="true"
                            className={cn('size-2 rounded-full', !aWon ? 'bg-emerald-500' : 'bg-transparent')}
                          />
                          <span
                            className={cn(
                              'font-display font-black text-xl tabular-nums w-6 text-right leading-none',
                              !aWon ? 'text-foreground' : 'text-muted-foreground/55'
                            )}
                          >
                            {m.score_b}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Meta + Action Row */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground">
                        {m.season_name} · 由 {m.reported_by_name} 報分
                      </p>

                      {isSettled ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openConfirmModal(m, 'edit')}
                            className="h-10 rounded-xl border-border font-bold text-xs gap-1.5"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            改分重算
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openVoidModal(m)}
                            className="h-10 rounded-xl border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-black text-xs gap-1.5"
                          >
                            <RotateCcw size={14} aria-hidden="true" />
                            撤銷回滾
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto_auto_1fr] gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openVoidModal(m)}
                            className="h-10 px-3.5 rounded-xl border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 font-bold text-xs gap-1"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            駁回
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openConfirmModal(m, 'edit')}
                            className="h-10 px-3.5 rounded-xl border-border font-bold text-xs gap-1"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            改分
                          </Button>
                          <Button
                            type="button"
                            onClick={() => openConfirmModal(m, 'as_is')}
                            className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs gap-1 border-none"
                          >
                            <Gavel size={14} aria-hidden="true" />
                            確認結算
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-border bg-surface-subtle/35 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-muted-foreground tabular-nums">
              已載入 <strong className="text-foreground font-black">{allMatches.length}</strong> / {filteredTotal} 場
              {(typeFilter !== 'all' || search.trim()) && ` · 目前顯示 ${filteredMatches.length} 場`}
            </p>

            {hasNextPage && (
              <Button
                type="button"
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="h-9 px-4 rounded-xl border-border bg-card font-bold text-xs gap-1.5"
              >
                {isFetchingNextPage ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} aria-hidden="true" />
                )}
                {isFetchingNextPage ? '載入中...' : '載入更多對戰'}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Modal 1: Force Confirm OR Edit Score (handles Pending/Disputed AND Settled Recalc) */}
      <ResponsiveFormModal
        open={!!confirmMatch}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setConfirmMatch(null);
        }}
        size="md"
        tone={confirmIsSettled ? 'default' : 'success'}
        icon={confirmIsSettled ? <Pencil size={18} /> : <Gavel size={18} />}
        title={
          confirmIsSettled
            ? '原地更正比分並重算積分'
            : confirmMode === 'edit'
              ? '修正比分並裁決結算'
              : '裁決確認並結算對戰'
        }
        description={
          confirmIsSettled
            ? '系統將先退回本場原套用的 ELO 積分，再依新比分即時重新結算。'
            : '結算後系統將即時更新雙方 ELO 積分與本季戰績。'
        }
        onSubmit={handleConfirmSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={confirmBusy}
              onClick={() => setConfirmMatch(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                confirmBusy ||
                ((confirmIsSettled || confirmMode === 'edit') && !scoreValidation.valid) ||
                (confirmIsSettled && scoreUnchanged)
              }
              className={cn(
                'w-full sm:w-auto h-11 px-6 rounded-xl text-white font-display font-black text-sm',
                confirmIsSettled
                  ? 'bg-sapphire-blue hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              {confirmBusy
                ? '處理中...'
                : confirmIsSettled
                  ? `確認更正為 ${editScoreA}:${editScoreB} 並重算`
                  : confirmMode === 'edit'
                    ? `以 ${editScoreA}:${editScoreB} 裁決結算`
                    : '確認強制結算'}
            </Button>
          </>
        }
      >
        {confirmMatch && (
          <div className="space-y-4">
            {/* Interactive Matchup Header */}
            <div className="rounded-2xl border border-border bg-surface-subtle/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  對戰雙方對照
                </span>
                {!confirmIsSettled && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmMode === 'as_is') {
                        setConfirmMode('edit');
                      } else {
                        setConfirmMode('as_is');
                        setEditScoreA(confirmMatch.score_a);
                        setEditScoreB(confirmMatch.score_b);
                        setEditFormat(inferMatchFormat(confirmMatch.score_a, confirmMatch.score_b));
                      }
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-black border transition-colors inline-flex items-center gap-1',
                      confirmMode === 'edit'
                        ? 'bg-card border-border text-foreground hover:bg-secondary'
                        : 'bg-sapphire-blue/10 border-sapphire-blue/30 text-sapphire-blue dark:text-blue-300'
                    )}
                  >
                    {confirmMode === 'edit' ? (
                      <>
                        <RotateCcw size={12} aria-hidden="true" />
                        恢復原比分 ({confirmMatch.score_a}:{confirmMatch.score_b})
                      </>
                    ) : (
                      <>
                        <Pencil size={12} aria-hidden="true" />
                        修正比分
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-muted-foreground block">A 隊</span>
                  <span className="text-sm font-black text-foreground truncate block">
                    {formatTeamLabel(confirmMatch.team_a)}
                  </span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border font-display font-black text-xl tabular-nums shrink-0 leading-none">
                  {confirmIsSettled || confirmMode === 'edit'
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
            </div>

            {(confirmIsSettled || confirmMode === 'edit') && (
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
                    confirmIsSettled && scoreUnchanged
                      ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/12 dark:border-amber-500/30 dark:text-amber-300'
                      : scoreValidation.tone === 'valid'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/12 dark:border-emerald-500/30 dark:text-emerald-300'
                        : scoreValidation.tone === 'error'
                          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/12 dark:border-rose-500/30 dark:text-rose-300'
                          : 'bg-surface-subtle border-border text-muted-foreground'
                  )}
                >
                  {confirmIsSettled && scoreUnchanged
                    ? `目前與原比分（${confirmMatch.score_a}:${confirmMatch.score_b}）相同，請點選調整為新局數`
                    : scoreValidation.valid
                      ? `${editFormat} · ${editScoreA > editScoreB ? 'A 隊獲勝' : 'B 隊獲勝'}`
                      : scoreValidation.message}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="admin-confirm-note" className="arena-label">
                裁決備註（選填）
              </label>
              <input
                id="admin-confirm-note"
                type="text"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="例如：已與雙方確認實際比分為 2:1"
                className="arena-input"
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
            ? '將精準退回每位選手的 ELO 積分、出賽場次、勝場與趨勢紀錄。'
            : '移除該筆誤報或無效對戰紀錄，此操作不影響任何積分。'
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
            <div className="bg-surface-subtle/70 border border-border rounded-2xl p-3.5 flex items-center justify-between gap-2.5">
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
              <div className="rounded-2xl border border-rose-200/80 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-500/8 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-rose-200/60 dark:border-rose-500/20 flex items-center gap-2 text-xs font-black text-rose-700 dark:text-rose-300">
                  <Clock size={13} aria-hidden="true" />
                  <span>回滾影響預覽（於單一交易內原子完成）</span>
                </div>
                <div className="divide-y divide-rose-200/50 dark:divide-rose-500/20">
                  {[...voidMatch.team_a, ...voidMatch.team_b].map((p) => {
                    const rbVal =
                      p.mmr_delta !== null && p.mmr_delta !== undefined ? -p.mmr_delta : null;
                    const rbStr = formatSigned(rbVal);
                    return (
                      <div
                        key={p.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PlayerAvatar
                            src={p.avatar_url}
                            name={p.name}
                            className="size-7 rounded-lg border border-border text-[10px] shrink-0"
                          />
                          <span className="font-bold text-foreground truncate">{p.name}</span>
                        </div>
                        <span
                          className={cn(
                            'font-display font-black tabular-nums shrink-0',
                            (rbVal ?? 0) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          )}
                        >
                          回滾 {rbStr || '0'} ELO · 場次 -1
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
                className="arena-input"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_VOID_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setVoidReason(preset)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors',
                      voidReason === preset
                        ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'bg-secondary/70 border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 3: Batch Force Confirm (Overdue or Multi-Selected) */}
      <ResponsiveFormModal
        open={!!batchModalMode}
        onOpenChange={(open) => {
          if (!open && !batchConfirmMutation.isPending) setBatchModalMode(null);
        }}
        size="md"
        tone="success"
        icon={<CheckCheck size={18} />}
        title={
          batchModalMode === 'overdue'
            ? `一鍵結算已超時對戰 (${counts.overdue} 場)`
            : `批次強制結算已選取對戰 (${selectedValidIds.length} 場)`
        }
        description="系統將依建立時間先後順序在同一交易內連貫結算每場 ELO 與出賽數，並通知所有參賽選手。"
        onSubmit={handleBatchSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={batchConfirmMutation.isPending}
              onClick={() => setBatchModalMode(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={batchConfirmMutation.isPending}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-sm"
            >
              {batchConfirmMutation.isPending
                ? '批次結算中...'
                : batchModalMode === 'overdue'
                  ? `確認結算全部超時 (${counts.overdue} 場)`
                  : `確認批次結算 (${selectedValidIds.length} 場)`}
            </Button>
          </>
        }
      >
        {batchModalMode && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-subtle/75 border border-border p-4 space-y-1.5 text-xs font-bold text-muted-foreground leading-relaxed">
              <p className="text-sm font-black text-foreground">
                {batchModalMode === 'overdue'
                  ? `即將結算 ${seasonFilter === 'all' ? '全站' : '此賽季'}所有超過 ${autoConfirmHours} 小時仍待確認的比賽（共 ${counts.overdue} 場）。`
                  : `即將強制結算您勾選的 ${selectedValidIds.length} 場對戰（包含任何申訴中或待確認場次）。`}
              </p>
              <p>
                連打場次將按時間順序逐場套用當下真實 ELO 與生涯場次，確保分數精準連貫且全成功或全回滾。
              </p>
            </div>

            <div>
              <label htmlFor="admin-batch-note" className="arena-label">
                統一裁決備註（選填，將附於選手通知）
              </label>
              <input
                id="admin-batch-note"
                type="text"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="例如：已核對本週賽程表完成結算"
                className="arena-input"
              />
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 4: Proxy Report Match (Admin Creates Match on Behalf of Players) */}
      <ResponsiveFormModal
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !createMatchMutation.isPending) setCreateOpen(false);
        }}
        size="lg"
        tone="default"
        icon={<Plus size={18} />}
        title="代為補登對戰賽果"
        description="為忘記報分或因賽季鎖定無法提交的球友補登賽果，可選擇立即結算 ELO。"
        onSubmit={handleCreateSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={createMatchMutation.isPending}
              onClick={() => setCreateOpen(false)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createMatchMutation.isPending || !createScoreValidation.valid}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm disabled:opacity-40"
            >
              {createMatchMutation.isPending
                ? '送出中...'
                : createAutoSettle
                  ? '補登並立即結算'
                  : '補登並發送待確認'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isUsersLoading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-sapphire-blue" />
              <span>載入活躍成員選單中...</span>
            </div>
          ) : (
            <>
              {/* Section 1: Target Season & Format */}
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_168px] gap-3 items-end">
                <div>
                  <span className="arena-label">目標賽季</span>
                  <ResponsiveSelect
                    value={createSeasonId}
                    onValueChange={setCreateSeasonId}
                    options={createSeasonOptions}
                    title="選擇補登賽季"
                    description="賽事統計將歸屬至所選賽季"
                    placeholder="請選擇賽季"
                    icon={<Calendar size={15} className="text-muted-foreground" />}
                  />
                </div>

                <div>
                  <span className="arena-label">對戰類型</span>
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary border border-border h-11">
                    {(['singles', 'doubles'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setCreateType(t);
                          if (t === 'singles') {
                            setTeamAP2('');
                            setTeamBP2('');
                          }
                        }}
                        className={cn(
                          'rounded-lg text-xs font-black transition-all',
                          createType === t
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {t === 'singles' ? '單打' : '雙打'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Players Lineup */}
              <div className="rounded-2xl border border-border bg-surface-subtle/50 p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-muted-foreground">
                  <Users size={14} aria-hidden="true" />
                  <span>參賽陣容（自動排除已選選手，避免重複）</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Team A */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-sapphire-blue dark:text-blue-300 block">
                      A 隊選手
                    </span>
                    <ResponsiveSelect
                      value={teamAP1}
                      onValueChange={setTeamAP1}
                      options={buildPlayerOptions([teamAP2, teamBP1, teamBP2])}
                      title="選擇 A 隊選手 1"
                      placeholder="選擇 A 隊主力..."
                    />
                    {createType === 'doubles' && (
                      <ResponsiveSelect
                        value={teamAP2}
                        onValueChange={setTeamAP2}
                        options={buildPlayerOptions([teamAP1, teamBP1, teamBP2])}
                        title="選擇 A 隊搭檔"
                        placeholder="選擇 A 隊搭檔..."
                      />
                    )}
                  </div>

                  {/* Team B */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-smash-orange block">
                      B 隊選手
                    </span>
                    <ResponsiveSelect
                      value={teamBP1}
                      onValueChange={setTeamBP1}
                      options={buildPlayerOptions([teamAP1, teamAP2, teamBP2])}
                      title="選擇 B 隊選手 1"
                      placeholder="選擇 B 隊對手..."
                    />
                    {createType === 'doubles' && (
                      <ResponsiveSelect
                        value={teamBP2}
                        onValueChange={setTeamBP2}
                        options={buildPlayerOptions([teamAP1, teamAP2, teamBP1])}
                        title="選擇 B 隊搭檔"
                        placeholder="選擇 B 隊搭檔..."
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Score Picker & Settlement Toggle */}
              <ScoreInputSection
                format={createFormat}
                onFormatChange={setCreateFormat}
                scoreA={createScoreA}
                scoreB={createScoreB}
                onScoreAChange={setCreateScoreA}
                onScoreBChange={setCreateScoreB}
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
                  createScoreValidation.tone === 'valid'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/12 dark:border-emerald-500/30 dark:text-emerald-300'
                    : createScoreValidation.tone === 'warning' || createScoreValidation.tone === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/12 dark:border-rose-500/30 dark:text-rose-300'
                      : 'bg-surface-subtle border-border text-muted-foreground'
                )}
              >
                {createScoreValidation.valid
                  ? `${createFormat} · ${createScoreA > createScoreB ? 'A 隊獲勝' : 'B 隊獲勝'}`
                  : createScoreValidation.message}
              </div>

              <div className="rounded-2xl border border-border bg-surface-subtle/40 p-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">立即結算並計入積分</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {createAutoSettle
                      ? '送出後直接計算雙方 ELO 與賽季排行（推薦現場確認無誤時使用）'
                      : '送出後進入待確認，由 B 隊選手點擊確認後再行計分'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={createAutoSettle}
                  aria-label="立即結算並計入積分"
                  onClick={() => setCreateAutoSettle((v) => !v)}
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors relative shrink-0',
                    createAutoSettle ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <motion.div
                    animate={{ x: createAutoSettle ? 22 : 3 }}
                    className="size-5 bg-white rounded-full absolute top-1 shadow-xs"
                  />
                </button>
              </div>

              <div>
                <label htmlFor="admin-create-note" className="arena-label">
                  補登備註（選填，將顯示於選手通知）
                </label>
                <input
                  id="admin-create-note"
                  type="text"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="例如：週五社課友誼賽補登"
                  className="arena-input"
                />
              </div>
            </>
          )}
        </div>
      </ResponsiveFormModal>
    </section>
  );
}
