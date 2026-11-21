import { format } from 'date-fns';
import { formatLocalTime } from '@/lib/utils';

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
