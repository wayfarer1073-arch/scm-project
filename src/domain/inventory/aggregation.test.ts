import { describe, expect, it } from 'vitest';
import { analyzeSku, calculateInventoryValueBreakdown, calculatePeriodComparison } from '@/domain/inventory/calculations';
import { DEFAULT_RISK_SETTINGS, type RiskThresholdSettings, type StockObservation } from '@/domain/inventory/types';
import { calculateCompanyKpis } from '@/domain/inventory/aggregation';
import type { InventoryRow } from '@/domain/inventory/read-model';

function observation(date: string, availableStock: number): StockObservation {
  return {
    date,
    availableStock,
    normalStock: availableStock,
    defectiveStock: 0,
    incomingStock: 0,
    unitCost: 100,
    warningQty: 0,
    dangerQty: 0,
  };
}

function buildRow(
  skuId: string,
  observations: StockObservation[],
  asOfDate: string,
  compareFromDate: string | null,
  settings: RiskThresholdSettings = DEFAULT_RISK_SETTINGS,
): InventoryRow {
  const analysis = analyzeSku(observations, asOfDate, settings)!;
  const valueBreakdown = calculateInventoryValueBreakdown(analysis.latest);
  const periodComparison = compareFromDate ? calculatePeriodComparison(observations, compareFromDate, asOfDate) : null;
  return {
    descriptor: {
      skuId,
      warehouseId: 'w1',
      warehouseCode: 'A',
      warehouseName: '창고 A',
      productCode: skuId,
      productName: skuId,
      option: null,
      barcode: null,
      location: null,
      manualDangerQty: null,
      manualWarningQty: null,
      expirationDate: null,
      expirationRiskDays: null,
    },
    analysis,
    valueBreakdown,
    periodComparison,
  };
}

describe('calculatePeriodComparison', () => {
  it('기간 중 감소와 증가를 순변화와 분리한다', () => {
    const result = calculatePeriodComparison(
      [observation('2026-09-01', 100), observation('2026-09-03', 70), observation('2026-09-05', 90)],
      '2026-09-01',
      '2026-09-05',
    );

    expect(result).toMatchObject({
      netChange: -10,
      totalDepletion: 30,
      totalIncrease: 20,
      observedDays: 4,
      averageDailyDepletion: 7.5,
    });
  });

  it('선택일에 스냅샷이 없으면 직전 관측치를 사용하고 실제 기준일을 반환한다', () => {
    const result = calculatePeriodComparison(
      [observation('2026-09-01', 100), observation('2026-09-05', 80)],
      '2026-09-02',
      '2026-09-06',
    );

    expect(result?.actualStartDate).toBe('2026-09-01');
    expect(result?.actualEndDate).toBe('2026-09-05');
  });
});

describe('calculateCompanyKpis - averageDailyDecreasePerSku', () => {
  it('요청한 조회 기간(1일)이 아니라 SKU의 실제 관측 기간(7일)으로 일평균을 낸다(회귀 테스트)', () => {
    // 사용자는 9/7~9/8(1일)을 요청했지만, 실제 스냅샷은 9/1과 9/8뿐이라 실제 비교 구간은 7일이다.
    // 70개 감소를 요청 기간(1일)으로 나누면 70개/일이 되어버리지만, 실제로는 하루 평균 10개다.
    const row = buildRow('sku-1', [observation('2026-09-01', 100), observation('2026-09-08', 30)], '2026-09-08', '2026-09-07');
    expect(row.periodComparison).toMatchObject({ actualStartDate: '2026-09-01', actualEndDate: '2026-09-08', totalDepletion: 70, observedDays: 7 });

    const kpis = calculateCompanyKpis([row], 30);
    expect(kpis.totalDecrease).toBe(70);
    expect(kpis.averageDailyDecreasePerSku).toBeCloseTo(10);
  });

  it('SKU마다 실제 관측 기간이 다르면 각자의 일평균을 먼저 구한 뒤 평균한다', () => {
    // sku-1: 3일간 30개 감소 = 10/일. sku-2: 1일간 4개 감소 = 4/일. 평균은 (10+4)/2 = 7.
    const row1 = buildRow('sku-1', [observation('2026-09-01', 100), observation('2026-09-04', 70)], '2026-09-04', '2026-09-01');
    const row2 = buildRow('sku-2', [observation('2026-09-03', 50), observation('2026-09-04', 46)], '2026-09-04', '2026-09-03');
    const kpis = calculateCompanyKpis([row1, row2], 30);
    expect(kpis.averageDailyDecreasePerSku).toBeCloseTo(7);
  });
});

describe('calculateCompanyKpis - stockoutSoon30dCount', () => {
  it('30일을 하드코딩하지 않고 설정된 manageMaxDays 임계값을 따른다(회귀 테스트)', () => {
    // 7일간 70개 감소(일평균 10개), 가용재고 350 -> coverageDays = 35일.
    // 기본 manageMaxDays(30일) 기준으로는 HEALTHY라 집계되면 안 되고,
    // manageMaxDays를 45일로 바꾸면 NEEDS_MANAGEMENT로 집계돼야 한다.
    const observations = [observation('2026-09-01', 420), observation('2026-09-08', 350)];

    const rowDefault = buildRow('sku-1', observations, '2026-09-08', null);
    expect(rowDefault.analysis.coverage.coverageDays).toBeCloseTo(35);
    expect(calculateCompanyKpis([rowDefault], 30).stockoutSoon30dCount).toBe(0);

    const looseSettings: RiskThresholdSettings = { ...DEFAULT_RISK_SETTINGS, manageMaxDays: 45 };
    const rowCustom = buildRow('sku-1', observations, '2026-09-08', null, looseSettings);
    expect(calculateCompanyKpis([rowCustom], 30).stockoutSoon30dCount).toBe(1);
  });
});
