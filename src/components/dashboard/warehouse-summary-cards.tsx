'use client';

import { UploadCloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { formatKstDate, formatKstDateTime } from '@/lib/date';
import type { WarehouseSummary } from '@/domain/inventory/types';

interface LatestUpload {
  warehouseId: string;
  snapshotDate: string | null;
  uploadedAt: string | null;
}

interface WarehouseSummaryCardsProps {
  summaries: WarehouseSummary[];
  activeWarehouseId: string | 'ALL';
  onSelect: (warehouseId: string | 'ALL') => void;
  latestUploads: LatestUpload[];
}

export function WarehouseSummaryCards({ summaries, activeWarehouseId, onSelect, latestUploads }: WarehouseSummaryCardsProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">창고별 요약</h2>
        <p className="text-xs text-muted-foreground">각 창고는 서로 다른 품목을 관리하는 독립 재고 Pool입니다 · 창고 간 우열 비교 아님</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaries.map((s) => {
          const active = activeWarehouseId === s.warehouseId;
          const upload = latestUploads.find((u) => u.warehouseId === s.warehouseId);
          return (
            <Card
              key={s.warehouseId}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onSelect(active ? 'ALL' : s.warehouseId)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(active ? 'ALL' : s.warehouseId)}
              className={cn(
                'cursor-pointer transition-all duration-150 hover:border-border hover:shadow-md active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active && 'border-primary/40 ring-2 ring-ring',
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{s.warehouseName}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0 text-xs">
                <Metric label="관리 SKU" value={`${formatNumber(s.skuCount)}개`} />
                <Metric label="재고자산" value={formatCurrency(s.inventoryValue)} />
                <Metric label="위험 SKU" value={`${formatNumber(s.dangerSkuCount)}개 (${formatPercent(s.dangerRatio)})`} />
                <Metric label="30일 내 소진 예상" value={formatPercent(s.stockoutSoon30dRatio)} />
                <Metric label="장기 정체 비율" value={formatPercent(s.stagnantRatio)} />
                <Metric label="과잉재고 후보 비율" value={formatPercent(s.overstockCandidateRatio)} />
              </CardContent>
              <div className="flex items-center gap-1.5 border-t px-5 py-2.5 text-[11px] text-muted-foreground">
                <UploadCloud className="size-3 shrink-0" aria-hidden="true" />
                {upload?.uploadedAt ? (
                  <span>
                    최근 업로드 {formatKstDate(upload.snapshotDate!)} 기준 · {formatKstDateTime(upload.uploadedAt)}
                  </span>
                ) : (
                  <span>아직 업로드된 스냅샷이 없습니다</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
