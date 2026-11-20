import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Scale, CalendarDays, RotateCcw } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { PlayerAvatar } from './PlayerAvatar';
import { ReportScore } from './ReportScore';
import { useAuth } from '@/hooks/useAuth';
import { inferMatchFormat } from '@/lib/matchScore';

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
}

export function MatchItem({ match }: Readonly<MatchItemProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();

  const openInspect = (playerId?: string) => {
    if (!playerId) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return { label: '已確認', color: 'bg-slate-100 text-slate-600 border-slate-200/80' };
      case 'pending':
        return { label: '待確認', color: 'bg-amber-50 text-amber-700 border-amber-200/80' };
      case 'disputed':
        return { label: '申訴中', color: 'bg-rose-50 text-rose-600 border-rose-200/80' };
      default:
        return { label: '未知', color: 'bg-slate-100 text-slate-500 border-slate-200/80' };
    }
  };

  const status = getStatusConfig(match?.status || 'unknown');
  const score = match?.score || [0, 0];
  const player1 = match?.player1 || [];
  const opponent = match?.opponent || [];
  const p1Change = match?.mmrChange?.[0] || 0;
  const p2Change = match?.mmrChange?.[1] || 0;

  const rawDate = match?.date || match?.created_at;
  const displayDate = rawDate ? (formatLocalTime(rawDate) || rawDate) : '-';

  // 若本人有參與此場比賽，計算「一鍵再戰」的預填陣容
  const myId = currentUser?.id ? String(currentUser.id) : null;
  const iAmInP1 = myId ? player1.some((p) => String(p.id) === myId) : false;
  const iAmInOpp = myId ? opponent.some((p) => String(p.id) === myId) : false;
  const canRematch = Boolean(myId && (iAmInP1 || iAmInOpp));

  const myTeamPlayers = iAmInP1 ? player1 : opponent;
  const theirTeamPlayers = iAmInP1 ? opponent : player1;
  const rematchType: 'singles' | 'doubles' = match?.type === 'doubles' ? 'doubles' : 'singles';
  const rematchPartnerId =
    rematchType === 'doubles'
      ? myTeamPlayers.find((p) => p.id && String(p.id) !== myId)?.id || null
      : null;
  const rematchOpp1Id = theirTeamPlayers[0]?.id || null;
  const rematchOpp2Id = rematchType === 'doubles' ? theirTeamPlayers[1]?.id || null : null;
  const rematchFormat = inferMatchFormat(score[0], score[1]);

  return (
    <Card className="arena-card p-4 sm:p-5 md:p-6 hover:shadow-md transition-all">
      <CardContent className="p-0 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <span className="text-sapphire-blue">{match?.tournament || '例行積分賽'}</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1.5 text-slate-400 font-bold tabular-nums">
              <CalendarDays size={12} aria-hidden="true" />
              {displayDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canRematch && rematchOpp1Id && (
              <ReportScore
                initialMatchType={rematchType}
                initialFormat={rematchFormat}
                initialPartnerId={rematchPartnerId}
                initialOpponentId={rematchOpp1Id}
                initialOpponent2Id={rematchOpp2Id}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-sapphire-blue text-sapphire-blue hover:text-white border border-blue-200/80 text-xs font-black transition-colors"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    再戰
                  </button>
                }
              />
            )}
            <Badge
              variant="secondary"
              className={cn('px-2.5 py-0.5 rounded-full text-xs font-black border tracking-wider shadow-none', status.color)}
            >
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Scoreboard Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Team 1 */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => openInspect(player1[0]?.id)}
              disabled={!player1[0]?.id}
              aria-label={`檢視 ${player1[0]?.name || '選手'} 戰情檔案`}
              className={cn('flex shrink-0 group/p1 rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue', player1.length > 1 ? '-space-x-2.5 sm:-space-x-4' : '')}
            >
              {player1.map((p, i) => (
                <PlayerAvatar
                  key={p.id || i}
                  src={p.avatar}
                  name={p.name}
                  className="size-10 sm:size-13 md:size-14 rounded-xl md:rounded-2xl border-2 border-white shadow-xs ring-1 ring-slate-200/70 text-xs sm:text-sm group-hover/p1:ring-sapphire-blue transition-all"
                />
              ))}
              {player1.length === 0 && <div className="size-10 sm:size-14 rounded-xl bg-slate-100 animate-pulse" />}
            </button>
            <div className="flex flex-col min-w-0">
              {player1.length === 1 && player1[0]?.id ? (
                <button
                  type="button"
                  onClick={() => openInspect(player1[0].id)}
                  className="text-left font-display font-black text-primary-navy hover:text-sapphire-blue text-xs sm:text-base md:text-lg truncate leading-tight transition-colors"
                >
                  {player1[0].name}
                </button>
              ) : (
                <div className="flex items-center gap-1 min-w-0 flex-wrap">
                  {player1.length > 0 ? (
                    player1.map((p, idx) => (
                      <span key={p.id || idx} className="inline-flex items-center">
                        {idx > 0 && <span className="text-slate-300 mx-1">/</span>}
                        <button
                          type="button"
                          onClick={() => openInspect(p.id)}
                          disabled={!p.id}
                          className="font-display font-black text-primary-navy hover:text-sapphire-blue text-xs sm:text-sm md:text-base truncate leading-tight transition-colors"
                        >
                          {p.name?.split(' ')[0] || '?'}
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="font-display font-black text-slate-400 text-xs">載入中...</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn('text-xs font-black font-display tabular-nums', p1Change >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                  {p1Change > 0 ? `+${p1Change}` : p1Change} 分
                </span>
                <TrendingUp
                  size={11}
                  strokeWidth={3}
                  aria-hidden="true"
                  className={cn(p1Change >= 0 ? 'text-emerald-500' : 'text-rose-400 rotate-180')}
                />
              </div>
            </div>
          </div>

          {/* Central Score */}
          <div className="flex flex-col items-center justify-center px-1.5 sm:px-3 shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 tabular-nums">
              <span className="text-xl sm:text-3xl md:text-4xl font-display font-black text-primary-navy tracking-tight leading-none">
                {score[0]}
              </span>
              <span className="text-slate-300 text-sm sm:text-xl font-black">:</span>
              <span className="text-xl sm:text-3xl md:text-4xl font-display font-black text-primary-navy tracking-tight leading-none">
                {score[1]}
              </span>
            </div>
            <span className="mt-1 px-2 py-0.5 bg-slate-100 rounded-md text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
              {match?.type === 'doubles' ? '2V2' : score[0] + score[1] >= 5 ? 'BO5' : 'BO3'}
            </span>
          </div>

          {/* Team 2 */}
          <div className="flex items-center justify-end gap-2.5 sm:gap-3.5 flex-1 min-w-0 text-right">
            <div className="flex flex-col min-w-0 items-end">
              {opponent.length === 1 && opponent[0]?.id ? (
                <button
                  type="button"
                  onClick={() => openInspect(opponent[0].id)}
                  className="text-right font-display font-black text-primary-navy hover:text-sapphire-blue text-xs sm:text-base md:text-lg truncate leading-tight transition-colors max-w-full"
                >
                  {opponent[0].name}
                </button>
              ) : (
                <div className="flex items-center justify-end gap-1 min-w-0 flex-wrap">
                  {opponent.length > 0 ? (
                    opponent.map((p, idx) => (
                      <span key={p.id || idx} className="inline-flex items-center">
                        {idx > 0 && <span className="text-slate-300 mx-1">/</span>}
                        <button
                          type="button"
                          onClick={() => openInspect(p.id)}
                          disabled={!p.id}
                          className="font-display font-black text-primary-navy hover:text-sapphire-blue text-xs sm:text-sm md:text-base truncate leading-tight transition-colors"
                        >
                          {p.name?.split(' ')[0] || '?'}
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="font-display font-black text-slate-400 text-xs">載入中...</span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className={cn('text-xs font-black font-display tabular-nums', p2Change >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                  {p2Change > 0 ? `+${p2Change}` : p2Change} 分
                </span>
                <TrendingDown
                  size={11}
                  strokeWidth={3}
                  aria-hidden="true"
                  className={cn(p2Change <= 0 ? 'text-rose-400' : 'text-emerald-500 rotate-180')}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => openInspect(opponent[0]?.id)}
              disabled={!opponent[0]?.id}
              aria-label={`檢視 ${opponent[0]?.name || '選手'} 戰情檔案`}
              className={cn('flex shrink-0 group/p2 rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue', opponent.length > 1 ? '-space-x-2.5 sm:-space-x-4' : '')}
            >
              {opponent.map((p, i) => (
                <PlayerAvatar
                  key={p.id || i}
                  src={p.avatar}
                  name={p.name}
                  className="size-10 sm:size-13 md:size-14 rounded-xl md:rounded-2xl border-2 border-white shadow-xs ring-1 ring-slate-200/70 text-xs sm:text-sm group-hover/p2:ring-sapphire-blue transition-all"
                />
              ))}
              {opponent.length === 0 && <div className="size-10 sm:size-14 rounded-xl bg-slate-100 animate-pulse" />}
            </button>
          </div>
        </div>

        {/* Dispute Action */}
        {match.status === 'disputed' && (
          <div className="pt-2 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="w-full max-w-sm bg-rose-50/40 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 rounded-xl h-11 font-sans font-black text-xs uppercase tracking-wider gap-2 shadow-none"
            >
              <Scale size={15} aria-hidden="true" />
              檢視申訴細節
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
