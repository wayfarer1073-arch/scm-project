'use client';

import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendLineChart } from './trend-line-chart';
import { RiskDistributionChart } from './risk-distribution-chart';
import { TopDepletionChart } from './top-depletion-chart';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { DailyWarehouseTotal } from '@/server/repositories/inventory-repository';
import type { InventoryRow } from '@/server/services/inventory-analysis-service';

interface ChartsSectionProps {
  rows: InventoryRow[];
  dailyTotals: DailyWarehouseTotal[];
  warehouses: { id: string; code: string; name: string }[];
  chartWarehouseId: string | 'ALL';
  onChangeChartWarehouse: (id: string | 'ALL') => void;
}

export function ChartsSection({ rows, dailyTotals, warehouses, chartWarehouseId, onChangeChartWarehouse }: ChartsSectionProps) {
  const filteredRows = useMemo(
    () => (chartWarehouseId === 'ALL' ? rows : rows.filter((r) => r.descriptor.warehouseId === chartWarehouseId)),
    [rows, chartWarehouseId],
  );

  const stockSeries = useMemo(() => buildDailySeries(dailyTotals, chartWarehouseId, 'totalAvailableStock'), [dailyTotals, chartWarehouseId]);
  const valueSeries = useMemo(() => buildDailySeries(dailyTotals, chartWarehouseId, 'totalInventoryValue'), [dailyTotals, chartWarehouseId]);

  const riskCounts = useMemo(() => {
    let danger = 0;
    let warning = 0;
    let normal = 0;
    for (const row of filteredRows) {
      if (row.analysis.thresholdRisk.level === 'DANGER') danger += 1;
      else if (row.analysis.thresholdRisk.level === 'WARNING') warning += 1;
      else normal += 1;
    }
    return { danger, warning, normal };
  }, [filteredRows]);

  const topDepletion = useMemo(
    () =>
      [...filteredRows]
        .filter((r) => r.analysis.window7.totalDepletion > 0)
        .sort((a, b) => b.analysis.window7.totalDepletion - a.analysis.window7.totalDepletion)
        .slice(0, 10)
        .map((r) => ({ productName: r.descriptor.productName, depletion: r.analysis.window7.totalDepletion })),
    [filteredRows],
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">핵심 차트</h2>
        <Tabs value={chartWarehouseId} onValueChange={(v) => onChangeChartWarehouse(v)}>
          <TabsList>
            <TabsTrigger value="ALL">전체</TabsTrigger>
            {warehouses.map((w) => (
              <TabsTrigger key={w.id} value={w.id}>
                {w.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendLineChart title="전체 재고수량 추이" data={stockSeries} valueFormatter={(v) => `${formatNumber(v)}개`} color="var(--color-chart-1)" />
        <TrendLineChart title="전체 재고자산 추이" data={valueSeries} valueFormatter={(v) => formatCurrency(v)} color="var(--color-chart-4)" />
        <RiskDistributionChart {...riskCounts} />
        <TopDepletionChart items={topDepletion} />
      </div>
    </section>
  );
}

function buildDailySeries(dailyTotals: DailyWarehouseTotal[], warehouseId: string | 'ALL', metric: 'totalAvailableStock' | 'totalInventoryValue') {
  const byDate = new Map<string, number>();
  for (const t of dailyTotals) {
    if (warehouseId !== 'ALL' && t.warehouseId !== warehouseId) continue;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t[metric]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, value]) => ({ date, value }));
}
