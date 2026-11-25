import type { ChallengeItem } from '@/types/api.types';
import { formatLocalTime } from '@/lib/utils';

export const CHALLENGE_MESSAGE_TEMPLATES: string[] = [
  '午休出來揮幾拍！',
  '來一場認真切磋！',
  '上次沒打夠，再戰一輪！',
  '下班活動筋骨輕鬆打～',
];

export const DECLINE_REASON_PRESETS: string[] = [
  '近期開會／公務較忙',
  '這時段剛好不方便',
  '手感調整中，下次再戰',
];

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTodayLocalDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getDefaultChallengeDateTime(baseIso?: string | null): { date: string; time: string } {
  if (baseIso) {
    const parsed = new Date(baseIso);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      return {
        date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
        time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
      };
    }
  }

  const candidate = new Date(Date.now() + 60 * 60 * 1000);
  const mins = candidate.getMinutes();
  if (mins === 0) {
    // keep :00
  } else if (mins <= 30) {
    candidate.setMinutes(30, 0, 0);
  } else {
    candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
  }

  if (candidate.getHours() >= 22) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 15, 0, 0);
    return {
      date: `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`,
      time: '12:15',
    };
  }

  return {
    date: `${candidate.getFullYear()}-${pad2(candidate.getMonth() + 1)}-${pad2(candidate.getDate())}`,
    time: `${pad2(candidate.getHours())}:${pad2(candidate.getMinutes())}`,
  };
}

export function combineLocalDateTimeToIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const dateParts = dateStr.split('-').map(Number);
  const timeParts = timeStr.split(':').map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const [y, m, d] = dateParts;
  const [hh, mm] = timeParts;
  if ([y, m, d, hh, mm].some((v) => Number.isNaN(v))) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function formatChallengeDateTimeLabel(iso?: string | null): string {
  if (!iso) return '時間待定';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '時間待定';
  const weekday = WEEKDAY_LABELS[dt.getDay()];
  return `${formatLocalTime(iso, 'MM/dd')} (${weekday}) ${formatLocalTime(iso, 'HH:mm')}`;
}

export function buildChallengeShareText(challenge: ChallengeItem): string {
  const modeLabel = challenge.match_type === 'doubles' ? '雙打' : '單打';
  const teamAName = challenge.challenger?.name || '挑戰方';
  const teamBName = challenge.challenged?.name || '應戰方';
  const sideA =
    challenge.match_type === 'doubles'
      ? `${teamAName} / ${challenge.challenger_partner?.name || '現場湊咖'}`
      : teamAName;
  const sideB =
    challenge.match_type === 'doubles'
      ? `${teamBName} / ${challenge.challenged_partner?.name || '現場湊咖'}`
      : teamBName;

  const when = formatChallengeDateTimeLabel(challenge.proposed_at);
  const loc = challenge.location ? `\n📍 地點：${challenge.location}` : '';
  const msg = challenge.message ? `\n💬 「${challenge.message}」` : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    `🏓【Precision Arena 約戰戰帖】\n` +
    `⚔️ ${sideA} vs ${sideB}\n` +
    `📅 時間：${when}（${modeLabel} ${challenge.format}）` +
    loc +
    msg +
    (origin ? `\n👉 ${origin}` : '')
  );
}

function toIcsUtc(dt: Date): string {
  return (
    dt.getUTCFullYear() +
    pad2(dt.getUTCMonth() + 1) +
    pad2(dt.getUTCDate()) +
    'T' +
    pad2(dt.getUTCHours()) +
    pad2(dt.getUTCMinutes()) +
    pad2(dt.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function downloadChallengeIcs(challenge: ChallengeItem): void {
  const start = new Date(challenge.proposed_at);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const now = new Date();

  const teamA = challenge.challenger?.name || '挑戰方';
  const teamB = challenge.challenged?.name || '應戰方';
  const modeLabel = challenge.match_type === 'doubles' ? '雙打' : '單打';
  const summary = escapeIcsText(`🏓 桌球約戰：${teamA} vs ${teamB} (${modeLabel} ${challenge.format})`);
  const desc = escapeIcsText(
    [
      challenge.message ? `戰帖喊話：${challenge.message}` : null,
      '賽後可直接回 Precision Arena 首頁一鍵轉報分。',
    ]
      .filter(Boolean)
      .join('\n')
  );
  const loc = escapeIcsText(challenge.location || 'Precision Arena 桌球室');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Precision Arena//MatchChallenge//ZH-TW',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:challenge-${challenge.id}@precision-arena`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${loc}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:桌球約戰即將在 15 分鐘後開打！',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `arena-challenge-${formatLocalTime(challenge.proposed_at, 'MMdd-HHmm')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function doesLineupMatchChallenge({
  challenge,
  myUserId,
  matchType,
  partnerId,
  opponent1Id,
  opponent2Id,
}: {
  challenge: ChallengeItem;
  myUserId: string;
  matchType: 'singles' | 'doubles';
  partnerId: string | null;
  opponent1Id: string | null;
  opponent2Id: string | null;
}): boolean {
  if (challenge.status !== 'accepted' || challenge.match_type !== matchType) {
    return false;
  }

  const challengerId = challenge.challenger?.id;
  const challengedId = challenge.challenged?.id;
  if (!challengerId || !challengedId) {
    return false;
  }

  const teamA = new Set<string>([myUserId]);
  if (matchType === 'doubles' && partnerId) {
    teamA.add(partnerId);
  }

  const teamB = new Set<string>();
  if (opponent1Id) teamB.add(opponent1Id);
  if (matchType === 'doubles' && opponent2Id) teamB.add(opponent2Id);

  let challengerTeam: Set<string>;
  let challengedTeam: Set<string>;
  if (teamA.has(challengerId) && teamB.has(challengedId)) {
    challengerTeam = teamA;
    challengedTeam = teamB;
  } else if (teamB.has(challengerId) && teamA.has(challengedId)) {
    challengerTeam = teamB;
    challengedTeam = teamA;
  } else {
    return false;
  }

  if (matchType === 'singles') {
    return teamA.size === 1 && teamB.size === 1;
  }

  const challengerPartnerId = challenge.challenger_partner?.id;
  const challengedPartnerId = challenge.challenged_partner?.id;
  if (challengerPartnerId && !challengerTeam.has(challengerPartnerId)) {
    return false;
  }
  if (challengedPartnerId && !challengedTeam.has(challengedPartnerId)) {
    return false;
  }
  return true;
}

export function isChallengeWithinAutoLinkWindow(
  challenge: ChallengeItem,
  nowMs: number,
): boolean {
  if (challenge.status !== 'accepted') return false;
  const proposedMs = Date.parse(challenge.proposed_at);
  if (Number.isNaN(proposedMs)) return false;

  const windowStart = proposedMs - 60 * 60 * 1000;
  let latestReportedMs = 0;
  for (const m of challenge.reported_matches ?? []) {
    if (!m.created_at) continue;
    const t = Date.parse(m.created_at);
    if (!Number.isNaN(t) && t > latestReportedMs) {
      latestReportedMs = t;
    }
  }

  const windowEnd = Math.max(
    proposedMs + 4 * 60 * 60 * 1000,
    latestReportedMs > 0 ? latestReportedMs + 2 * 60 * 60 * 1000 : 0,
  );
  return nowMs >= windowStart && nowMs <= windowEnd;
}

export function getChallengeOpponentSummary(
  challenge: ChallengeItem,
  myUserId: string,
): string {
  const isChallengerSide =
    challenge.challenger?.id === myUserId ||
    challenge.challenger_partner?.id === myUserId;

  const lead = isChallengerSide ? challenge.challenged : challenge.challenger;
  const partner = isChallengerSide
    ? challenge.challenged_partner
    : challenge.challenger_partner;

  const leadName = lead?.name || '對手';
  if (challenge.match_type === 'doubles') {
    return `${leadName} / ${partner?.name || '現場湊咖'}`;
  }
  return leadName;
}
