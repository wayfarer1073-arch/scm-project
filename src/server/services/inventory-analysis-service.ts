import { analyzeSku, calculateInventoryValueBreakdown, calculatePeriodComparison } from '@/domain/inventory/calculations';
import type { RiskThresholdSettings } from '@/domain/inventory/types';

import { loadActiveSkusWithSeries, loadSkuWithSeries } from '@/server/repositories/inventory-repository';
import { getSettings } from '@/server/repositories/settings-repository';

import type { InventoryRow } from '@/domain/inventory/read-model';

export async function getInventoryRows(options: { warehouseId?: string; asOfDate: string; compareFromDate?: string; settings?: RiskThresholdSettings }): Promise<InventoryRow[]> {
  const settings = options.settings ?? (await getSettings());
  const skusWithSeries = await loadActiveSkusWithSeries(options.warehouseId, options.asOfDate);

  const rows: InventoryRow[] = [];
  for (const { descriptor, observations } of skusWithSeries) {
    const analysis = analyzeSku(
      observations,
      options.asOfDate,
      settings,
      { dangerQty: descriptor.manualDangerQty, warningQty: descriptor.manualWarningQty },
      { expirationDate: descriptor.expirationDate, expirationRiskDays: descriptor.expirationRiskDays },
    );
    if (!analysis) continue; // asOfDate 이전 관측치가 없는 SKU(예: 미래 등록)는 제외
    const valueBreakdown = calculateInventoryValueBreakdown(analysis.latest);
    const periodComparison = options.compareFromDate
      ? calculatePeriodComparison(observations, options.compareFromDate, options.asOfDate)
      : null;
    rows.push({ descriptor, analysis, valueBreakdown, periodComparison });
  }
  return rows;
}

export async function getSkuDetail(skuId: string, asOfDate: string, settings?: RiskThresholdSettings) {
  const resolvedSettings = settings ?? (await getSettings());
  const result = await loadSkuWithSeries(skuId, asOfDate);
  if (!result) return null;
  const analysis = analyzeSku(
    result.observations,
    asOfDate,
    resolvedSettings,
    { dangerQty: result.descriptor.manualDangerQty, warningQty: result.descriptor.manualWarningQty },
    { expirationDate: result.descriptor.expirationDate, expirationRiskDays: result.descriptor.expirationRiskDays },
  );
  if (!analysis) return null;
  const valueBreakdown = calculateInventoryValueBreakdown(analysis.latest);
  return { descriptor: result.descriptor, analysis, valueBreakdown, observations: result.observations };
}
