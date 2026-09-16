import { analyzeSku, calculateInventoryValueBreakdown, isNewlyAtRisk } from '@/domain/inventory/calculations';
import type { CompanyKpis, InventoryValueBreakdown, RiskThresholdSettings, SkuAnalysis, WarehouseSummary } from '@/domain/inventory/types';

export type { CompanyKpis, WarehouseSummary } from '@/domain/inventory/types';
import { loadActiveSkusWithSeries, loadSkuWithSeries, type SkuDescriptor } from '@/server/repositories/inventory-repository';
import { getSettings } from '@/server/repositories/settings-repository';

export interface InventoryRow {
  descriptor: SkuDescriptor;
  analysis: SkuAnalysis;
  valueBreakdown: InventoryValueBreakdown;
}

export async function getInventoryRows(options: { warehouseId?: string; asOfDate: string; settings?: RiskThresholdSettings }): Promise<InventoryRow[]> {
  const settings = options.settings ?? (await getSettings());
  const skusWithSeries = await loadActiveSkusWithSeries(options.warehouseId);

  const rows: InventoryRow[] = [];
  for (const { descriptor, observations } of skusWithSeries) {
    const analysis = analyzeSku(observations, options.asOfDate, settings);
    if (!analysis) continue; // asOfDate 이전 관측치가 없는 SKU(예: 미래 등록)는 제외
    const valueBreakdown = calculateInventoryValueBreakdown(analysis.latest);
    rows.push({ descriptor, analysis, valueBreakdown });
  }
  return rows;
}

export async function getSkuDetail(skuId: string, asOfDate: string, settings?: RiskThresholdSettings) {
  const resolvedSettings = settings ?? (await getSettings());
  const result = await loadSkuWithSeries(skuId);
  if (!result) return null;
  const analysis = analyzeSku(result.observations, asOfDate, resolvedSettings);
  if (!analysis) return null;
  const valueBreakdown = calculateInventoryValueBreakdown(analysis.latest);
  return { descriptor: result.descriptor, analysis, valueBreakdown, observations: result.observations };
}

// ---- 집계 ----

export function calculateCompanyKpis(rows: InventoryRow[]): CompanyKpis {
  let totalAvailableStock = 0;
  let totalInventoryValue = 0;
  let netChangeVsYesterday = 0;
  let hasAnyDayOverDay = false;
  let totalDepletion7d = 0;
  let dangerSkuCount = 0;
  let stockoutSoon30dCount = 0;
  let stagnantValue = 0;

  for (const row of rows) {
    totalAvailableStock += row.analysis.latest.availableStock;
    totalInventoryValue += row.valueBreakdown.normalStockValue;
    totalDepletion7d += row.analysis.window7.totalDepletion;
    if (row.analysis.thresholdRisk.level === 'DANGER') dangerSkuCount += 1;
    if (row.analysis.coverage.coverageDays !== null && row.analysis.coverage.coverageDays <= 30) stockoutSoon30dCount += 1;
    if (row.analysis.stagnation.isMeaningful && row.analysis.stagnation.stagnantDays >= 30) {
      stagnantValue += row.valueBreakdown.normalStockValue;
    }
    if (row.analysis.dailyChange !== null) {
      hasAnyDayOverDay = true;
      netChangeVsYesterday += row.analysis.dailyChange;
    }
  }

  return {
    totalSkuCount: rows.length,
    totalAvailableStock,
    totalInventoryValue,
    netChangeVsYesterday: hasAnyDayOverDay ? netChangeVsYesterday : null,
    totalDepletion7d,
    dangerSkuCount,
    stockoutSoon30dCount,
    stagnantValue,
  };
}

export function calculateWarehouseSummaries(rows: InventoryRow[]): WarehouseSummary[] {
  const byWarehouse = new Map<string, InventoryRow[]>();
  for (const row of rows) {
    const list = byWarehouse.get(row.descriptor.warehouseId) ?? [];
    list.push(row);
    byWarehouse.set(row.descriptor.warehouseId, list);
  }

  return [...byWarehouse.entries()].map(([warehouseId, whRows]) => {
    const skuCount = whRows.length;
    const inventoryValue = whRows.reduce((sum, r) => sum + r.valueBreakdown.normalStockValue, 0);
    const dangerSkuCount = whRows.filter((r) => r.analysis.thresholdRisk.level === 'DANGER').length;
    const stockoutSoonCount = whRows.filter((r) => r.analysis.coverage.coverageDays !== null && r.analysis.coverage.coverageDays <= 30).length;
    const stagnantCount = whRows.filter((r) => r.analysis.stagnation.isMeaningful && r.analysis.stagnation.stagnantDays >= 30).length;
    const overstockCount = whRows.filter((r) => r.analysis.overstock.isCandidate).length;

    return {
      warehouseId,
      warehouseCode: whRows[0].descriptor.warehouseCode,
      warehouseName: whRows[0].descriptor.warehouseName,
      skuCount,
      inventoryValue,
      dangerSkuCount,
      dangerRatio: skuCount > 0 ? dangerSkuCount / skuCount : 0,
      stockoutSoon30dRatio: skuCount > 0 ? stockoutSoonCount / skuCount : 0,
      stagnantRatio: skuCount > 0 ? stagnantCount / skuCount : 0,
      overstockCandidateRatio: skuCount > 0 ? overstockCount / skuCount : 0,
    };
  });
}

export type ActionCenterCategory = 'NEW_DANGER' | 'STOCKOUT_SOON' | 'ACCELERATING' | 'STOCK_INCREASE' | 'STAGNANT' | 'OVERSTOCK_CANDIDATE';

export interface ActionCenterCard {
  category: ActionCenterCategory;
  title: string;
  count: number;
  sampleSkus: { skuId: string; productName: string; productCode: string; warehouseName: string; detail: string }[];
}

export function buildActionCenterCards(rows: InventoryRow[]): ActionCenterCard[] {
  const newDanger = rows.filter((r) => isNewlyAtRisk(r.analysis));
  const stockoutSoon = rows.filter((r) => r.analysis.coverage.band === 'STOCKOUT_SOON');
  const accelerating = rows.filter((r) => r.analysis.acceleration.trend === 'ACCELERATING');
  const stockIncrease = rows.filter((r) => r.analysis.stockIncreasedToday);
  const stagnant = rows.filter((r) => r.analysis.stagnation.isMeaningful && r.analysis.stagnation.stagnantDays >= 30);
  const overstock = rows.filter((r) => r.analysis.overstock.isCandidate);

  const toSample = (list: InventoryRow[], detailFn: (r: InventoryRow) => string) =>
    list.slice(0, 3).map((r) => ({
      skuId: r.descriptor.skuId,
      productName: r.descriptor.productName,
      productCode: r.descriptor.productCode,
      warehouseName: r.descriptor.warehouseName,
      detail: detailFn(r),
    }));

  return [
    {
      category: 'NEW_DANGER',
      title: '신규 위험 SKU',
      count: newDanger.length,
      sampleSkus: toSample(newDanger, (r) => (r.analysis.thresholdRisk.reason ? r.analysis.thresholdRisk.reason : '상태 악화')),
    },
    {
      category: 'STOCKOUT_SOON',
      title: '품절 임박 SKU',
      count: stockoutSoon.length,
      sampleSkus: toSample(stockoutSoon, (r) => `${Math.floor(r.analysis.coverage.coverageDays ?? 0)}일분 남음`),
    },
    {
      category: 'ACCELERATING',
      title: '소진 가속 SKU',
      count: accelerating.length,
      sampleSkus: toSample(accelerating, (r) => `소진속도 +${Math.round(r.analysis.acceleration.accelerationRatePercent ?? 0)}%`),
    },
    {
      category: 'STOCK_INCREASE',
      title: '재고 증가 감지 SKU',
      count: stockIncrease.length,
      sampleSkus: toSample(stockIncrease, (r) => `+${r.analysis.dailyChange ?? 0}`),
    },
    {
      category: 'STAGNANT',
      title: '장기 정체 SKU',
      count: stagnant.length,
      sampleSkus: toSample(stagnant, (r) => `${r.analysis.stagnation.stagnantDays}일간 감소 없음`),
    },
    {
      category: 'OVERSTOCK_CANDIDATE',
      title: '과잉재고 후보',
      count: overstock.length,
      sampleSkus: toSample(overstock, (r) => `${Math.floor(r.analysis.overstock.coverageDays ?? 0)}일분 재고`),
    },
  ];
}
