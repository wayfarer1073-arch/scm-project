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

interface DashboardClientProps {
  asOfDate: string;
  warehouses: { id: string; code: string; name: string }[];
  settings: RiskThresholdSettings;
  rows: InventoryRow[];
  dailyTotals: DailyWarehouseTotal[];
}

export function DashboardClient({ asOfDate, warehouses, rows, dailyTotals }: DashboardClientProps) {
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
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <UploadCloud className="size-10 text-muted-foreground" />
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
    );
  }

  return (
    <div className="space-y-8">
      <ActionCenter cards={actionCenterCards} onSelect={handleActionCenterSelect} />
      <KpiCards kpis={kpis} />
      <WarehouseSummaryCards summaries={warehouseSummaries} activeWarehouseId={warehouseFilter} onSelect={setWarehouseFilter} />
      <ChartsSection
        rows={rows}
        dailyTotals={dailyTotals}
        warehouses={warehouses}
        chartWarehouseId={warehouseFilter}
        onChangeChartWarehouse={setWarehouseFilter}
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
        />
      </div>
      <SkuDetailSheet skuId={selectedSkuId} asOfDate={asOfDate} onOpenChange={(open) => !open && setSelectedSkuId(null)} />
    </div>
  );
}
