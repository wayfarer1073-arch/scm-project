import { Star } from 'lucide-react';
import { Table, TableBody, TableHeader } from '@/components/ui/table';
import { InventoryTableRow, InventoryTableStaticHeader } from '@/components/inventory-table/inventory-table';
import type { InventoryRow } from '@/domain/inventory/read-model';

interface FavoritesSummaryProps {
  rows: InventoryRow[];
  onSelectSku: (skuId: string) => void;
  fromDate: string | null;
}

export function FavoritesSummary({ rows, onSelectSku, fromDate }: FavoritesSummaryProps) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        <h2 className="text-base font-semibold">즐겨찾기</h2>
        <span className="text-xs text-muted-foreground">{rows.length}개</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          아래 목록에서 상품을 클릭한 뒤 SKU 상세의 별표를 누르면 이곳에 즐겨찾기한 SKU의 KPI 현황이 표시됩니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <InventoryTableStaticHeader fromDate={fromDate} />
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <InventoryTableRow key={r.descriptor.skuId} row={r} fromDate={fromDate} onSelectSku={onSelectSku} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
