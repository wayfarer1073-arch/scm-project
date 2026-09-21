import { describe, expect, it } from 'vitest';
import { analyzeOperationalSku } from './operational-analysis';
import { isShippingDay, shiftDate, shippingDateAfter, shippingDaysBetween } from './shipping-calendar';
import type { StockObservation } from './types';
import { calculateSnapshotKpis } from './aggregation';
import { buildInventorySheetRows, buildRiskSheetRows } from '../excel/export';
import { calculateInventoryValueBreakdown } from './calculations';
import type { InventoryRow } from './read-model';

const obs = (date: string, stock: number, inbound = 0): StockObservation => ({ date, normalStock: stock,
  availableStock: stock, unitCost: 10, defectiveStock: 0, incomingStock: 0, warningQty: 0, dangerQty: 0, inboundQuantity: inbound });
function daily(rate = 10, holidays = new Set<string>()) {
  const result: StockObservation[] = [obs('2026-09-04', 200)];
  let stock = 200;
  for (let d = '2026-09-05'; d <= '2026-09-18'; d = shiftDate(d, 1)) {
    if (isShippingDay(d, holidays)) { stock -= rate; result.push(obs(d, stock)); }
  }
  return result;
}

describe('shipping-day trading inventory', () => {
  it('excludes weekends and configured holidays, including from projected exhaustion dates', () => {
    expect(shippingDaysBetween('2026-09-11', '2026-09-14')).toBe(1);
    expect(shippingDaysBetween('2026-09-11', '2026-09-15', new Set(['2026-09-14']))).toBe(1);
    expect(shippingDateAfter('2026-09-18', 1.2, new Set(['2026-09-21']))).toBe('2026-09-23');
    expect(shippingDateAfter('2026-09-18', Infinity)).toBeNull();
  });
  it('uses five shipping days rather than seven calendar days and holds weekend stock constant', () => {
    const a = analyzeOperationalSku(daily(), '2026-09-19')!;
    expect(a.window7.totalDepletion).toBe(50);
    expect(a.window7.observedIntervalDays).toBe(5);
    expect(a.window7.averageDailyDepletion).toBe(10);
    expect(a.coverage.coverageDays).toBe(10);
    expect(a.forecast.expectedStockoutDate).toBe('2026-10-02');
    expect(a.operating?.staleShippingDays).toBe(0);
  });
  it('falls back to a sufficiently observed window when holidays shorten the latest week', () => {
    const holidays = new Set(['2026-09-16']);
    const a = analyzeOperationalSku(daily(10, holidays), '2026-09-18', undefined, undefined, undefined, { holidays })!;
    expect(a.window7.observedIntervalDays).toBe(4);
    expect(a.window7.averageDailyDepletion).toBe(10);
    expect(a.operating?.basisWindowDays).toBe(14);
    expect(a.coverage.coverageDays).toBe(11);
  });
  it('does not treat a new SKU or a single long interval as reliable repeat demand', () => {
    for (const observations of [[obs('2026-09-17', 100), obs('2026-09-18', 90)], [obs('2026-08-19', 200), obs('2026-09-18', 100)]]) {
      const a = analyzeOperationalSku(observations, '2026-09-18')!;
      expect(a.coverage.coverageDays).toBeNull();
      expect(a.thresholdRisk.level).toBe('UNKNOWN');
    }
    expect(analyzeOperationalSku([obs('2026-09-18', 100)], '2026-09-18')!.window7.averageDailyDepletion).toBeNull();
  });
  it('keeps zero depletion different from absent observations and does not invent a stockout date', () => {
    const a = analyzeOperationalSku(daily(0), '2026-09-18')!;
    expect(a.window7.averageDailyDepletion).toBe(0);
    expect(a.operating?.reason).toBe('소진 미관측');
    expect(a.forecast.expectedStockoutDate).toBeNull();
  });
  it('does not turn batch B2B shipments into replenishment or overstock recommendations', () => {
    const a = analyzeOperationalSku(daily(), '2026-09-18', undefined, undefined,
      { expirationDate: '2026-09-20', expirationRiskDays: 14 }, { isB2B: true })!;
    expect(a.coverage.coverageDays).toBeNull();
    expect(a.forecast.expectedStockoutDate).toBeNull();
    expect(a.window7.averageDailyDepletion).toBeNull();
    expect(a.acceleration.trend).toBeNull();
    expect(a.overstock.isCandidate).toBe(false);
    expect(a.stagnation.isMeaningful).toBe(false);
    expect(a.thresholdRisk.level).toBe('UNKNOWN');
    expect(a.expirationRisk.isAtRisk).toBe(true);
  });
  it('blocks predictions after missed shipping-day uploads or unexplained stock increases', () => {
    expect(analyzeOperationalSku(daily(), '2026-09-21')!.operating?.reason).toBe('자료 갱신 필요');
    const rows = daily(); rows[rows.length - 1] = obs('2026-09-18', 300);
    expect(analyzeOperationalSku(rows, '2026-09-18')!.operating?.reason).toBe('입고·조정 확인');
    rows[rows.length - 1] = obs('2026-09-18', 300, 200);
    expect(analyzeOperationalSku(rows, '2026-09-18')!.coverage.coverageDays).toBe(30);
  });
  it('grades forecast confidence by basis window size, and drops it to LOW whenever a disqualifying reason exists even if an old basis window still looks valid', () => {
    expect(analyzeOperationalSku(daily(), '2026-09-19')!.forecast.confidence).toBe('HIGH');
    const holidays = new Set(['2026-09-16']);
    expect(analyzeOperationalSku(daily(10, holidays), '2026-09-18', undefined, undefined, undefined, { holidays })!.forecast.confidence).toBe('MEDIUM');
    const stale = analyzeOperationalSku(daily(), '2026-09-21')!;
    expect(stale.operating?.reason).toBe('자료 갱신 필요');
    expect(stale.operating?.basisWindowDays).toBe(7);
    expect(stale.forecast.confidence).toBe('LOW');
  });
  it('compares a calendar expiry to the projected date, not to shipping-day coverage', () => {
    const a = analyzeOperationalSku(daily(), '2026-09-18', undefined, undefined,
      { expirationDate: '2026-09-30', expirationRiskDays: 0 })!;
    expect(a.coverage.coverageDays).toBe(10);
    expect(a.expirationRisk.daysUntilExpiration).toBe(12);
    expect(a.expirationRisk.isAtRisk).toBe(true); // ten shipping days exhaust on October 2
  });
  it('compares like-for-like weekly shipping rates', () => {
    const a = analyzeOperationalSku(daily(), '2026-09-18')!;
    expect(a.acceleration.accelerationRatePercent).toBe(0);
    expect(a.acceleration.trend).toBe('STABLE');
  });
  it('keeps actual zero stock separate from a SKU absent in the latest list', () => {
    expect(analyzeOperationalSku([obs('2026-09-18', 0)], '2026-09-18')!.thresholdRisk.level).toBe('DANGER');
    const a = analyzeOperationalSku(daily(), '2026-09-18', undefined, undefined, undefined, { isMissing: true })!;
    expect(a.operating?.reason).toBe('품절');
    const row: InventoryRow = { descriptor: { skuId: 'x', warehouseId: 'w', warehouseCode: 'A', warehouseName: 'A', productCode: 'x', productName: 'x',
      option: null, barcode: null, location: null, manualDangerQty: null, manualWarningQty: null, expirationDate: null, expirationRiskDays: null,
      isB2B: false, isSoldOut: true, firstSeenDate: '2026-09-04', soldOutDetectedDate: '2026-09-18',
      eaPerBox: null, eaPerPallet: null, packagingBarcode: null },
      analysis: a, periodComparison: null, valueBreakdown: calculateInventoryValueBreakdown(a.latest) };
    expect(calculateSnapshotKpis([row])).toMatchObject({ observedSkuCount: 0, staleSkuCount: 1, comparableSkuCount: 0, knownInventoryValue: null });
    expect(buildRiskSheetRows([{ ...row, ...row.descriptor }])).toEqual([]);
    expect(buildInventorySheetRows([{ ...row, ...row.descriptor }])[0].재고금액).toBe(0);
  });
});
