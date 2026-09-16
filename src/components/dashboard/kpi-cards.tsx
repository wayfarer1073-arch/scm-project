import { ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { CompanyKpis } from '@/server/services/inventory-analysis-service';

interface KpiCardsProps {
  kpis: CompanyKpis;
  fromDate: string | null;
  asOfDate: string;
}

export function KpiCards({ kpis, fromDate, asOfDate }: KpiCardsProps) {
  const periodLabel = fromDate ? `${fromDate.slice(5)} — ${asOfDate.slice(5)}` : '직전 관측 대비';
  const periodDays = fromDate ? Math.max(1, Math.round((Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000)) : null;
  const primary = [
    { label: '총 재고자산', value: formatCurrency(kpis.totalInventoryValue), detail: '정상재고 × 원가', icon: CircleDollarSign, tone: 'bg-primary text-primary-foreground' },
    { label: '총 가용재고', value: `${formatNumber(kpis.totalAvailableStock)}개`, detail: `${formatNumber(kpis.totalSkuCount)}개 SKU`, icon: Boxes, tone: 'bg-status-increase-bg text-status-increase' },
    { label: '관측 재고 감소', value: `${formatNumber(kpis.totalDecrease ?? 0)}개`, detail: periodLabel, icon: ArrowDownRight, tone: 'bg-status-warning-bg text-status-warning' },
    { label: '관측 재고 증가', value: `${formatNumber(kpis.totalIncrease ?? 0)}개`, detail: `${periodLabel} · 입고/반품/조정 가능`, icon: ArrowUpRight, tone: 'bg-status-normal-bg text-status-normal' },
  ];

  return (
    <section aria-labelledby="company-kpi-heading">
      <div className="mb-3">
        <h2 id="company-kpi-heading" className="text-base font-semibold">전체 현황</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">수량 합계는 규모와 변화 확인용이며 상품 간 우열을 뜻하지 않습니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primary.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="overflow-hidden rounded-xl shadow-[0_16px_40px_-34px_rgba(15,23,42,0.6)]">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className={`flex size-9 items-center justify-center rounded-xl ${item.tone}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 divide-x rounded-xl border bg-card px-2 py-3 sm:grid-cols-4">
        <SmallMetric label="위험 SKU" value={`${formatNumber(kpis.dangerSkuCount)}개`} emphasis="danger" />
        <SmallMetric label="30일 내 소진 예상" value={`${formatNumber(kpis.stockoutSoon30dCount)}개`} emphasis="warning" />
        {periodDays ? (
          <SmallMetric label="기간 일평균 관측 감소" value={`${formatNumber((kpis.totalDecrease ?? 0) / periodDays)}개/일`} />
        ) : (
          <SmallMetric label="예측 가능 SKU" value={`${formatNumber(kpis.forecastReadyCount ?? 0)} / ${formatNumber(kpis.totalSkuCount)}`} />
        )}
        <SmallMetric label="장기 정체재고 금액" value={formatCurrency(kpis.stagnantValue)} />
      </div>
    </section>
  );
}

function SmallMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: 'danger' | 'warning' }) {
  const valueClass = emphasis === 'danger' ? 'text-status-danger' : emphasis === 'warning' ? 'text-status-warning' : 'text-foreground';
  return (
    <div className="px-3 sm:px-5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
