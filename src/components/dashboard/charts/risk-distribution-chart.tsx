'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RiskDistributionChartProps {
  danger: number;
  warning: number;
  normal: number;
}

export function RiskDistributionChart({ danger, warning, normal }: RiskDistributionChartProps) {
  const data = [
    { name: '위험', value: danger, color: 'var(--color-status-danger)' },
    { name: '주의', value: warning, color: 'var(--color-status-warning)' },
    { name: '정상', value: normal, color: 'var(--color-status-normal)' },
  ];
  const total = danger + warning + normal;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">재고 위험상태 분포</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const v = Number(value);
                  return [`${v.toLocaleString('ko-KR')}개 (${Math.round((v / total) * 100)}%)`, String(name)];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
