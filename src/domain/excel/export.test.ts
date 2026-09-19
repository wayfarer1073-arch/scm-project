import { describe, expect, it } from 'vitest';
import { buildEventsSheetRows, buildInventorySheetRows, buildRiskSheetRows, buildStagnantSheetRows, buildSummarySheetRows, type ExportRowInput } from './export';
import { calculateSnapshotKpis } from '@/domain/inventory/aggregation';
import { analyzeSku } from '@/domain/inventory/calculations';
import type { StockObservation } from '@/domain/inventory/types';

function makeRow(productCode: string, observations: StockObservation[], asOfDate: string, warehouseName = '창고 A'): ExportRowInput {
  const analysis = analyzeSku(observations, asOfDate)!;
  return {
    productCode,
    productName: `상품 ${productCode}`,
    warehouseName,
    analysis,
    valueBreakdown: { normalStockValue: analysis.latest.normalStock * analysis.latest.unitCost, availableStockValue: 0, defectiveStockValue: 0, incomingStockValue: 0 },
  };
}

describe('buildInventorySheetRows', () => {
  it('필요한 컬럼을 모두 포함하고 판매량이라는 표현을 쓰지 않는다', () => {
    const row = makeRow('00001', [
      { date: '2026-01-01', availableStock: 100, normalStock: 100, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 20, dangerQty: 10 },
      { date: '2026-01-02', availableStock: 80, normalStock: 80, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 20, dangerQty: 10 },
    ], '2026-01-02');
    const sheetRows = buildInventorySheetRows([row]);
    expect(sheetRows).toHaveLength(1);
    const keys = Object.keys(sheetRows[0]);
    expect(keys).toContain('상품코드');
    expect(keys).toContain('재고금액');
    expect(keys.some((k) => k.includes('판매량'))).toBe(false);
    expect(sheetRows[0]['상태']).toBe('기준 내');
  });
});

describe('buildRiskSheetRows', () => {
  it('위험/주의 상태이거나 품절임박인 행만 남긴다', () => {
    const danger = makeRow('00001', [{ date: '2026-01-01', availableStock: 3, normalStock: 3, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 20, dangerQty: 10 }], '2026-01-01');
    const normal = makeRow('00002', [{ date: '2026-01-01', availableStock: 100, normalStock: 100, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 20, dangerQty: 10 }], '2026-01-01');
    const result = buildRiskSheetRows([danger, normal]);
    expect(result).toHaveLength(1);
    expect(result[0]['상품코드']).toBe('00001');
  });
});

describe('buildStagnantSheetRows', () => {
  it('30일 이상 정체 태그가 있는 행만 남긴다', () => {
    const observations: StockObservation[] = [
      { date: '2026-01-01', availableStock: 500, normalStock: 500, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 0, dangerQty: 0 },
      { date: '2026-02-10', availableStock: 500, normalStock: 500, defectiveStock: 0, incomingStock: 0, unitCost: 1000, warningQty: 0, dangerQty: 0 },
    ];
    const stagnantRow = makeRow('00003', observations, '2026-02-10');
    const result = buildStagnantSheetRows([stagnantRow]);
    expect(result).toHaveLength(1);
  });
});

describe('buildSummarySheetRows', () => {
  it('회사 전체 KPI와 창고별 요약을 항목-값 형태로 만든다', () => {
    const kpis = {
      snapshot: calculateSnapshotKpis([]),
      totalSkuCount: 10,
      totalAvailableStock: 1000,
      totalInventoryValue: 5000000,
      netChangeVsYesterday: -50,
      totalDepletion7d: 300,
      dangerSkuCount: 2,
      stockoutSoon30dCount: 3,
      stagnantValue: 100000,
    };
    const rows = buildSummarySheetRows(kpis, [
      { snapshot: calculateSnapshotKpis([]), warehouseId: 'w1', warehouseCode: 'A', warehouseName: '창고 A', skuCount: 5, inventoryValue: 2000000, dangerSkuCount: 1, dangerRatio: 0.2, stockoutSoon30dRatio: 0.1, stagnantRatio: 0, overstockCandidateRatio: 0 },
    ]);
    expect(rows.some((r) => r['항목'] === '관리 SKU 수' && r['값'] === 10)).toBe(true);
    expect(rows.some((r) => String(r['항목']).includes('창고 A'))).toBe(true);
  });
});

describe('buildEventsSheetRows', () => {
  it('이벤트를 한글 헤더로 매핑한다', () => {
    const rows = buildEventsSheetRows([
      { eventDate: '2026-01-01 09:00', warehouseName: '창고 A', productName: '상품A', eventType: '입고', quantity: 100, note: '발주 입고', createdByName: '관리자' },
    ]);
    expect(rows[0]).toMatchObject({ 창고: '창고 A', 상품: '상품A', 유형: '입고', 수량: 100 });
  });
});
