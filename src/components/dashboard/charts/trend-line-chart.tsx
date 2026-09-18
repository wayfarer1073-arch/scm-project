'use client';

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatKstDate } from '@/lib/date';

interface TrendLineChartProps {
  title: string;
  data: { date: string; value: number }[];
  valueFormatter: (value: number) => string;
  color?: string;
}

export function TrendLineChart({ title, data, valueFormatter, color = 'var(--color-foreground)' }: TrendLineChartProps) {
  const gradientId = `trend-fill-${title.replace(/[^a-zA-Z0-9가-힣]+/g, '-')}`;
  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 h-60">
        {data.length < 2 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <TrendingUp className="size-5 opacity-40" aria-hidden="true" />
            <p className="text-sm">데이터 축적 중</p>
            <p className="text-xs">스냅샷 2건 이상 필요</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, stroke: 'var(--color-card)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
