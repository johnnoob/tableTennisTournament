import { useState, useMemo } from 'react';
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
  TrendingUp,
  Radar as RadarIcon,
  BarChart3,
  Swords,
  Users,
  Lock,
  Calendar,
  Loader2,
  Star,
  ChevronRight,
} from 'lucide-react';
import { StatsChart } from '@/components/StatsChart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/contexts/theme-context';
import { cn, formatLocalTime } from '@/lib/utils';
import type {
  ChartDataPoint,
  PlayerAnalytics,
  PlayerStats,
  RadarAxisItem,
} from '@/types/api.types';

type HubView = 'progression' | 'radar' | 'breakdown';

const INTERVAL_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'recent', label: '近10場' },
  { id: 'recent30', label: '近30場' },
  { id: 'season', label: '本季' },
  { id: 'all', label: '生涯' },
];

const TIER_PILL_COLOR: Record<string, string> = {
  elite: 'bg-slate-900 text-amber-400 dark:bg-amber-500/20 dark:text-amber-300',
  gold: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  silver: 'bg-slate-200/80 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200',
  bronze: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
};

interface PlayerAnalyticsHubProps {
  stats?: PlayerStats;
  chartInterval: string;
  onChartIntervalChange: (val: string) => void;
  isFetching?: boolean;
  onInspectPlayer?: (id: string) => void;
}

export function PlayerAnalyticsHub({
  stats,
  chartInterval,
  onChartIntervalChange,
  isFetching = false,
  onInspectPlayer,
}: Readonly<PlayerAnalyticsHubProps>) {
  const [activeView, setActiveView] = useState<HubView>('progression');
  const [pinnedSelection, setPinnedSelection] = useState<{
    interval: string;
    idx: number;
  } | null>(null);

  const chartData = useMemo(() => stats?.chart_data ?? [], [stats?.chart_data]);
  const summary = stats?.progression_summary;
  const analytics = stats?.analytics;

  const activePinnedPoint: ChartDataPoint | undefined = useMemo(() => {
    if (chartData.length === 0) return undefined;
    if (pinnedSelection && pinnedSelection.interval === chartInterval) {
      const hit = chartData.find((p) => (p.idx ?? 0) === pinnedSelection.idx);
      if (hit) return hit;
    }
    return chartData[chartData.length - 1];
  }, [chartData, pinnedSelection, chartInterval]);

  return (
    <section
      aria-label="個人戰力分析艙"
      className="arena-surface p-4 sm:p-6 md:p-7 overflow-hidden space-y-4 sm:space-y-5"
    >
      {/* Top Header + View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-lg sm:text-xl text-foreground font-black tracking-tight">
            個人戰力分析艙
          </h2>
          <p className="text-[11px] text-muted-foreground uppercase font-sans font-bold tracking-wider">
            Player Analytics Hub · Single-Track Elo
          </p>
        </div>

        {/* 3-Tab Hub Switcher (Mobile full-width 44px touch targets) */}
        <Tabs
          value={activeView}
          onValueChange={(v) => setActiveView(v as HubView)}
          className="w-full lg:w-auto"
        >
          <TabsList className="grid w-full lg:w-auto grid-cols-3 h-10 sm:h-9 bg-secondary/90 border border-border rounded-xl p-1">
            <TabsTrigger
              value="progression"
              className="text-xs font-black rounded-lg px-2.5 sm:px-3.5 gap-1.5"
            >
              <TrendingUp size={13} aria-hidden="true" />
              <span>走勢曲線</span>
            </TabsTrigger>
            <TabsTrigger
              value="radar"
              className="text-xs font-black rounded-lg px-2.5 sm:px-3.5 gap-1.5"
            >
              <RadarIcon size={13} aria-hidden="true" />
              <span>球風雷達</span>
            </TabsTrigger>
            <TabsTrigger
              value="breakdown"
              className="text-xs font-black rounded-lg px-2.5 sm:px-3.5 gap-1.5"
            >
              <BarChart3 size={13} aria-hidden="true" />
              <span>勝敗拆解</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* View 1: 劇情式 ELO 走勢曲線 */}
      {activeView === 'progression' && (
        <div className="space-y-3.5">
          {/* Interval Selector + Quick KPI Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div
              role="group"
              aria-label="選擇走勢圖區間"
              className="grid grid-cols-4 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-surface-subtle border border-border"
            >
              {INTERVAL_OPTIONS.map((opt) => {
                const active = chartInterval === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPinnedSelection(null);
                      onChartIntervalChange(opt.id);
                    }}
                    className={cn(
                      'min-h-8 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all whitespace-nowrap',
                      active
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {isFetching && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Loader2 size={12} className="animate-spin text-sapphire-blue" aria-hidden="true" />
                更新數據中…
              </span>
            )}
          </div>

          {/* 3-Col Interval KPI Strip */}
          {summary && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl bg-surface-subtle/80 border border-border px-3 py-2.5">
                <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                  區間淨值
                </p>
                <p
                  className={cn(
                    'text-base sm:text-xl font-display font-black tabular-nums leading-tight mt-0.5',
                    summary.net_delta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : summary.net_delta < 0
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-foreground',
                  )}
                >
                  {summary.net_delta > 0 ? `+${summary.net_delta}` : summary.net_delta}
                </p>
              </div>

              <div className="rounded-2xl bg-surface-subtle/80 border border-border px-3 py-2.5">
                <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                  區間勝率
                </p>
                <p className="text-base sm:text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
                  {summary.matches > 0 ? `${summary.win_rate}%` : '-'}
                  {summary.matches > 0 && (
                    <span className="hidden sm:inline text-xs font-bold text-muted-foreground ml-1.5">
                      ({summary.wins}勝 {summary.losses}敗)
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl bg-surface-subtle/80 border border-border px-3 py-2.5">
                <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                  區間最高
                </p>
                <p className="text-base sm:text-xl font-display font-black text-sapphire-blue dark:text-blue-300 tabular-nums leading-tight mt-0.5">
                  {summary.peak_rating}
                </p>
              </div>
            </div>
          )}

          {/* Main Interactive Story Chart */}
          <div className="rounded-2xl bg-card/60 dark:bg-slate-950/35 border border-border/80 pt-2 pb-1 px-1 sm:px-3">
            <StatsChart
              showCard={false}
              showHeader={false}
              showTierLines
              height={230}
              data={chartData}
              selectedIdx={activePinnedPoint?.idx}
              onSelectPoint={(pt) => {
                if (pt.idx !== undefined) {
                  setPinnedSelection({ interval: chartInterval, idx: pt.idx });
                }
              }}
            />
          </div>

          {/* Mobile-First Tap-to-Pin Match Story Strip */}
          {activePinnedPoint && (
            <PinnedMatchStoryStrip
              point={activePinnedPoint}
              onInspectPlayer={onInspectPlayer}
            />
          )}

          {/* Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-bold text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                勝場
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-500" />
                敗場
              </span>
              <span className="inline-flex items-center gap-1">
                <Star size={11} className="text-amber-500" fill="currentColor" aria-hidden="true" />
                換季重置
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/85">
              點擊或滑過任一點檢視賽果詳情
            </span>
          </div>
        </div>
      )}

      {/* View 2: 五維球風雷達 & 戰術稱號 */}
      {activeView === 'radar' && (
        <RadarAnalyticsView analytics={analytics} />
      )}

      {/* View 3: 單雙打 & 勝負結構拆解 */}
      {activeView === 'breakdown' && (
        <BreakdownAnalyticsView analytics={analytics} />
      )}
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * Mobile-First 焦點場次釘選卡（Tap-to-Pin Story Strip）
 * ─────────────────────────────────────────────────────────────────────────── */
function PinnedMatchStoryStrip({
  point,
  onInspectPlayer,
}: Readonly<{
  point: ChartDataPoint;
  onInspectPlayer?: (id: string) => void;
}>) {
  const isReset = point.event_type === 'soft_reset';
  const isStart = point.event_type === 'start';
  const deltaVal = typeof point.delta === 'number' ? point.delta : 0;
  const timeText = point.recorded_at
    ? formatLocalTime(point.recorded_at, 'MM/dd HH:mm')
    : point.name;

  return (
    <div className="rounded-2xl border border-border bg-surface-subtle/85 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
            {timeText}
          </span>
          {isReset ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
              <Star size={10} fill="currentColor" aria-hidden="true" />
              系統換季軟重置
            </span>
          ) : isStart ? (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-black">
              賽季初始基準
            </span>
          ) : point.result ? (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-black',
                point.result === 'W'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white',
              )}
            >
              {point.result === 'W' ? '勝' : '敗'} {point.score}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-300 text-[10px] font-black">
              積分校準
            </span>
          )}
          {point.match_type && (
            <span className="text-[11px] font-black text-muted-foreground">
              {point.match_type === 'doubles' ? '雙打' : '單打'} {point.format || ''}
            </span>
          )}
        </div>

        {point.opponents && point.opponents.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap text-xs sm:text-sm font-bold text-foreground">
            <span className="text-muted-foreground font-bold">vs</span>
            {point.opponents.map((opp, idx) => (
              <button
                key={opp.id}
                type="button"
                onClick={() => onInspectPlayer?.(opp.id)}
                className="inline-flex items-center gap-0.5 font-display font-black text-foreground hover:text-sapphire-blue dark:hover:text-blue-300 underline decoration-border underline-offset-4 transition-colors"
              >
                <span>{opp.name}</span>
                {onInspectPlayer && <ChevronRight size={12} aria-hidden="true" />}
                {idx < (point.opponents?.length ?? 0) - 1 && (
                  <span className="no-underline text-muted-foreground">/</span>
                )}
              </button>
            ))}
            {point.partner && (
              <span className="text-xs text-muted-foreground font-bold">
                （搭檔：{point.partner.name}）
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs font-bold text-muted-foreground">
            {isReset
              ? '依新季軟重置公式調整積分起點'
              : isStart
                ? '目前尚未產生新的已結算戰績'
                : '系統校準積分紀錄'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 border-t border-border/60 sm:pt-0 sm:border-0 shrink-0">
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-black text-muted-foreground uppercase">結算積分</p>
          <p className="font-display font-black text-lg text-foreground tabular-nums leading-tight">
            {Math.round(point.rating)}
          </p>
        </div>
        {deltaVal !== 0 && !isReset && (
          <span
            className={cn(
              'px-2.5 py-1 rounded-xl font-display font-black text-xs tabular-nums',
              deltaVal > 0
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
            )}
          >
            {deltaVal > 0 ? `+${deltaVal}` : deltaVal} ELO
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * View 2: 五維球風雷達 & 戰術稱號
 * ─────────────────────────────────────────────────────────────────────────── */
function RadarAnalyticsView({
  analytics,
}: Readonly<{ analytics?: PlayerAnalytics }>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.22)';
  const labelColor = isDark ? '#e2e8f0' : '#334155';
  const strokeColor = isDark ? '#60a5fa' : '#2563eb';
  const fillColor = isDark ? '#3b82f6' : '#2563eb';

  if (!analytics) {
    return (
      <div className="py-12 text-center text-xs font-bold text-muted-foreground">
        暫無足夠對戰數據可產生雷達報告
      </div>
    );
  }

  const { unlocked, settled_count, unlock_required, radar } = analytics;
  const remaining = Math.max(0, unlock_required - settled_count);

  return (
    <div className="space-y-4">
      {/* Lock Progress Callout if < 5 matches */}
      {!unlocked && (
        <div className="rounded-2xl border border-dashed border-sapphire-blue/40 bg-sapphire-blue/[0.05] dark:bg-blue-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock size={15} className="text-sapphire-blue dark:text-blue-300 shrink-0" aria-hidden="true" />
            <p className="text-xs font-bold text-foreground">
              目前為預覽模式：再完成 <strong className="font-display font-black text-sapphire-blue dark:text-blue-300">{remaining}</strong> 場已結算對戰即正式定型您的個人雷達！
            </p>
          </div>
          <span className="font-display font-black text-xs text-sapphire-blue dark:text-blue-300 tabular-nums shrink-0">
            {Math.min(100, Math.round((settled_count / unlock_required) * 100))}%
          </span>
        </div>
      )}

      {/* Enlarged Radar + 5 Axis Detail Grid */}
      <div
        className={cn(
          'grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch',
          !unlocked && 'opacity-75',
        )}
      >
        <div className="md:col-span-6 h-[300px] sm:h-[340px] md:h-auto md:min-h-[360px] rounded-2xl border border-border bg-card/60 dark:bg-slate-950/35 p-2 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="64%"
              margin={{ top: 18, right: 36, bottom: 18, left: 36 }}
              data={radar}
            >
              <PolarGrid stroke={gridStroke} />
              <PolarAngleAxis
                dataKey="label"
                tickLine={false}
                tick={{ fill: labelColor, fontSize: 12, fontWeight: 800 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  const axis = payload?.[0]?.payload as RadarAxisItem | undefined;
                  if (!active || !axis) return null;
                  return (
                    <div className="bg-popover p-3 rounded-xl shadow-lg border border-border text-xs space-y-1">
                      <p className="font-display font-black text-foreground">
                        {axis.label}：{axis.score} 分
                      </p>
                      <p className="font-bold text-muted-foreground">{axis.detail}</p>
                    </div>
                  );
                }}
              />
              <Radar
                name="球風戰力"
                dataKey="score"
                stroke={strokeColor}
                strokeWidth={2.5}
                fill={fillColor}
                fillOpacity={0.28}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="md:col-span-6 flex flex-col justify-between gap-2">
          {radar.map((axis) => (
            <div
              key={axis.key}
              className="rounded-xl border border-border bg-card px-3.5 py-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-display font-black text-foreground">{axis.label}</span>
                <span className="text-[11px] font-bold text-muted-foreground truncate">
                  {axis.detail}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sapphire-blue to-indigo-500 transition-all duration-500"
                    style={{ width: `${axis.score}%` }}
                  />
                </div>
                <span className="font-display font-black text-xs text-foreground tabular-nums w-8 text-right">
                  {axis.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * View 3: 單雙打對照 & 比分結構拆解 & 段位勝率 & 出勤脈動
 * ─────────────────────────────────────────────────────────────────────────── */
function BreakdownAnalyticsView({
  analytics,
}: Readonly<{ analytics?: PlayerAnalytics }>) {
  if (!analytics) {
    return (
      <div className="py-12 text-center text-xs font-bold text-muted-foreground">
        暫無實戰數據可供拆解
      </div>
    );
  }

  const { singles, doubles, scorelines, vs_tiers, activity_weeks, activity_8w_total } =
    analytics.breakdown;
  const maxWeekMatches = Math.max(1, ...activity_weeks.map((w) => w.matches));

  const formatCards = [
    {
      title: '單打戰績',
      subtitle: 'Singles',
      icon: Swords,
      iconBg: 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300',
      stats: singles,
    },
    {
      title: '雙打戰績',
      subtitle: 'Doubles',
      icon: Users,
      iconBg: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      stats: doubles,
    },
  ];

  const scoreBuckets = [
    {
      key: 'sweep_win',
      label: '直落完封勝',
      sub: '2:0 / 3:0',
      barClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      data: scorelines.sweep_win,
    },
    {
      key: 'close_win',
      label: '苦戰險勝',
      sub: '2:1 / 3:1 / 3:2',
      barClass: 'bg-sky-500',
      textClass: 'text-sky-600 dark:text-sky-400',
      data: scorelines.close_win,
    },
    {
      key: 'close_loss',
      label: '惜敗落馬',
      sub: '1:2 / 1:3 / 2:3',
      barClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
      data: scorelines.close_loss,
    },
    {
      key: 'sweep_loss',
      label: '遭直落橫掃',
      sub: '0:2 / 0:3',
      barClass: 'bg-rose-500',
      textClass: 'text-rose-500 dark:text-rose-400',
      data: scorelines.sweep_loss,
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* Row 1: Singles vs Doubles Split */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {formatCards.map((card) => {
          const Icon = card.icon;
          const net = card.stats.net_mmr;
          return (
            <div
              key={card.title}
              className="rounded-2xl border border-border bg-surface-subtle/75 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'size-7 rounded-lg flex items-center justify-center shrink-0',
                      card.iconBg,
                    )}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-display font-black text-foreground truncate">
                      {card.title}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[11px] font-display font-black tabular-nums whitespace-nowrap',
                    net > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : net < 0
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {net > 0 ? `+${net}` : net} ELO
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-display font-black text-foreground tabular-nums leading-none">
                  {card.stats.matches > 0 ? `${card.stats.win_rate}%` : '-'}
                </span>
                <span className="text-xs font-display font-black tabular-nums whitespace-nowrap">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {card.stats.wins}勝
                  </span>
                  <span className="text-muted-foreground/45 mx-0.5">·</span>
                  <span className="text-rose-500 dark:text-rose-400">
                    {card.stats.losses}敗
                  </span>
                  <span className="text-[11px] font-sans font-bold text-muted-foreground ml-1">
                    ({card.stats.matches})
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Scoreline DNA Stacked Bar */}
      <div className="rounded-2xl border border-border bg-surface-subtle/75 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-display font-black text-foreground">
            比分結構拆解 (Scoreline DNA)
          </p>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
            累計 {scorelines.total} 場已結算
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden flex">
          {scorelines.total > 0 &&
            scoreBuckets.map(
              (b) =>
                b.data.count > 0 && (
                  <div
                    key={b.key}
                    style={{ width: `${(b.data.count / scorelines.total) * 100}%` }}
                    className={cn('h-full transition-all duration-500', b.barClass)}
                    title={`${b.label}: ${b.data.count} 場 (${b.data.pct}%)`}
                  />
                ),
            )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scoreBuckets.map((b) => (
            <div
              key={b.key}
              className="rounded-xl border border-border/80 bg-card px-2.5 py-2 space-y-0.5"
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full shrink-0', b.barClass)} />
                <span className="text-[11px] font-black text-foreground truncate">
                  {b.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-1 pt-0.5">
                <span className={cn('text-sm font-display font-black tabular-nums', b.textClass)}>
                  {b.data.pct}%
                </span>
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                  {b.data.count} 場 · {b.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Vs Opponent Tiers + 8-Week Activity Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-subtle/75 p-3.5 space-y-2.5">
          <p className="text-xs font-display font-black text-foreground">
            對戰各段位勝率階梯
          </p>
          <div className="space-y-2">
            {vs_tiers.map((tier) => (
              <div key={tier.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-md font-black text-[10px] shrink-0',
                        TIER_PILL_COLOR[tier.key] || TIER_PILL_COLOR.silver,
                      )}
                    >
                      {tier.label}
                    </span>
                    <span className="text-muted-foreground font-bold tabular-nums">
                      {tier.range}
                    </span>
                  </div>
                  {tier.matches > 0 ? (
                    <span className="font-display font-black text-foreground tabular-nums">
                      {tier.win_rate}%{' '}
                      <span className="text-muted-foreground font-sans font-bold">
                        ({tier.wins}勝 {tier.losses}敗)
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 font-bold">尚未交手</span>
                  )}
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sapphire-blue transition-all duration-500"
                    style={{ width: `${tier.matches > 0 ? tier.win_rate : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface-subtle/75 p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-display font-black text-foreground flex items-center gap-1.5">
              <Calendar size={13} className="text-sapphire-blue" aria-hidden="true" />
              近 8 週出勤節奏
            </p>
            <span className="px-2 py-0.5 rounded-full bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 text-[11px] font-black tabular-nums">
              近8週 {activity_8w_total} 場
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 items-end h-28 pt-2">
            {activity_weeks.map((week, idx) => {
              const barPct =
                week.matches > 0 ? Math.max(16, Math.round((week.matches / maxWeekMatches) * 100)) : 8;
              const isCurrentWeek = idx === activity_weeks.length - 1;
              return (
                <div
                  key={week.label}
                  className="flex flex-col items-center justify-end h-full gap-1"
                  title={`${week.label} 週：${week.matches} 場（${week.wins} 勝）`}
                >
                  <span className="text-[10px] font-display font-black text-muted-foreground tabular-nums leading-none">
                    {week.matches > 0 ? week.matches : ''}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      style={{ height: `${barPct}%` }}
                      className={cn(
                        'w-full max-w-6 rounded-t-lg transition-all duration-500',
                        week.matches === 0
                          ? 'bg-secondary/90 rounded-lg'
                          : isCurrentWeek
                            ? 'bg-gradient-to-t from-sapphire-blue to-sky-400 shadow-xs'
                            : 'bg-sapphire-blue/75 dark:bg-blue-500/70',
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] sm:text-[10px] font-bold tabular-nums leading-none',
                      isCurrentWeek
                        ? 'text-sapphire-blue dark:text-blue-300 font-black'
                        : 'text-muted-foreground',
                    )}
                  >
                    {week.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
