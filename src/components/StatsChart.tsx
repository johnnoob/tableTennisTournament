import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
  { name: 'Mon', rating: 2340 },
  { name: 'Tue', rating: 2380 },
  { name: 'Wed', rating: 2410 },
  { name: 'Thu', rating: 2390 },
  { name: 'Fri', rating: 2440 },
  { name: 'Sat', rating: 2470 },
  { name: 'Sun', rating: 2450 },
];

export function StatsChart() {
  return (
    <Card className="no-line-card rounded-3xl bg-white p-6 shadow-sm overflow-hidden">
      <CardHeader className="p-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-xl text-primary-navy">Performance Analytics</CardTitle>
            <p className="text-xs text-primary-slate/40 mt-1 font-sans">MMR Progression • Last 7 Days</p>
          </div>
          <div className="bg-electric-blue/10 text-electric-blue rounded-full px-3 py-1 text-xs font-semibold">
            +110 PTS
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 size-full min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0058be" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#0058be" stopOpacity={0}/>
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
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                border: 'none', 
                borderRadius: '12px', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                fontSize: '12px',
                fontFamily: 'Public Sans'
              }}
              cursor={{ stroke: '#0058be', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
              type="monotone" 
              dataKey="rating" 
              stroke="#0058be" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorRating)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
