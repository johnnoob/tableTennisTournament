import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PlayerAvatar } from './PlayerAvatar';
import { ReportScore } from './ReportScore';
import { useAuth } from '@/hooks/useAuth';
import { inferMatchFormat } from '@/lib/matchScore';
import { formatMatchClock, formatSmartMatchTime } from '@/lib/matchDate';

interface MatchPlayer {
  id?: string;
  name: string;
  avatar?: string | null;
}

interface MatchData {
  id: string;
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
}

function formatDelta(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
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
    return <div className={cn('rounded-xl bg-secondary animate-pulse shrink-0', placeholderClassName)} />;
  }

  return (
    <button
      type="button"
      onClick={() => onInspect(players[0]?.id)}
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
}: {
  players: MatchPlayer[];
  onInspect: (id?: string) => void;
  className?: string;
  align?: 'left' | 'right';
}) {
  if (players.length === 0) {
    return <span className="font-display font-bold text-muted-foreground text-xs">載入中...</span>;
  }

  if (players.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onInspect(players[0]?.id)}
        disabled={!players[0]?.id}
        className={cn(
          'truncate leading-tight transition-colors hover:text-sapphire-blue max-w-full',
          align === 'right' ? 'text-right' : 'text-left',
          className,
        )}
      >
        {players[0].name}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center min-w-0 max-w-full overflow-hidden',
        align === 'right' && 'justify-end',
      )}
    >
      {players.map((p, idx) => (
        <span key={p.id || idx} className="inline-flex items-center min-w-0">
          {idx > 0 && <span className="text-muted-foreground/45 mx-1 shrink-0">/</span>}
          <button
            type="button"
            onClick={() => onInspect(p.id)}
            disabled={!p.id}
            className={cn('truncate leading-tight transition-colors hover:text-sapphire-blue', className)}
          >
            {p.name?.split(' ')[0] || '?'}
          </button>
        </span>
      ))}
    </div>
  );
}

export function MatchItem({
  match,
  variant = 'feed',
  timeDisplay = 'smart',
}: Readonly<MatchItemProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();

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
  const canRematch = Boolean(myId && (iAmInP1 || iAmInOpp));

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
  const rematchType: 'singles' | 'doubles' = isDoubles ? 'doubles' : 'singles';
  const rematchPartnerId = myPartner?.id || null;
  const rematchOpp1Id = rivalTeam[0]?.id || null;
  const rematchOpp2Id = isDoubles ? rivalTeam[1]?.id || null : null;

  const handleShowDisputeInfo = () => {
    toast.info('線上申訴檢視功能建置中，請聯繫管理員或對手協助處理');
  };

  const renderRematchAction = ({
    iconOnly = false,
    className,
  }: {
    iconOnly?: boolean;
    className?: string;
  }) => {
    if (!canRematch || !rematchOpp1Id) return null;

    return (
      <ReportScore
        initialMatchType={rematchType}
        initialFormat={matchFormat}
        initialPartnerId={rematchPartnerId}
        initialOpponentId={rematchOpp1Id}
        initialOpponent2Id={rematchOpp2Id}
        trigger={
          <button
            type="button"
            aria-label="發起再戰"
            title="再戰"
            className={cn(
              'inline-flex items-center justify-center rounded-lg bg-blue-50 hover:bg-sapphire-blue text-sapphire-blue hover:text-white border border-blue-200/80 dark:bg-blue-500/12 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-sapphire-blue dark:hover:text-white font-black transition-colors shrink-0',
              iconOnly ? 'size-7' : 'gap-1 h-7 px-2.5 text-xs',
              className,
            )}
          >
            <RotateCcw size={iconOnly ? 13 : 11} aria-hidden="true" />
            {!iconOnly && <span>再戰</span>}
          </button>
        }
      />
    );
  };

  if (variant === 'feed') {
    const typePillDesktop = isDoubles ? (
      <span className="px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-700 dark:text-amber-300 text-[10px] font-black leading-none">
        雙打
      </span>
    ) : (
      <span className="text-[11px] font-bold text-muted-foreground/80 leading-none">單打</span>
    );

    const statusBadge = isPending ? (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/30 shrink-0">
        待確認
      </span>
    ) : isDisputed ? (
      <button
        type="button"
        onClick={handleShowDisputeInfo}
        className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shrink-0"
      >
        申訴中
      </button>
    ) : null;

    return (
      <div className="transition-colors hover:bg-surface-subtle/60 group">
        {/* Desktop: Compact Single-Row Scoreboard */}
        <div className="hidden md:grid md:grid-cols-[112px_minmax(0,1fr)_108px] items-center gap-3 px-4 py-3">
          {/* Left Meta */}
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground tabular-nums truncate">
              {displayTime}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {typePillDesktop}
              {matchFormat === 'BO5' && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                  BO5
                </span>
              )}
            </div>
          </div>

          {/* Center Tight Matchup Stage */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 min-w-0">
            {/* Team 1 (Right-Aligned toward Center Score) */}
            <div className="flex items-center justify-end gap-2.5 min-w-0">
              {isSettled && p1Change !== 0 && (
                <span
                  className={cn(
                    'text-[11px] font-display font-black tabular-nums shrink-0',
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
                className={cn(
                  'font-display text-sm',
                  p1Won ? 'font-black text-foreground' : 'font-bold text-muted-foreground',
                )}
              />
              <TeamAvatars
                players={player1}
                onInspect={openInspect}
                avatarClassName="size-8 rounded-xl text-xs"
                overlapClassName="-space-x-2.5"
                placeholderClassName="size-8"
                wonRing={p1Won && isSettled}
              />
            </div>

            {/* Center Score Pill */}
            <div className="px-2.5 py-1 rounded-xl bg-surface-subtle border border-border/80 flex items-center gap-1.5 font-display font-black text-base tabular-nums shrink-0">
              <span className={p1Won ? 'text-foreground' : 'text-muted-foreground/60'}>
                {score[0]}
              </span>
              <span className="text-muted-foreground/40 text-xs">:</span>
              <span className={p2Won ? 'text-foreground' : 'text-muted-foreground/60'}>
                {score[1]}
              </span>
            </div>

            {/* Team 2 (Left-Aligned from Center Score) */}
            <div className="flex items-center justify-start gap-2.5 min-w-0">
              <TeamAvatars
                players={opponent}
                onInspect={openInspect}
                avatarClassName="size-8 rounded-xl text-xs"
                overlapClassName="-space-x-2.5"
                placeholderClassName="size-8"
                wonRing={p2Won && isSettled}
              />
              <TeamNames
                players={opponent}
                onInspect={openInspect}
                align="left"
                className={cn(
                  'font-display text-sm',
                  p2Won ? 'font-black text-foreground' : 'font-bold text-muted-foreground',
                )}
              />
              {isSettled && p2Change !== 0 && (
                <span
                  className={cn(
                    'text-[11px] font-display font-black tabular-nums shrink-0',
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

          {/* Right Status / Rematch */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {statusBadge}
            {renderRematchAction({
              iconOnly: isPending || isDisputed,
              className: isSettled
                ? 'opacity-85 group-hover:opacity-100 rounded-xl'
                : undefined,
            })}
          </div>
        </div>

        {/* Mobile: Apple Sports Stacked 2-Row Scoreboard */}
        <div className="md:hidden px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground min-w-0">
              {typePillDesktop}
              {matchFormat === 'BO5' && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                  BO5
                </span>
              )}
              <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              <span className="tabular-nums truncate">{displayTime}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {statusBadge}
              {renderRematchAction({ className: 'h-6 px-2 text-[11px]' })}
            </div>
          </div>

          <div className="space-y-1.5">
            {/* Team 1 Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <TeamAvatars
                  players={player1}
                  onInspect={openInspect}
                  avatarClassName="size-7 rounded-lg text-[11px]"
                  overlapClassName="-space-x-2"
                  placeholderClassName="size-7"
                />
                <TeamNames
                  players={player1}
                  onInspect={openInspect}
                  align="left"
                  className={cn(
                    'font-display text-sm',
                    p1Won ? 'font-black text-foreground' : 'font-bold text-muted-foreground',
                  )}
                />
                {isSettled && p1Change !== 0 && (
                  <span
                    className={cn(
                      'text-xs font-display font-black tabular-nums shrink-0',
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
                  className={cn('size-1.5 rounded-full', p1Won ? 'bg-emerald-500' : 'bg-transparent')}
                />
                <span
                  className={cn(
                    'font-display font-black text-lg tabular-nums w-5 text-right leading-none',
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
                  avatarClassName="size-7 rounded-lg text-[11px]"
                  overlapClassName="-space-x-2"
                  placeholderClassName="size-7"
                />
                <TeamNames
                  players={opponent}
                  onInspect={openInspect}
                  align="left"
                  className={cn(
                    'font-display text-sm',
                    p2Won ? 'font-black text-foreground' : 'font-bold text-muted-foreground',
                  )}
                />
                {isSettled && p2Change !== 0 && (
                  <span
                    className={cn(
                      'text-xs font-display font-black tabular-nums shrink-0',
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
                  className={cn('size-1.5 rounded-full', p2Won ? 'bg-emerald-500' : 'bg-transparent')}
                />
                <span
                  className={cn(
                    'font-display font-black text-lg tabular-nums w-5 text-right leading-none',
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

  const surfaceWashClass = isPending
    ? 'bg-amber-50/30 dark:bg-amber-500/[0.05]'
    : isDisputed
      ? 'bg-rose-50/35 dark:bg-rose-500/[0.06]'
      : iWon
        ? 'bg-emerald-50/30 dark:bg-emerald-500/[0.05]'
        : 'bg-rose-50/25 dark:bg-rose-500/[0.04]';

  const resultLabel = isPending
    ? '待確認'
    : isDisputed
      ? '申訴中'
      : iWon
        ? 'WIN'
        : 'LOSS';

  const resultColorClass = isPending
    ? 'text-amber-600 dark:text-amber-400'
    : isDisputed
      ? 'text-rose-600 dark:text-rose-400'
      : iWon
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const deltaNode = isPending ? (
    <span className="text-[11px] font-bold text-amber-600/80 dark:text-amber-300/80">待結算</span>
  ) : isDisputed ? (
    <span className="text-[11px] font-bold text-rose-500/80">審核中</span>
  ) : myDelta !== 0 ? (
    <span
      className={cn(
        'text-xs font-display font-black tabular-nums',
        myDelta > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {formatDelta(myDelta)} 分
    </span>
  ) : (
    <span className="text-xs font-bold text-muted-foreground tabular-nums">0 分</span>
  );

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-sm transition-all flex items-stretch">
      <div className={cn('w-1.5 shrink-0', railClass)} aria-hidden="true" />

      <div className={cn('flex-1 min-w-0', surfaceWashClass)}>
        {/* Desktop / Tablet Single Row */}
        <div className="hidden sm:flex items-center justify-between gap-3 md:gap-4 px-4 py-3">
          {/* 1. Result + ELO Column */}
          <div className="w-[76px] shrink-0 flex flex-col">
            <span className={cn('text-xs font-display font-black tracking-wider leading-tight', resultColorClass)}>
              {resultLabel}
            </span>
            <div className="mt-0.5 leading-tight">{deltaNode}</div>
          </div>

          {/* 2. Score Pill (My Score : Rival Score) */}
          <div className="w-[68px] shrink-0 py-1.5 rounded-xl bg-card/90 border border-border/80 flex flex-col items-center justify-center">
            <div className="font-display font-black text-lg leading-none tabular-nums flex items-center gap-1">
              <span className={iWon ? 'text-foreground' : 'text-muted-foreground/70'}>
                {myScore}
              </span>
              <span className="text-muted-foreground/40 text-xs">:</span>
              <span className={!iWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                {rivalScore}
              </span>
            </div>
            {matchFormat === 'BO5' && (
              <span className="text-[10px] font-black text-muted-foreground leading-none mt-1">
                BO5
              </span>
            )}
          </div>

          {/* 3. VS Rival Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TeamAvatars
              players={rivalTeam}
              onInspect={openInspect}
              avatarClassName="size-9 md:size-10 rounded-xl text-xs"
              overlapClassName="-space-x-2.5"
              placeholderClassName="size-9 md:size-10"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-display font-black text-muted-foreground/75 uppercase shrink-0">
                  VS
                </span>
                <TeamNames
                  players={rivalTeam}
                  onInspect={openInspect}
                  align="left"
                  className="text-sm md:text-base font-display font-black text-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {isDoubles ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-700 dark:text-amber-300 text-[10px] font-black leading-none">
                    雙打
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-muted-foreground leading-none">
                    單打
                  </span>
                )}
                {isDoubles && myPartner && (
                  <button
                    type="button"
                    onClick={() => openInspect(myPartner.id)}
                    disabled={!myPartner.id}
                    className="text-[11px] font-bold text-muted-foreground hover:text-sapphire-blue truncate max-w-[170px] transition-colors leading-none"
                  >
                    · 搭檔：{myPartner.name}
                  </button>
                )}
                {isPending && (
                  <span className="text-[11px] font-bold text-amber-600/80 dark:text-amber-300/80 leading-none">
                    (暫定{iWon ? '勝' : '敗'})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Time & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-muted-foreground tabular-nums">
              {displayTime}
            </span>
            {isDisputed && (
              <button
                type="button"
                onClick={handleShowDisputeInfo}
                className="h-8 px-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 text-xs font-black hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
              >
                申訴細節
              </button>
            )}
            {renderRematchAction({ className: 'h-8 px-2.5 rounded-xl text-xs' })}
          </div>
        </div>

        {/* Mobile Compact Personal Card */}
        <div className="sm:hidden px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className={cn('text-xs font-display font-black tracking-wider', resultColorClass)}>
                {resultLabel}
              </span>
              {deltaNode}
              {isDoubles ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-700 dark:text-amber-300 text-[10px] font-black leading-none">
                  雙打
                </span>
              ) : (
                <span className="text-[11px] font-bold text-muted-foreground leading-none">單打</span>
              )}
              {matchFormat === 'BO5' && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-black text-muted-foreground leading-none">
                  BO5
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                {displayTime}
              </span>
              {renderRematchAction({ className: 'h-6 px-2 text-[11px]' })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <TeamAvatars
                players={rivalTeam}
                onInspect={openInspect}
                avatarClassName="size-9 rounded-xl text-xs"
                overlapClassName="-space-x-2"
                placeholderClassName="size-9"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] font-display font-black text-muted-foreground/75 uppercase shrink-0">
                    VS
                  </span>
                  <TeamNames
                    players={rivalTeam}
                    onInspect={openInspect}
                    align="left"
                    className="text-sm font-display font-black text-foreground"
                  />
                </div>
                {isDoubles && myPartner && (
                  <button
                    type="button"
                    onClick={() => openInspect(myPartner.id)}
                    disabled={!myPartner.id}
                    className="text-[11px] font-bold text-muted-foreground hover:text-sapphire-blue truncate block max-w-full text-left mt-0.5"
                  >
                    搭檔：{myPartner.name}
                  </button>
                )}
              </div>
            </div>

            <div className="shrink-0 px-2.5 py-1 rounded-xl bg-card border border-border/80 font-display font-black text-lg leading-none tabular-nums">
              <span className={iWon ? 'text-foreground' : 'text-muted-foreground/65'}>
                {myScore}
              </span>
              <span className="text-muted-foreground/40 text-xs mx-0.5">:</span>
              <span className={!iWon ? 'text-foreground' : 'text-muted-foreground/60'}>
                {rivalScore}
              </span>
            </div>
          </div>

          {isDisputed && (
            <button
              type="button"
              onClick={handleShowDisputeInfo}
              className="w-full h-9 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/12 text-rose-600 dark:text-rose-300 text-xs font-black hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
            >
              檢視申訴細節
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
