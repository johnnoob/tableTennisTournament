import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Crosshair, Layers, Swords, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayerAvatar } from './PlayerAvatar';
import { useAuth } from '@/hooks/useAuth';
import { inferMatchFormat } from '@/lib/matchScore';
import {
  formatMatchClock,
  formatSmartMatchTime,
  type MatchSeriesCluster,
} from '@/lib/matchDate';

interface MatchPlayer {
  id?: string;
  name: string;
  avatar?: string | null;
}

interface MatchData {
  id: string;
  challenge_id?: string | null;
  date?: string;
  created_at?: string;
  score: [number, number];
  result: 'win' | 'loss';
  status: string;
  type?: string;
  tournament?: string;
  mmrChange?: [number, number];
  player1: MatchPlayer[];
  opponent: MatchPlayer[];
}

interface MatchItemProps {
  match: MatchData;
  variant?: 'feed' | 'personal';
  timeDisplay?: 'smart' | 'clock';
  enableDeepLinkFocus?: boolean;
}

function formatDelta(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function ChallengeTag({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="此場比賽源自約戰戰帖"
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-smash-orange/12 text-smash-orange dark:bg-orange-500/15 dark:text-orange-300 border border-smash-orange/25 font-semibold leading-none whitespace-nowrap shrink-0',
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs',
      )}
    >
      <Swords size={compact ? 11 : 12} aria-hidden="true" />
      約戰
    </span>
  );
}

function TeamAvatars({
  players,
  onInspect,
  avatarClassName,
  overlapClassName,
  placeholderClassName,
  wonRing,
}: {
  players: MatchPlayer[];
  onInspect: (id?: string) => void;
  avatarClassName: string;
  overlapClassName: string;
  placeholderClassName: string;
  wonRing?: boolean;
}) {
  if (players.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl bg-secondary animate-pulse shrink-0',
          placeholderClassName,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onInspect(players[0]?.id);
      }}
      disabled={!players[0]?.id}
      aria-label={`檢視 ${players[0]?.name || '選手'} 戰情檔案`}
      className={cn(
        'flex shrink-0 group/team rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue',
        players.length > 1 && overlapClassName,
      )}
    >
      {players.map((p, i) => (
        <PlayerAvatar
          key={p.id || i}
          src={p.avatar}
          name={p.name}
          className={cn(
            avatarClassName,
            'border border-border group-hover/team:ring-2 group-hover/team:ring-sapphire-blue/60 transition-all',
            wonRing && 'ring-2 ring-emerald-500/40',
          )}
        />
      ))}
    </button>
  );
}

function TeamNames({
  players,
  onInspect,
  className,
  align = 'left',
  stacked = false,
}: {
  players: MatchPlayer[];
  onInspect: (id?: string) => void;
  className?: string;
  align?: 'left' | 'right';
  stacked?: boolean;
}) {
  if (players.length === 0) {
    return (
      <span className="font-display font-bold text-muted-foreground text-xs sm:text-sm">
        載入中...
      </span>
    );
  }

  if (players.length === 1) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInspect(players[0]?.id);
        }}
        disabled={!players[0]?.id}
        className={cn(
          'leading-snug transition-colors hover:text-sapphire-blue break-words',
          align === 'right' ? 'text-right' : 'text-left',
          className,
        )}
      >
        {players[0].name}
      </button>
    );
  }

  if (stacked) {
    return (
      <div
        className={cn(
          'flex flex-col gap-0.5 min-w-0',
          align === 'right' ? 'items-end' : 'items-start',
        )}
      >
        {players.map((p, idx) => (
          <button
            key={p.id || idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(p.id);
            }}
            disabled={!p.id}
            className={cn(
              'leading-tight transition-colors hover:text-sapphire-blue whitespace-nowrap',
              align === 'right' ? 'text-right' : 'text-left',
              className,
            )}
          >
            {p.name || '?'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center flex-wrap gap-x-1 gap-y-0.5 min-w-0',
        align === 'right' && 'justify-end',
      )}
    >
      {players.map((p, idx) => (
        <span key={p.id || idx} className="inline-flex items-center min-w-0">
          {idx > 0 && <span className="text-muted-foreground/45 mr-1 shrink-0">/</span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(p.id);
            }}
            disabled={!p.id}
            className={cn(
              'leading-tight transition-colors hover:text-sapphire-blue whitespace-nowrap',
              className,
            )}
          >
            {p.name || '?'}
          </button>
        </span>
      ))}
    </div>
  );
}

function HighlightFocusBanner({
  shortId,
  label = '通知定位場次',
  onClear,
}: {
  shortId: string;
  label?: string;
  onClear: () => void;
}) {
  return (
    <div className="bg-sapphire-blue/10 dark:bg-blue-500/18 border-b border-sapphire-blue/25 px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-sapphire-blue dark:text-blue-300 min-w-0">
        <Crosshair size={13} className="shrink-0 animate-pulse" aria-hidden="true" />
        <span className="truncate">
          {label} · #{shortId}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="inline-flex items-center gap-1 min-h-7 px-2.5 py-1 rounded-md bg-card/90 hover:bg-card border border-border/80 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <span>清除定位</span>
        <X size={11} aria-hidden="true" />
      </button>
    </div>
  );
}

export function MatchItem({
  match,
  variant = 'feed',
  timeDisplay = 'smart',
  enableDeepLinkFocus = true,
}: Readonly<MatchItemProps>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const highlightMatchId = enableDeepLinkFocus ? searchParams.get('matchId') : null;
  const isHighlighted = Boolean(
    highlightMatchId && String(match.id) === String(highlightMatchId),
  );

  const clearHighlight = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('matchId');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!isHighlighted || !rootRef.current) return;
    const timer = window.setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [isHighlighted]);

  const openInspect = (playerId?: string) => {
    if (!playerId) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const score = match?.score || [0, 0];
  const player1 = match?.player1 || [];
  const opponent = match?.opponent || [];
  const p1Change = match?.mmrChange?.[0] ?? 0;
  const p2Change = match?.mmrChange?.[1] ?? 0;

  const isDoubles = match?.type === 'doubles';
  const matchFormat = inferMatchFormat(score[0], score[1]);
  const isPending = match?.status === 'pending';
  const isDisputed = match?.status === 'disputed';
  const isSettled = match?.status === 'confirmed' || match?.status === 'completed';

  const p1Won = score[0] > score[1];
  const p2Won = score[1] > score[0];

  const rawDate = match?.date || match?.created_at;
  const displayTime =
    timeDisplay === 'clock' ? formatMatchClock(rawDate) : formatSmartMatchTime(rawDate);

  const myId = currentUser?.id ? String(currentUser.id) : null;
  const iAmInP1 = myId ? player1.some((p) => String(p.id) === myId) : false;
  const iAmInOpp = myId ? opponent.some((p) => String(p.id) === myId) : false;

  const useMyAsP1 = iAmInP1 || !iAmInOpp;
  const myTeam = useMyAsP1 ? player1 : opponent;
  const rivalTeam = useMyAsP1 ? opponent : player1;
  const myScore = useMyAsP1 ? score[0] : score[1];
  const rivalScore = useMyAsP1 ? score[1] : score[0];
  const myDelta = useMyAsP1 ? p1Change : p2Change;
  const iWon = myScore > rivalScore;

  const myPartner = isDoubles
    ? myTeam.find((p) => p.id && String(p.id) !== myId) ?? null
    : null;

  const handleShowDisputeInfo = () => {
    if (currentUser?.role === 'admin') {
      navigate('/admin?tab=matches&status=disputed');
      return;
    }
    toast.info('此場賽果已標記為爭議申訴，自動結算已暫停，正等待管理員裁決。');
  };

  if (variant === 'feed') {
    const typePill = isDoubles ? (
      <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap shrink-0">
        雙打
      </span>
    ) : (
      <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap shrink-0">
        單打
      </span>
    );

    const statusBadge = isPending ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap shrink-0 leading-none">
        待確認
      </span>
    ) : isDisputed ? (
      <button
        type="button"
        onClick={handleShowDisputeInfo}
        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors whitespace-nowrap shrink-0 leading-none"
      >
        申訴中
      </button>
    ) : null;

    return (
      <div
        id={`match-${match.id}`}
        ref={rootRef}
        className={cn(
          'transition-all hover:bg-surface-subtle/60 group',
          isHighlighted &&
            'ring-2 ring-inset ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/[0.06] dark:bg-blue-500/[0.12] relative z-[1]',
        )}
      >
        {isHighlighted && (
          <HighlightFocusBanner
            shortId={String(match.id).slice(0, 4)}
            onClear={clearHighlight}
          />
        )}
        {/* Desktop: Top Meta Strip + Full-Width Broadcast Matchup Stage (never truncates names) */}
        <div className="hidden md:block px-5 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="text-foreground/85 tabular-nums whitespace-nowrap">
                {displayTime}
              </span>
              <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              {typePill}
              {Boolean(match?.challenge_id) && <ChallengeTag compact />}
              {matchFormat === 'BO5' && (
                <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-semibold text-muted-foreground leading-none whitespace-nowrap shrink-0">
                  BO5
                </span>
              )}
            </div>
            {statusBadge && <div className="flex items-center gap-2 shrink-0">{statusBadge}</div>}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            {/* Team 1 */}
            <div className="flex items-center justify-end gap-3 min-w-0">
              {isSettled && p1Change !== 0 && (
                <span
                  className={cn(
                    'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                    p1Change > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400',
                  )}
                >
                  {formatDelta(p1Change)}
                </span>
              )}
              <TeamNames
                players={player1}
                onInspect={openInspect}
                align="right"
                stacked={isDoubles}
                className={cn(
                  'font-display text-sm sm:text-base',
                  p1Won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                )}
              />
              <TeamAvatars
                players={player1}
                onInspect={openInspect}
                avatarClassName="size-9 sm:size-10 rounded-xl text-xs sm:text-sm"
                overlapClassName="-space-x-2.5"
                placeholderClassName="size-9 sm:size-10"
                wonRing={p1Won && isSettled}
              />
            </div>

            {/* Center Score Pill */}
            <div className="min-w-[84px] px-3.5 py-1.5 rounded-xl bg-surface-subtle border border-border/80 flex items-center justify-center gap-1.5 font-display font-bold text-xl sm:text-2xl tabular-nums shrink-0 leading-none">
              <span className={p1Won ? 'text-foreground' : 'text-muted-foreground/60'}>
                {score[0]}
              </span>
              <span className="text-muted-foreground/40 text-sm">:</span>
              <span className={p2Won ? 'text-foreground' : 'text-muted-foreground/60'}>
                {score[1]}
              </span>
            </div>

            {/* Team 2 */}
            <div className="flex items-center justify-start gap-3 min-w-0">
              <TeamAvatars
                players={opponent}
                onInspect={openInspect}
                avatarClassName="size-9 sm:size-10 rounded-xl text-xs sm:text-sm"
                overlapClassName="-space-x-2.5"
                placeholderClassName="size-9 sm:size-10"
                wonRing={p2Won && isSettled}
              />
              <TeamNames
                players={opponent}
                onInspect={openInspect}
                align="left"
                stacked={isDoubles}
                className={cn(
                  'font-display text-sm sm:text-base',
                  p2Won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                )}
              />
              {isSettled && p2Change !== 0 && (
                <span
                  className={cn(
                    'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                    p2Change > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400',
                  )}
                >
                  {formatDelta(p2Change)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: Apple Sports Stacked 2-Row Scoreboard */}
        <div className="md:hidden px-3.5 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground min-w-0 flex-wrap">
              {typePill}
              {Boolean(match?.challenge_id) && <ChallengeTag compact />}
              {matchFormat === 'BO5' && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none whitespace-nowrap">
                  BO5
                </span>
              )}
              <span className="text-muted-foreground/40" aria-hidden="true">
                ·
              </span>
              <span className="tabular-nums truncate">{displayTime}</span>
            </div>
            {statusBadge && <div className="shrink-0">{statusBadge}</div>}
          </div>

          <div className="space-y-2">
            {/* Team 1 Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <TeamAvatars
                  players={player1}
                  onInspect={openInspect}
                  avatarClassName="size-8 rounded-lg text-xs"
                  overlapClassName="-space-x-2"
                  placeholderClassName="size-8"
                />
                <TeamNames
                  players={player1}
                  onInspect={openInspect}
                  align="left"
                  stacked={isDoubles}
                  className={cn(
                    'font-display text-sm sm:text-base',
                    p1Won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                  )}
                />
                {isSettled && p1Change !== 0 && (
                  <span
                    className={cn(
                      'text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                      p1Change > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400',
                    )}
                  >
                    {formatDelta(p1Change)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    p1Won ? 'bg-emerald-500' : 'bg-transparent',
                  )}
                />
                <span
                  className={cn(
                    'font-display font-bold text-xl tabular-nums w-6 text-right leading-none',
                    p1Won ? 'text-foreground' : 'text-muted-foreground/55',
                  )}
                >
                  {score[0]}
                </span>
              </div>
            </div>

            {/* Team 2 Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <TeamAvatars
                  players={opponent}
                  onInspect={openInspect}
                  avatarClassName="size-8 rounded-lg text-xs"
                  overlapClassName="-space-x-2"
                  placeholderClassName="size-8"
                />
                <TeamNames
                  players={opponent}
                  onInspect={openInspect}
                  align="left"
                  stacked={isDoubles}
                  className={cn(
                    'font-display text-sm sm:text-base',
                    p2Won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                  )}
                />
                {isSettled && p2Change !== 0 && (
                  <span
                    className={cn(
                      'text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                      p2Change > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400',
                    )}
                  >
                    {formatDelta(p2Change)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    p2Won ? 'bg-emerald-500' : 'bg-transparent',
                  )}
                />
                <span
                  className={cn(
                    'font-display font-bold text-xl tabular-nums w-6 text-right leading-none',
                    p2Won ? 'text-foreground' : 'text-muted-foreground/55',
                  )}
                >
                  {score[1]}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scheme B: OP.GG / Personal-Perspective History Card
  const railClass = isPending
    ? 'bg-amber-400'
    : isDisputed
      ? 'bg-rose-500'
      : iWon
        ? 'bg-emerald-500'
        : 'bg-rose-500';

  const resultLabel = isPending
    ? '待確認'
    : isDisputed
      ? '申訴中'
      : iWon
        ? '勝'
        : '敗';

  const resultColorClass = isPending
    ? 'text-amber-600 dark:text-amber-400'
    : isDisputed
      ? 'text-rose-600 dark:text-rose-400'
      : iWon
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const deltaNode = isPending ? (
    <span className="text-xs font-medium text-amber-600/85 dark:text-amber-300/85 whitespace-nowrap">
      待結算
    </span>
  ) : isDisputed ? (
    <span className="text-xs font-medium text-rose-500/85 whitespace-nowrap">審核中</span>
  ) : myDelta !== 0 ? (
    <span
      className={cn(
        'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap',
        myDelta > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {formatDelta(myDelta)} 分
    </span>
  ) : (
    <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
      0 分
    </span>
  );

  return (
    <div
      id={`match-${match.id}`}
      ref={rootRef}
      className={cn(
        'rounded-2xl bg-card border overflow-hidden shadow-xs hover:shadow-sm transition-all flex items-stretch',
        isHighlighted
          ? 'border-sapphire-blue ring-2 ring-sapphire-blue/60 dark:ring-blue-400/60 shadow-md'
          : 'border-border',
      )}
    >
      <div className={cn('w-1 shrink-0', railClass)} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        {isHighlighted && (
          <HighlightFocusBanner
            shortId={String(match.id).slice(0, 4)}
            onClear={clearHighlight}
          />
        )}
        {/* Desktop / Tablet Single Row */}
        <div className="hidden sm:flex items-center justify-between gap-3.5 md:gap-4 px-4 py-3.5">
          {/* 1. Result + Points Column */}
          <div className="w-[88px] shrink-0 flex flex-col">
            <span
              className={cn(
                'text-sm sm:text-base font-display font-bold leading-tight whitespace-nowrap',
                resultColorClass,
              )}
            >
              {resultLabel}
            </span>
            <div className="mt-0.5 leading-tight">{deltaNode}</div>
          </div>

          {/* 2. Score Pill (My Score : Rival Score) */}
          <div className="w-[84px] shrink-0 py-1.5 rounded-xl bg-surface-subtle border border-border/80 flex flex-col items-center justify-center">
            <div className="font-display font-bold text-xl sm:text-2xl leading-none tabular-nums flex items-center gap-1">
              <span className={iWon ? 'text-foreground' : 'text-muted-foreground/70'}>
                {myScore}
              </span>
              <span className="text-muted-foreground/40 text-sm">:</span>
              <span className={!iWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                {rivalScore}
              </span>
            </div>
            {matchFormat === 'BO5' && (
              <span className="text-xs font-semibold text-muted-foreground leading-none mt-1 whitespace-nowrap">
                BO5
              </span>
            )}
          </div>

          {/* 3. VS Rival Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TeamAvatars
              players={rivalTeam}
              onInspect={openInspect}
              avatarClassName="size-10 sm:size-11 rounded-xl text-xs sm:text-sm"
              overlapClassName="-space-x-2.5"
              placeholderClassName="size-10 sm:size-11"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-display font-semibold text-muted-foreground/80 shrink-0">
                  VS
                </span>
                <TeamNames
                  players={rivalTeam}
                  onInspect={openInspect}
                  align="left"
                  className="text-base sm:text-lg font-display font-bold text-foreground"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {isDoubles ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap">
                    雙打
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap">
                    單打
                  </span>
                )}
                {Boolean(match?.challenge_id) && <ChallengeTag />}
                {isDoubles && myPartner && (
                  <button
                    type="button"
                    onClick={() => openInspect(myPartner.id)}
                    disabled={!myPartner.id}
                    className="text-xs font-medium text-muted-foreground hover:text-sapphire-blue truncate max-w-[180px] transition-colors leading-none"
                  >
                    · 搭檔：{myPartner.name}
                  </button>
                )}
                {isPending && (
                  <span className="text-xs font-medium text-amber-600/85 dark:text-amber-300/85 leading-none whitespace-nowrap">
                    (暫定{iWon ? '勝' : '敗'})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Time & Dispute Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
              {displayTime}
            </span>
            {isDisputed && (
              <button
                type="button"
                onClick={handleShowDisputeInfo}
                className="min-h-8 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors whitespace-nowrap"
              >
                申訴細節
              </button>
            )}
          </div>
        </div>

        {/* Mobile Compact Personal Card */}
        <div className="sm:hidden px-3.5 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span
                className={cn(
                  'text-sm font-display font-bold whitespace-nowrap',
                  resultColorClass,
                )}
              >
                {resultLabel}
              </span>
              {deltaNode}
              {isDoubles ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap">
                  雙打
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap">
                  單打
                </span>
              )}
              {Boolean(match?.challenge_id) && <ChallengeTag compact />}
              {matchFormat === 'BO5' && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none whitespace-nowrap">
                  BO5
                </span>
              )}
            </div>

            <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
              {displayTime}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <TeamAvatars
                players={rivalTeam}
                onInspect={openInspect}
                avatarClassName="size-10 rounded-xl text-xs"
                overlapClassName="-space-x-2"
                placeholderClassName="size-10"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-display font-semibold text-muted-foreground/80 shrink-0">
                    VS
                  </span>
                  <TeamNames
                    players={rivalTeam}
                    onInspect={openInspect}
                    align="left"
                    stacked={isDoubles}
                    className="text-base font-display font-bold text-foreground"
                  />
                </div>
                {isDoubles && myPartner && (
                  <button
                    type="button"
                    onClick={() => openInspect(myPartner.id)}
                    disabled={!myPartner.id}
                    className="text-xs font-medium text-muted-foreground hover:text-sapphire-blue truncate block max-w-full text-left mt-0.5"
                  >
                    搭檔：{myPartner.name}
                  </button>
                )}
              </div>
            </div>

            <div className="shrink-0 px-3 py-1.5 rounded-xl bg-surface-subtle border border-border/80 font-display font-bold text-xl leading-none tabular-nums">
              <span className={iWon ? 'text-foreground' : 'text-muted-foreground/65'}>
                {myScore}
              </span>
              <span className="text-muted-foreground/40 text-sm mx-0.5">:</span>
              <span className={!iWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                {rivalScore}
              </span>
            </div>
          </div>

          {isDisputed && (
            <button
              type="button"
              onClick={handleShowDisputeInfo}
              className="w-full min-h-9 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors whitespace-nowrap"
            >
              檢視申訴細節
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mechanism 1: Same-Day Same-Matchup Expandable Series Row / Card
export function MatchSeriesItem({
  cluster,
  variant = 'feed',
  timeDisplay = 'smart',
  enableDeepLinkFocus = true,
}: Readonly<{
  cluster: MatchSeriesCluster;
  variant?: 'feed' | 'personal';
  timeDisplay?: 'smart' | 'clock';
  enableDeepLinkFocus?: boolean;
}>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();

  const highlightMatchId = enableDeepLinkFocus ? searchParams.get('matchId') : null;
  const containsHighlightedMatch = Boolean(
    highlightMatchId &&
      cluster.matches.some((m) => String(m.id) === String(highlightMatchId)),
  );

  const [manualExpanded, setManualExpanded] = useState(false);
  const [dismissedHighlightId, setDismissedHighlightId] = useState<string | null>(null);

  const isAutoExpanded = Boolean(
    containsHighlightedMatch &&
      highlightMatchId &&
      dismissedHighlightId !== highlightMatchId,
  );
  const expanded = manualExpanded || isAutoExpanded;

  const handleToggleExpanded = () => {
    if (expanded) {
      setManualExpanded(false);
      if (containsHighlightedMatch && highlightMatchId) {
        setDismissedHighlightId(highlightMatchId);
      }
    } else {
      setManualExpanded(true);
    }
  };

  const clearHighlight = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('matchId');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!containsHighlightedMatch || !highlightMatchId || !expanded) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`match-${highlightMatchId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [containsHighlightedMatch, highlightMatchId, expanded]);

  if (cluster.matches.length === 1) {
    return (
      <MatchItem
        match={cluster.matches[0]}
        variant={variant}
        timeDisplay={timeDisplay}
        enableDeepLinkFocus={enableDeepLinkFocus}
      />
    );
  }

  const openInspect = (playerId?: string) => {
    if (!playerId) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const handleShowDisputeInfo = () => {
    if (currentUser?.role === 'admin') {
      navigate('/admin?tab=matches&status=disputed');
      return;
    }
    toast.info('此場賽果已標記為爭議申訴，自動結算已暫停，正等待管理員裁決。');
  };

  const isDoubles = cluster.type === 'doubles';
  const hasChallengeMatch = cluster.matches.some((m) => Boolean((m as MatchData).challenge_id));
  const rawDate = cluster.latestMatch?.date || cluster.latestMatch?.created_at;
  const displayTime =
    timeDisplay === 'clock' ? formatMatchClock(rawDate) : formatSmartMatchTime(rawDate);

  const myId = currentUser?.id ? String(currentUser.id) : null;
  const iAmInT1 = myId
    ? cluster.anchorTeam1.some((p) => String(p.id) === myId)
    : false;
  const iAmInT2 = myId
    ? cluster.anchorTeam2.some((p) => String(p.id) === myId)
    : false;

  const useT1AsMe = iAmInT1 || !iAmInT2;
  const myTeam = useT1AsMe ? cluster.anchorTeam1 : cluster.anchorTeam2;
  const rivalTeam = useT1AsMe ? cluster.anchorTeam2 : cluster.anchorTeam1;
  const myWins = useT1AsMe ? cluster.team1Wins : cluster.team2Wins;
  const myLosses = useT1AsMe ? cluster.team2Wins : cluster.team1Wins;
  const myNetDelta = useT1AsMe ? cluster.team1NetDelta : cluster.team2NetDelta;
  const myPartner = isDoubles
    ? myTeam.find((p) => p.id && String(p.id) !== myId) ?? null
    : null;

  if (variant === 'feed') {
    const t1Lead = cluster.team1Wins > cluster.team2Wins;
    const t2Lead = cluster.team2Wins > cluster.team1Wins;

    return (
      <div
        className={cn(
          'transition-colors',
          containsHighlightedMatch &&
            'ring-2 ring-inset ring-sapphire-blue/60 dark:ring-blue-400/60 bg-sapphire-blue/[0.02]',
        )}
      >
        <div
          onClick={handleToggleExpanded}
          className="hover:bg-surface-subtle/60 cursor-pointer"
        >
          {/* Desktop: Top Meta & Actions Strip + Full-Width Broadcast Matchup Stage */}
          <div className="hidden md:block px-5 py-4 space-y-3">
            {/* Row 1: Top Meta Strip + Status & Expand Action */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs sm:text-sm font-medium text-foreground/85 tabular-nums whitespace-nowrap">
                  {displayTime}
                </span>
                <span className="text-muted-foreground/35 text-xs">·</span>
                {isDoubles ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap">
                    雙打
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap">
                    單打
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-semibold leading-none whitespace-nowrap">
                  <Layers size={11} aria-hidden="true" />
                  連打 {cluster.matches.length} 場
                </span>
                {hasChallengeMatch && <ChallengeTag compact />}
                {containsHighlightedMatch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue text-white text-xs font-semibold leading-none whitespace-nowrap">
                    <Crosshair size={11} aria-hidden="true" />
                    含通知場次
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                {cluster.hasPending && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap shrink-0 leading-none">
                    待確認
                  </span>
                )}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label="切換連打場次明細"
                  title={expanded ? '收合明細' : '展開明細'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleExpanded();
                  }}
                  className="size-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={cn('transition-transform duration-200', expanded && 'rotate-180')}
                  />
                </button>
              </div>
            </div>

            {/* Row 2: Full-Width Center Alignment Axis */}
            <div className="space-y-2.5 min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] items-center gap-4 min-w-0 px-2">
                <div className="flex items-center justify-end gap-3 min-w-0">
                  {cluster.team1NetDelta !== 0 && (
                    <span
                      className={cn(
                        'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                        cluster.team1NetDelta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatDelta(cluster.team1NetDelta)}
                    </span>
                  )}
                  <TeamNames
                    players={cluster.anchorTeam1}
                    onInspect={openInspect}
                    align="right"
                    stacked={isDoubles}
                    className={cn(
                      'font-display text-sm sm:text-base',
                      t1Lead || !t2Lead
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground',
                    )}
                  />
                  <TeamAvatars
                    players={cluster.anchorTeam1}
                    onInspect={openInspect}
                    avatarClassName="size-10 sm:size-11 rounded-xl text-xs sm:text-sm"
                    overlapClassName="-space-x-2.5"
                    placeholderClassName="size-10 sm:size-11"
                    wonRing={t1Lead && cluster.allSettled}
                  />
                </div>

                <div className="w-[104px] py-1.5 rounded-xl bg-surface-subtle border border-border/80 flex items-center justify-center gap-1 font-display font-bold text-sm sm:text-base tabular-nums whitespace-nowrap shrink-0 leading-none">
                  <span className={t1Lead ? 'text-foreground' : 'text-muted-foreground/70'}>
                    {cluster.team1Wins}勝
                  </span>
                  <span className="text-muted-foreground/40 text-xs">:</span>
                  <span className={t2Lead ? 'text-foreground' : 'text-muted-foreground/70'}>
                    {cluster.team2Wins}勝
                  </span>
                </div>

                <div className="flex items-center justify-start gap-3 min-w-0">
                  <TeamAvatars
                    players={cluster.anchorTeam2}
                    onInspect={openInspect}
                    avatarClassName="size-10 sm:size-11 rounded-xl text-xs sm:text-sm"
                    overlapClassName="-space-x-2.5"
                    placeholderClassName="size-10 sm:size-11"
                    wonRing={t2Lead && cluster.allSettled}
                  />
                  <TeamNames
                    players={cluster.anchorTeam2}
                    onInspect={openInspect}
                    align="left"
                    stacked={isDoubles}
                    className={cn(
                      'font-display text-sm sm:text-base',
                      t2Lead || !t1Lead
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground',
                    )}
                  />
                  {cluster.team2NetDelta !== 0 && (
                    <span
                      className={cn(
                        'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                        cluster.team2NetDelta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatDelta(cluster.team2NetDelta)}
                    </span>
                  )}
                </div>
              </div>

              {/* Chronological Mini Score Pills (hidden when expanded to avoid duplicate scores) */}
              {!expanded && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {cluster.games.map((g) => {
                    const isGameHighlighted = Boolean(
                      highlightMatchId && String(g.match.id) === String(highlightMatchId),
                    );
                    return (
                      <span
                        key={g.match.id}
                        className={cn(
                          'px-2.5 py-0.5 rounded-lg border text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                          isGameHighlighted
                            ? 'bg-sapphire-blue/12 border-sapphire-blue text-sapphire-blue dark:text-blue-300 ring-2 ring-sapphire-blue/40'
                            : g.isPending
                              ? 'bg-amber-50/70 border-amber-200/80 text-amber-700 dark:bg-amber-500/12 dark:border-amber-500/30 dark:text-amber-300'
                              : 'bg-surface-subtle border-border/70 text-foreground/85',
                        )}
                      >
                        <span className="text-muted-foreground mr-1">#{g.index}</span>
                        {g.team1Score}:{g.team2Score}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Stacked Series Summary */}
          <div className="md:hidden px-3.5 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {isDoubles ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap">
                    雙打
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap">
                    單打
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-semibold leading-none whitespace-nowrap">
                  <Layers size={11} aria-hidden="true" />
                  連打 {cluster.matches.length} 場
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                  · {displayTime}
                </span>
                {containsHighlightedMatch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue text-white text-xs font-semibold leading-none whitespace-nowrap">
                    <Crosshair size={11} aria-hidden="true" />
                    通知場次
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-expanded={expanded}
                aria-label="切換連打場次明細"
                title={expanded ? '收合明細' : '展開明細'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpanded();
                }}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn('transition-transform duration-200', expanded && 'rotate-180')}
                />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <TeamAvatars
                    players={cluster.anchorTeam1}
                    onInspect={openInspect}
                    avatarClassName="size-8 rounded-lg text-xs"
                    overlapClassName="-space-x-2"
                    placeholderClassName="size-8"
                  />
                  <TeamNames
                    players={cluster.anchorTeam1}
                    onInspect={openInspect}
                    align="left"
                    stacked={isDoubles}
                    className={cn(
                      'font-display text-sm sm:text-base',
                      t1Lead || !t2Lead
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground',
                    )}
                  />
                  {cluster.team1NetDelta !== 0 && (
                    <span
                      className={cn(
                        'text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                        cluster.team1NetDelta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatDelta(cluster.team1NetDelta)}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'font-display font-bold text-base tabular-nums shrink-0 whitespace-nowrap',
                    t1Lead ? 'text-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {cluster.team1Wins} 勝
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <TeamAvatars
                    players={cluster.anchorTeam2}
                    onInspect={openInspect}
                    avatarClassName="size-8 rounded-lg text-xs"
                    overlapClassName="-space-x-2"
                    placeholderClassName="size-8"
                  />
                  <TeamNames
                    players={cluster.anchorTeam2}
                    onInspect={openInspect}
                    align="left"
                    stacked={isDoubles}
                    className={cn(
                      'font-display text-sm sm:text-base',
                      t2Lead || !t1Lead
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground',
                    )}
                  />
                  {cluster.team2NetDelta !== 0 && (
                    <span
                      className={cn(
                        'text-xs font-display font-semibold tabular-nums whitespace-nowrap shrink-0',
                        cluster.team2NetDelta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatDelta(cluster.team2NetDelta)}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'font-display font-bold text-base tabular-nums shrink-0 whitespace-nowrap',
                    t2Lead ? 'text-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {cluster.team2Wins} 勝
                </span>
              </div>
            </div>

            {!expanded && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {cluster.games.map((g) => {
                  const isGameHighlighted = Boolean(
                    highlightMatchId && String(g.match.id) === String(highlightMatchId),
                  );
                  return (
                    <span
                      key={g.match.id}
                      className={cn(
                        'px-2.5 py-0.5 rounded-lg border text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                        isGameHighlighted
                          ? 'bg-sapphire-blue/12 border-sapphire-blue text-sapphire-blue dark:text-blue-300 ring-2 ring-sapphire-blue/40'
                          : g.isPending
                            ? 'bg-amber-50/70 border-amber-200/80 text-amber-700 dark:bg-amber-500/12 dark:border-amber-500/30 dark:text-amber-300'
                            : 'bg-surface-subtle border-border/70 text-foreground/85',
                      )}
                    >
                      <span className="text-muted-foreground mr-1">#{g.index}</span>
                      {g.team1Score}:{g.team2Score}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Chronological Per-Game Breakdown (Zero Repeated Avatars/Names) */}
        {expanded && (
          <div className="border-t border-border/70 bg-surface-subtle/55 divide-y divide-border/50">
            {cluster.games.map((g) => {
              const gameClock = formatMatchClock(g.match.date || g.match.created_at);
              const gameFormat = inferMatchFormat(g.team1Score, g.team2Score);
              const winPlayers = g.team1Won ? cluster.anchorTeam1 : cluster.anchorTeam2;
              const leadName = winPlayers[0]?.name?.split(' ')[0] || (g.team1Won ? '左隊' : '右隊');
              const winnerLabel = winPlayers.length > 1 ? `${leadName} 等` : leadName;
              const winnerDelta = g.team1Won ? g.team1Delta : g.team2Delta;
              const isGameHighlighted = Boolean(
                highlightMatchId && String(g.match.id) === String(highlightMatchId),
              );

              return (
                <div
                  key={g.match.id}
                  id={`match-${g.match.id}`}
                  className={cn(
                    isGameHighlighted &&
                      'ring-2 ring-inset ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/[0.08] dark:bg-blue-500/[0.16]',
                  )}
                >
                  {isGameHighlighted && (
                    <HighlightFocusBanner
                      shortId={String(g.match.id).slice(0, 4)}
                      label={`連打第 ${g.index} 場 · 通知指定場次`}
                      onClear={clearHighlight}
                    />
                  )}
                  {/* Desktop: Score strictly aligned under center matchup column */}
                  <div className="hidden md:grid md:grid-cols-[152px_minmax(0,1fr)_144px] items-center gap-4 px-5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-card border border-border/80 text-xs font-display font-semibold text-muted-foreground tabular-nums shrink-0">
                        #{g.index}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                        {gameClock}
                      </span>
                      {gameFormat === 'BO5' && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none shrink-0">
                          BO5
                        </span>
                      )}
                      {Boolean((g.match as MatchData).challenge_id) && <ChallengeTag compact />}
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-end gap-2 min-w-0">
                        {g.isSettled && g.team1Delta !== 0 && (
                          <span
                            className={cn(
                              'text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                              g.team1Delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-500 dark:text-rose-400',
                            )}
                          >
                            {formatDelta(g.team1Delta)}
                          </span>
                        )}
                        {g.team1Won && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            勝
                          </span>
                        )}
                      </div>

                      <div className="w-[96px] py-1 rounded-lg bg-card border border-border/70 flex items-center justify-center gap-1.5 font-display font-bold text-base tabular-nums leading-none shrink-0">
                        <span className={g.team1Won ? 'text-foreground' : 'text-muted-foreground/55'}>
                          {g.team1Score}
                        </span>
                        <span className="text-muted-foreground/40 text-xs">:</span>
                        <span className={!g.team1Won ? 'text-foreground' : 'text-muted-foreground/55'}>
                          {g.team2Score}
                        </span>
                      </div>

                      <div className="flex items-center justify-start gap-2 min-w-0">
                        {!g.team1Won && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            勝
                          </span>
                        )}
                        {g.isSettled && g.team2Delta !== 0 && (
                          <span
                            className={cn(
                              'text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                              g.team2Delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-500 dark:text-rose-400',
                            )}
                          >
                            {formatDelta(g.team2Delta)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      {g.isPending && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap">
                          待確認
                        </span>
                      )}
                      {g.isDisputed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowDisputeInfo();
                          }}
                          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30 hover:bg-rose-100 transition-colors whitespace-nowrap"
                        >
                          申訴中
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile: Ultra-clean single-line breakdown */}
                  <div className="md:hidden px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-card border border-border/80 text-xs font-display font-semibold text-muted-foreground tabular-nums">
                        #{g.index}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {gameClock}
                      </span>
                      {Boolean((g.match as MatchData).challenge_id) && <ChallengeTag compact />}
                      {gameFormat === 'BO5' && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none">
                          BO5
                        </span>
                      )}
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-card border border-border/70 font-display font-bold text-sm tabular-nums leading-none shrink-0 flex items-center gap-1">
                      <span className={g.team1Won ? 'text-foreground' : 'text-muted-foreground/55'}>
                        {g.team1Score}
                      </span>
                      <span className="text-muted-foreground/40 text-xs">:</span>
                      <span className={!g.team1Won ? 'text-foreground' : 'text-muted-foreground/55'}>
                        {g.team2Score}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-foreground/85 truncate">
                        {winnerLabel} 勝
                      </span>
                      {g.isPending ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap shrink-0">
                          待確認
                        </span>
                      ) : g.isDisputed ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowDisputeInfo();
                          }}
                          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30 whitespace-nowrap shrink-0"
                        >
                          申訴中
                        </button>
                      ) : winnerDelta !== 0 ? (
                        <span className="text-xs font-display font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
                          {formatDelta(winnerDelta)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Personal Perspective Series Card (Scheme B + Minimalist Expanded Box Score)
  const netWon = myWins > myLosses;
  const netLost = myLosses > myWins;
  const allPending = cluster.games.every((g) => g.isPending);

  const railClass = allPending
    ? 'bg-amber-400'
    : netWon
      ? 'bg-emerald-500'
      : netLost
        ? 'bg-rose-500'
        : 'bg-sapphire-blue';

  const summaryColorClass = allPending
    ? 'text-amber-600 dark:text-amber-400'
    : netWon
      ? 'text-emerald-600 dark:text-emerald-400'
      : netLost
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-sapphire-blue dark:text-blue-400';

  const netDeltaNode = allPending ? (
    <span className="text-xs font-medium text-amber-600/85 dark:text-amber-300/85 whitespace-nowrap">
      待結算
    </span>
  ) : myNetDelta !== 0 ? (
    <span
      className={cn(
        'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap',
        myNetDelta > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {formatDelta(myNetDelta)} 分
    </span>
  ) : (
    <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
      0 分
    </span>
  );

  return (
    <div
      className={cn(
        'rounded-2xl bg-card border overflow-hidden shadow-xs hover:shadow-sm transition-all flex items-stretch',
        containsHighlightedMatch
          ? 'border-sapphire-blue ring-2 ring-sapphire-blue/60 dark:ring-blue-400/60 shadow-md'
          : 'border-border',
      )}
    >
      <div className={cn('w-1 shrink-0', railClass)} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <div
          onClick={handleToggleExpanded}
          className="cursor-pointer"
        >
          {/* Desktop Personal Series Header */}
          <div className="hidden sm:flex items-center justify-between gap-3.5 md:gap-4 px-4 py-3.5">
            <div className="w-[88px] shrink-0 flex flex-col">
              <span
                className={cn(
                  'text-sm sm:text-base font-display font-bold leading-tight whitespace-nowrap',
                  summaryColorClass,
                )}
              >
                {myWins}勝 {myLosses}敗
              </span>
              <div className="mt-0.5 leading-tight">{netDeltaNode}</div>
            </div>

            <div className="w-[84px] shrink-0 py-1.5 rounded-xl bg-surface-subtle border border-border/80 flex flex-col items-center justify-center">
              <span className="text-xs font-semibold text-sapphire-blue leading-none whitespace-nowrap">
                連打
              </span>
              <span className="font-display font-bold text-sm sm:text-base leading-tight text-foreground tabular-nums mt-0.5 whitespace-nowrap">
                {cluster.matches.length} 場
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <TeamAvatars
                players={rivalTeam}
                onInspect={openInspect}
                avatarClassName="size-10 sm:size-11 rounded-xl text-xs sm:text-sm"
                overlapClassName="-space-x-2.5"
                placeholderClassName="size-10 sm:size-11"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-xs font-display font-semibold text-muted-foreground/80 shrink-0">
                    VS
                  </span>
                  <TeamNames
                    players={rivalTeam}
                    onInspect={openInspect}
                    align="left"
                    className="text-base sm:text-lg font-display font-bold text-foreground"
                  />
                  {isDoubles ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-semibold leading-none whitespace-nowrap">
                      雙打
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground leading-none whitespace-nowrap">
                      單打
                    </span>
                  )}
                  {hasChallengeMatch && <ChallengeTag />}
                  {isDoubles && myPartner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInspect(myPartner.id);
                      }}
                      disabled={!myPartner.id}
                      className="text-xs font-medium text-muted-foreground hover:text-sapphire-blue truncate max-w-[180px] transition-colors leading-none"
                    >
                      · 搭檔：{myPartner.name}
                    </button>
                  )}
                </div>

                {!expanded && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cluster.games.map((g) => {
                      const myScore = useT1AsMe ? g.team1Score : g.team2Score;
                      const oppScore = useT1AsMe ? g.team2Score : g.team1Score;
                      const won = myScore > oppScore;
                      const isGameHighlighted = Boolean(
                        highlightMatchId && String(g.match.id) === String(highlightMatchId),
                      );
                      const pillDotClass = g.isPending
                        ? 'bg-amber-400'
                        : won
                          ? 'bg-emerald-500'
                          : 'bg-rose-500';

                      return (
                        <span
                          key={g.match.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                            isGameHighlighted
                              ? 'bg-sapphire-blue/15 border-sapphire-blue text-sapphire-blue dark:text-blue-300 ring-2 ring-sapphire-blue/40'
                              : 'bg-surface-subtle border-border/80 text-foreground',
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full shrink-0', pillDotClass)} aria-hidden="true" />
                          <span>
                            <span className="text-muted-foreground mr-1">#{g.index}</span>
                            {myScore}:{oppScore}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                {displayTime}
              </span>
              <button
                type="button"
                aria-expanded={expanded}
                aria-label="切換連打場次明細"
                title={expanded ? '收合明細' : '展開明細'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpanded();
                }}
                className="size-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={cn('transition-transform duration-200', expanded && 'rotate-180')}
                />
              </button>
            </div>
          </div>

          {/* Mobile Personal Series Header */}
          <div className="sm:hidden px-3.5 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span
                  className={cn(
                    'text-sm font-display font-bold whitespace-nowrap',
                    summaryColorClass,
                  )}
                >
                  {myWins}勝 {myLosses}敗
                </span>
                {netDeltaNode}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-semibold leading-none whitespace-nowrap">
                  <Layers size={11} aria-hidden="true" />
                  連打 {cluster.matches.length} 場
                </span>
                {hasChallengeMatch && <ChallengeTag compact />}
                {containsHighlightedMatch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sapphire-blue text-white text-xs font-semibold leading-none whitespace-nowrap">
                    <Crosshair size={11} aria-hidden="true" />
                    含通知場次
                  </span>
                )}
              </div>

              <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                {displayTime}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <TeamAvatars
                  players={rivalTeam}
                  onInspect={openInspect}
                  avatarClassName="size-10 rounded-xl text-xs"
                  overlapClassName="-space-x-2"
                  placeholderClassName="size-10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-display font-semibold text-muted-foreground/80 shrink-0">
                      VS
                    </span>
                    <TeamNames
                      players={rivalTeam}
                      onInspect={openInspect}
                      align="left"
                      stacked={isDoubles}
                      className="text-base font-display font-bold text-foreground"
                    />
                  </div>
                  {isDoubles && myPartner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInspect(myPartner.id);
                      }}
                      disabled={!myPartner.id}
                      className="text-xs font-medium text-muted-foreground hover:text-sapphire-blue truncate block max-w-full text-left mt-0.5"
                    >
                      搭檔：{myPartner.name}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-expanded={expanded}
                aria-label="切換連打場次明細"
                title={expanded ? '收合明細' : '展開明細'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpanded();
                }}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn('transition-transform duration-200', expanded && 'rotate-180')}
                />
              </button>
            </div>

            {!expanded && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {cluster.games.map((g) => {
                  const myScore = useT1AsMe ? g.team1Score : g.team2Score;
                  const oppScore = useT1AsMe ? g.team2Score : g.team1Score;
                  const won = myScore > oppScore;
                  const isGameHighlighted = Boolean(
                    highlightMatchId && String(g.match.id) === String(highlightMatchId),
                  );
                  const pillDotClass = g.isPending
                    ? 'bg-amber-400'
                    : won
                      ? 'bg-emerald-500'
                      : 'bg-rose-500';

                  return (
                    <span
                      key={g.match.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-display font-semibold tabular-nums whitespace-nowrap',
                        isGameHighlighted
                          ? 'bg-sapphire-blue/15 border-sapphire-blue text-sapphire-blue dark:text-blue-300 ring-2 ring-sapphire-blue/40'
                          : 'bg-surface-subtle border-border/80 text-foreground',
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full shrink-0', pillDotClass)} aria-hidden="true" />
                      <span>
                        <span className="text-muted-foreground mr-1">#{g.index}</span>
                        {myScore}:{oppScore}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Expanded Per-Game Table Inside Single Card Rail */}
        {expanded && (
          <div className="border-t border-border/60 bg-card/75 dark:bg-background/40 divide-y divide-border/50">
            {cluster.games.map((g) => {
              const myGameScore = useT1AsMe ? g.team1Score : g.team2Score;
              const oppGameScore = useT1AsMe ? g.team2Score : g.team1Score;
              const won = myGameScore > oppGameScore;
              const gameDelta = useT1AsMe ? g.team1Delta : g.team2Delta;
              const gameClock = formatMatchClock(g.match.date || g.match.created_at);
              const gameFormat = inferMatchFormat(myGameScore, oppGameScore);
              const isGameHighlighted = Boolean(
                highlightMatchId && String(g.match.id) === String(highlightMatchId),
              );

              const dotColor = g.isPending
                ? 'bg-amber-400'
                : g.isDisputed
                  ? 'bg-rose-500'
                  : won
                    ? 'bg-emerald-500'
                    : 'bg-rose-500';

              return (
                <div
                  key={g.match.id}
                  id={`match-${g.match.id}`}
                  className={cn(
                    isGameHighlighted &&
                      'ring-2 ring-inset ring-sapphire-blue dark:ring-blue-400 bg-sapphire-blue/[0.08] dark:bg-blue-500/[0.16]',
                  )}
                >
                  {isGameHighlighted && (
                    <HighlightFocusBanner
                      shortId={String(g.match.id).slice(0, 4)}
                      label={`連打第 ${g.index} 場 · 通知指定場次`}
                      onClear={clearHighlight}
                    />
                  )}
                  <div className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2.5 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <span className="w-8 text-center py-0.5 rounded-md bg-surface-subtle border border-border/70 text-xs font-display font-semibold text-muted-foreground tabular-nums shrink-0">
                      #{g.index}
                    </span>

                    <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
                      {gameClock}
                    </span>

                    <div className="w-[66px] sm:w-[76px] py-1 rounded-lg bg-surface-subtle border border-border/70 flex items-center justify-center gap-1 font-display font-bold text-sm sm:text-base tabular-nums shrink-0 leading-none">
                      <span className={won ? 'text-foreground' : 'text-muted-foreground/60'}>
                        {myGameScore}
                      </span>
                      <span className="text-muted-foreground/40 text-xs">:</span>
                      <span className={!won ? 'text-foreground' : 'text-muted-foreground/60'}>
                        {oppGameScore}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn('size-2 rounded-full shrink-0', dotColor)} aria-hidden="true" />
                      {g.isPending ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-300 truncate">
                          暫定{won ? '勝' : '敗'}
                          <span className="hidden sm:inline font-medium text-muted-foreground ml-1">
                            · 待確認
                          </span>
                        </span>
                      ) : g.isDisputed ? (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          申訴中
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-xs font-semibold whitespace-nowrap',
                            won
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {won ? '勝' : '敗'}
                        </span>
                      )}

                      {gameFormat === 'BO5' && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-semibold text-muted-foreground leading-none shrink-0">
                          BO5
                        </span>
                      )}
                      {Boolean((g.match as MatchData).challenge_id) && <ChallengeTag compact />}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {g.isPending ? (
                      <span className="text-xs font-medium text-amber-600/85 dark:text-amber-300/85 whitespace-nowrap">
                        待結算
                      </span>
                    ) : g.isDisputed ? (
                      <button
                        type="button"
                        onClick={handleShowDisputeInfo}
                        className="min-h-8 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition-colors whitespace-nowrap"
                      >
                        申訴細節
                      </button>
                    ) : (
                      <span
                        className={cn(
                          'text-xs sm:text-sm font-display font-semibold tabular-nums whitespace-nowrap',
                          gameDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : gameDelta < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {gameDelta !== 0 ? `${formatDelta(gameDelta)} 分` : '0 分'}
                      </span>
                    )}
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
