import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  ChevronRight,
  Flame,
  Handshake,
  History,
  LayoutDashboard,
  Lock,
  Plus,
  Radar as RadarIcon,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { getTierBadge } from '@/lib/ranking';
import { useTheme } from '@/contexts/theme-context';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ReportScore } from '@/components/ReportScore';
import { ChallengeModal } from '@/components/ChallengeModal';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/hooks/useAuth';
import { useMyChallenges } from '@/hooks/useChallenges';
import apiClient from '@/utils/apiClient';
import type {
  H2HBucket,
  H2HMatchupPreview,
  H2HRecentMatch,
  H2HResponse,
  PlayerPartnerItem,
  PlayerProfileData,
  PlayerStats,
} from '@/types/api.types';

type DrawerMainTab = 'h2h' | 'scouting';
type H2HTab = 'doubles_vs' | 'doubles_with' | 'singles_vs';

function getRankBadgeStyle(
  rank: string | number | undefined,
  isPlacement: boolean,
): { containerClass: string; textLabel: string; ariaText: string } {
  const isRanked = rank !== undefined && rank !== null && rank !== '-' && rank !== '';
  const numRank = isRanked ? Number(rank) : undefined;

  if (isRanked && numRank === 1) {
    return {
      containerClass:
        'bg-amber-100 text-amber-700 border-amber-400/80 dark:bg-amber-950/95 dark:text-amber-300 dark:border-amber-400/60',
      textLabel: '1',
      ariaText: '目前第 1 名',
    };
  }
  if (isRanked && numRank === 2) {
    return {
      containerClass:
        'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-500/70',
      textLabel: '2',
      ariaText: '目前第 2 名',
    };
  }
  if (isRanked && numRank === 3) {
    return {
      containerClass:
        'bg-orange-100 text-orange-700 border-orange-400/75 dark:bg-orange-950/95 dark:text-orange-300 dark:border-orange-400/60',
      textLabel: '3',
      ariaText: '目前第 3 名',
    };
  }
  if (isRanked && numRank !== undefined && !Number.isNaN(numRank)) {
    return {
      containerClass:
        'bg-secondary text-muted-foreground border-border dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
      textLabel: String(numRank),
      ariaText: `目前第 ${numRank} 名`,
    };
  }
  if (isPlacement) {
    return {
      containerClass:
        'bg-blue-50 text-sapphire-blue border-sapphire-blue/40 dark:bg-blue-950/95 dark:text-blue-300 dark:border-blue-400/50',
      textLabel: '定級',
      ariaText: '定級賽進行中',
    };
  }
  return {
    containerClass:
      'bg-surface-subtle text-muted-foreground border-dashed border-border dark:bg-slate-900 dark:text-slate-400',
    textLabel: '-',
    ariaText: '尚無正式名次',
  };
}

function formatRangeText(a: number, b: number, prefixPlus = false): string {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const fmt = (n: number) => (prefixPlus && n > 0 ? `+${n}` : `${n}`);
  if (low === high) return `${fmt(low)} 分`;
  return `${fmt(low)} ~ ${fmt(high)} 分`;
}

function formatEquipmentLine(player: PlayerProfileData): string {
  const parts: string[] = [];
  if (player.department?.trim()) {
    parts.push(player.department.trim());
  }
  if (player.dominant_hand?.trim()) {
    parts.push(player.dominant_hand.trim());
  }
  const fh = player.racketConfig?.forehand;
  const bh = player.racketConfig?.backhand;
  const hasFh = Boolean(fh && fh !== '未設定');
  const hasBh = Boolean(bh && bh !== '未設定');
  if (hasFh && hasBh) {
    parts.push(`${fh} / ${bh}`);
  } else if (hasFh) {
    parts.push(`正手 ${fh}`);
  } else if (hasBh) {
    parts.push(`反手 ${bh}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '尚未填寫單位與球拍配置';
}

function handleRovingTabKeyDown<T extends string>(
  e: KeyboardEvent<HTMLButtonElement>,
  ids: readonly T[],
  currentIndex: number,
  onSelect: (id: T) => void,
  buttonRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
) {
  let targetIndex = -1;
  if (e.key === 'ArrowRight') {
    targetIndex = (currentIndex + 1) % ids.length;
  } else if (e.key === 'ArrowLeft') {
    targetIndex = (currentIndex - 1 + ids.length) % ids.length;
  } else if (e.key === 'Home') {
    targetIndex = 0;
  } else if (e.key === 'End') {
    targetIndex = ids.length - 1;
  } else {
    return;
  }
  e.preventDefault();
  onSelect(ids[targetIndex]);
  buttonRefs.current[targetIndex]?.focus();
}

export function GlobalPlayerDrawer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectingId = searchParams.get('inspect');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { data: currentUser } = useAuth();

  const [quickReportTarget, setQuickReportTarget] = useState<{ id: string; key: number } | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<{
    id: string;
    name: string;
    avatar?: string | null;
    department?: string | null;
  } | null>(null);

  const isViewingSelf = Boolean(
    currentUser?.id && inspectingId && String(currentUser.id) === String(inspectingId),
  );

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('inspect');
    setSearchParams(newParams);
  };

  const inspectOtherPlayer = (targetId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', targetId);
    setSearchParams(newParams);
  };

  const handleOpenChallenge = (player: PlayerProfileData, hasExisting: boolean) => {
    if (hasExisting) {
      navigate('/?focus=challenges');
      return;
    }
    const target = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      department: player.department,
    };
    closeDrawer();
    window.setTimeout(() => {
      setChallengeTarget(target);
    }, 150);
  };

  const handleQuickReport = (targetId: string) => {
    closeDrawer();
    window.setTimeout(() => {
      setQuickReportTarget({ id: targetId, key: Date.now() });
    }, 150);
  };

  const handleNavigateRoute = (url: string) => {
    navigate(url);
  };

  const drawerContent = inspectingId ? (
    <PlayerDrawerInner
      key={inspectingId}
      inspectingId={inspectingId}
      isDesktop={isDesktop}
      isViewingSelf={isViewingSelf}
      currentUser={currentUser}
      onClose={closeDrawer}
      onInspectPlayer={inspectOtherPlayer}
      onOpenChallenge={handleOpenChallenge}
      onQuickReport={handleQuickReport}
      onNavigateRoute={handleNavigateRoute}
    />
  ) : null;

  return (
    <>
      {inspectingId &&
        (isDesktop ? (
          <Sheet open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
            <SheetContent
              hideCloseButton
              className="w-[92vw] sm:max-w-[460px] p-0 border-none bg-popover lg:rounded-l-[2rem] overflow-hidden shadow-2xl flex flex-col gap-0"
            >
              <SheetTitle className="sr-only">選手詳細戰力與交手紀錄</SheetTitle>
              <SheetDescription className="sr-only">
                檢視選手即時積分、近況手感、雙方交手紀錄與五維能力雷達。
              </SheetDescription>
              {drawerContent}
            </SheetContent>
          </Sheet>
        ) : (
          <Drawer open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
            <DrawerContent className="p-0 border-none bg-popover rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
              <DrawerTitle className="sr-only">選手詳細戰力與交手紀錄</DrawerTitle>
              <DrawerDescription className="sr-only">
                檢視選手即時積分、近況手感、雙方交手紀錄與五維能力雷達。
              </DrawerDescription>
              {drawerContent}
            </DrawerContent>
          </Drawer>
        ))}

      {quickReportTarget && (
        <ReportScore
          key={quickReportTarget.key}
          open={Boolean(quickReportTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setQuickReportTarget(null);
          }}
          initialOpponentId={quickReportTarget.id}
        />
      )}

      {challengeTarget && (
        <ChallengeModal
          open={Boolean(challengeTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setChallengeTarget(null);
          }}
          targetPlayer={challengeTarget}
        />
      )}
    </>
  );
}

function PlayerDrawerInner({
  inspectingId,
  isDesktop,
  isViewingSelf,
  currentUser,
  onClose,
  onInspectPlayer,
  onOpenChallenge,
  onQuickReport,
  onNavigateRoute,
}: Readonly<{
  inspectingId: string;
  isDesktop: boolean;
  isViewingSelf: boolean;
  currentUser: ReturnType<typeof useAuth>['data'];
  onClose: () => void;
  onInspectPlayer: (targetId: string) => void;
  onOpenChallenge: (player: PlayerProfileData, hasExisting: boolean) => void;
  onQuickReport: (targetId: string) => void;
  onNavigateRoute: (url: string) => void;
}>) {
  const canShowH2H = Boolean(currentUser && !isViewingSelf);
  const [selectedMainTab, setSelectedMainTab] = useState<DrawerMainTab>('h2h');
  const activeMainTab: DrawerMainTab = canShowH2H ? selectedMainTab : 'scouting';

  const mainTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const h2hTabId = useId();
  const scoutingTabId = useId();

  const { data: myChallenges } = useMyChallenges(canShowH2H);
  const existingChallenge = myChallenges?.active.find(
    (ch) =>
      (ch.challenger?.id === currentUser?.id && ch.challenged?.id === inspectingId) ||
      (ch.challenged?.id === currentUser?.id && ch.challenger?.id === inspectingId),
  );

  const { data: player, isPending: isLoading } = useQuery({
    queryKey: ['users', 'profile', inspectingId],
    queryFn: async () => {
      const res = await apiClient.get<PlayerProfileData>(`/users/${inspectingId}/profile`);
      return res.data;
    },
    enabled: Boolean(inspectingId),
  });

  const { data: h2hData, isPending: isH2HLoading } = useQuery({
    queryKey: ['users', 'h2h', inspectingId],
    queryFn: async () => {
      const res = await apiClient.get<H2HResponse>(`/users/${inspectingId}/h2h`);
      return res.data;
    },
    enabled: canShowH2H,
  });

  const { data: myStats } = useQuery({
    queryKey: ['users', 'me', 'stats', 'all'],
    queryFn: async () => {
      const res = await apiClient.get<PlayerStats>('/users/me/stats?interval=all');
      return res.data;
    },
    enabled: Boolean(canShowH2H && activeMainTab === 'scouting'),
    staleTime: 60_000,
  });

  if (isLoading || !player) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4 min-h-[340px]">
        <div className="size-10 border-4 border-border border-t-sapphire-blue rounded-full animate-spin" />
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
          讀取選手資料中...
        </p>
      </div>
    );
  }

  const tier = getTierBadge(player.rating, 12);
  const rankBadge = getRankBadgeStyle(player.rank, Boolean(player.is_placement));
  const recentForm = player.recent_form ?? [];
  const streak = player.current_streak ?? 0;

  const myMmr =
    h2hData?.matchup_preview?.my_mmr ??
    (typeof currentUser?.global_mmr === 'number'
      ? Math.round(currentUser.global_mmr)
      : typeof currentUser?.mmr === 'number'
        ? Math.round(currentUser.mmr)
        : null);
  const mmrGap = myMmr !== null ? Math.round(player.rating) - myMmr : null;

  const mainTabs: ReadonlyArray<{ id: DrawerMainTab; tabElId: string; label: string; badge?: number }> = [
    {
      id: 'h2h',
      tabElId: h2hTabId,
      label: '交手對決',
      badge: h2hData?.total_matches,
    },
    {
      id: 'scouting',
      tabElId: scoutingTabId,
      label: '選手情報',
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. Compact Broadcast Hero Header */}
      <header className="arena-hero-surface px-4 pt-4 pb-3.5 sm:px-5 sm:pt-5 sm:pb-4 text-foreground border-b border-blue-200/70 dark:border-slate-700/80 relative shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <PlayerAvatar
                src={player.avatar}
                name={player.name}
                className="size-13 sm:size-15 rounded-2xl border-2 border-blue-200/80 dark:border-white/20 shadow-md text-lg"
              />
              <span
                aria-label={rankBadge.ariaText}
                className={cn(
                  'absolute -left-1.5 -top-1.5 flex items-center justify-center rounded-full border-2 ring-2 ring-background font-display font-black tabular-nums shadow-sm leading-none',
                  rankBadge.textLabel === '定級'
                    ? 'px-1.5 h-6 text-[10px]'
                    : 'size-6 sm:size-7 text-[11px] sm:text-xs',
                  rankBadge.containerClass,
                )}
              >
                {rankBadge.textLabel}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-display font-black tracking-tight text-foreground leading-tight truncate">
                  {player.name}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-black shrink-0',
                    tier.color,
                  )}
                >
                  {tier.icon}
                  {tier.name}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-muted-foreground mt-1 truncate">
                {formatEquipmentLine(player)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl sm:text-[26px] font-display font-black text-foreground tabular-nums leading-none">
                  {Math.round(player.rating)}
                </span>
                <span className="text-xs font-black text-muted-foreground">分</span>
              </div>
              {canShowH2H && mmrGap !== null && (
                <span
                  className={cn(
                    'mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums',
                    mmrGap > 0
                      ? 'bg-orange-500/12 text-orange-600 dark:text-orange-300'
                      : mmrGap < 0
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {mmrGap > 0
                    ? `高你 ${mmrGap} 分`
                    : mmrGap < 0
                      ? `低你 ${Math.abs(mmrGap)} 分`
                      : '與你同分'}
                </span>
              )}
            </div>

            {isDesktop && (
              <button
                type="button"
                aria-label="關閉玩家資料"
                onClick={onClose}
                className="size-9 min-h-9 min-w-9 flex items-center justify-center rounded-full bg-secondary/90 hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/20 transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue focus-visible:outline-offset-2"
              >
                <X className="size-4 text-foreground" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* 近 5 場正圓手感 + 連勝/戰績摘要 Strip */}
        <div className="mt-3 pt-2.5 border-t border-blue-200/50 dark:border-slate-700/60 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5"
            aria-label="近 5 場勝負（由左至右為最新到較舊）"
          >
            <span className="text-[11px] font-black text-muted-foreground mr-0.5 shrink-0">
              近 5 場
            </span>
            {Array.from({ length: 5 }).map((_, idx) => {
              const res = recentForm[idx];
              const label = res === 'W' ? '勝' : res === 'L' ? '敗' : '-';
              return (
                <span
                  key={idx}
                  className={cn(
                    'size-5.5 sm:size-6 rounded-full shrink-0 flex items-center justify-center font-display font-black text-[10px] leading-none select-none',
                    res === 'W'
                      ? cn('bg-emerald-500 text-white', idx === 0 && 'ring-2 ring-emerald-500/35')
                      : res === 'L'
                        ? cn('bg-rose-500 text-white', idx === 0 && 'ring-2 ring-rose-500/35')
                        : 'border border-dashed border-border bg-surface-subtle/80 text-muted-foreground/45',
                  )}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <div className="shrink-0">
            {Math.abs(streak) >= 2 ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums',
                  streak > 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
                )}
              >
                {streak > 0 && <Flame size={11} aria-hidden="true" />}
                {streak > 0 ? `${streak} 連勝` : `${Math.abs(streak)} 連敗`}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                生涯 {player.stats.wins}勝 {player.stats.losses}敗
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Top-Level Segmented Tabs (僅看其他人時出現，WAI-ARIA Tablist + 底線標示) */}
      {canShowH2H && (
        <div
          role="tablist"
          aria-label="檢視視角切換"
          className="grid grid-cols-2 border-b border-border bg-card shrink-0"
        >
          {mainTabs.map((tab, idx) => {
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  mainTabRefs.current[idx] = el;
                }}
                id={tab.tabElId}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setSelectedMainTab(tab.id)}
                onKeyDown={(e) =>
                  handleRovingTabKeyDown(
                    e,
                    ['h2h', 'scouting'] as const,
                    idx,
                    setSelectedMainTab,
                    mainTabRefs,
                  )
                }
                className={cn(
                  'relative min-h-11 px-3 py-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue focus-visible:-outline-offset-2',
                  isActive
                    ? "text-sapphire-blue dark:text-blue-300 after:content-[''] after:absolute after:inset-x-4 after:bottom-0 after:border-b-[3px] after:border-sapphire-blue dark:after:border-blue-400"
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.id === 'h2h' ? (
                  <Swords size={14} aria-hidden="true" />
                ) : (
                  <RadarIcon size={14} aria-hidden="true" />
                )}
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-display font-black tabular-nums leading-none',
                      isActive
                        ? 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-400/20 dark:text-blue-200'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Scrollable Tab Panel */}
      <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-5 bg-surface-shell">
        {activeMainTab === 'h2h' && canShowH2H ? (
          <div role="tabpanel" aria-labelledby={h2hTabId} className="space-y-4">
            <H2HComparisonPanel
              key={inspectingId}
              targetId={player.id}
              targetName={player.name}
              data={h2hData}
              isLoading={isH2HLoading}
              onJumpToMatch={(matchId) => onNavigateRoute(`/history?scope=mine&matchId=${encodeURIComponent(matchId)}`)}
              onJumpToAllHistory={(role, matchType) => {
                const params = new URLSearchParams({
                  scope: 'mine',
                  playerId: player.id,
                  playerName: player.name,
                  role,
                });
                if (matchType !== 'all') {
                  params.set('matchType', matchType);
                }
                onNavigateRoute(`/history?${params.toString()}`);
              }}
            />
          </div>
        ) : (
          <div
            role={canShowH2H ? 'tabpanel' : undefined}
            aria-labelledby={canShowH2H ? scoutingTabId : undefined}
            className="space-y-4"
          >
            <ScoutingPanel
              player={player}
              myStats={myStats}
              isViewingSelf={isViewingSelf}
              isDesktop={isDesktop}
              onInspectPlayer={onInspectPlayer}
            />
          </div>
        )}
      </div>

      {/* 4. Sticky Action Footer */}
      <footer className="p-3.5 sm:p-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-popover shrink-0 flex items-center gap-2.5">
        {canShowH2H ? (
          <>
            <Button
              type="button"
              onClick={() => onOpenChallenge(player, Boolean(existingChallenge))}
              className="flex-1 min-h-11 rounded-xl bg-gradient-to-r from-smash-orange to-orange-600 hover:opacity-95 text-white font-display font-black text-sm gap-1.5 shadow-sm"
            >
              <Swords size={16} aria-hidden="true" />
              {existingChallenge ? '查看進行中戰帖' : `向 ${player.name} 發起挑戰`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onQuickReport(inspectingId)}
              className="min-h-11 px-4 rounded-xl border-sapphire-blue/35 text-sapphire-blue hover:bg-blue-50 dark:hover:bg-blue-500/15 font-black text-sm gap-1.5 shrink-0"
            >
              <Plus size={15} aria-hidden="true" />
              直接報分
            </Button>
          </>
        ) : isViewingSelf ? (
          <>
            <Button
              type="button"
              onClick={() => onNavigateRoute('/')}
              className="flex-1 min-h-11 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm gap-1.5"
            >
              <LayoutDashboard size={16} aria-hidden="true" />
              前往個人戰情室
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-11 px-4 rounded-xl font-black text-sm shrink-0"
            >
              關閉
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black text-sm"
          >
            關閉檔案
          </Button>
        )}
      </footer>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 分頁一：交手對決 (雙打優先 + 規則盤口 + 明細可點跳轉)
 * ─────────────────────────────────────────────────────────────────────────── */
function H2HComparisonPanel({
  targetId,
  targetName,
  data,
  isLoading,
  onJumpToMatch,
  onJumpToAllHistory,
}: Readonly<{
  targetId: string;
  targetName: string;
  data?: H2HResponse;
  isLoading: boolean;
  onJumpToMatch: (matchId: string) => void;
  onJumpToAllHistory: (role: 'any' | 'rival' | 'partner', matchType: 'all' | 'singles' | 'doubles') => void;
}>) {
  const [selectedTab, setSelectedTab] = useState<H2HTab | null>(null);
  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const subTabBaseId = useId();

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
        <div className="h-5 w-40 bg-secondary rounded" />
        <div className="h-11 bg-secondary rounded-xl" />
        <div className="h-24 bg-secondary rounded-xl" />
        <div className="h-32 bg-secondary rounded-xl" />
      </div>
    );
  }

  if (!data || data.is_self) return null;

  const preview = data.matchup_preview;

  // 零交手冷啟動：直接轉化成「組隊雙打 + 單打 BO3 盤口」雙卡邀請，不出現 0/0/0 空白框
  if (data.total_matches === 0) {
    return <ZeroMatchupInviteCard targetName={targetName} preview={preview} />;
  }

  // 智慧預設次分頁：優先場次最多，同場次依雙打優先順序 (doubles_vs -> doubles_with -> singles_vs)
  const priorityOrder: H2HTab[] = ['doubles_vs', 'doubles_with', 'singles_vs'];
  const defaultTab = priorityOrder.reduce<H2HTab>((best, candidate) => {
    return data[candidate].matches > data[best].matches ? candidate : best;
  }, 'doubles_vs');

  const activeTab = selectedTab ?? defaultTab;
  const bucket: H2HBucket = data[activeTab];
  const isPartnerTab = activeTab === 'doubles_with';
  const bucketStreak = bucket.streak ?? 0;

  const subTabs: ReadonlyArray<{ id: H2HTab; label: string; count: number }> = [
    { id: 'doubles_vs', label: '雙打對陣', count: data.doubles_vs.matches },
    { id: 'doubles_with', label: '同隊搭檔', count: data.doubles_with.matches },
    { id: 'singles_vs', label: '單打對決', count: data.singles_vs.matches },
  ];

  const handleViewAll = () => {
    if (activeTab === 'doubles_with') {
      onJumpToAllHistory('partner', 'doubles');
    } else if (activeTab === 'doubles_vs') {
      onJumpToAllHistory('rival', 'doubles');
    } else if (activeTab === 'singles_vs') {
      onJumpToAllHistory('rival', 'singles');
    } else {
      onJumpToAllHistory('any', 'all');
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
      {/* 次分頁列 (雙打對陣 / 同隊搭檔 / 單打對決) */}
      <div
        role="tablist"
        aria-label="交手模式分類"
        className="flex items-stretch border-b border-border bg-surface-subtle/60 overflow-x-auto no-scrollbar"
      >
        {subTabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                subTabRefs.current[idx] = el;
              }}
              id={`${subTabBaseId}-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSelectedTab(tab.id)}
              onKeyDown={(e) =>
                handleRovingTabKeyDown(
                  e,
                  ['doubles_vs', 'doubles_with', 'singles_vs'] as const,
                  idx,
                  setSelectedTab,
                  subTabRefs,
                )
              }
              className={cn(
                'relative flex-1 min-w-[96px] min-h-10 px-2.5 py-2 flex items-center justify-center gap-1.5 text-xs font-black whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue focus-visible:-outline-offset-2',
                isActive
                  ? "text-foreground bg-card after:content-[''] after:absolute after:inset-x-3 after:bottom-0 after:border-b-[3px] after:border-sapphire-blue dark:after:border-blue-400"
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'font-display tabular-nums text-[11px]',
                  isActive ? 'text-sapphire-blue dark:text-blue-300' : 'text-muted-foreground/75',
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 次分頁面板（單一扁平容器，無內層套娃卡片） */}
      <div
        role="tabpanel"
        aria-labelledby={`${subTabBaseId}-${activeTab}`}
        className="p-4 space-y-4"
      >
        {bucket.matches === 0 ? (
          <EmptySubBucketState
            activeTab={activeTab}
            targetName={targetName}
            preview={preview}
          />
        ) : (
          <>
            {/* 大比分與淨分區 */}
            <div className="space-y-2.5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-1.5 font-display font-black leading-none">
                    <span className="text-2xl sm:text-[26px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {bucket.wins}勝
                    </span>
                    <span className="text-lg text-muted-foreground/45">·</span>
                    <span className="text-2xl sm:text-[26px] text-rose-500 dark:text-rose-400 tabular-nums">
                      {bucket.losses}敗
                    </span>
                  </div>
                  <p className="text-xs font-bold text-muted-foreground mt-1 tabular-nums">
                    {isPartnerTab ? '同隊搭檔勝率' : '雙方交手勝率'}{' '}
                    <span className="font-black text-foreground">{bucket.win_rate}%</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                    累計淨得分
                  </span>
                  <span
                    className={cn(
                      'text-lg sm:text-xl font-display font-black tabular-nums leading-tight',
                      bucket.net_mmr > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : bucket.net_mmr < 0
                          ? 'text-rose-500 dark:text-rose-400'
                          : 'text-foreground',
                    )}
                  >
                    {bucket.net_mmr > 0 ? `+${bucket.net_mmr}` : bucket.net_mmr} 分
                  </span>
                </div>
              </div>

              {/* 對比比例條 */}
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${bucket.win_rate}%` }}
                />
                <div
                  className="h-full bg-rose-400 transition-all duration-500"
                  style={{ width: `${100 - bucket.win_rate}%` }}
                />
              </div>

              {/* 動態情資條（氣勢 + 雙打合體/單打盤口事實） */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black tabular-nums',
                    bucketStreak >= 2
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : bucketStreak <= -2
                        ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
                        : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {bucketStreak >= 2
                    ? `近期 ${bucketStreak} 連勝`
                    : bucketStreak <= -2
                      ? `近期 ${Math.abs(bucketStreak)} 連敗`
                      : `共 ${bucket.matches} 場紀錄`}
                </span>

                {isPartnerTab && preview && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-sapphire-blue dark:text-blue-300 font-black tabular-nums">
                      <Handshake size={11} aria-hidden="true" />
                      合體均強 {preview.combined_team_mmr} 分
                    </span>
                    {preview.hand_synergy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black">
                        <Sparkles size={11} aria-hidden="true" />
                        左右手黃金配對
                      </span>
                    )}
                  </div>
                )}

                {activeTab === 'singles_vs' && preview && (
                  <span className="font-bold text-muted-foreground tabular-nums">
                    BO3 贏{' '}
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {formatRangeText(preview.singles_bo3.win_2_1, preview.singles_bo3.win_2_0, true)}
                    </span>
                    {' / 輸 '}
                    <span className="font-black text-rose-500 dark:text-rose-400">
                      {formatRangeText(preview.singles_bo3.lose_0_2, preview.singles_bo3.lose_1_2)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* 近期交手明細清單 (最多 5 場，可點擊直接跳轉該場詳情) */}
            {bucket.recent.length > 0 && (
              <div className="pt-1 border-t border-border">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider pt-2 pb-1">
                  近期交手明細（點擊跳至戰報）
                </p>
                <ul className="divide-y divide-border">
                  {bucket.recent.map((m) => (
                    <li key={m.id}>
                      <H2HRecentMatchRow
                        match={m}
                        activeTab={activeTab}
                        targetId={targetId}
                        onSelect={() => onJumpToMatch(m.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* 底部一鍵前往全部交手紀錄（會自動帶入此對象篩選） */}
        <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onJumpToAllHistory('any', 'all')}
            className="min-h-10 px-2 -mx-2 rounded-xl text-xs font-black text-sapphire-blue dark:text-blue-300 hover:bg-blue-50/70 dark:hover:bg-blue-500/10 inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue"
          >
            <History size={14} aria-hidden="true" />
            <span>查看與 {targetName} 的全部 {data.total_matches} 場紀錄</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>

          {bucket.matches > 0 && bucket.matches < data.total_matches && (
            <button
              type="button"
              onClick={handleViewAll}
              className="min-h-10 px-2 rounded-xl text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              僅看本項 ({bucket.matches})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ZeroMatchupInviteCard({
  targetName,
  preview,
}: Readonly<{
  targetName: string;
  preview?: H2HMatchupPreview | null;
}>) {
  const gap = preview?.mmr_gap ?? 0;
  const gapBadge =
    gap >= 60
      ? { label: '越級挑戰', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' }
      : gap <= -60
        ? { label: '積分領先', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' }
        : { label: '勢均力敵', cls: 'bg-blue-500/15 text-sapphire-blue dark:text-blue-300' };

  const placementHint = preview?.my_is_placement || preview?.target_is_placement;

  return (
    <section
      aria-label="首次交手規則預覽"
      className="bg-card border border-border rounded-2xl p-4 space-y-3.5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-7 rounded-xl bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Swords size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-black text-foreground truncate">
              尚未與 {targetName} 同場出賽
            </h3>
            <p className="text-[11px] font-bold text-muted-foreground">
              依現行積分規則預覽組隊與單打盤口
            </p>
          </div>
        </div>

        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-black shrink-0',
            gapBadge.cls,
          )}
        >
          {gapBadge.label}
        </span>
      </div>

      {preview && (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5">
          {/* 組隊雙打預覽 */}
          <div className="rounded-xl bg-surface-subtle border border-border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-sapphire-blue dark:text-blue-300">
              <Handshake size={14} aria-hidden="true" />
              <span>組隊雙打戰力</span>
            </div>
            <p className="text-lg font-display font-black text-foreground tabular-nums leading-tight">
              均強 {preview.combined_team_mmr} 分
            </p>
            {preview.hand_synergy ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                <Sparkles size={10} aria-hidden="true" />
                左右手黃金配對
              </span>
            ) : (
              <p className="text-[11px] font-bold text-muted-foreground tabular-nums">
                你 {preview.my_mmr} + 他 {preview.target_mmr} 分均分
              </p>
            )}
          </div>

          {/* 單打 BO3 盤口預覽 */}
          <div className="rounded-xl bg-surface-subtle border border-border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-xs font-black text-foreground">
              <span className="inline-flex items-center gap-1">
                <Swords size={13} className="text-smash-orange" aria-hidden="true" />
                單打 BO3 盤口
              </span>
              {placementHint && (
                <span className="text-[10px] font-black text-sapphire-blue dark:text-blue-300">
                  含定級加成
                </span>
              )}
            </div>
            <div className="space-y-0.5 text-xs font-black tabular-nums">
              <p className="text-emerald-600 dark:text-emerald-400">
                贏 {formatRangeText(preview.singles_bo3.win_2_1, preview.singles_bo3.win_2_0, true)}
              </p>
              <p className="text-rose-500 dark:text-rose-400">
                輸 {formatRangeText(preview.singles_bo3.lose_0_2, preview.singles_bo3.lose_1_2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs font-bold text-muted-foreground text-center pt-0.5">
        點下方「向 {targetName} 發起挑戰」，開啟你們的第一場正式交鋒！
      </p>
    </section>
  );
}

function EmptySubBucketState({
  activeTab,
  targetName,
  preview,
}: Readonly<{
  activeTab: H2HTab;
  targetName: string;
  preview?: H2HMatchupPreview | null;
}>) {
  return (
    <div className="py-6 px-4 text-center rounded-xl bg-surface-subtle/70 border border-dashed border-border space-y-2">
      <p className="text-xs font-black text-foreground">
        {activeTab === 'doubles_with'
          ? `尚未與 ${targetName} 同隊搭檔出賽`
          : activeTab === 'doubles_vs'
            ? `尚未在雙打場與 ${targetName} 隔網對陣`
            : `尚未與 ${targetName} 進行過單打對決`}
      </p>
      {activeTab === 'doubles_with' && preview && (
        <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-bold text-muted-foreground">
          <span>
            合體雙打均強{' '}
            <strong className="font-display font-black text-sapphire-blue dark:text-blue-300 tabular-nums">
              {preview.combined_team_mmr} 分
            </strong>
          </span>
          {preview.hand_synergy && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black">
              <Sparkles size={10} aria-hidden="true" />
              左右手黃金配對
            </span>
          )}
        </div>
      )}
      {activeTab === 'singles_vs' && preview && (
        <p className="text-[11px] font-bold text-muted-foreground tabular-nums">
          BO3 單打盤口：贏{' '}
          <span className="font-black text-emerald-600 dark:text-emerald-400">
            {formatRangeText(preview.singles_bo3.win_2_1, preview.singles_bo3.win_2_0, true)}
          </span>
          {' / 輸 '}
          <span className="font-black text-rose-500 dark:text-rose-400">
            {formatRangeText(preview.singles_bo3.lose_0_2, preview.singles_bo3.lose_1_2)}
          </span>
        </p>
      )}
      {activeTab === 'doubles_vs' && (
        <p className="text-[11px] font-bold text-muted-foreground">
          雙打會依四位球員平均積分與 0.85x 團隊係數共同結算
        </p>
      )}
    </div>
  );
}

function H2HRecentMatchRow({
  match,
  activeTab,
  targetId,
  onSelect,
}: Readonly<{
  match: H2HRecentMatch;
  activeTab: H2HTab;
  targetId: string;
  onSelect: () => void;
}>) {
  const oppsText =
    match.opponents && match.opponents.length > 0
      ? match.opponents.map((o) => o.name).join(' + ')
      : '';

  let lineupSummary = '';
  if (activeTab === 'doubles_vs') {
    const partnerLabel = match.my_partner ? `搭 ${match.my_partner.name}` : '';
    const oppLabel = oppsText ? `vs ${oppsText}` : '';
    lineupSummary = [partnerLabel, oppLabel].filter(Boolean).join(' · ');
  } else if (activeTab === 'doubles_with') {
    const partnerDiff =
      match.my_partner && match.my_partner.id !== targetId
        ? `搭 ${match.my_partner.name}`
        : '';
    const oppLabel = oppsText ? `vs ${oppsText}` : '';
    lineupSummary = [partnerDiff, oppLabel].filter(Boolean).join(' · ');
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full min-h-12 py-2.5 px-1.5 -mx-1.5 rounded-xl flex items-center justify-between gap-2.5 text-left hover:bg-surface-subtle/80 transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            'size-6 rounded-full shrink-0 flex items-center justify-center font-display font-black text-[11px] leading-none',
            match.is_winner
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white',
          )}
        >
          {match.is_winner ? '勝' : '敗'}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <span className="tabular-nums text-muted-foreground">
              {formatLocalTime(match.date, 'MM/dd')}
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
              {match.format}
            </span>
          </div>
          {lineupSummary && (
            <p className="text-[11px] font-bold text-muted-foreground truncate mt-0.5">
              {lineupSummary}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-display font-black text-sm text-foreground tabular-nums">
          {match.my_score} : {match.opp_score}
        </span>
        <span
          className={cn(
            'font-display font-black text-xs tabular-nums min-w-[3.25rem] text-right',
            match.mmr_delta >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400',
          )}
        >
          {match.mmr_delta > 0 ? `+${match.mmr_delta}` : match.mmr_delta} 分
        </span>
        <ChevronRight size={14} className="text-muted-foreground/60" aria-hidden="true" />
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * 分頁二：選手情報 (整合 KPI + 我 vs 對手雙人雷達 + 走勢圖 + 搭檔天敵)
 * ─────────────────────────────────────────────────────────────────────────── */
function ScoutingPanel({
  player,
  myStats,
  isViewingSelf,
  isDesktop,
  onInspectPlayer,
}: Readonly<{
  player: PlayerProfileData;
  myStats?: PlayerStats;
  isViewingSelf: boolean;
  isDesktop: boolean;
  onInspectPlayer: (targetId: string) => void;
}>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const totalMatches = player.stats.wins + player.stats.losses;
  const singlesCount = player.format_split?.singles.matches ?? 0;
  const doublesCount = player.format_split?.doubles.matches ?? 0;
  const peakRating = player.peak_rating ?? Math.round(player.rating);
  const currentRounded = Math.round(player.rating);

  const radarBlock = player.radar;
  const myAxes = !isViewingSelf ? myStats?.analytics?.radar : undefined;
  const hasMyOverlay = Boolean(myAxes && myAxes.length === radarBlock?.axes?.length);

  const radarChartData = useMemo(() => {
    if (!radarBlock?.axes) return [];
    return radarBlock.axes.map((ax, idx) => ({
      label: ax.label,
      targetScore: ax.score,
      myScore: myAxes?.[idx]?.score ?? null,
      detail: ax.detail,
    }));
  }, [radarBlock, myAxes]);

  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.22)';
  const labelColor = isDark ? '#e2e8f0' : '#334155';
  const targetStroke = isDark ? '#60a5fa' : '#2563eb';
  const myStroke = isDark ? '#fb923c' : '#ea580c';

  return (
    <div className="space-y-4">
      {/* 1. 整合式三欄 KPI（單卡，避免碎片感） */}
      <div className="rounded-2xl bg-card border border-border grid grid-cols-3 divide-x divide-border shadow-xs">
        <div className="p-3 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <TrendingUp size={12} className="text-emerald-500" aria-hidden="true" />
            生涯勝率
          </p>
          <p className="text-lg sm:text-xl font-display font-black text-foreground tabular-nums mt-0.5 leading-tight">
            {player.stats.winRate}%
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-0.5 tabular-nums">
            {player.stats.wins}勝 {player.stats.losses}敗
          </p>
        </div>

        <div className="p-3 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <Swords size={12} className="text-sapphire-blue" aria-hidden="true" />
            總出賽數
          </p>
          <p className="text-lg sm:text-xl font-display font-black text-foreground tabular-nums mt-0.5 leading-tight">
            {totalMatches}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-0.5 tabular-nums">
            {player.format_split ? `雙${doublesCount} · 單${singlesCount}` : '已結算場次'}
          </p>
        </div>

        <div className="p-3 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <Trophy size={12} className="text-olympic-gold" aria-hidden="true" />
            生涯巔峰
          </p>
          <p className="text-lg sm:text-xl font-display font-black text-foreground tabular-nums mt-0.5 leading-tight">
            {peakRating} <span className="text-xs font-bold text-muted-foreground">分</span>
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-0.5 tabular-nums">
            {peakRating <= currentRounded ? '目前即為巔峰' : `距巔峰差 ${peakRating - currentRounded} 分`}
          </p>
        </div>
      </div>

      {/* 2. 雙人重疊五維雷達圖（我 vs 對手） */}
      {radarBlock && radarChartData.length > 0 && (
        <section
          aria-label="五維球風雷達對比"
          className="rounded-2xl bg-card border border-border p-3.5 sm:p-4 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <RadarIcon size={14} className="text-sapphire-blue" aria-hidden="true" />
              五維球風雷達
            </h3>

            <div className="flex items-center gap-2.5 text-[11px] font-black">
              <span className="inline-flex items-center gap-1 text-foreground">
                <span className="size-2.5 rounded-full bg-sapphire-blue" />
                {player.name}
              </span>
              {hasMyOverlay && (
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-300">
                  <span className="w-3 border-t-2 border-dashed border-orange-500 dark:border-orange-400" />
                  我
                </span>
              )}
            </div>
          </div>

          {!radarBlock.unlocked && (
            <div className="rounded-xl border border-dashed border-sapphire-blue/35 bg-sapphire-blue/[0.05] dark:bg-blue-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground">
                <Lock size={12} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                預覽輪廓：已結算 {radarBlock.settled_count}/{radarBlock.unlock_required} 場
              </span>
            </div>
          )}

          <div
            className={cn(
              'h-[235px] sm:h-[250px] w-full',
              !radarBlock.unlocked && 'opacity-75',
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="60%"
                margin={{ top: 14, right: 34, bottom: 14, left: 34 }}
                data={radarChartData}
              >
                <PolarGrid stroke={gridStroke} />
                <PolarAngleAxis
                  dataKey="label"
                  tickLine={false}
                  tick={{ fill: labelColor, fontSize: 11, fontWeight: 800 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as
                      | { label: string; targetScore: number; myScore: number | null; detail: string }
                      | undefined;
                    if (!active || !row) return null;
                    return (
                      <div className="bg-popover p-2.5 rounded-xl shadow-lg border border-border text-xs space-y-1">
                        <p className="font-display font-black text-foreground">{row.label}</p>
                        <p className="font-bold text-sapphire-blue dark:text-blue-300 tabular-nums">
                          {player.name}：{row.targetScore} 分
                        </p>
                        {row.myScore !== null && (
                          <p className="font-bold text-orange-600 dark:text-orange-300 tabular-nums">
                            我：{row.myScore} 分
                          </p>
                        )}
                        <p className="text-[11px] font-bold text-muted-foreground">{row.detail}</p>
                      </div>
                    );
                  }}
                />
                <Radar
                  name={player.name}
                  dataKey="targetScore"
                  stroke={targetStroke}
                  strokeWidth={2}
                  fill={targetStroke}
                  fillOpacity={0.22}
                />
                {hasMyOverlay && (
                  <Radar
                    name="我"
                    dataKey="myScore"
                    stroke={myStroke}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill={myStroke}
                    fillOpacity={0.08}
                  />
                )}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 輔助技術無障礙數據表 */}
          <table className="sr-only">
            <caption>{player.name} 與個人五維球風分數對比</caption>
            <thead>
              <tr>
                <th scope="col">維度</th>
                <th scope="col">{player.name}</th>
                {hasMyOverlay && <th scope="col">我</th>}
                <th scope="col">說明</th>
              </tr>
            </thead>
            <tbody>
              {radarChartData.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.targetScore} 分</td>
                  {hasMyOverlay && <td>{row.myScore ?? '-'} 分</td>}
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 3. 近期實力波動趨勢 */}
      <section aria-label="近期積分走勢" className="space-y-2">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider ml-1">
          近期積分走勢
        </h3>
        <div className="w-full bg-card rounded-2xl p-3 sm:p-3.5 border border-border shadow-xs">
          <StatsChart
            data={player.chart_data}
            showCard={false}
            showHeader={false}
            height={isDesktop ? 165 : 145}
          />
        </div>
      </section>

      {/* 4. 關係圈 (最佳雙打搭檔 / 宿命天敵) */}
      {(player.goldenPartner.length > 0 || player.nemesis.length > 0) && (
        <div className="grid grid-cols-1 gap-3.5">
          {player.goldenPartner.length > 0 && (
            <RelationSection
              title="最佳雙打搭檔"
              tone="amber"
              icon={<Users size={13} aria-hidden="true" />}
              items={player.goldenPartner}
              onInspectPlayer={onInspectPlayer}
            />
          )}
          {player.nemesis.length > 0 && (
            <RelationSection
              title="宿命天敵"
              tone="rose"
              icon={<Swords size={13} aria-hidden="true" />}
              items={player.nemesis}
              onInspectPlayer={onInspectPlayer}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RelationSection({
  title,
  tone,
  icon,
  items,
  onInspectPlayer,
}: Readonly<{
  title: string;
  tone: 'amber' | 'rose';
  icon: React.ReactNode;
  items: PlayerPartnerItem[];
  onInspectPlayer: (targetId: string) => void;
}>) {
  const isAmber = tone === 'amber';
  return (
    <section className="space-y-2">
      <h3
        className={cn(
          'text-xs font-black uppercase tracking-wider ml-1 flex items-center gap-1.5',
          isAmber ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400',
        )}
      >
        {icon}
        {title}
      </h3>
      <ul className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden shadow-xs">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onInspectPlayer(p.id)}
              className="w-full min-h-12 px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-surface-subtle/80 transition-colors focus-visible:outline-2 focus-visible:outline-sapphire-blue focus-visible:-outline-offset-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  src={p.avatar}
                  name={p.name}
                  className={cn(
                    'size-9 rounded-xl border text-xs shrink-0',
                    isAmber
                      ? 'border-amber-200 dark:border-amber-500/30'
                      : 'border-rose-200 dark:border-rose-500/30',
                  )}
                />
                <div className="min-w-0">
                  <span className="text-sm font-black text-foreground truncate block">
                    {p.name}
                  </span>
                  {typeof p.wins === 'number' && typeof p.losses === 'number' && (
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                      {p.wins}勝 {p.losses}敗{typeof p.matches === 'number' ? ` · 共 ${p.matches} 場` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    'text-sm sm:text-base font-display font-black tabular-nums',
                    isAmber
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {p.winRate}%{' '}
                  <span className="text-[11px] font-sans font-bold text-muted-foreground">勝率</span>
                </span>
                <ChevronRight size={14} className="text-muted-foreground/60" aria-hidden="true" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
