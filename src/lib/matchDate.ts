import { format } from 'date-fns';
import { formatLocalTime } from '@/lib/utils';
import type { MatchFeedItem, MatchPlayer } from '@/types/api.types';

const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function parseMatchDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatSmartMatchTime(dateStr?: string | null): string {
  const d = parseMatchDate(dateStr);
  if (!d) return dateStr || '-';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs >= 0 && diffMs < 60_000) return '剛剛';
  if (diffMs >= 0 && diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分鐘前`;
  if (isSameLocalDay(d, now)) return `今天 ${format(d, 'HH:mm')}`;

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameLocalDay(d, yesterday)) return `昨天 ${format(d, 'HH:mm')}`;

  if (d.getFullYear() === now.getFullYear()) return format(d, 'MM/dd HH:mm');
  return format(d, 'yyyy/MM/dd');
}

export function formatMatchClock(dateStr?: string | null): string {
  return formatLocalTime(dateStr, 'HH:mm') || '-';
}

export function getMatchDateGroup(dateStr?: string | null): { key: string; label: string } {
  const d = parseMatchDate(dateStr);
  if (!d) return { key: 'unknown', label: '其他日期' };

  const key = format(d, 'yyyy-MM-dd');
  const now = new Date();
  if (isSameLocalDay(d, now)) return { key, label: '今天' };

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameLocalDay(d, yesterday)) return { key, label: '昨天' };

  if (d.getFullYear() === now.getFullYear()) {
    return {
      key,
      label: `${d.getMonth() + 1}月${d.getDate()}日 (${WEEKDAYS_ZH[d.getDay()]})`,
    };
  }

  return {
    key,
    label: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
  };
}

export function groupMatchesByDate<T extends { date?: string; created_at?: string }>(
  matches: T[],
): Array<{ key: string; label: string; items: T[] }> {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  const indexByKey = new Map<string, number>();

  for (const match of matches) {
    const group = getMatchDateGroup(match.date || match.created_at);
    const existingIndex = indexByKey.get(group.key);
    if (existingIndex === undefined) {
      indexByKey.set(group.key, groups.length);
      groups.push({ key: group.key, label: group.label, items: [match] });
    } else {
      groups[existingIndex].items.push(match);
    }
  }

  return groups;
}

export function normalizeTeamKey(players: MatchPlayer[]): string {
  return (players || [])
    .map((p) => String(p.id || p.name))
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

export interface MatchSeriesGameSummary {
  match: MatchFeedItem;
  index: number;
  team1Score: number;
  team2Score: number;
  team1Won: boolean;
  team1Delta: number;
  team2Delta: number;
  isPending: boolean;
  isDisputed: boolean;
  isSettled: boolean;
}

export interface MatchSeriesCluster {
  key: string;
  dateKey: string;
  type: 'singles' | 'doubles';
  matches: MatchFeedItem[];
  games: MatchSeriesGameSummary[];
  latestMatch: MatchFeedItem;
  anchorTeam1: MatchPlayer[];
  anchorTeam2: MatchPlayer[];
  team1Wins: number;
  team2Wins: number;
  team1NetDelta: number;
  team2NetDelta: number;
  hasPending: boolean;
  hasDisputed: boolean;
  allSettled: boolean;
}

export function clusterMatchesIntoSeries(matches: MatchFeedItem[]): MatchSeriesCluster[] {
  const bucketMap = new Map<
    string,
    { dateKey: string; type: 'singles' | 'doubles'; items: MatchFeedItem[] }
  >();
  const orderedKeys: string[] = [];

  for (const m of matches) {
    const dateKey = getMatchDateGroup(m.date || m.created_at).key;
    const type: 'singles' | 'doubles' = m.type === 'doubles' ? 'doubles' : 'singles';
    const [sideA, sideB] = [
      normalizeTeamKey(m.player1 || []),
      normalizeTeamKey(m.opponent || []),
    ].sort((a, b) => a.localeCompare(b));
    const key = `${dateKey}::${type}::${sideA}::${sideB}`;

    const existing = bucketMap.get(key);
    if (existing) {
      existing.items.push(m);
    } else {
      bucketMap.set(key, { dateKey, type, items: [m] });
      orderedKeys.push(key);
    }
  }

  return orderedKeys.map((key) => {
    const bucket = bucketMap.get(key)!;
    const clusterMatches = bucket.items;
    const latestMatch = clusterMatches[0];
    const anchorTeam1 = latestMatch.player1 || [];
    const anchorTeam2 = latestMatch.opponent || [];
    const anchorTeam1Key = normalizeTeamKey(anchorTeam1);

    const chronological = [...clusterMatches].reverse();
    let team1Wins = 0;
    let team2Wins = 0;
    let team1Net = 0;
    let team2Net = 0;
    let hasPending = false;
    let hasDisputed = false;
    let allSettled = true;

    const games: MatchSeriesGameSummary[] = chronological.map((m, idx) => {
      const score = m.score || [0, 0];
      const sameOrientation = normalizeTeamKey(m.player1 || []) === anchorTeam1Key;
      const team1Score = sameOrientation ? score[0] : score[1];
      const team2Score = sameOrientation ? score[1] : score[0];
      const team1Won = team1Score > team2Score;

      const rawP1 = m.mmrChange?.[0] ?? 0;
      const rawP2 = m.mmrChange?.[1] ?? 0;
      const team1Delta = sameOrientation ? rawP1 : rawP2;
      const team2Delta = sameOrientation ? rawP2 : rawP1;

      const isPending = m.status === 'pending';
      const isDisputed = m.status === 'disputed';
      const isSettled = m.status === 'confirmed' || m.status === 'completed';

      if (team1Won) team1Wins += 1;
      else if (team2Score > team1Score) team2Wins += 1;

      if (isPending) hasPending = true;
      if (isDisputed) hasDisputed = true;
      if (isSettled) {
        team1Net += team1Delta;
        team2Net += team2Delta;
      } else {
        allSettled = false;
      }

      return {
        match: m,
        index: idx + 1,
        team1Score,
        team2Score,
        team1Won,
        team1Delta,
        team2Delta,
        isPending,
        isDisputed,
        isSettled,
      };
    });

    return {
      key,
      dateKey: bucket.dateKey,
      type: bucket.type,
      matches: clusterMatches,
      games,
      latestMatch,
      anchorTeam1,
      anchorTeam2,
      team1Wins,
      team2Wins,
      team1NetDelta: Math.round(team1Net * 10) / 10,
      team2NetDelta: Math.round(team2Net * 10) / 10,
      hasPending,
      hasDisputed,
      allSettled,
    };
  });
}
