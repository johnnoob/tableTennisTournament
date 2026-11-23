import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { cn, formatLocalTime } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { ChartDataPoint } from '@/types/api.types';

interface StatsChartProps {
  data?: ChartDataPoint[];
  ptsChange?: number;
  showCard?: boolean;
  showHeader?: boolean;
  showTierLines?: boolean;
  height?: number;
  selectedIdx?: number;
  onSelectPoint?: (point: ChartDataPoint) => void;
}

const TIER_THRESHOLDS = [
  { score: 1050, label: '銀牌 1050', light: '#64748b', dark: '#94a3b8' },
  { score: 1180, label: '金牌 1180', light: '#d97706', dark: '#fbbf24' },
  { score: 1320, label: '菁英 1320', light: '#4f46e5', dark: '#818cf8' },
] as const;

interface CustomizedDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
  isDark?: boolean;
  selectedIdx?: number;
  onSelectPoint?: (point: ChartDataPoint) => void;
}

function getDotFillColor(payload: ChartDataPoint | undefined, isDark?: boolean): string {
  if (payload?.event_type === 'soft_reset') return '#f59e0b';
  if (payload?.result === 'W') return '#10b981';
  if (payload?.result === 'L') return '#f43f5e';
  return isDark ? '#60a5fa' : '#2563eb';
}

const CustomizedDot = ({
  cx,
  cy,
  payload,
  isDark,
  selectedIdx,
  onSelectPoint,
}: CustomizedDotProps) => {
  if (cx === undefined || cy === undefined || !payload) return null;
  const strokeColor = isDark ? '#0f172a' : '#ffffff';
  const fillColor = getDotFillColor(payload, isDark);
  const isSelected = selectedIdx !== undefined && payload.idx === selectedIdx;

  const handleClick = onSelectPoint ? () => onSelectPoint(payload) : undefined;

  if (payload.event_type === 'soft_reset') {
    return (
      <g
        transform={`translate(${cx - 8}, ${cy - 8})`}
        onClick={handleClick}
        style={{ cursor: onSelectPoint ? 'pointer' : undefined }}
      >
        {isSelected && (
          <circle cx={8} cy={8} r={12} fill="#f59e0b" fillOpacity={0.22} />
        )}
        <path
          d="M8 0L9.8 5.5H15.6L10.9 9.1L12.7 14.6L8 11L3.3 14.6L5.1 9.1L0.4 5.5H6.2L8 0Z"
          fill="#f59e0b"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
      </g>
    );
  }

  return (
    <g
      onClick={handleClick}
      style={{ cursor: onSelectPoint ? 'pointer' : undefined }}
    >
      {isSelected && (
        <circle cx={cx} cy={cy} r={9} fill={fillColor} fillOpacity={0.24} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 5 : 3.8}
        stroke={strokeColor}
        strokeWidth={2}
        fill={fillColor}
      />
    </g>
  );
};

interface TooltipEntry {
  payload?: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  const data = payload?.[0]?.payload;
  if (!active || !data) return null;

  const isReset = data.event_type === 'soft_reset';
  const timeLabel = data.recorded_at
    ? formatLocalTime(data.recorded_at, 'MM/dd HH:mm')
    : String(label ?? data.name);
  const deltaNum = typeof data.delta === 'number' ? data.delta : null;
  const oppText =
    data.opponents && data.opponents.length > 0
      ? data.opponents.map((o) => o.name).join(' / ')
      : null;

  return (
    <div className="bg-popover/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-border min-w-[185px] max-w-[250px] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground font-bold tabular-nums">
          {timeLabel}
        </span>
        {isReset ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px] font-black">
            <Star size={10} fill="currentColor" aria-hidden="true" />
            換季重置
          </span>
        ) : data.result ? (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black',
              data.result === 'W'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
            )}
          >
            {data.result === 'W' ? '勝場' : '敗場'} {data.score || ''}
          </span>
        ) : null}
      </div>

      {oppText && (
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-foreground">
            {data.match_type === 'doubles' ? '雙打' : '單打'} {data.format || ''} · vs {oppText}
          </p>
          {data.partner && (
            <p className="text-[11px] font-bold text-muted-foreground">
              搭檔：{data.partner.name}
            </p>
          )}
        </div>
      )}

      <div className="pt-1.5 border-t border-border/80 flex items-baseline justify-between gap-3">
        <span className="font-display font-black text-base text-foreground tabular-nums">
          {Math.round(data.rating)}{' '}
          <span className="text-[10px] font-sans font-bold text-muted-foreground">ELO</span>
        </span>
        {deltaNum !== null && deltaNum !== 0 && !isReset && (
          <span
            className={cn(
              'font-display font-black text-xs tabular-nums',
              deltaNum > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-500 dark:text-rose-400',
            )}
          >
            {deltaNum > 0 ? `+${deltaNum}` : deltaNum}
          </span>
        )}
      </div>
    </div>
  );
};

const CompactMobileTooltip = ({ active, payload }: CustomTooltipProps) => {
  const data = payload?.[0]?.payload;
  if (!active || !data) return null;
  const deltaNum = typeof data.delta === 'number' ? data.delta : null;
  const oppText =
    data.opponents && data.opponents.length > 0
      ? data.opponents.map((o) => o.name).join(' / ')
      : null;

  return (
    <div className="bg-popover/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-md border border-border text-[11px] flex items-center gap-2 whitespace-nowrap">
      {data.result && (
        <span
          className={cn(
            'font-black',
            data.result === 'W'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400',
          )}
        >
          {data.result === 'W' ? '勝' : '敗'} {data.score || ''}
        </span>
      )}
      {oppText && <span className="font-bold text-foreground max-w-[90px] truncate">{oppText}</span>}
      <span className="font-display font-black text-foreground tabular-nums">
        {Math.round(data.rating)}
      </span>
      {deltaNum !== null && deltaNum !== 0 && (
        <span
          className={cn(
            'font-display font-black tabular-nums',
            deltaNum > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400',
          )}
        >
          {deltaNum > 0 ? `+${deltaNum}` : deltaNum}
        </span>
      )}
    </div>
  );
};

export function StatsChart({
  showCard = true,
  showHeader = true,
  showTierLines = true,
  height = 220,
  data = [],
  ptsChange = 0,
  selectedIdx,
  onSelectPoint,
}: StatsChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isSmUp = useMediaQuery('(min-width: 640px)');

  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.14)' : '#eceef0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const lineStroke = isDark ? '#60a5fa' : '#2563eb';
  const refLineStroke = isDark ? '#64748b' : '#94a3b8';

  const chartData = useMemo(() => {
    if (data.length === 1) {
      return [
        { ...data[0], idx: data[0].idx ?? 1, name: data[0].name || '起點' },
        { ...data[0], idx: 2, name: '目前' },
      ];
    }
    return data.map((item, i) => ({
      ...item,
      idx: item.idx ?? i + 1,
    }));
  }, [data]);

  const pointByName = useMemo(() => {
    const map = new Map<string, ChartDataPoint>();
    for (const pt of chartData) {
      map.set(pt.name, pt);
    }
    return map;
  }, [chartData]);

  const { yDomain, visibleTiers } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        yDomain: [950, 1100] as [number, number],
        visibleTiers: TIER_THRESHOLDS.filter((t) => t.score >= 950 && t.score <= 1100),
      };
    }
    const ratings = chartData.map((d) => d.rating);
    const minVal = Math.min(...ratings);
    const maxVal = Math.max(...ratings);

    let yMin = Math.floor((minVal - 35) / 50) * 50;
    let yMax = Math.ceil((maxVal + 35) / 50) * 50;
    if (yMax - yMin < 100) {
      yMin -= 50;
      yMax += 50;
    }

    return {
      yDomain: [yMin, yMax] as [number, number],
      visibleTiers: TIER_THRESHOLDS.filter((t) => t.score >= yMin && t.score <= yMax),
    };
  }, [chartData]);

  const handleChartPointSelect = (state: { activeTooltipIndex?: number | string | null }) => {
    if (!onSelectPoint) return;
    const rawIdx = state?.activeTooltipIndex;
    const idxNum = typeof rawIdx === 'number' ? rawIdx : Number(rawIdx);
    if (!Number.isNaN(idxNum) && idxNum >= 0 && idxNum < chartData.length) {
      onSelectPoint(chartData[idxNum]);
    }
  };

  // 手機端在下方已有焦點賽果條 (onSelectPoint) 時完全隱藏浮層，避免手指觸控遮住線圖
  const renderTooltip = (props: CustomTooltipProps) => {
    if (!isSmUp) {
      return onSelectPoint ? null : <CompactMobileTooltip {...props} />;
    }
    return <CustomTooltip {...props} />;
  };

  const content = (
    <div className={cn('size-full', !showCard && 'p-0')}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-display text-xl text-foreground">Performance Analytics</h4>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Rating Progression • Season Summary
            </p>
          </div>
          <div
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              ptsChange >= 0
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300',
            )}
          >
            {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
          </div>
        </div>
      )}

      <div className={cn('w-full', showCard ? 'min-h-[220px]' : '')}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={chartData}
            margin={{ top: 18, right: 14, left: -16, bottom: 2 }}
            onClick={handleChartPointSelect}
            onMouseMove={!isSmUp ? handleChartPointSelect : undefined}
          >
            <defs>
              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineStroke} stopOpacity={isDark ? 0.28 : 0.16} />
                <stop offset="95%" stopColor={lineStroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fontSize: 11, fill: tickColor }}
              tickFormatter={(value) => {
                const pt = pointByName.get(String(value));
                if (pt?.recorded_at) {
                  return formatLocalTime(pt.recorded_at, 'MM/dd');
                }
                return String(value);
              }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: tickColor }}
              domain={yDomain}
              allowDecimals={false}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: lineStroke, strokeWidth: 1.5, strokeDasharray: '4 4' }}
            />

            {showTierLines &&
              visibleTiers.map((tier) => (
                <ReferenceLine
                  key={tier.score}
                  y={tier.score}
                  stroke={isDark ? tier.dark : tier.light}
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                  label={{
                    value: tier.label,
                    position: 'insideTopRight',
                    fill: isDark ? tier.dark : tier.light,
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                />
              ))}

            {chartData.map(
              (entry, index) =>
                entry.event_type === 'soft_reset' && (
                  <ReferenceLine
                    key={`ref-${entry.idx ?? index}`}
                    x={entry.name}
                    stroke={refLineStroke}
                    strokeDasharray="3 3"
                    label={{
                      value: '換季重置',
                      position: 'top',
                      fill: tickColor,
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  />
                ),
            )}

            <Area
              type="monotone"
              dataKey="rating"
              stroke={lineStroke}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRating)"
              animationDuration={700}
              dot={
                <CustomizedDot
                  isDark={isDark}
                  selectedIdx={selectedIdx}
                  onSelectPoint={onSelectPoint}
                />
              }
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: isDark ? '#0f172a' : '#ffffff',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return content;

  return (
    <Card className="no-line-card rounded-3xl bg-card p-6 shadow-sm overflow-hidden border-none">
      {content}
    </Card>
  );
}
