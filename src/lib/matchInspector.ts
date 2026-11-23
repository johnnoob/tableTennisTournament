import type { MatchFeedItem, MatchPlayer } from '@/types/api.types';

export interface PivotPlayerStats {
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  netMmr: number;
}

export type H2HContext = {
  role: 'rival' | 'partner';
  player: MatchPlayer;
} | null;

export interface FormatSplitSummary {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface RecentFormTile {
  id: string;
  win: boolean;
  tooltip: string;
}

export interface PersonalSliceStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  netMmr: number;
  singles: FormatSplitSummary;
  doubles: FormatSplitSummary;
  recentForm: RecentFormTile[];
  h2hContext: H2HContext;
}

export interface PersonalPivots {
  topRivals: PivotPlayerStats[];
  topPartners: PivotPlayerStats[];
}

export interface ClubInspectorStats {
  total: number;
  singlesCount: number;
  doublesCount: number;
  singlesPct: number;
  doublesPct: number;
  confirmedCount: number;
  pendingCount: number;
  activePlayersCount: number;
  totalPendingInBase: number;
  topActivePlayers: PivotPlayerStats[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const formatSignedDelta = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export const getNormalizedDept = (dept?: string | null): string => {
  const trimmed = dept?.trim();
  if (!trimmed || trimmed === '未設定處室') return '';
  return trimmed;
};

function getPlayerPerspective(match: MatchFeedItem, currentUserId: string | null) {
  const isTeamA = Boolean(
    currentUserId && match.player1?.some((p) => String(p.id) === currentUserId),
  );
  const myTeam = isTeamA ? match.player1 || [] : match.opponent || [];
  const rivalTeam = isTeamA ? match.opponent || [] : match.player1 || [];
  const myPartners = myTeam.filter((p) => String(p.id) !== currentUserId);
  const isSettled = match.status === 'confirmed' || match.status === 'completed';
  const myDelta = isSettled ? (isTeamA ? match.mmrChange?.[0] || 0 : match.mmrChange?.[1] || 0) : 0;
  const myScore = isTeamA ? (match.score?.[0] ?? 0) : (match.score?.[1] ?? 0);
  const oppScore = isTeamA ? (match.score?.[1] ?? 0) : (match.score?.[0] ?? 0);

  return {
    isTeamA,
    myTeam,
    rivalTeam,
    myPartners,
    isSettled,
    myDelta,
    myScore,
    oppScore,
  };
}

export function computePersonalSliceStats(
  filteredMatches: MatchFeedItem[],
  currentUserId: string | null,
  searchQuery: string,
): PersonalSliceStats {
  let wins = 0;
  let netSum = 0;
  let singlesTotal = 0;
  let singlesWins = 0;
  let doublesTotal = 0;
  let doublesWins = 0;

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchedRivals = new Map<string, MatchPlayer>();
  const matchedPartners = new Map<string, MatchPlayer>();
  const recentForm: RecentFormTile[] = [];

  for (let idx = 0; idx < filteredMatches.length; idx += 1) {
    const m = filteredMatches[idx];
    const isWin = m.result === 'win';
    const { rivalTeam, myPartners, myDelta, myScore, oppScore } = getPlayerPerspective(
      m,
      currentUserId,
    );

    if (isWin) wins += 1;
    netSum += myDelta;

    if (m.type === 'doubles') {
      doublesTotal += 1;
      if (isWin) doublesWins += 1;
    } else {
      singlesTotal += 1;
      if (isWin) singlesWins += 1;
    }

    if (idx < 10) {
      const rivalNames = rivalTeam.map((p) => p.name).filter(Boolean).join(' / ') || '對手';
      recentForm.push({
        id: m.id,
        win: isWin,
        tooltip: `${isWin ? '勝' : '敗'} ${myScore}:${oppScore} · vs ${rivalNames}`,
      });
    }

    if (trimmedQuery) {
      for (const rival of rivalTeam) {
        if ((rival.name || '').toLowerCase().includes(trimmedQuery)) {
          const key = String(rival.id || rival.name);
          if (key && !matchedRivals.has(key)) {
            matchedRivals.set(key, rival);
          }
        }
      }
      for (const partner of myPartners) {
        if ((partner.name || '').toLowerCase().includes(trimmedQuery)) {
          const key = String(partner.id || partner.name);
          if (key && !matchedPartners.has(key)) {
            matchedPartners.set(key, partner);
          }
        }
      }
    }
  }

  const total = filteredMatches.length;
  const losses = total - wins;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  let h2hContext: H2HContext = null;
  if (trimmedQuery && total > 0) {
    if (matchedRivals.size === 1) {
      const rival = Array.from(matchedRivals.values())[0];
      h2hContext = { role: 'rival', player: rival };
    } else if (matchedRivals.size === 0 && matchedPartners.size === 1) {
      const partner = Array.from(matchedPartners.values())[0];
      h2hContext = { role: 'partner', player: partner };
    }
  }

  return {
    total,
    wins,
    losses,
    winRate,
    netMmr: round1(netSum),
    singles: {
      total: singlesTotal,
      wins: singlesWins,
      losses: singlesTotal - singlesWins,
      winRate: singlesTotal > 0 ? Math.round((singlesWins / singlesTotal) * 100) : 0,
    },
    doubles: {
      total: doublesTotal,
      wins: doublesWins,
      losses: doublesTotal - doublesWins,
      winRate: doublesTotal > 0 ? Math.round((doublesWins / doublesTotal) * 100) : 0,
    },
    recentForm,
    h2hContext,
  };
}

interface PivotAccumulator {
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  matches: number;
  wins: number;
  losses: number;
  netMmr: number;
}

function finalizePivots(accMap: Map<string, PivotAccumulator>): PivotPlayerStats[] {
  return Array.from(accMap.values()).map((item) => ({
    id: item.id,
    name: item.name,
    avatar: item.avatar,
    department: item.department,
    matches: item.matches,
    wins: item.wins,
    losses: item.losses,
    winRate: item.matches > 0 ? Math.round((item.wins / item.matches) * 100) : 0,
    netMmr: round1(item.netMmr),
  }));
}

export function computePersonalPivots(
  myBaseMatches: MatchFeedItem[],
  currentUserId: string | null,
): PersonalPivots {
  const rivalMap = new Map<string, PivotAccumulator>();
  const partnerMap = new Map<string, PivotAccumulator>();

  for (const m of myBaseMatches) {
    const isWin = m.result === 'win';
    const { rivalTeam, myPartners, myDelta } = getPlayerPerspective(m, currentUserId);

    for (const rival of rivalTeam) {
      const key = String(rival.id || rival.name || '');
      if (!key || !rival.name) continue;
      const existing = rivalMap.get(key) ?? {
        id: key,
        name: rival.name,
        avatar: rival.avatar,
        department: rival.department,
        matches: 0,
        wins: 0,
        losses: 0,
        netMmr: 0,
      };
      existing.matches += 1;
      if (isWin) existing.wins += 1;
      else existing.losses += 1;
      existing.netMmr += myDelta;
      if (!existing.avatar && rival.avatar) existing.avatar = rival.avatar;
      if (!existing.department && rival.department) existing.department = rival.department;
      rivalMap.set(key, existing);
    }

    if (m.type === 'doubles') {
      for (const partner of myPartners) {
        const key = String(partner.id || partner.name || '');
        if (!key || !partner.name) continue;
        const existing = partnerMap.get(key) ?? {
          id: key,
          name: partner.name,
          avatar: partner.avatar,
          department: partner.department,
          matches: 0,
          wins: 0,
          losses: 0,
          netMmr: 0,
        };
        existing.matches += 1;
        if (isWin) existing.wins += 1;
        else existing.losses += 1;
        existing.netMmr += myDelta;
        if (!existing.avatar && partner.avatar) existing.avatar = partner.avatar;
        if (!existing.department && partner.department) existing.department = partner.department;
        partnerMap.set(key, existing);
      }
    }
  }

  const topRivals = finalizePivots(rivalMap)
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins)
    .slice(0, 4);

  const topPartners = finalizePivots(partnerMap)
    .sort((a, b) => b.matches - a.matches || b.winRate - a.winRate)
    .slice(0, 3);

  return { topRivals, topPartners };
}

export function computeClubStats(
  filteredMatches: MatchFeedItem[],
  allBaseMatches: MatchFeedItem[],
): ClubInspectorStats {
  let singlesCount = 0;
  let doublesCount = 0;
  let confirmedCount = 0;
  let pendingCount = 0;
  const activeIds = new Set<string>();

  for (const m of filteredMatches) {
    if (m.type === 'doubles') doublesCount += 1;
    else singlesCount += 1;

    if (m.status === 'confirmed' || m.status === 'completed') confirmedCount += 1;
    else if (m.status === 'pending') pendingCount += 1;

    for (const p of [...(m.player1 || []), ...(m.opponent || [])]) {
      const key = String(p.id || p.name || '');
      if (key) activeIds.add(key);
    }
  }

  const total = filteredMatches.length;
  const singlesPct = total > 0 ? Math.round((singlesCount / total) * 100) : 0;
  const doublesPct = total > 0 ? 100 - singlesPct : 0;

  let totalPendingInBase = 0;
  const playerMap = new Map<string, PivotAccumulator>();

  for (const m of allBaseMatches) {
    if (m.status === 'pending') totalPendingInBase += 1;

    const s1 = m.score?.[0] ?? 0;
    const s2 = m.score?.[1] ?? 0;
    const team1Won = s1 > s2;
    const team2Won = s2 > s1;

    for (const p of m.player1 || []) {
      const key = String(p.id || p.name || '');
      if (!key || !p.name) continue;
      const existing = playerMap.get(key) ?? {
        id: key,
        name: p.name,
        avatar: p.avatar,
        department: p.department,
        matches: 0,
        wins: 0,
        losses: 0,
        netMmr: 0,
      };
      existing.matches += 1;
      if (team1Won) existing.wins += 1;
      else if (team2Won) existing.losses += 1;
      if (!existing.avatar && p.avatar) existing.avatar = p.avatar;
      if (!existing.department && p.department) existing.department = p.department;
      playerMap.set(key, existing);
    }

    for (const p of m.opponent || []) {
      const key = String(p.id || p.name || '');
      if (!key || !p.name) continue;
      const existing = playerMap.get(key) ?? {
        id: key,
        name: p.name,
        avatar: p.avatar,
        department: p.department,
        matches: 0,
        wins: 0,
        losses: 0,
        netMmr: 0,
      };
      existing.matches += 1;
      if (team2Won) existing.wins += 1;
      else if (team1Won) existing.losses += 1;
      if (!existing.avatar && p.avatar) existing.avatar = p.avatar;
      if (!existing.department && p.department) existing.department = p.department;
      playerMap.set(key, existing);
    }
  }

  const topActivePlayers = finalizePivots(playerMap)
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins)
    .slice(0, 5);

  return {
    total,
    singlesCount,
    doublesCount,
    singlesPct,
    doublesPct,
    confirmedCount,
    pendingCount,
    activePlayersCount: activeIds.size,
    totalPendingInBase,
    topActivePlayers,
  };
}
