'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionCenter } from '@/components/dashboard/action-center';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { WarehouseSummaryCards } from '@/components/dashboard/warehouse-summary-cards';
import { ChartsSection } from '@/components/dashboard/charts/charts-section';
import { InventoryTable } from '@/components/inventory-table/inventory-table';
import { SkuDetailSheet } from '@/components/inventory-table/sku-detail-sheet';
import { calculateCompanyKpis, calculateWarehouseSummaries, buildActionCenterCards, type InventoryRow } from '@/server/services/inventory-analysis-service';
import type { RiskThresholdSettings } from '@/domain/inventory/types';
import type { DailyWarehouseTotal } from '@/server/repositories/inventory-repository';
import type { QuickFilter, TableTab } from '@/lib/inventory-filters';
import { DateRangeControl } from '@/components/dashboard/date-range-control';
import { todayKstDateString } from '@/lib/date';

interface DashboardClientProps {
  asOfDate: string;
  fromDate: string | null;
  warehouses: { id: string; code: string; name: string }[];
  settings: RiskThresholdSettings;
  rows: InventoryRow[];
  dailyTotals: DailyWarehouseTotal[];
}

export function DashboardClient({ asOfDate, fromDate, warehouses, rows, dailyTotals }: DashboardClientProps) {
  const [warehouseFilter, setWarehouseFilter] = useState<string | 'ALL'>('ALL');
  const [tableTab, setTableTab] = useState<TableTab>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);

  const kpis = useMemo(() => calculateCompanyKpis(rows), [rows]);
  const warehouseSummaries = useMemo(() => calculateWarehouseSummaries(rows), [rows]);
  const actionCenterCards = useMemo(() => buildActionCenterCards(rows), [rows]);

  function handleActionCenterSelect(tab: TableTab, qf: QuickFilter) {
    setTableTab(tab);
    setQuickFilter(qf);
    document.getElementById('inventory-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-7">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inventory intelligence</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">재고 운영 현황</h1>
          <p className="text-sm text-muted-foreground">{asOfDate} 기준 재고 상태입니다.</p>
        </div>
        <DateRangeControl key={`${fromDate ?? 'day'}-${asOfDate}`} asOfDate={asOfDate} fromDate={fromDate} maxDate={todayKstDateString()} />
        <div className="flex items-center justify-center py-12">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed bg-card p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">아직 업로드된 재고 데이터가 없습니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">창고별 Excel을 업로드하면 대시보드가 자동으로 채워집니다.</p>
          </div>
          <Button asChild>
            <Link href="/upload">
              <UploadCloud className="size-4" /> 업로드 하러 가기
            </Link>
          </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inventory intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">재고 운영 현황</h1>
        <p className="text-sm text-muted-foreground">
          {fromDate ? `${fromDate}부터 ${asOfDate}까지의 변화와 현재 상태를 함께 봅니다.` : `${asOfDate} 기준 재고 상태입니다.`}
        </p>
      </div>
      <DateRangeControl key={`${fromDate ?? 'day'}-${asOfDate}`} asOfDate={asOfDate} fromDate={fromDate} maxDate={todayKstDateString()} />
      <ActionCenter cards={actionCenterCards} onSelect={handleActionCenterSelect} />
      <KpiCards kpis={kpis} fromDate={fromDate} asOfDate={asOfDate} />
      <WarehouseSummaryCards summaries={warehouseSummaries} activeWarehouseId={warehouseFilter} onSelect={setWarehouseFilter} />
      <ChartsSection
        rows={rows}
        dailyTotals={dailyTotals}
        warehouses={warehouses}
        chartWarehouseId={warehouseFilter}
        onChangeChartWarehouse={setWarehouseFilter}
        fromDate={fromDate}
        asOfDate={asOfDate}
      />
      <div id="inventory-table-section">
        <InventoryTable
          rows={rows}
          warehouses={warehouses}
          warehouseFilter={warehouseFilter}
          onChangeWarehouseFilter={setWarehouseFilter}
          tab={tableTab}
          onChangeTab={(tab) => {
            setTableTab(tab);
            setQuickFilter(null);
          }}
          quickFilter={quickFilter}
          onClearQuickFilter={() => setQuickFilter(null)}
          onSelectSku={setSelectedSkuId}
          asOfDate={asOfDate}
          fromDate={fromDate}
        />
      </div>
      <SkuDetailSheet skuId={selectedSkuId} asOfDate={asOfDate} fromDate={fromDate} onOpenChange={(open) => !open && setSelectedSkuId(null)} />
    </div>
  );
}
