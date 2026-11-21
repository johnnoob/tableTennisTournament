export interface PendingPlayer {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface PendingMatch {
  id: string;
  date: string;
  created_at?: string;
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

export type PendingPerspective = 'confirm' | 'waiting';

export interface MatchPerspectiveInfo {
  type: 'singles' | 'doubles';
  myTeam: PendingPlayer[];
  rivalTeam: PendingPlayer[];
  partner: PendingPlayer | null;
  myScore: number;
  rivalScore: number;
  isWin: boolean;
  isLoss: boolean;
  myDelta: number;
}

export interface MatchupGroup {
  key: string;
  type: 'singles' | 'doubles';
  myTeam: PendingPlayer[];
  rivalTeam: PendingPlayer[];
  partner: PendingPlayer | null;
  matches: PendingMatch[];
  wins: number;
  losses: number;
  estimatedTotalDelta: number;
  earliestExpiresAt?: string;
  latestTimestamp: number;
}

export function formatTeamNames(players: PendingPlayer[]): string {
  if (players.length > 1) {
    return players.map((p) => p.name?.split(' ')[0] || '?').join(' / ');
  }
  return players[0]?.name || '未知選手';
}

export function formatSignedDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function getRemainingTimeStr(expiresAtStr?: string): string {
  if (!expiresAtStr) return '--:--';
  const expiresAt = new Date(expiresAtStr).getTime();
  if (!Number.isFinite(expiresAt)) return '--:--';
  const diffMs = expiresAt - Date.now();

  if (diffMs <= 0) return '已逾期';

  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getMatchTimestamp(match: PendingMatch): number {
  const ts = Date.parse(match.created_at || match.date);
  return Number.isFinite(ts) ? ts : 0;
}

export function getMatchPerspective(
  match: PendingMatch,
  perspective: PendingPerspective,
  currentUserId?: string,
): MatchPerspectiveInfo {
  const type = match.type === 'doubles' ? 'doubles' : 'singles';
  const isConfirm = perspective === 'confirm';

  const myTeam = isConfirm ? match.opponent : match.player1;
  const rivalTeam = isConfirm ? match.player1 : match.opponent;
  const myScore = isConfirm ? match.score[1] : match.score[0];
  const rivalScore = isConfirm ? match.score[0] : match.score[1];
  const myDelta = isConfirm ? match.mmrChange[1] : match.mmrChange[0];

  const partner =
    type === 'doubles'
      ? myTeam.find((p) => String(p.id) !== String(currentUserId)) ?? myTeam[1] ?? null
      : null;

  return {
    type,
    myTeam,
    rivalTeam,
    partner,
    myScore,
    rivalScore,
    isWin: myScore > rivalScore,
    isLoss: myScore < rivalScore,
    myDelta,
  };
}

function normalizeTeamKey(players: PendingPlayer[]): string {
  return players
    .map((p) => String(p.id))
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

export function groupPendingMatches(
  matches: PendingMatch[],
  perspective: PendingPerspective,
  currentUserId?: string,
): MatchupGroup[] {
  const groupMap = new Map<
    string,
    {
      type: 'singles' | 'doubles';
      myTeam: PendingPlayer[];
      rivalTeam: PendingPlayer[];
      partner: PendingPlayer | null;
      matches: PendingMatch[];
    }
  >();

  for (const match of matches) {
    const info = getMatchPerspective(match, perspective, currentUserId);
    const key = `${info.type}::${normalizeTeamKey(info.myTeam)}::${normalizeTeamKey(info.rivalTeam)}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.matches.push(match);
    } else {
      groupMap.set(key, {
        type: info.type,
        myTeam: info.myTeam,
        rivalTeam: info.rivalTeam,
        partner: info.partner,
        matches: [match],
      });
    }
  }

  const groups: MatchupGroup[] = [];

  for (const [key, entry] of groupMap.entries()) {
    const orderedMatches = [...entry.matches].sort(
      (a, b) => getMatchTimestamp(a) - getMatchTimestamp(b) || a.id.localeCompare(b.id),
    );

    let wins = 0;
    let losses = 0;
    let deltaSum = 0;
    let latestTimestamp = 0;
    let earliestExpiry: { ts: number; raw: string } | null = null;

    for (const match of orderedMatches) {
      const info = getMatchPerspective(match, perspective, currentUserId);
      if (info.isWin) wins += 1;
      if (info.isLoss) losses += 1;
      deltaSum += info.myDelta;

      const ts = getMatchTimestamp(match);
      if (ts > latestTimestamp) latestTimestamp = ts;

      if (match.expiresAt) {
        const expTs = Date.parse(match.expiresAt);
        if (Number.isFinite(expTs) && (!earliestExpiry || expTs < earliestExpiry.ts)) {
          earliestExpiry = { ts: expTs, raw: match.expiresAt };
        }
      }
    }

    groups.push({
      key,
      type: entry.type,
      myTeam: entry.myTeam,
      rivalTeam: entry.rivalTeam,
      partner: entry.partner,
      matches: orderedMatches,
      wins,
      losses,
      estimatedTotalDelta: Math.round(deltaSum * 10) / 10,
      earliestExpiresAt: earliestExpiry?.raw ?? orderedMatches[0]?.expiresAt,
      latestTimestamp,
    });
  }

  return groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}
