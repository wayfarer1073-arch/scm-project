'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKstDate } from '@/lib/date';

interface TrendLineChartProps {
  title: string;
  data: { date: string; value: number }[];
  valueFormatter: (value: number) => string;
  color?: string;
}

export function TrendLineChart({ title, data, valueFormatter, color = 'var(--color-chart-1)' }: TrendLineChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">데이터 축적 중 (스냅샷 2건 이상 필요)</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatKstDate(d).slice(5)}
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={56}
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 100000000 ? `${Math.round(v / 100000000)}억` : v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)}
              />
              <Tooltip
                formatter={(value) => [valueFormatter(Number(value)), title]}
                labelFormatter={(d) => formatKstDate(String(d))}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-border)' }}
              />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
