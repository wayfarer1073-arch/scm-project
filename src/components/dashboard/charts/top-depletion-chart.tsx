'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface TopDepletionChartProps {
  items: { productName: string; depletion: number }[];
}

/** 순위 기반 단일 hue 순차 램프(짙은 잉크 -> 옅은 잉크). 무지개색 대신 중립 톤 하나만 쓴다. */
function rankColor(index: number, count: number): string {
  const t = count <= 1 ? 0 : index / (count - 1);
  const lightness = 0.26 + t * 0.22;
  return `oklch(${lightness.toFixed(3)} 0.02 260)`;
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { value: number; color: string };
}

/** 데이터 끝(막대 끝)만 둥글게, 기준선 쪽은 각지게 — 값은 끝에 붙는 뱃지로 direct label 처리 */
function RankedBarShape(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const thickness = Math.min(height, 16);
  const barY = y + (height - thickness) / 2;
  const w = Math.max(width, 0);
  const radius = Math.min(4, thickness / 2, w);
  const fill = payload.color;
  const valueText = payload.value.toLocaleString('ko-KR');
  // 뱃지가 옆 막대 행까지 침범해 숫자가 가려지지 않도록, 카테고리 행 높이(height)의 절반을 넘지 않게 제한한다.
  const maxBadgeR = Math.max(9, height / 2 - 2);
  const badgeR = Math.min(Math.max(12, 7 + valueText.length * 3.6), maxBadgeR);
  const fontSize = badgeR < 13 ? 9 : 10;
  const cx = x + w;
  const cy = barY + thickness / 2;

  return (
    <g>
      <path
        d={`M ${x} ${barY} H ${x + Math.max(w - radius, 0)} A ${radius} ${radius} 0 0 1 ${x + w} ${barY + radius} V ${barY + thickness - radius} A ${radius} ${radius} 0 0 1 ${x + Math.max(w - radius, 0)} ${barY + thickness} H ${x} Z`}
        fill={fill}
      />
      <circle cx={cx} cy={cy} r={badgeR} fill={fill} stroke="var(--color-card)" strokeWidth={2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={700} fill="#fff">
        {valueText}
      </text>
    </g>
  );
}

const MAX_BARS = 7;
const LABEL_MAX_CHARS = 11;

export function TopDepletionChart({ items }: TopDepletionChartProps) {
  const top = items.slice(0, MAX_BARS);
  const data = top.map((i, index) => ({
    name: i.productName.length > LABEL_MAX_CHARS ? `${i.productName.slice(0, LABEL_MAX_CHARS)}…` : i.productName,
    fullName: i.productName,
    value: i.depletion,
    color: rankColor(index, top.length),
  }));

  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold">최근 7일 소진량 TOP {MAX_BARS} SKU</h3>
      <div className="mt-2 h-64">
        {data.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <BarChart3 className="size-5 opacity-40" aria-hidden="true" />
            <p className="text-sm">데이터 축적 중</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }} barCategoryGap="32%">
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={104} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, _name, item) => [`${Number(value).toLocaleString('ko-KR')}개`, item.payload.fullName]}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
                cursor={{ fill: 'var(--color-muted)' }}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Bar dataKey="value" shape={RankedBarShape as any} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
