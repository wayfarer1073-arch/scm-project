'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface RiskDistributionChartProps {
  danger: number;
  warning: number;
  normal: number;
}

const RADIAN = Math.PI / 180;

interface LeaderLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  value: number;
  percent: number;
  name: string;
  fill: string;
}

/**
 * 위험/주의는 작은 슬라이스로 붙어있는 경우가 많아 각도 기준으로만 라벨을 배치하면 겹친다.
 * 그래서 라벨 텍스트는 카테고리별 고정 슬롯에 배치하고, 리더라인의 시작점만 실제 조각 위치에서 뽑는다.
 */
const LABEL_SLOTS: Record<string, { side: 'left' | 'right'; yOffset: number }> = {
  위험: { side: 'right', yOffset: -34 },
  주의: { side: 'right', yOffset: 10 },
  정상: { side: 'left', yOffset: -12 },
};

function LeaderLineLabel({ cx, cy, midAngle, outerRadius, value, percent, name, fill }: LeaderLabelProps) {
  if (value === 0) return null;
  const cos = Math.cos(-RADIAN * midAngle);
  const sin = Math.sin(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;

  const slot = LABEL_SLOTS[name] ?? { side: cos >= 0 ? 'right' : 'left', yOffset: 0 };
  const dir = slot.side === 'right' ? 1 : -1;
  const ey = cy + slot.yOffset;
  const ex = cx + dir * (outerRadius + 44);
  const mx = ex - dir * 14;
  const textAnchor = slot.side === 'right' ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy} L${mx},${ey} L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" />
      <circle cx={sx} cy={sy} r={2.5} fill={fill} />
      <text x={ex + dir * 4} y={ey - 3} textAnchor={textAnchor} fontSize={12} fontWeight={600} fill="var(--color-foreground)">
        {name}
      </text>
      <text x={ex + dir * 4} y={ey + 12} textAnchor={textAnchor} fontSize={11} fill="var(--color-muted-foreground)">
        {`${value.toLocaleString('ko-KR')}건 · ${Math.round(percent * 100)}%`}
      </text>
    </g>
  );
}

export function RiskDistributionChart({ danger, warning, normal }: RiskDistributionChartProps) {
  const data = [
    { name: '위험', value: danger, color: '#F52E7F' },
    { name: '주의', value: warning, color: '#EAB308' },
    { name: '정상', value: normal, color: 'var(--color-foreground)' },
  ];
  const total = danger + warning + normal;

  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold">재고 위험상태 분포</h3>
      <div className="mt-2 h-64">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <PieChartIcon className="size-5 opacity-40" aria-hidden="true" />
            <p className="text-sm">데이터가 없습니다</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 24, right: 96, bottom: 24, left: 72 }}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={3}
                stroke="var(--color-card)"
                strokeWidth={2}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={(props: any) => (
                  <LeaderLineLabel
                    cx={props.cx}
                    cy={props.cy}
                    midAngle={props.midAngle}
                    outerRadius={props.outerRadius}
                    value={props.value}
                    percent={props.percent}
                    name={props.name}
                    fill={data[props.index].color}
                  />
                )}
                labelLine={false}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={700} fill="var(--color-foreground)">
                {formatNumber(total)}
              </text>
              <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" fontSize={11} fill="var(--color-muted-foreground)">
                전체 SKU
              </text>
              <Tooltip
                formatter={(value, name) => {
                  const v = Number(value);
                  return [`${v.toLocaleString('ko-KR')}개 (${Math.round((v / total) * 100)}%)`, String(name)];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
