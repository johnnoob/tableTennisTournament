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
  lastPlayedAt: number;
}

export interface RecentCompanionStats extends PivotPlayerStats {
  lastRole: 'rival' | 'partner';
}

export interface SelectedPlayerFilter {
  id?: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  role: 'any' | 'rival' | 'partner';
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
  recentPlayers: RecentCompanionStats[];
  topRivals: PivotPlayerStats[];
  topPartners: PivotPlayerStats[];
  allRivals: PivotPlayerStats[];
  allPartners: PivotPlayerStats[];
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
  recentPlayers: PivotPlayerStats[];
  topActivePlayers: PivotPlayerStats[];
  allPlayers: PivotPlayerStats[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const formatSignedDelta = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export const getNormalizedDept = (dept?: string | null): string => {
  const trimmed = dept?.trim();
  if (!trimmed || trimmed === '未設定處室') return '';
  return trimmed;
};

function getMatchTimestamp(match: MatchFeedItem): number {
  const raw = match.date || match.created_at;
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function getPlayerPerspective(match: MatchFeedItem, currentUserId: string | null) {
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

export function matchesSelectedPlayerFilter(
  match: MatchFeedItem,
  selected: SelectedPlayerFilter,
  scope: 'mine' | 'all',
  currentUserId: string | null,
): boolean {
  const targetId = selected.id ? String(selected.id) : null;
  const targetName = selected.name.trim().toLowerCase();

  const playerMatches = (p: MatchPlayer) => {
    if (targetId && p.id && String(p.id) === targetId) return true;
    const pName = (p.name || '').trim().toLowerCase();
    const pDept = (p.department || '').trim().toLowerCase();
    if (targetId) return pName === targetName;
    return pName.includes(targetName) || pDept.includes(targetName);
  };

  if (scope === 'mine' && currentUserId && selected.role !== 'any') {
    const { rivalTeam, myPartners } = getPlayerPerspective(match, currentUserId);
    if (selected.role === 'rival') {
      return rivalTeam.some(playerMatches);
    }
    if (selected.role === 'partner') {
      return myPartners.some(playerMatches);
    }
  }

  const allPlayers = [...(match.player1 || []), ...(match.opponent || [])];
  return allPlayers.some(playerMatches);
}

export function computePersonalSliceStats(
  filteredMatches: MatchFeedItem[],
  currentUserId: string | null,
  searchQuery: string,
  selectedPlayer?: SelectedPlayerFilter | null,
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
  if (selectedPlayer) {
    const resolvedPlayer: MatchPlayer = {
      id: selectedPlayer.id || '',
      name: selectedPlayer.name,
      avatar: selectedPlayer.avatar,
      department: selectedPlayer.department,
    };
    if (selectedPlayer.role === 'partner') {
      h2hContext = { role: 'partner', player: resolvedPlayer };
    } else if (selectedPlayer.role === 'rival') {
      h2hContext = { role: 'rival', player: resolvedPlayer };
    } else if (matchedRivals.size === 0 && matchedPartners.size >= 1) {
      h2hContext = { role: 'partner', player: Array.from(matchedPartners.values())[0] };
    } else {
      h2hContext = { role: 'rival', player: resolvedPlayer };
    }
  } else if (trimmedQuery && total > 0) {
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
  lastPlayedAt: number;
}

interface RecentAccumulator extends PivotAccumulator {
  lastRole: 'rival' | 'partner';
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
    lastPlayedAt: item.lastPlayedAt,
  }));
}

export function computePersonalPivots(
  myBaseMatches: MatchFeedItem[],
  currentUserId: string | null,
): PersonalPivots {
  const rivalMap = new Map<string, PivotAccumulator>();
  const partnerMap = new Map<string, PivotAccumulator>();
  const recentMap = new Map<string, RecentAccumulator>();

  for (const m of myBaseMatches) {
    const isWin = m.result === 'win';
    const matchTs = getMatchTimestamp(m);
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
        lastPlayedAt: 0,
      };
      existing.matches += 1;
      if (isWin) existing.wins += 1;
      else existing.losses += 1;
      existing.netMmr += myDelta;
      if (matchTs > existing.lastPlayedAt) existing.lastPlayedAt = matchTs;
      if (!existing.avatar && rival.avatar) existing.avatar = rival.avatar;
      if (!existing.department && rival.department) existing.department = rival.department;
      rivalMap.set(key, existing);

      const recent = recentMap.get(key) ?? {
        id: key,
        name: rival.name,
        avatar: rival.avatar,
        department: rival.department,
        matches: 0,
        wins: 0,
        losses: 0,
        netMmr: 0,
        lastPlayedAt: -1,
        lastRole: 'rival' as const,
      };
      recent.matches += 1;
      if (isWin) recent.wins += 1;
      else recent.losses += 1;
      recent.netMmr += myDelta;
      if (matchTs >= recent.lastPlayedAt) {
        recent.lastPlayedAt = matchTs;
        recent.lastRole = 'rival';
      }
      if (!recent.avatar && rival.avatar) recent.avatar = rival.avatar;
      if (!recent.department && rival.department) recent.department = rival.department;
      recentMap.set(key, recent);
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
          lastPlayedAt: 0,
        };
        existing.matches += 1;
        if (isWin) existing.wins += 1;
        else existing.losses += 1;
        existing.netMmr += myDelta;
        if (matchTs > existing.lastPlayedAt) existing.lastPlayedAt = matchTs;
        if (!existing.avatar && partner.avatar) existing.avatar = partner.avatar;
        if (!existing.department && partner.department) existing.department = partner.department;
        partnerMap.set(key, existing);

        const recent = recentMap.get(key) ?? {
          id: key,
          name: partner.name,
          avatar: partner.avatar,
          department: partner.department,
          matches: 0,
          wins: 0,
          losses: 0,
          netMmr: 0,
          lastPlayedAt: -1,
          lastRole: 'partner' as const,
        };
        recent.matches += 1;
        if (isWin) recent.wins += 1;
        else recent.losses += 1;
        recent.netMmr += myDelta;
        if (matchTs >= recent.lastPlayedAt) {
          recent.lastPlayedAt = matchTs;
          recent.lastRole = 'partner';
        }
        if (!recent.avatar && partner.avatar) recent.avatar = partner.avatar;
        if (!recent.department && partner.department) recent.department = partner.department;
        recentMap.set(key, recent);
      }
    }
  }

  const recentPlayers: RecentCompanionStats[] = Array.from(recentMap.values())
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || b.matches - a.matches)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      department: item.department,
      matches: item.matches,
      wins: item.wins,
      losses: item.losses,
      winRate: item.matches > 0 ? Math.round((item.wins / item.matches) * 100) : 0,
      netMmr: round1(item.netMmr),
      lastPlayedAt: item.lastPlayedAt,
      lastRole: item.lastRole,
    }));

  const allRivals = finalizePivots(rivalMap).sort(
    (a, b) => b.matches - a.matches || b.lastPlayedAt - a.lastPlayedAt,
  );
  const topRivals = allRivals.slice(0, 6);

  const allPartners = finalizePivots(partnerMap).sort(
    (a, b) => b.matches - a.matches || b.winRate - a.winRate,
  );
  const topPartners = allPartners.slice(0, 5);

  return { recentPlayers, topRivals, topPartners, allRivals, allPartners };
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
    const matchTs = getMatchTimestamp(m);

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
        lastPlayedAt: 0,
      };
      existing.matches += 1;
      if (team1Won) existing.wins += 1;
      else if (team2Won) existing.losses += 1;
      if (matchTs > existing.lastPlayedAt) existing.lastPlayedAt = matchTs;
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
        lastPlayedAt: 0,
      };
      existing.matches += 1;
      if (team2Won) existing.wins += 1;
      else if (team1Won) existing.losses += 1;
      if (matchTs > existing.lastPlayedAt) existing.lastPlayedAt = matchTs;
      if (!existing.avatar && p.avatar) existing.avatar = p.avatar;
      if (!existing.department && p.department) existing.department = p.department;
      playerMap.set(key, existing);
    }
  }

  const allClubPlayers = finalizePivots(playerMap).sort(
    (a, b) => b.matches - a.matches || b.wins - a.wins,
  );

  const recentPlayers = [...allClubPlayers]
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || b.matches - a.matches)
    .slice(0, 5);

  const topActivePlayers = allClubPlayers.slice(0, 6);

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
    recentPlayers,
    topActivePlayers,
    allPlayers: allClubPlayers,
  };
}
