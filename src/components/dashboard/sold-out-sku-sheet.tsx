'use client';

import { PackageX } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { formatKstDate } from '@/lib/date';
import type { InventoryRow } from '@/domain/inventory/read-model';

interface SoldOutSkuSheetProps {
  rows: InventoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSku: (skuId: string) => void;
}

/** 품절 SKU 수 옆 상세보기 아이콘으로 여는 목록 패널. 행을 클릭하면 이 패널을 닫고 해당 SKU의
 * 상세보기(SkuDetailSheet)를 연다 — 같은 우측 슬라이드 자리를 두 시트가 번갈아 쓴다. */
export function SoldOutSkuSheet({ rows, open, onOpenChange, onSelectSku }: SoldOutSkuSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>품절 SKU {rows.length}개</SheetTitle>
          <SheetDescription>
            최신 업로드 목록에서 빠져 품절로 인식된 뒤, 아직 1개월 유예기간이 지나지 않은 SKU입니다. 클릭하면 상세보기로 이동합니다.
          </SheetDescription>
        </SheetHeader>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">품절 SKU가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border px-1 pb-4">
            {rows.map((r) => (
              <li key={r.descriptor.skuId}>
                <button
                  type="button"
                  onClick={() => onSelectSku(r.descriptor.skuId)}
                  className="-mx-1 flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <PackageX className="size-3.5 shrink-0 text-status-soldout" aria-hidden="true" />
                    {r.descriptor.productName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.descriptor.productCode} · {r.descriptor.warehouseCode}
                    {r.descriptor.soldOutDetectedDate ? ` · 품절 인식 ${formatKstDate(r.descriptor.soldOutDetectedDate)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
