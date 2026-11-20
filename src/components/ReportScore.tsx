import * as React from 'react';
import { useThrottledCallback } from '@tanstack/react-pacer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import { Trophy, User, CheckCircle2, Search, X, RotateCcw, Sparkles } from 'lucide-react';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ScoreInputSection } from '@/components/ScoreInputSection';
import { inferMatchFormat, validateMatchScore, type MatchFormat } from '@/lib/matchScore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { cn, formatLocalTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface UserOption {
  id: string;
  name: string;
  department?: string;
  mmr?: number;
  avatar?: string | null;
}

interface CachedMatchPlayer {
  id?: string;
}

interface CachedRecentMatch {
  player1?: CachedMatchPlayer[];
  opponent?: CachedMatchPlayer[];
}

interface ReportPayload {
  score_a: number;
  score_b: number;
  match_type: 'singles' | 'doubles';
  team_a_p1_id: string;
  team_a_p2_id: string | null;
  team_b_p1_id: string;
  team_b_p2_id: string | null;
  format: 'BO3' | 'BO5';
  reported_by: string;
}

interface AxiosErrorShape {
  response?: {
    data?: {
      detail?: string | Array<{ loc: Array<string | number>; msg: string }>;
    };
  };
  message?: string;
}

interface ReportScoreProps {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editMode?: boolean;
  initialMatchType?: 'singles' | 'doubles';
  initialFormat?: MatchFormat;
  initialPartnerId?: string | null;
  initialOpponentId?: string | null;
  initialOpponent2Id?: string | null;
  initialScoreA?: number;
  initialScoreB?: number;
}

type MatchType = 'singles' | 'doubles';
type ActiveSlot = 'partner' | 'opp1' | 'opp2';

function getTeamMmr(m1: number, m2?: number): number {
  if (m2 === undefined) return m1;
  return Math.max(m1, m2) * 0.6 + Math.min(m1, m2) * 0.4;
}

function getMovMultiplier(winnerScore: number, loserScore: number, format: MatchFormat): number {
  const margin = Math.abs(winnerScore - loserScore);
  if (format === 'BO3') {
    return margin >= 2 ? 1.2 : 1.0;
  }
  if (margin >= 3) return 1.5;
  if (margin === 2) return 1.35;
  return 1.2;
}

function estimateMyEloDelta({
  myMmr,
  partnerMmr,
  opp1Mmr,
  opp2Mmr,
  scoreA,
  scoreB,
  isDoubles,
  format,
}: {
  myMmr: number;
  partnerMmr?: number;
  opp1Mmr: number;
  opp2Mmr?: number;
  scoreA: number;
  scoreB: number;
  isDoubles: boolean;
  format: MatchFormat;
}): number {
  const myTeamMmr = isDoubles && partnerMmr !== undefined ? getTeamMmr(myMmr, partnerMmr) : myMmr;
  const oppTeamMmr = isDoubles && opp2Mmr !== undefined ? getTeamMmr(opp1Mmr, opp2Mmr) : opp1Mmr;

  const isWin = scoreA > scoreB;
  const winnerMmr = isWin ? myTeamMmr : oppTeamMmr;
  const loserMmr = isWin ? oppTeamMmr : myTeamMmr;
  const expectedWinnerWin = 1 / (1 + 10 ** ((loserMmr - winnerMmr) / 400));

  const k = 24;
  const mov = getMovMultiplier(Math.max(scoreA, scoreB), Math.min(scoreA, scoreB), format);
  const teamDelta = k * (1 - expectedWinnerWin) * mov;

  if (!isDoubles || partnerMmr === undefined) {
    const rounded = Math.round(teamDelta * 10) / 10;
    return isWin ? rounded : -rounded;
  }

  const discounted = teamDelta * 1.2;
  const total = myMmr + partnerMmr;
  const share = total > 0 ? partnerMmr / total : 0.5;
  const myAbs = Math.round(discounted * share * 10) / 10;
  return isWin ? myAbs : -myAbs;
}

export function ReportScore({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  editMode = false,
  initialMatchType = 'singles',
  initialFormat,
  initialPartnerId = null,
  initialOpponentId = null,
  initialOpponent2Id = null,
  initialScoreA = 0,
  initialScoreB = 0,
}: ReportScoreProps) {
  const { data: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const searchInputId = React.useId();

  const findInitialSlot = (
    type: MatchType,
    partnerId: string | null,
    opp1: string | null,
    opp2: string | null
  ): ActiveSlot | null => {
    if (type === 'doubles' && !partnerId) return 'partner';
    if (!opp1) return 'opp1';
    if (type === 'doubles' && !opp2) return 'opp2';
    return null;
  };

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const [scoreA, setScoreA] = React.useState(initialScoreA);
  const [scoreB, setScoreB] = React.useState(initialScoreB);
  const [matchType, setMatchType] = React.useState<MatchType>(initialMatchType);
  const [matchFormat, setMatchFormat] = React.useState<MatchFormat>(
    () => initialFormat ?? inferMatchFormat(initialScoreA, initialScoreB)
  );
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(initialPartnerId);
  const [opponent1Id, setOpponent1Id] = React.useState<string | null>(initialOpponentId);
  const [opponent2Id, setOpponent2Id] = React.useState<string | null>(initialOpponent2Id);
  const [activeSlot, setActiveSlot] = React.useState<ActiveSlot | null>(() =>
    findInitialSlot(initialMatchType, initialPartnerId, initialOpponentId, initialOpponent2Id)
  );
  const [isSuccess, setIsSuccess] = React.useState(false);

  const resetFormState = React.useCallback(
    (nextType: MatchType = initialMatchType) => {
      setScoreA(initialScoreA);
      setScoreB(initialScoreB);
      setMatchType(nextType);
      setMatchFormat(initialFormat ?? inferMatchFormat(initialScoreA, initialScoreB));
      setSearchTerm('');
      setSelectedPartnerId(nextType === 'doubles' ? initialPartnerId : null);
      setOpponent1Id(initialOpponentId);
      setOpponent2Id(nextType === 'doubles' ? initialOpponent2Id : null);
      setActiveSlot(
        findInitialSlot(
          nextType,
          nextType === 'doubles' ? initialPartnerId : null,
          initialOpponentId,
          nextType === 'doubles' ? initialOpponent2Id : null
        )
      );
      setIsSuccess(false);
    },
    [initialFormat, initialMatchType, initialOpponent2Id, initialOpponentId, initialPartnerId, initialScoreA, initialScoreB]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    controlledOnOpenChange?.(nextOpen);
    if (nextOpen) {
      resetFormState(initialMatchType);
    } else if (isSuccess) {
      setTimeout(() => resetFormState(initialMatchType), 250);
    }
  };

  const handleQuickRematch = () => {
    setScoreA(0);
    setScoreB(0);
    setSearchTerm('');
    setActiveSlot(findInitialSlot(matchType, selectedPartnerId, opponent1Id, opponent2Id));
    setIsSuccess(false);
  };

  const { data: configData } = useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => {
      const res = await apiClient.get<{ season_paused?: string }>('/config/public');
      return res.data;
    },
    enabled: !!currentUser && open,
  });
  const seasonPaused = configData?.season_paused === 'true';

  const { data: realPlayers = [], isPending: isPlayersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<UserOption[]>('/users');
      return res.data;
    },
    enabled: !!currentUser && open,
  });

  // 讀取已快取的近期對戰名單，將常交手的同事置頂方便點選
  const cachedRecentMatches = open
    ? queryClient.getQueryData<CachedRecentMatch[]>(['matches', 'recent'])
    : undefined;

  const recentPartnerIds = React.useMemo(() => {
    const counts = new Map<string, number>();
    const myId = currentUser?.id;
    (cachedRecentMatches || []).forEach((m) => {
      [...(m.player1 || []), ...(m.opponent || [])].forEach((p) => {
        if (p.id && p.id !== myId) {
          counts.set(p.id, (counts.get(p.id) || 0) + 1);
        }
      });
    });
    return counts;
  }, [cachedRecentMatches, currentUser?.id]);

  const sortedAvailablePlayers = React.useMemo(() => {
    const myId = currentUser?.id;
    const q = searchTerm.trim().toLowerCase();
    return realPlayers
      .filter((p) => {
        if (p.id === myId) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.department && p.department.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (recentPartnerIds.get(b.id) || 0) - (recentPartnerIds.get(a.id) || 0));
  }, [realPlayers, currentUser?.id, searchTerm, recentPartnerIds]);

  const playerMap = React.useMemo(() => {
    const map = new Map<string, UserOption>();
    realPlayers.forEach((p) => map.set(p.id, p));
    return map;
  }, [realPlayers]);

  const selectedPartner = selectedPartnerId ? playerMap.get(selectedPartnerId) || null : null;
  const opponent1 = opponent1Id ? playerMap.get(opponent1Id) || null : null;
  const opponent2 = opponent2Id ? playerMap.get(opponent2Id) || null : null;

  const isLineupReady =
    matchType === 'singles'
      ? !!opponent1Id
      : !!selectedPartnerId && !!opponent1Id && !!opponent2Id;

  const findNextEmptySlot = (
    nextPartner: string | null,
    nextOpp1: string | null,
    nextOpp2: string | null,
    type: MatchType
  ): ActiveSlot | null => {
    if (type === 'doubles' && !nextPartner) return 'partner';
    if (!nextOpp1) return 'opp1';
    if (type === 'doubles' && !nextOpp2) return 'opp2';
    return null;
  };

  const handleSelectPlayer = (playerId: string) => {
    if (editMode) return;

    // 若點擊已選中的人員，直接將他從對應槽位移除並將焦點切到該槽位
    if (matchType === 'doubles' && selectedPartnerId === playerId) {
      setSelectedPartnerId(null);
      setActiveSlot('partner');
      return;
    }
    if (opponent1Id === playerId) {
      setOpponent1Id(null);
      setActiveSlot('opp1');
      return;
    }
    if (matchType === 'doubles' && opponent2Id === playerId) {
      setOpponent2Id(null);
      setActiveSlot('opp2');
      return;
    }

    if (matchType === 'singles') {
      setOpponent1Id(playerId);
      setActiveSlot(null);
      return;
    }

    const targetSlot =
      activeSlot || findNextEmptySlot(selectedPartnerId, opponent1Id, opponent2Id, 'doubles') || 'opp2';

    let nextPartner = selectedPartnerId;
    let nextOpp1 = opponent1Id;
    let nextOpp2 = opponent2Id;

    if (targetSlot === 'partner') {
      nextPartner = playerId;
      setSelectedPartnerId(playerId);
    } else if (targetSlot === 'opp1') {
      nextOpp1 = playerId;
      setOpponent1Id(playerId);
    } else {
      nextOpp2 = playerId;
      setOpponent2Id(playerId);
    }

    setActiveSlot(findNextEmptySlot(nextPartner, nextOpp1, nextOpp2, 'doubles'));
  };

  const mutation = useMutation({
    mutationFn: async (payload: ReportPayload) => {
      return apiClient.post('/matches', payload);
    },
    onMutate: async (newMatch) => {
      await queryClient.cancelQueries({ queryKey: ['matches', 'recent'] });
      const previousMatches = queryClient.getQueryData(['matches', 'recent']);

      const optimisticMatch = {
        id: 'temp-' + Date.now(),
        date: formatLocalTime(new Date().toISOString(), 'yyyy/MM/dd'),
        score: [newMatch.score_a, newMatch.score_b],
        match_type: newMatch.match_type,
        created_at: new Date().toISOString(),
        status: 'pending',
        player1:
          matchType === 'doubles' && selectedPartner ? [currentUser, selectedPartner] : [currentUser],
        opponent:
          matchType === 'doubles'
            ? [opponent1, opponent2].filter(Boolean)
            : opponent1
              ? [opponent1]
              : [],
      };

      queryClient.setQueryData(['matches', 'recent'], (old: unknown) => {
        return Array.isArray(old) ? [optimisticMatch, ...old] : [optimisticMatch];
      });

      return { previousMatches };
    },
    onError: (err: unknown, _newMatch, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matches', 'recent'], context.previousMatches);
      }

      const typedErr = err as AxiosErrorShape;
      let errorMessage = '報分失敗，請稍後再試';
      const detail = typedErr.response?.data?.detail;
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map((e) => `欄位 [${e.loc[e.loc.length - 1]}]: ${e.msg}`).join('；');
      } else if (typedErr.message) {
        errorMessage = typedErr.message;
      }
      toast.error(errorMessage);
    },
    onSuccess: () => {
      setIsSuccess(true);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['matches', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'rivals'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'partners'] });
    },
  });

  const isSubmitting = mutation.isPending;

  const scoreValidation = React.useMemo(() => {
    if (seasonPaused) {
      return { valid: false, message: '賽季已暫停，目前無法申報新比分', tone: 'error' as const };
    }
    const lineupMessage = !isLineupReady
      ? matchType === 'singles'
        ? '請先點選一位對手'
        : !selectedPartnerId
          ? '請先選擇您的雙打搭檔'
          : '請選齊兩位對手'
      : null;

    return validateMatchScore(scoreA, scoreB, matchFormat, lineupMessage);
  }, [seasonPaused, scoreA, scoreB, matchFormat, isLineupReady, matchType, selectedPartnerId]);

  const estimatedDelta = React.useMemo(() => {
    if (!scoreValidation.valid || !opponent1 || !currentUser) return null;
    if (matchType === 'doubles' && (!selectedPartner || !opponent2)) return null;

    const myMmr = Number(currentUser.global_mmr ?? currentUser.mmr ?? 1000);
    const opp1Mmr = Number(opponent1.mmr ?? 1000);
    const partnerMmr = selectedPartner ? Number(selectedPartner.mmr ?? 1000) : undefined;
    const opp2Mmr = opponent2 ? Number(opponent2.mmr ?? 1000) : undefined;

    return estimateMyEloDelta({
      myMmr,
      partnerMmr,
      opp1Mmr,
      opp2Mmr,
      scoreA,
      scoreB,
      isDoubles: matchType === 'doubles',
      format: matchFormat,
    });
  }, [scoreValidation.valid, opponent1, opponent2, selectedPartner, currentUser, matchType, scoreA, scoreB, matchFormat]);

  const throttledSubmit = useThrottledCallback(
    async () => {
      if (seasonPaused || !isLineupReady || !scoreValidation.valid || !currentUser || !opponent1Id) {
        return;
      }

      const payload: ReportPayload = {
        score_a: scoreA,
        score_b: scoreB,
        match_type: matchType,
        team_a_p1_id: currentUser.id,
        team_a_p2_id: matchType === 'doubles' ? selectedPartnerId : null,
        team_b_p1_id: opponent1Id,
        team_b_p2_id: matchType === 'doubles' ? opponent2Id : null,
        format: matchFormat,
        reported_by: currentUser.id,
      };

      mutation.mutate(payload);
    },
    { wait: 2000 }
  );

  if (!currentUser) return null;

  const submitLabel = isSubmitting
    ? '送出中...'
    : editMode
      ? '送出修改'
      : seasonPaused
        ? '賽季已暫停報分'
        : !isLineupReady
          ? matchType === 'singles'
            ? '請先選擇對手'
            : '請選齊搭檔與對手'
          : !scoreValidation.valid
            ? '請點選比賽比分'
            : `確認申報 · ${scoreA > scoreB ? '我方' : '對手'} ${scoreA}:${scoreB} 獲勝`;

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    throttledSubmit();
  };

  const bodyContent = (
    <div className="space-y-5">
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-4 space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
            <CheckCircle2 size={36} strokeWidth={2.5} aria-hidden="true" />
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-xl sm:text-2xl font-display font-black text-primary-navy">申報成功！</h3>
            <p className="text-sm font-medium text-slate-500">賽果已送出，等待對手確認後立即結算積分。</p>
          </div>

          <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <div className={cn('flex items-center justify-center', matchType === 'doubles' && selectedPartner ? '-space-x-3' : '')}>
                  <PlayerAvatar
                    src={currentUser.avatar_url || currentUser.avatar}
                    name={currentUser.name}
                    className={cn('size-12 rounded-xl border-2 text-sm', scoreA > scoreB ? 'border-emerald-500' : 'border-white')}
                  />
                  {matchType === 'doubles' && selectedPartner && (
                    <PlayerAvatar
                      src={selectedPartner.avatar}
                      name={selectedPartner.name}
                      className={cn('size-12 rounded-xl border-2 text-sm', scoreA > scoreB ? 'border-emerald-500' : 'border-white')}
                    />
                  )}
                </div>
                <span className="text-xs font-black text-primary-navy truncate max-w-full">
                  {matchType === 'doubles' && selectedPartner ? `${currentUser.name} / ${selectedPartner.name}` : currentUser.name}
                </span>
              </div>

              <div className="flex flex-col items-center shrink-0 px-2">
                <span className="text-3xl sm:text-4xl font-display font-black text-primary-navy tabular-nums">
                  {scoreA} : {scoreB}
                </span>
                <span
                  className={cn(
                    'mt-1 px-2.5 py-0.5 rounded-full text-xs font-black',
                    scoreA > scoreB ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                  )}
                >
                  {scoreA > scoreB ? '我方勝' : '對手勝'}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <div className={cn('flex items-center justify-center', matchType === 'doubles' && opponent2 ? '-space-x-3' : '')}>
                  {opponent1 && (
                    <PlayerAvatar
                      src={opponent1.avatar}
                      name={opponent1.name}
                      className={cn('size-12 rounded-xl border-2 text-sm', scoreB > scoreA ? 'border-emerald-500' : 'border-white')}
                    />
                  )}
                  {matchType === 'doubles' && opponent2 && (
                    <PlayerAvatar
                      src={opponent2.avatar}
                      name={opponent2.name}
                      className={cn('size-12 rounded-xl border-2 text-sm', scoreB > scoreA ? 'border-emerald-500' : 'border-white')}
                    />
                  )}
                </div>
                <span className="text-xs font-black text-primary-navy truncate max-w-full">
                  {matchType === 'doubles' && opponent1 && opponent2
                    ? `${opponent1.name} / ${opponent2.name}`
                    : opponent1?.name || '對手'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <span className="size-2 bg-amber-400 rounded-full animate-pulse" />
                等待對手確認中
              </span>
              <span className="font-bold text-slate-500">48 小時後自動生效</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. 賽制切換 */}
          {!editMode && (
            <Tabs
              value={matchType}
              onValueChange={(val) => {
                const nextType = val as MatchType;
                setMatchType(nextType);
                setSelectedPartnerId(null);
                setOpponent1Id(null);
                setOpponent2Id(null);
                setActiveSlot(nextType === 'doubles' ? 'partner' : 'opp1');
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 h-11 bg-slate-100 border border-slate-200/70">
                <TabsTrigger
                  value="singles"
                  className="rounded-xl text-sm font-black data-[state=active]:bg-white data-[state=active]:text-primary-navy data-[state=active]:shadow-xs"
                >
                  單打 1v1
                </TabsTrigger>
                <TabsTrigger
                  value="doubles"
                  className="rounded-xl text-sm font-black data-[state=active]:bg-white data-[state=active]:text-primary-navy data-[state=active]:shadow-xs"
                >
                  雙打 2v2
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* 2. 對戰陣容槽位 (Slot-First Matchup Stage) */}
          <section aria-label="對戰陣容" className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              {/* 我方陣營 */}
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-black text-slate-500 flex items-center justify-between">
                  <span>我方</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/80 min-w-0">
                    <PlayerAvatar
                      src={currentUser.avatar_url || currentUser.avatar}
                      name={currentUser.name}
                      className="size-8 rounded-lg text-xs"
                    />
                    <span className="text-xs sm:text-sm font-black text-primary-navy truncate">
                      {currentUser.name}
                    </span>
                  </div>

                  {matchType === 'doubles' && (
                    <LineupSlotButton
                      label="選搭檔"
                      roleBadge="搭檔"
                      badgeColor="bg-amber-100 text-amber-700"
                      player={selectedPartner}
                      isActive={activeSlot === 'partner'}
                      disabled={editMode}
                      onFocus={() => setActiveSlot('partner')}
                      onClear={() => {
                        setSelectedPartnerId(null);
                        setActiveSlot('partner');
                      }}
                    />
                  )}
                </div>
              </div>

              {/* 中央即時比分 */}
              <div className="flex flex-col items-center justify-center px-1 sm:px-2 shrink-0">
                <div className="flex items-center gap-1 font-display font-black text-2xl sm:text-3xl text-primary-navy tabular-nums">
                  <span className={cn(scoreA > scoreB && 'text-emerald-600')}>{scoreA}</span>
                  <span className="text-slate-300">:</span>
                  <span className={cn(scoreB > scoreA && 'text-emerald-600')}>{scoreB}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 mt-0.5 whitespace-nowrap">{matchFormat}</span>
              </div>

              {/* 對手陣營 */}
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-black text-slate-500 text-right">對手</p>
                <div className="flex flex-col gap-1.5">
                  <LineupSlotButton
                    label={matchType === 'singles' ? '選對手' : '對手 1'}
                    roleBadge="對手"
                    badgeColor="bg-blue-100 text-sapphire-blue"
                    player={opponent1}
                    isActive={activeSlot === 'opp1'}
                    disabled={editMode}
                    onFocus={() => setActiveSlot('opp1')}
                    onClear={() => {
                      setOpponent1Id(null);
                      setActiveSlot('opp1');
                    }}
                  />

                  {matchType === 'doubles' && (
                    <LineupSlotButton
                      label="對手 2"
                      roleBadge="對手"
                      badgeColor="bg-blue-100 text-sapphire-blue"
                      player={opponent2}
                      isActive={activeSlot === 'opp2'}
                      disabled={editMode}
                      onFocus={() => setActiveSlot('opp2')}
                      onClear={() => {
                        setOpponent2Id(null);
                        setActiveSlot('opp2');
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. 同仁快速選擇區 */}
          {!editMode && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-slate-600">
                  {activeSlot === 'partner'
                    ? '點選一位同事擔任您的搭檔'
                    : activeSlot === 'opp1' || activeSlot === 'opp2'
                      ? '點選一位對手同事'
                      : '陣容已選好（點擊槽位或下方人員可替換）'}
                </p>
                {(selectedPartnerId || opponent1Id || opponent2Id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPartnerId(null);
                      setOpponent1Id(null);
                      setOpponent2Id(null);
                      setActiveSlot(matchType === 'doubles' ? 'partner' : 'opp1');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sapphire-blue hover:underline shrink-0"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    重設
                  </button>
                )}
              </div>

              <div className="relative">
                <label htmlFor={searchInputId} className="sr-only">
                  搜尋同仁姓名或處室
                </label>
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={16}
                  aria-hidden="true"
                />
                <input
                  id={searchInputId}
                  name="playerSearch"
                  type="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="搜尋姓名或處室..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="arena-input pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="清除搜尋"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="max-h-44 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {isPlayersLoading ? (
                  <div className="col-span-full py-6 text-center text-sm font-bold text-slate-400">
                    讀取同仁名單中...
                  </div>
                ) : sortedAvailablePlayers.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-sm font-bold text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    找不到符合「{searchTerm}」的同仁
                  </div>
                ) : (
                  sortedAvailablePlayers.map((player) => {
                    const isPartner = matchType === 'doubles' && selectedPartnerId === player.id;
                    const isOpponent =
                      opponent1Id === player.id || (matchType === 'doubles' && opponent2Id === player.id);
                    const isSelected = isPartner || isOpponent;
                    const isFrequent = (recentPartnerIds.get(player.id) || 0) > 0;

                    return (
                      <button
                        type="button"
                        key={player.id}
                        onClick={() => handleSelectPlayer(player.id)}
                        className={cn(
                          'flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all min-h-12 relative',
                          isPartner
                            ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300'
                            : isOpponent
                              ? 'bg-blue-50 border-sapphire-blue ring-1 ring-sapphire-blue/30'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <PlayerAvatar
                          src={player.avatar}
                          name={player.name}
                          className="size-9 rounded-lg border border-slate-200/70 text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-primary-navy truncate">
                              {player.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            {player.department || '一般同仁'}
                          </p>
                        </div>
                        {isSelected ? (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded-md text-xs font-black shrink-0',
                              isPartner ? 'bg-olympic-gold text-white' : 'bg-sapphire-blue text-white'
                            )}
                          >
                            {isPartner ? '搭檔' : '對手'}
                          </span>
                        ) : (
                          isFrequent && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-bold shrink-0">
                              常打
                            </span>
                          )
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* 4. 賽制 & 一鍵比分 + 精簡微調 */}
          <section className="pt-3 border-t border-slate-100">
            <ScoreInputSection
              format={matchFormat}
              onFormatChange={setMatchFormat}
              scoreA={scoreA}
              scoreB={scoreB}
              onScoreAChange={setScoreA}
              onScoreBChange={setScoreB}
            />
          </section>

          {/* 5. 狀態與預估積分變動回饋 */}
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold',
              scoreValidation.tone === 'valid'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : scoreValidation.tone === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : scoreValidation.tone === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
            )}
          >
            <span>{scoreValidation.message}</span>
            {estimatedDelta !== null && (
              <span className="inline-flex items-center gap-1 font-display font-black tabular-nums">
                <Sparkles size={13} aria-hidden="true" />
                預估 {estimatedDelta > 0 ? `+${estimatedDelta}` : estimatedDelta} ELO
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      size="xl"
      tone={isSuccess ? 'success' : 'gold'}
      icon={isSuccess ? <CheckCircle2 size={18} /> : <Trophy size={18} />}
      title={isSuccess ? '申報成功' : editMode ? '修改賽果' : '申報比賽結果'}
      description={
        isSuccess ? '賽果已提交，等待對手系統確認中。' : '點選對手與局數後送出，確認後即時結算積分。'
      }
      onSubmit={!isSuccess ? handleFormSubmit : undefined}
      footer={
        isSuccess ? (
          <>
            {!editMode && opponent1Id && (
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickRematch}
                className="w-full lg:w-auto h-11 px-5 rounded-xl border-sapphire-blue/30 text-sapphire-blue hover:bg-blue-50 font-black text-sm gap-1.5"
              >
                <RotateCcw size={15} aria-hidden="true" />
                原陣容再報一場
              </Button>
            )}
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full lg:w-auto h-11 px-8 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-sm"
            >
              完成
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="w-full lg:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={seasonPaused || !isLineupReady || isSubmitting || !scoreValidation.valid}
              className="w-full lg:w-auto h-11 px-7 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-sm tracking-wide transition-all disabled:opacity-35 shadow-sm"
            >
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {bodyContent}
    </ResponsiveFormModal>
  );
}

function LineupSlotButton({
  label,
  roleBadge,
  badgeColor,
  player,
  isActive,
  disabled,
  onFocus,
  onClear,
}: {
  label: string;
  roleBadge: string;
  badgeColor: string;
  player: UserOption | null;
  isActive: boolean;
  disabled?: boolean;
  onFocus: () => void;
  onClear: () => void;
}) {
  if (player) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-xl bg-white border transition-all min-w-0',
          isActive ? 'border-sapphire-blue ring-2 ring-sapphire-blue/25' : 'border-slate-200/80'
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onFocus}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <PlayerAvatar src={player.avatar} name={player.name} className="size-8 rounded-lg text-xs" />
          <div className="min-w-0 flex-1">
            <span className="text-xs sm:text-sm font-black text-primary-navy truncate block">
              {player.name}
            </span>
          </div>
        </button>
        <span className={cn('hidden sm:inline px-1.5 py-0.5 rounded-md text-xs font-bold shrink-0', badgeColor)}>
          {roleBadge}
        </span>
        {!disabled && (
          <button
            type="button"
            aria-label={`移除${player.name}`}
            onClick={onClear}
            className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onFocus}
      className={cn(
        'flex items-center justify-center gap-1.5 min-h-12 px-2.5 rounded-xl border border-dashed text-xs sm:text-sm font-bold transition-all w-full',
        isActive
          ? 'border-sapphire-blue bg-blue-50/70 text-sapphire-blue ring-2 ring-sapphire-blue/20'
          : 'border-slate-300 bg-white/70 text-slate-500 hover:border-sapphire-blue/50 hover:text-primary-navy'
      )}
    >
      <User size={14} aria-hidden="true" />
      <span className="truncate">+ {label}</span>
    </button>
  );
}
