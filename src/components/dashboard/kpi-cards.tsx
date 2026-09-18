import { formatCurrency, formatNumber } from '@/lib/format';
import type { CompanyKpis } from '@/domain/inventory/types';

interface KpiCardsProps { kpis: CompanyKpis; fromDate: string | null; asOfDate: string; }

export function KpiCards({ kpis, fromDate, asOfDate }: KpiCardsProps) {
  const s = kpis.snapshot;
  const percent = (value: number | null) => value === null ? '산정 불가' : `${(value * 100).toFixed(1)}%`;
  const quantity = (value: number | null) => value === null ? '비교 불가' : `${formatNumber(value)}개`;
  const periodLabel = fromDate ? `${fromDate} — ${asOfDate} 양 끝 관측 일치` : 'SKU별 직전 관측 대비';
  return (
    <section className="rounded-xl border border-border" aria-label="스냅샷 기반 재고 KPI">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-base font-semibold">관측 재고 현황</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">정상재고 기준 · 최신 스냅샷의 표시 대상 SKU만 집계 · 보유율은 주문 충족률이 아닙니다.</p>
      </div>
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-xs text-muted-foreground">평가 가능한 재고금액</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{s.knownInventoryValue === null ? '평가 불가' : formatCurrency(s.knownInventoryValue)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">업로드 원가합 우선, 없으면 정상재고 × 유효 원가</p>
          <p className="mt-1 text-xs text-muted-foreground">평가 범위 {s.valuedSkuCount} / {kpis.totalSkuCount} SKU ({percent(s.valuationCoverageRatio)}) · 원가 미상·오류 {s.unvaluedSkuCount}개 제외</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Metric label="재고 보유 SKU 비율" value={percent(s.inStockSkuRatio)} detail={`정상재고 > 0 · ${s.positiveStockSkuCount} / ${kpis.totalSkuCount} SKU`} />
          <Metric label="무재고 SKU" value={`${s.zeroStockSkuCount}개`} detail="정상재고 = 0 · 마지막 관측 기준" emphasis="warning" />
          <Metric label="음수재고 SKU" value={`${s.negativeStockSkuCount}개`} detail="정합성 확인 필요 · 평가금액 제외" emphasis="danger" />
          <Metric label="기준일 미관측 SKU" value={`${s.staleSkuCount}개`} detail={`${asOfDate} 스냅샷 없음 · 과거값 사용`} emphasis={s.staleSkuCount ? 'warning' : undefined} />
          <Metric label="관측 재고 기준일" value={s.newestObservationDate ?? '관측 없음'} detail={s.oldestObservationDate && s.oldestObservationDate !== s.newestObservationDate ? `가장 오래된 관측 ${s.oldestObservationDate}` : '대상 SKU의 관측일 동일'} />
          <Metric label="비교 가능한 SKU" value={`${s.comparableSkuCount} / ${kpis.totalSkuCount}`} detail={periodLabel} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 sm:grid-cols-4">
        <Metric label="SKU별 순감소 합계" value={quantity(s.observedDecrease)} detail="두 관측 재고의 차이 · 판매량 아님" />
        <Metric label="SKU별 순증가 합계" value={quantity(s.observedIncrease)} detail="두 관측 재고의 차이" />
        <Metric label="기록된 입고량" value={quantity(s.recordedInbound)} detail="동일 비교 구간 · 미기록 입고 제외" />
        <Metric label="입고 보정 추정 소진" value={quantity(s.estimatedDepletion)} detail="구간별 max(이전 재고 + 입고 − 현재 재고, 0)" />
      </div>
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">추정 소진에는 반품·이동·재고조정 및 미기록 입고의 영향이 남습니다. 회전율·실제 판매량·정확한 품절 예측은 이 데이터만으로 검증할 수 없습니다.</p>
    </section>
  );
}
function Metric({ label, value, detail, emphasis }: { label: string; value: string; detail?: string; emphasis?: 'danger' | 'warning' }) {
  const valueClass = emphasis === 'danger' ? 'text-status-danger' : emphasis === 'warning' ? 'text-status-warning' : 'text-foreground';
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>{detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}</div>;
}
