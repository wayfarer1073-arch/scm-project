import { formatCurrency, formatNumber } from '@/lib/format';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { CompanyKpis } from '@/domain/inventory/types';

interface KpiCardsProps { kpis: CompanyKpis; fromDate: string | null; asOfDate: string; onOpenSoldOutList?: () => void; }

export function KpiCards({ kpis, fromDate, asOfDate, onOpenSoldOutList }: KpiCardsProps) {
  const s = kpis.snapshot;
  const percent = (value: number | null) => value === null ? '산정 불가' : `${(value * 100).toFixed(1)}%`;
  const quantity = (value: number | null) => value === null ? '비교 불가' : `${formatNumber(value)}개`;
  const periodLabel = fromDate ? `${fromDate} — ${asOfDate} 양 끝 관측 일치` : 'SKU별 직전 관측 대비';
  // 집계 시작일: 특정 날짜 조회는 데이터가 실제로 처음 쌓이기 시작한 날짜(firstSeenDate 최솟값),
  // 기간 조회는 선택한 시작일(fromDate) — 단 자료 자체가 그 시작일보다 늦게부터 쌓였다면(신규 SKU
  // 집합 등) 실제로 확인 가능한 가장 이른 날짜로 보정한다.
  const collectionStartDate = fromDate
    ? (s.earliestFirstSeenDate && s.earliestFirstSeenDate > fromDate ? s.earliestFirstSeenDate : fromDate)
    : s.earliestFirstSeenDate;
  return (
    <section className="overflow-hidden rounded-xl border border-border" aria-label="스냅샷 기반 재고 KPI">
      <div className="flex items-center gap-1.5 bg-sidebar px-5 py-3.5 text-sidebar-foreground">
        <h2 className="text-base font-semibold">관측 재고 현황</h2>
        <InfoTooltip className="text-brand-accent hover:text-brand-accent/80">
          판매 가능한(정상) 재고만 계산에 넣었어요. 선택한 날짜에 실제로 자료가 올라온 상품만 포함하고, 자료가 없는 날은 빼고 계산합니다.
          &quot;보유율&quot;은 주문을 얼마나 채울 수 있는지가 아니라, 재고가 남아있는 상품이 몇 %인지를 뜻해요.
        </InfoTooltip>
      </div>
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-xs text-muted-foreground">평가 가능한 재고금액</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{s.knownInventoryValue === null ? '평가 불가' : formatCurrency(s.knownInventoryValue)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">업로드 원가합 우선, 없으면 정상재고 × 유효 원가</p>
          <p className="mt-1 text-xs text-muted-foreground">평가 범위 {s.valuedSkuCount} / {s.observedSkuCount} SKU ({percent(s.valuationCoverageRatio)}) · 원가 미상·오류 {s.unvaluedSkuCount}개 제외</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Metric
            label="품절 SKU"
            value={`${s.soldOutSkuCount}개`}
            emphasis={s.soldOutSkuCount ? 'warning' : undefined}
            tooltip="최신 업로드 목록에서 빠져 품절로 인식된 뒤, 아직 1개월 유예기간이 지나지 않은 SKU 수입니다."
            action={
              <button
                type="button"
                onClick={onOpenSoldOutList}
                disabled={s.soldOutSkuCount === 0}
                aria-label="품절 SKU 목록 보기"
                className="rounded px-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                상세보기
              </button>
            }
          />
          <Metric
            label="미입고재고"
            value={`${formatNumber(s.unexplainedIncreaseTotal ?? 0)}개 / ${s.unexplainedIncreaseSkus.length}개 SKU`}
            detail="입고 특이사항으로 등록되지 않아 늘어난 재고"
            tooltip={s.unexplainedIncreaseSkus.length === 0
              ? '입고로 설명되지 않는 증가가 관측되지 않았습니다.'
              : `해당 SKU(관측일): ${s.unexplainedIncreaseSkus.slice(0, 8).map((x) => `${x.productCode}(${x.observedDate})`).join(', ')}${s.unexplainedIncreaseSkus.length > 8 ? ` 외 ${s.unexplainedIncreaseSkus.length - 8}건` : ''} · 입고 특이사항은 이 관측일(직전 관측일 초과~이 날짜 이내)로 등록해야 반영됩니다.`}
          />
          <Metric label="측정 기준일" value={s.newestObservationDate ?? '관측 없음'} detail={s.newestObservationDate ? `마지막 업로드 일자 · 집계 시작일 ${collectionStartDate ?? s.newestObservationDate}` : undefined} />
          <Metric label="총 SKU" value={`${s.comparableSkuCount} / ${kpis.totalSkuCount}`} detail={periodLabel} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 sm:grid-cols-4">
        <Metric label="SKU별 순감소 합계" value={quantity(s.observedDecrease)} detail="두 관측 재고의 차이 · 판매량 아님" />
        <Metric label="SKU별 순증가 합계" value={quantity(s.observedIncrease)} detail="두 관측 재고의 차이" />
        <Metric label="기록된 입고량" value={quantity(s.recordedInbound)} detail="동일 비교 구간 · 미기록 입고 제외" />
        <Metric label="입고 보정 추정 소진" value={quantity(s.estimatedDepletion)} detail="구간별 max(이전 재고 + 입고 − 현재 재고, 0)" />
      </div>
      <div className="flex items-center gap-1.5 border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">추정치 해석 유의사항</p>
        <InfoTooltip>
          여기 나온 소진량은 재고가 줄어든 만큼을 계산한 추정치예요. 반품, 창고 간 이동, 재고 조정, 기록되지 않은 입고 등이 섞여 있을 수 있어
          실제 판매량과는 다를 수 있습니다. 정확한 회전율이나 품절 시점 예측에는 이 숫자만으로는 충분하지 않아요.
        </InfoTooltip>
      </div>
    </section>
  );
}
function Metric({ label, value, detail, emphasis, tooltip, action }: { label: string; value: string; detail?: string; emphasis?: 'danger' | 'warning'; tooltip?: React.ReactNode; action?: React.ReactNode }) {
  const valueClass = emphasis === 'danger' ? 'text-status-danger' : emphasis === 'warning' ? 'text-status-warning' : 'text-foreground';
  return (
    <div>
      <div className="flex items-center gap-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <p className={`text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
        {action}
      </div>
      {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}
