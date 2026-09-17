import { analyzeSku, calculateInventoryValueBreakdown, calculatePeriodComparison, isNewlyAtRisk } from '@/domain/inventory/calculations';
import type { CompanyKpis, InventoryValueBreakdown, PeriodComparison, RiskThresholdSettings, SkuAnalysis, WarehouseSummary } from '@/domain/inventory/types';

export type { CompanyKpis, WarehouseSummary } from '@/domain/inventory/types';
import { loadActiveSkusWithSeries, loadSkuWithSeries, type SkuDescriptor } from '@/server/repositories/inventory-repository';
import { getSettings } from '@/server/repositories/settings-repository';

export interface InventoryRow {
  descriptor: SkuDescriptor;
  analysis: SkuAnalysis;
  valueBreakdown: InventoryValueBreakdown;
  periodComparison: PeriodComparison | null;
}

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

// ---- 집계 ----

export function calculateCompanyKpis(rows: InventoryRow[], stagnantDaysThreshold: number): CompanyKpis {
  let totalAvailableStock = 0;
  let totalInventoryValue = 0;
  let netChangeVsYesterday = 0;
  let hasAnyDayOverDay = false;
  let totalDepletion7d = 0;
  let dangerSkuCount = 0;
  let stockoutSoon30dCount = 0;
  let stagnantValue = 0;
  let totalDecrease = 0;
  let totalIncrease = 0;
  let forecastReadyCount = 0;
  let overstockCandidateValue = 0;
  let sumOfPerSkuDailyDecreaseRates = 0;
  let skusWithPeriodRate = 0;

  for (const row of rows) {
    totalAvailableStock += row.analysis.latest.availableStock;
    totalInventoryValue += row.valueBreakdown.normalStockValue;
    totalDepletion7d += row.analysis.window7.totalDepletion;
    if (row.analysis.thresholdRisk.level === 'DANGER') dangerSkuCount += 1;
    // "30일 내 소진 예상"은 설정 페이지의 "관리 필요/정상 경계"(manageMaxDays, 기본 30일) 임계값을
    // 그대로 따라야 한다. coverageDays를 30으로 재하드코딩하면 admin이 이 기준을 바꿔도(예: 45일)
    // 이 KPI만 조용히 어긋난다 — band는 이미 그 설정으로 계산돼 있으므로 재사용한다.
    if (row.analysis.coverage.band === 'STOCKOUT_SOON' || row.analysis.coverage.band === 'NEEDS_MANAGEMENT') stockoutSoon30dCount += 1;
    if (row.analysis.forecast.expectedStockoutDays !== null) forecastReadyCount += 1;
    if (row.analysis.overstock.isCandidate) overstockCandidateValue += row.valueBreakdown.normalStockValue;
    if (row.analysis.stagnation.isMeaningful && row.analysis.stagnation.stagnantDays >= stagnantDaysThreshold) {
      stagnantValue += row.valueBreakdown.normalStockValue;
    }
    if (row.analysis.dailyChange !== null) {
      hasAnyDayOverDay = true;
      netChangeVsYesterday += row.analysis.dailyChange;
    }
    if (row.periodComparison) {
      totalDecrease += row.periodComparison.totalDepletion;
      totalIncrease += row.periodComparison.totalIncrease;
      // "기간 일평균 감소"는 SKU마다 실제 관측 기간(observedDays)이 다를 수 있으므로, 전체
      // 합계를 하나의 (요청된) 기간 일수로 나누지 않는다. 대신 SKU별로 자기 자신의 관측 기간에
      // 맞춰 계산한 일평균을 먼저 구하고, 그 값들의 평균을 낸다.
      if (row.periodComparison.observedDays > 0) {
        sumOfPerSkuDailyDecreaseRates += row.periodComparison.totalDepletion / row.periodComparison.observedDays;
        skusWithPeriodRate += 1;
      }
    } else if (row.analysis.dailyChange !== null) {
      totalDecrease += Math.max(-row.analysis.dailyChange, 0);
      totalIncrease += Math.max(row.analysis.dailyChange, 0);
    }
  }

  return {
    totalSkuCount: rows.length,
    totalAvailableStock,
    totalInventoryValue,
    netChangeVsYesterday: hasAnyDayOverDay ? netChangeVsYesterday : null,
    totalDepletion7d,
    averageDailyDecreasePerSku: skusWithPeriodRate > 0 ? sumOfPerSkuDailyDecreaseRates / skusWithPeriodRate : null,
    dangerSkuCount,
    stockoutSoon30dCount,
    stagnantValue,
    totalDecrease,
    totalIncrease,
    forecastReadyCount,
    overstockCandidateValue,
  };
}

export function calculateWarehouseSummaries(rows: InventoryRow[], stagnantDaysThreshold: number): WarehouseSummary[] {
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
    const stockoutSoonCount = whRows.filter((r) => r.analysis.coverage.band === 'STOCKOUT_SOON' || r.analysis.coverage.band === 'NEEDS_MANAGEMENT').length;
    const stagnantCount = whRows.filter((r) => r.analysis.stagnation.isMeaningful && r.analysis.stagnation.stagnantDays >= stagnantDaysThreshold).length;
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

export type ActionCenterCategory = 'NEW_DANGER' | 'STOCKOUT_SOON' | 'ACCELERATING' | 'STOCK_INCREASE' | 'STAGNANT' | 'OVERSTOCK_CANDIDATE' | 'EXPIRATION_RISK';

export interface ActionCenterCard {
  category: ActionCenterCategory;
  title: string;
  count: number;
  sampleSkus: { skuId: string; productName: string; productCode: string; warehouseName: string; detail: string }[];
}

export function buildActionCenterCards(rows: InventoryRow[], stagnantDaysThreshold: number): ActionCenterCard[] {
  const newDanger = rows.filter((r) => isNewlyAtRisk(r.analysis));
  const stockoutSoon = rows.filter((r) => r.analysis.coverage.band === 'STOCKOUT_SOON');
  const accelerating = rows.filter((r) => r.analysis.acceleration.trend === 'ACCELERATING');
  const stockIncrease = rows.filter((r) => r.analysis.stockIncreasedToday);
  const stagnant = rows.filter((r) => r.analysis.stagnation.isMeaningful && r.analysis.stagnation.stagnantDays >= stagnantDaysThreshold);
  const overstock = rows.filter((r) => r.analysis.overstock.isCandidate);
  const expirationRisk = rows.filter((r) => r.analysis.expirationRisk.isAtRisk);

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
    {
      category: 'EXPIRATION_RISK',
      title: '소비기한 임박 위험',
      count: expirationRisk.length,
      sampleSkus: toSample(expirationRisk, (r) => `소비기한 D-${r.analysis.expirationRisk.daysUntilExpiration} · 재고 ${Math.floor(r.analysis.coverage.coverageDays ?? 0)}일분`),
    },
  ];
}
