'use client';

import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Table, TableBody, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InventoryTableRow, InventoryTableStaticHeader } from '@/components/inventory-table/inventory-table';
import type { InventoryRow } from '@/domain/inventory/read-model';
import type { RiskLevel } from '@/domain/inventory/types';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// 위험 > 주의 > 개별 확인 > 기준 내 순 — 더 급하게 봐야 할 SKU가 위로 오도록.
const RISK_DISPLAY_RANK: Record<RiskLevel, number> = { DANGER: 0, WARNING: 1, UNKNOWN: 2, NORMAL: 3 };

interface FavoritesSummaryProps {
  rows: InventoryRow[];
  onSelectSku: (skuId: string) => void;
  fromDate: string | null;
}

export function FavoritesSummary({ rows, onSelectSku, fromDate }: FavoritesSummaryProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => RISK_DISPLAY_RANK[a.analysis.thresholdRisk.level] - RISK_DISPLAY_RANK[b.analysis.thresholdRisk.level]),
    [rows],
  );
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-1.5 bg-sidebar px-5 py-3.5 text-sidebar-foreground">
        <Star className="size-4 fill-brand-accent text-brand-accent" aria-hidden="true" />
        <h2 className="text-base font-semibold">즐겨찾기</h2>
        <span className="text-xs text-sidebar-muted-foreground">{rows.length}개</span>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          아래 목록에서 상품을 클릭한 뒤 SKU 상세의 별표를 누르면 이곳에 즐겨찾기한 SKU의 KPI 현황이 표시됩니다.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <InventoryTableStaticHeader fromDate={fromDate} />
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <InventoryTableRow key={r.descriptor.skuId} row={r} fromDate={fromDate} onSelectSku={onSelectSku} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>페이지당 행수</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[84px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}개</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  이전
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                  다음
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
