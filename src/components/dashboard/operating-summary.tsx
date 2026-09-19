import type { InventoryRow } from '@/domain/inventory/read-model';
import { formatCurrency } from '@/lib/format';

export function OperatingSummary({ rows }: { rows: InventoryRow[] }) {
  const current = rows.filter(r => !r.descriptor.isSoldOut && r.analysis.operating?.staleShippingDays === 0);
  const b2b = current.filter(r => r.descriptor.isB2B);
  const regular = current.filter(r => !r.descriptor.isB2B);
  const value = (list: InventoryRow[]) => {
    const known = list.filter(r => r.analysis.latest.valuationKnown !== false && r.analysis.latest.normalStock >= 0);
    return known.length ? formatCurrency(known.reduce((sum, r) => sum + r.valueBreakdown.normalStockValue, 0)) : '평가 자료 없음';
  };
  return <section className="rounded-xl border border-border p-5" aria-label="운영 유형별 재고">
    <h2 className="text-base font-semibold">운영 유형별 판단</h2>
    <div className="mt-3 grid gap-4 sm:grid-cols-3">
      <div><p className="text-sm font-medium">일반 판매 · {regular.length} SKU</p><p className="text-lg tabular-nums">{value(regular)}</p><p className="text-xs text-muted-foreground">관측 자료가 충분한 SKU만 출고일 커버리지 제공</p></div>
      <div><p className="text-sm font-medium">직납 B2B · {b2b.length} SKU</p><p className="text-lg tabular-nums">{value(b2b)}</p><p className="text-xs text-muted-foreground">일괄 출고 예정 재고 · 발주/납품 일정과 소비기한 개별 확인</p></div>
      <div><p className="text-sm font-medium">품절 · {rows.filter(r => r.descriptor.isSoldOut).length} SKU</p><p className="text-xs text-muted-foreground">최근 업로드 목록에서 빠진 상품. 마지막 관측 재고는 현재 자산에서 제외</p></div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">금액은 평가 가능한 관측 재고만 포함합니다. 커버리지는 관측일 재고 ÷ 출고일평균 추정 소진입니다. 주말·등록 공휴일 제외, 반품·조정 미분리. 자동 발주량·안전재고·마진·폐기 예상 수량은 산출하지 않습니다.</p>
  </section>;
}
