import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 🌟 定義接收從 Dashboard 傳進來的真實資料
interface StatsChartProps {
  data?: { name: string, rating: number }[];
  ptsChange?: number;
  showCard?: boolean;
  showHeader?: boolean;
  height?: number;
}

export function StatsChart({
  showCard = true,
  showHeader = true,
  height = 220,
  data = [], // 🌟 接收資料 (預設為空陣列)
  ptsChange = 0 // 🌟 接收分數變化
}: StatsChartProps) {

  // 防呆機制：如果圖表沒有資料，或是只有 1 筆起始資料，
  // 為了讓圖表畫得出來並且能 hover，我們幫它「複製」一個點拉成一條平線。
  const chartData = data.length === 1
    ? [{ name: 'Start', rating: data[0].rating }, { name: 'Now', rating: data[0].rating }]
    : data;

  const content = (
    <div className={cn("size-full", !showCard && "p-0")}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-display text-xl text-primary-navy">Performance Analytics</h4>
            <p className="text-xs text-slate-500 mt-1 font-sans">MMR Progression • Last 10 Matches</p>
          </div>
          <div className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            ptsChange >= 0
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-500"
          )}>
            {/* 🌟 動態顯示分數變化與正負號 */}
            {ptsChange > 0 ? `+${ptsChange}` : ptsChange} PTS
          </div>
        </div>
      )}

      <div className={cn("w-full", showCard ? "min-h-[220px]" : "")}>
        <ResponsiveContainer width="100%" height={height}>
          {/* 🌟 綁定 chartData */}
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0058be" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#0058be" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceef0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#3c475a', opacity: 0.5 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#3c475a', opacity: 0.5 }}
              domain={['dataMin - 20', 'dataMax + 20']} // 讓上下有點留白空間
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                fontSize: '12px',
                fontFamily: 'Public Sans',
                fontWeight: 'bold'
              }}
              // 自訂 Hover 時顯示的文字
              formatter={(value: any) => [`${value} LP`, "Rating"]}
              cursor={{ stroke: '#0058be', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="rating"
              stroke="#0058be"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRating)"
              animationDuration={1000} // 加入繪製動畫
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!showCard) return content;

  return (
    <Card className="no-line-card rounded-3xl bg-white p-6 shadow-sm overflow-hidden border-none">
      {content}
    </Card>
  );
}