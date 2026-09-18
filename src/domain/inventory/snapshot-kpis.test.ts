import { describe, expect, it } from 'vitest';
import { calculateCompanyKpis, calculateSnapshotKpis, calculateWarehouseSummaries } from './aggregation';
import { analyzeSku, calculateInventoryValueBreakdown, calculatePeriodComparison } from './calculations';
import { resolveInventoryCost } from './costs';
import { buildSummarySheetRows } from '../excel/export';
import type { StockObservation } from './types';
import type { InventoryRow } from './read-model';

function obs(date: string, normalStock: number, rest: Partial<StockObservation> = {}): StockObservation {
  return { date, normalStock, availableStock: normalStock, unitCost: 10, defectiveStock: 0, incomingStock: 0, warningQty: 0, dangerQty: 0, ...rest };
}
function row(id: string, observations: StockObservation[], asOf = '2026-09-08', from?: string): InventoryRow {
  const analysis = analyzeSku(observations, asOf)!;
  return {
    descriptor: { skuId: id, productCode: id, productName: id, warehouseId: 'w', warehouseCode: 'A', warehouseName: 'A', option: null, barcode: null, location: null, manualDangerQty: null, manualWarningQty: null, expirationDate: null, expirationRiskDays: null },
    analysis, valueBreakdown: calculateInventoryValueBreakdown(analysis.latest),
    periodComparison: from ? calculatePeriodComparison(observations, from, asOf) : null,
  };
}

describe('directly observed snapshot KPIs', () => {
  it('empty data is unknown, not zero percent or a zero valuation', () => {
    expect(calculateSnapshotKpis([])).toMatchObject({ inStockSkuRatio: null, knownInventoryValue: null, observedDecrease: null, comparableSkuCount: 0 });
  });
  it('uses SKU count, separates zero and negative inventory, exposes stale stock', () => {
    const s = calculateSnapshotKpis([row('a', [obs('2026-09-08', 1000)]), row('b', [obs('2026-09-08', 0)]), row('c', [obs('2026-09-01', -100)])]);
    expect(s).toMatchObject({ positiveStockSkuCount: 1, zeroStockSkuCount: 1, negativeStockSkuCount: 1, knownInventoryValue: 10000, valuedSkuCount: 2, unvaluedSkuCount: 1, staleSkuCount: 1, oldestObservationDate: '2026-09-01', newestObservationDate: '2026-09-08' });
    expect(s.inStockSkuRatio).toBeCloseTo(1 / 3);
  });
  it('does not turn missing costs into known zero; honors uploaded total and explicit zero', () => {
    const missing = resolveInventoryCost({ normalStock: 10, unitCost: 0, unitCostProvided: false, totalCost: null }, null);
    const zero = resolveInventoryCost({ normalStock: 10, unitCost: 0, unitCostProvided: true, totalCost: null }, null);
    expect(missing.valuationKnown).toBe(false);
    expect(zero.valuationKnown).toBe(true);
    const rows = [row('missing', [obs('2026-09-08', 10, missing)]), row('zero', [obs('2026-09-08', 10, zero)]), row('total', [obs('2026-09-08', 10, { totalCost: 95 })])];
    expect(calculateSnapshotKpis(rows)).toMatchObject({ knownInventoryValue: 95, valuedSkuCount: 2, unvaluedSkuCount: 1 });
    expect(calculateSnapshotKpis(rows.slice(0, 1)).knownInventoryValue).toBeNull();
  });
  it('separates net changes and inbound-adjusted depletion in both modes', () => {
    const observations = [obs('2026-09-01', 100), obs('2026-09-08', 120, { inboundQuantity: 50 })];
    const r = row('a', observations, '2026-09-08', '2026-09-01');
    for (const from of [undefined, '2026-09-01']) {
      expect(calculateSnapshotKpis([r], from)).toMatchObject({ comparableSkuCount: 1, observedDecrease: 0, observedIncrease: 20, recordedInbound: 50, estimatedDepletion: 30 });
    }
  });
  it('excludes missing endpoints, new SKUs and zero-day intervals without daily fallback', () => {
    const rows = [
      row('exact', [obs('2026-09-01', 100), obs('2026-09-08', 70)], '2026-09-08', '2026-09-01'),
      row('new', [obs('2026-09-05', 50), obs('2026-09-08', 20)], '2026-09-08', '2026-09-01'),
      row('stale', [obs('2026-09-01', 100), obs('2026-09-07', 10)], '2026-09-08', '2026-09-01'),
      row('old-start', [obs('2026-08-31', 100), obs('2026-09-08', 10)], '2026-09-08', '2026-09-01'),
    ];
    expect(calculateSnapshotKpis(rows, '2026-09-01')).toMatchObject({ comparableSkuCount: 1, observedDecrease: 30, estimatedDepletion: 30 });
    expect(calculateSnapshotKpis(rows.slice(1), '2026-09-01').estimatedDepletion).toBeNull();
    expect(calculateSnapshotKpis([row('same', [obs('2026-09-08', 10)], '2026-09-08', '2026-09-08')], '2026-09-08').comparableSkuCount).toBe(0);
  });
  it('exports the same direct metrics as dashboard and warehouse summaries', () => {
    const rows = [row('a', [obs('2026-09-08', 10)])];
    const company = calculateCompanyKpis(rows, 30);
    const warehouses = calculateWarehouseSummaries(rows, 30);
    expect(warehouses[0].snapshot).toEqual(company.snapshot);
    const sheet = buildSummarySheetRows(company, warehouses);
    expect(sheet).toContainEqual({ 항목: '평가 가능한 재고금액', 값: 100 });
    expect(sheet).toContainEqual({ 항목: '재고 보유 SKU 비율(%)', 값: 100 });
  });
});

describe('forecast and risk regressions', () => {
  it('a long history cannot qualify one recent day as seven observed days', () => {
    const a = analyzeSku([obs('2026-01-01', 1000), obs('2026-09-07', 900), obs('2026-09-08', 800)], '2026-09-08')!;
    expect(a.forecast.expectedStockoutDate).toBeNull();
    expect(a.coverage.coverageDays).toBeNull();
    expect(a.riskThresholds.source).toBe('none');
  });
  it('forecast and coverage share the same fallback basis and sparse data is LOW', () => {
    const a = analyzeSku([obs('2026-08-09', 100), obs('2026-09-08', 70)], '2026-09-08')!;
    expect(a.coverage.coverageDays).toBe(70);
    expect(a.forecast.expectedStockoutDays).toBe(70);
    expect(a.forecast.basisWindowDays).toBe(30);
    expect(a.forecast.confidence).toBe('LOW');
  });
  it('does not advance stagnation or forecasts without a new observation', () => {
    const observations = [obs('2026-08-01', 100), obs('2026-09-01', 100)];
    expect(analyzeSku(observations, '2026-09-18')!.stagnation.stagnantDays).toBe(31);
    const moving = [obs('2026-09-01', 100), obs('2026-09-08', 30)];
    expect(analyzeSku(moving, '2026-10-01')!.forecast).toEqual(analyzeSku(moving, '2026-09-08')!.forecast);
  });
  it('zero stock is a risk even without a depletion history', () => {
    expect(analyzeSku([obs('2026-09-08', 0)], '2026-09-08')!.thresholdRisk.level).toBe('DANGER');
  });
  it('expired positive stock is flagged without a rate; empty stock is not an expiration risk', () => {
    const expiry = { expirationDate: '2026-09-01', expirationRiskDays: 14 };
    expect(analyzeSku([obs('2026-09-08', 10)], '2026-09-08', undefined, undefined, expiry)!.expirationRisk.isAtRisk).toBe(true);
    expect(analyzeSku([obs('2026-09-01', 100), obs('2026-09-08', 0)], '2026-09-08', undefined, undefined, expiry)!.expirationRisk.isAtRisk).toBe(false);
  });
});
