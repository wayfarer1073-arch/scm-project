import { formatCurrency, formatNumber } from '@/lib/format';
import type { CompanyKpis } from '@/domain/inventory/types';

interface KpiCardsProps {
  kpis: CompanyKpis;
  fromDate: string | null;
  asOfDate: string;
}

export function KpiCards({ kpis, fromDate, asOfDate }: KpiCardsProps) {
  const periodLabel = fromDate ? `${fromDate.slice(5)} — ${asOfDate.slice(5)}` : '직전 관측 대비';

  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-base font-semibold">전체 현황</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">수량 합계는 규모와 변화 확인용이며 상품 간 우열을 뜻하지 않습니다.</p>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="shrink-0">
          <p className="text-xs text-muted-foreground">총 재고자산</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatCurrency(kpis.totalInventoryValue)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            정상재고 × 원가 · {formatNumber(kpis.totalSkuCount)}개 SKU · 가용재고 {formatNumber(kpis.totalAvailableStock)}개
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <Metric label="위험 SKU" value={`${formatNumber(kpis.dangerSkuCount)}개`} emphasis="danger" />
          <Metric label="30일 내 소진 예상" value={`${formatNumber(kpis.stockoutSoon30dCount)}개`} emphasis="warning" />
          <Metric label="관측 재고 감소" value={`${formatNumber(kpis.totalDecrease ?? 0)}개`} detail={periodLabel} />
          <Metric label="관측 재고 증가" value={`${formatNumber(kpis.totalIncrease ?? 0)}개`} detail="입고/반품/조정 가능" />
          {fromDate ? (
            kpis.averageDailyDecreasePerSku !== null && kpis.averageDailyDecreasePerSku !== undefined ? (
              <Metric label="기간 일평균 관측 감소" value={`${formatNumber(kpis.averageDailyDecreasePerSku)}개/일`} detail="SKU 평균" />
            ) : (
              <Metric label="기간 일평균 관측 감소" value="비교 불가" />
            )
          ) : (
            <Metric label="예측 가능 SKU" value={`${formatNumber(kpis.forecastReadyCount ?? 0)} / ${formatNumber(kpis.totalSkuCount)}`} />
          )}
          <Metric label="장기 정체재고 금액" value={formatCurrency(kpis.stagnantValue)} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, emphasis }: { label: string; value: string; detail?: string; emphasis?: 'danger' | 'warning' }) {
  const valueClass = emphasis === 'danger' ? 'text-status-danger' : emphasis === 'warning' ? 'text-status-warning' : 'text-foreground';
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}
