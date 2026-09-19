import { Star } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { InventoryRow } from '@/domain/inventory/read-model';

interface FavoritesSummaryProps {
  rows: InventoryRow[];
}

export function FavoritesSummary({ rows }: FavoritesSummaryProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-1.5">
          <Star className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-semibold">즐겨찾기</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          아래 목록에서 상품을 클릭한 뒤 SKU 상세의 별표를 누르면 이곳에 즐겨찾기한 SKU의 KPI 현황이 표시됩니다.
        </p>
      </section>
    );
  }

  const dangerCount = rows.filter((r) => r.analysis.thresholdRisk.level === 'DANGER').length;
  const warningCount = rows.filter((r) => r.analysis.thresholdRisk.level === 'WARNING').length;
  const normalCount = rows.length - dangerCount - warningCount;
  const totalValue = rows.reduce((sum, r) => sum + r.valueBreakdown.normalStockValue, 0);
  const stockoutSoonCount = rows.filter((r) => r.analysis.coverage.band === 'STOCKOUT_SOON').length;
  const acceleratingCount = rows.filter((r) => r.analysis.acceleration.trend === 'ACCELERATING').length;
  const stagnantCount = rows.filter((r) => r.analysis.tags.some((t) => t.startsWith('[재고 정체'))).length;
  const overstockCount = rows.filter((r) => r.analysis.overstock.isCandidate).length;

  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center gap-1.5 border-b border-border px-5 py-3.5">
        <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        <h2 className="text-base font-semibold">즐겨찾기</h2>
        <span className="text-xs text-muted-foreground">{rows.length}개 SKU</span>
      </div>
      <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4 lg:grid-cols-7">
        <Metric label="재고자산" value={formatCurrency(totalValue)} />
        <Metric label="위험" value={`${dangerCount}개`} emphasis={dangerCount ? 'danger' : undefined} />
        <Metric label="주의" value={`${warningCount}개`} emphasis={warningCount ? 'warning' : undefined} />
        <Metric label="정상" value={`${normalCount}개`} />
        <Metric label="품절 임박" value={`${stockoutSoonCount}개`} emphasis={stockoutSoonCount ? 'danger' : undefined} />
        <Metric label="소진 가속" value={`${acceleratingCount}개`} emphasis={acceleratingCount ? 'warning' : undefined} />
        <Metric label="장기 정체·과잉 후보" value={`${stagnantCount + overstockCount}개`} />
      </div>
    </section>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: 'danger' | 'warning' }) {
  const valueClass = emphasis === 'danger' ? 'text-status-danger' : emphasis === 'warning' ? 'text-status-warning' : 'text-foreground';
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
