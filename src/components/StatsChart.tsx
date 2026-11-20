import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';

// 🌟 定義接收從 Dashboard 傳進來的真實資料
interface DataPoint {
  name: string;
  rating: number;
  event_type?: 'match' | 'soft_reset' | 'decay';
}

interface StatsChartProps {
  data?: DataPoint[];
  ptsChange?: number;
  showCard?: boolean;
  showHeader?: boolean;
  height?: number;
}

interface CustomizedDotProps {
  cx?: number;
  cy?: number;
  payload?: DataPoint;
  isDark?: boolean;
}

interface TooltipEntry {
  payload?: DataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

const CustomizedDot = ({ cx, cy, payload, isDark }: CustomizedDotProps) => {
  if (cx === undefined || cy === undefined) return null;
  const strokeColor = isDark ? '#111a2e' : '#ffffff';
  const fillColor = isDark ? '#60a5fa' : '#2563eb';
  if (payload?.event_type === 'soft_reset') {
    return (
      <g transform={`translate(${cx - 8}, ${cy - 8})`}>
        <path
          d="M8 0L9.8 5.5H15.6L10.9 9.1L12.7 14.6L8 11L3.3 14.6L5.1 9.1L0.4 5.5H6.2L8 0Z"
          fill="#f59e0b"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} stroke={strokeColor} strokeWidth={2} fill={fillColor} />;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  const data = payload?.[0]?.payload;
  if (active && data) {
    const isReset = data.event_type === 'soft_reset';

    return (
      <div className="bg-popover p-4 rounded-2xl shadow-xl border border-border min-w-[140px]">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1">
          {isReset ? (
            <>
              <p className="text-amber-600 dark:text-amber-400 font-black text-xs flex items-center gap-1.5">
                <Star size={12} fill="currentColor" />
                ✨ 系統換季重置
              </p>
              <div className="h-px bg-border my-2" />
              <p className="text-foreground font-black text-sm">
                重置後積分: <span className="text-sapphire-blue">{Math.round(data.rating)}</span>
              </p>
            </>
          ) : (
            <p className="text-foreground font-black text-sm">
              Rating: <span className="text-sapphire-blue font-display">{Math.round(data.rating)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function StatsChart({
  showCard = true,
  showHeader = true,
  height = 220,
  data = [], // 🌟 接收資料 (預設為空陣列)
  ptsChange = 0 // 🌟 接收分數變化
}: StatsChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.14)' : '#eceef0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const lineStroke = isDark ? '#60a5fa' : '#2563eb';
  const refLineStroke = isDark ? '#64748b' : '#94a3b8';

  // 防呆機制：如果圖表沒有資料，或是只有 1 筆起始資料，
  // 為了讓圖表畫得出來並且能 hover，我們幫它「複製」一個點拉成一條平線。
  const chartData = data.length === 1
    ? [{ name: 'Start', rating: data[0].rating, event_type: data[0].event_type }, { name: 'Now', rating: data[0].rating, event_type: data[0].event_type }]
    : data;

  const content = (
    <div className={cn("size-full", !showCard && "p-0")}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-display text-xl text-foreground">Performance Analytics</h4>
            <p className="text-xs text-muted-foreground mt-1 font-sans">Rating Progression • Season Summary</p>
          </div>
          <div className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            ptsChange >= 0
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300"
          )}>
            {/* 🌟 動態顯示分數變化與正負號 */}
            {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
          </div>
        </div>
      )}

      <div className={cn("w-full", showCard ? "min-h-[220px]" : "")}>
        <ResponsiveContainer width="100%" height={height}>
          {/* 🌟 綁定 chartData */}
          <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
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
              tick={{ fontSize: 12, fill: tickColor }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: tickColor }}
              domain={['dataMin - 50', 'dataMax + 50']} // 讓上下有點留白空間
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: lineStroke, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            {/* 動態渲染參考線 */}
            {chartData.map((entry, index) => (
              entry.event_type === 'soft_reset' && (
                <ReferenceLine
                  key={`ref-${index}`}
                  x={entry.name}
                  stroke={refLineStroke}
                  strokeDasharray="3 3"
                  label={{ value: '賽季重置', position: 'top', fill: tickColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )
            ))}
            <Area
              type="monotone"
              dataKey="rating"
              stroke={lineStroke}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRating)"
              animationDuration={1000} // 加入繪製動畫
              dot={<CustomizedDot isDark={isDark} />}
              activeDot={{ r: 6, strokeWidth: 2, stroke: isDark ? '#111a2e' : '#ffffff' }}
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
