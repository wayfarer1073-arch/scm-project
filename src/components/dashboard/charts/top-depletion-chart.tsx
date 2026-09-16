'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TopDepletionChartProps {
  items: { productName: string; depletion: number }[];
}

export function TopDepletionChart({ items }: TopDepletionChartProps) {
  const data = items.slice(0, 10).map((i) => ({ name: i.productName.length > 14 ? `${i.productName.slice(0, 14)}…` : i.productName, value: i.depletion }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">최근 7일 소진량 TOP SKU</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">데이터 축적 중</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}개`, '소진량(7일)']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
