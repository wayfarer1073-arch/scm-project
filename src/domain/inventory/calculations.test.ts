import { describe, expect, it } from 'vitest';
import {
  analyzeSku,
  buildDailyDeltas,
  calculateAcceleration,
  calculateCoverage,
  calculateDataMaturity,
  calculateInventoryValueBreakdown,
  calculateOverstockCandidate,
  calculateStagnation,
  calculateStockoutForecast,
  calculateThresholdRisk,
  calculateWindowDepletion,
  dailyChange,
  dailyDepletion,
  dailyIncrease,
  isNewlyAtRisk,
  sortObservations,
} from './calculations';
import type { StockObservation } from './types';

function obs(date: string, availableStock: number, overrides: Partial<StockObservation> = {}): StockObservation {
  return {
    date,
    availableStock,
    normalStock: overrides.normalStock ?? availableStock,
    defectiveStock: overrides.defectiveStock ?? 0,
    incomingStock: overrides.incomingStock ?? 0,
    unitCost: overrides.unitCost ?? 1000,
    warningQty: overrides.warningQty ?? 0,
    dangerQty: overrides.dangerQty ?? 0,
    ...overrides,
  };
}

describe('daily change / depletion / increase', () => {
  it('감소는 depletion으로, 증가는 increase로만 계산되고 서로 음수화되지 않는다', () => {
    const prev = obs('2026-01-01', 1000);
    const curr = obs('2026-01-02', 850);
    expect(dailyChange(curr, prev)).toBe(-150);
    expect(dailyDepletion(curr, prev)).toBe(150);
    expect(dailyIncrease(curr, prev)).toBe(0);
  });

  it('재고 증가 시 depletion은 0으로 취급한다(음수 금지)', () => {
    const prev = obs('2026-01-01', 1000);
    const curr = obs('2026-01-02', 1500);
    expect(dailyChange(curr, prev)).toBe(500);
    expect(dailyDepletion(curr, prev)).toBe(0);
    expect(dailyIncrease(curr, prev)).toBe(500);
  });
});

describe('buildDailyDeltas', () => {
  it('업로드 누락으로 간격이 벌어져도 interval일수를 정확히 기록한다', () => {
    const observations = sortObservations([obs('2026-01-01', 1000), obs('2026-01-05', 600)]);
    const deltas = buildDailyDeltas(observations);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].intervalDays).toBe(4);
    expect(deltas[0].depletion).toBe(400);
  });
});

describe('calculateWindowDepletion', () => {
  it('window 밖의 delta는 제외하고 실제 관측 interval 합계로 나눈다', () => {
    const observations = sortObservations([
      obs('2026-01-01', 1000),
      obs('2026-01-05', 800), // interval 4일, depletion 200 (window 밖)
      obs('2026-01-08', 650), // interval 3일, depletion 150 (window 안)
    ]);
    const deltas = buildDailyDeltas(observations);
    const result = calculateWindowDepletion(deltas, '2026-01-08', 7);
    // 2026-01-01 exclusive ~ 2026-01-08 inclusive 안에 두 delta 모두 포함(toDate가 1/5, 1/8 모두 window 안)
    expect(result.totalDepletion).toBe(350);
    expect(result.observedIntervalDays).toBe(7);
    expect(result.averageDailyDepletion).toBeCloseTo(50);
  });

  it('관측 interval이 전혀 없으면 평균은 null', () => {
    const result = calculateWindowDepletion([], '2026-01-08', 7);
    expect(result.averageDailyDepletion).toBeNull();
  });
});

describe('calculateCoverage', () => {
  it('가용재고 2100, 일평균 소진 100 → 21일분', () => {
    const result = calculateCoverage(2100, 100);
    expect(result.coverageDays).toBe(21);
  });

  it('평균 소진량이 0이면 무한대 숫자 대신 null(소진 없음)', () => {
    const result = calculateCoverage(500, 0);
    expect(result.coverageDays).toBeNull();
    expect(result.band).toBeNull();
  });

  it('coverage band 경계값 처리', () => {
    const settings = { stockoutSoonDays: 7, manageMaxDays: 30, overstockCoverageDays: 90, stagnantDays: 30 };
    expect(calculateCoverage(70, 10, settings).band).toBe('STOCKOUT_SOON'); // 7일
    expect(calculateCoverage(300, 10, settings).band).toBe('NEEDS_MANAGEMENT'); // 30일
    expect(calculateCoverage(310, 10, settings).band).toBe('HEALTHY'); // 31일
  });
});

describe('calculateDataMaturity', () => {
  it('7/14/30일 데이터 보유 여부를 정확히 판정한다', () => {
    const short = sortObservations([obs('2026-01-01', 100), obs('2026-01-03', 90)]);
    const maturity = calculateDataMaturity(short, '2026-01-03');
    expect(maturity.hasDayOverDayData).toBe(true);
    expect(maturity.hasSevenDayData).toBe(false);

    const long = sortObservations([obs('2026-01-01', 100), obs('2026-01-31', 10)]);
    const maturityLong = calculateDataMaturity(long, '2026-01-31');
    expect(maturityLong.hasSevenDayData).toBe(true);
    expect(maturityLong.hasFourteenDayData).toBe(true);
    expect(maturityLong.hasThirtyDayData).toBe(true);
  });
});

describe('calculateStockoutForecast', () => {
  it('7일 미만 데이터는 예측하지 않는다(데이터 축적 중)', () => {
    const observations = sortObservations([obs('2026-01-01', 100), obs('2026-01-03', 90)]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-03');
    const w7 = calculateWindowDepletion(deltas, '2026-01-03', 7);
    const w14 = calculateWindowDepletion(deltas, '2026-01-03', 14);
    const w30 = calculateWindowDepletion(deltas, '2026-01-03', 30);
    const forecast = calculateStockoutForecast(90, '2026-01-03', maturity, w7, w14, w30);
    expect(forecast.expectedStockoutDays).toBeNull();
  });

  it('7일 이상 데이터로 현재 추세 기준 예상 소진일을 계산한다', () => {
    const observations = sortObservations([obs('2026-01-01', 1000), obs('2026-01-08', 300)]); // 7일간 700 소진 = 하루 100
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-08');
    const w7 = calculateWindowDepletion(deltas, '2026-01-08', 7);
    const w14 = calculateWindowDepletion(deltas, '2026-01-08', 14);
    const w30 = calculateWindowDepletion(deltas, '2026-01-08', 30);
    const forecast = calculateStockoutForecast(300, '2026-01-08', maturity, w7, w14, w30);
    expect(forecast.expectedStockoutDays).toBeCloseTo(3);
    expect(forecast.expectedStockoutDate).toBe('2026-01-11');
  });
});

describe('calculateAcceleration', () => {
  it('14일 미만이면 계산하지 않는다', () => {
    const observations = sortObservations([obs('2026-01-01', 1000), obs('2026-01-08', 300)]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-08');
    const result = calculateAcceleration(maturity, deltas, '2026-01-08');
    expect(result.trend).toBeNull();
  });

  it('이전 7일 80개/일 → 최근 7일 120개/일 이면 가속 +50%', () => {
    const observations = sortObservations([
      obs('2026-01-01', 2000),
      obs('2026-01-08', 1440), // 이전 7일: 560 소진 = 80/일
      obs('2026-01-15', 600), // 최근 7일: 840 소진 = 120/일
    ]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-15');
    const result = calculateAcceleration(maturity, deltas, '2026-01-15');
    expect(result.previous7AvgDepletion).toBeCloseTo(80);
    expect(result.recent7AvgDepletion).toBeCloseTo(120);
    expect(result.accelerationRatePercent).toBeCloseTo(50);
    expect(result.trend).toBe('ACCELERATING');
  });

  it('이전 7일 소진이 0이면 무한대 대신 NEW_DEPLETION으로 표기한다', () => {
    const observations = sortObservations([
      obs('2026-01-01', 1000),
      obs('2026-01-08', 1000), // 이전 7일 소진 0
      obs('2026-01-15', 800), // 최근 7일 소진 200
    ]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-15');
    const result = calculateAcceleration(maturity, deltas, '2026-01-15');
    expect(result.previous7AvgDepletion).toBe(0);
    expect(result.accelerationRatePercent).toBeNull();
    expect(result.trend).toBe('NEW_DEPLETION');
  });
});

describe('calculateThresholdRisk', () => {
  it('가용재고가 위험수량 이하면 DANGER', () => {
    const result = calculateThresholdRisk(obs('2026-01-01', 5, { dangerQty: 10, warningQty: 20 }));
    expect(result.level).toBe('DANGER');
    expect(result.reason).toBe('위험수량 이하');
  });

  it('위험수량 초과, 경고수량 이하면 WARNING', () => {
    const result = calculateThresholdRisk(obs('2026-01-01', 15, { dangerQty: 10, warningQty: 20 }));
    expect(result.level).toBe('WARNING');
  });

  it('둘 다 초과하면 NORMAL', () => {
    const result = calculateThresholdRisk(obs('2026-01-01', 50, { dangerQty: 10, warningQty: 20 }));
    expect(result.level).toBe('NORMAL');
    expect(result.reason).toBeNull();
  });
});

describe('calculateStagnation', () => {
  it('30일 미만이면 isMeaningful=false', () => {
    const observations = sortObservations([obs('2026-01-01', 100), obs('2026-01-10', 100)]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-01-10');
    const result = calculateStagnation(observations, deltas, '2026-01-10', maturity);
    expect(result.isMeaningful).toBe(false);
  });

  it('마지막 소진 이후 경과일을 정확히 계산한다', () => {
    const observations = sortObservations([
      obs('2026-01-01', 500),
      obs('2026-01-10', 400), // 마지막 소진일
      obs('2026-02-10', 400), // 31일간 변화 없음
    ]);
    const deltas = buildDailyDeltas(observations);
    const maturity = calculateDataMaturity(observations, '2026-02-10');
    const result = calculateStagnation(observations, deltas, '2026-02-10', maturity);
    expect(result.lastDepletionDate).toBe('2026-01-10');
    expect(result.stagnantDays).toBe(31);
    expect(result.isMeaningful).toBe(true);
  });
});

describe('calculateOverstockCandidate', () => {
  it('30일 미만 데이터는 후보로 판정하지 않는다', () => {
    const result = calculateOverstockCandidate(10000, { windowDays: 30, totalDepletion: 10, observedIntervalDays: 10, averageDailyDepletion: 1 }, {
      firstObservedDate: '2026-01-01',
      lastObservedDate: '2026-01-10',
      snapshotCount: 2,
      daysSinceFirstObservation: 9,
      hasDayOverDayData: true,
      hasSevenDayData: true,
      hasFourteenDayData: false,
      hasThirtyDayData: false,
    });
    expect(result.isCandidate).toBe(false);
  });

  it('30일 데이터 + coverage 90일 이상이면 과잉재고 후보', () => {
    const maturity = {
      firstObservedDate: '2026-01-01',
      lastObservedDate: '2026-01-31',
      snapshotCount: 2,
      daysSinceFirstObservation: 30,
      hasDayOverDayData: true,
      hasSevenDayData: true,
      hasFourteenDayData: true,
      hasThirtyDayData: true,
    };
    const w30 = { windowDays: 30, totalDepletion: 30, observedIntervalDays: 30, averageDailyDepletion: 1 };
    const result = calculateOverstockCandidate(9000, w30, maturity);
    expect(result.coverageDays).toBe(9000);
    expect(result.isCandidate).toBe(true);
  });
});

describe('calculateInventoryValueBreakdown', () => {
  it('정상재고 기준 자산만 기본값이고 나머지는 이중계산 없이 별도 제공', () => {
    const result = calculateInventoryValueBreakdown({
      normalStock: 100,
      availableStock: 90,
      defectiveStock: 5,
      incomingStock: 20,
      unitCost: 1000,
    });
    expect(result.normalStockValue).toBe(100000);
    expect(result.availableStockValue).toBe(90000);
    expect(result.defectiveStockValue).toBe(5000);
    expect(result.incomingStockValue).toBe(20000);
  });
});

describe('isNewlyAtRisk', () => {
  it('어제 정상 → 오늘 위험이면 true', () => {
    const observations = [obs('2026-01-01', 50, { dangerQty: 10, warningQty: 20 }), obs('2026-01-02', 5, { dangerQty: 10, warningQty: 20 })];
    const analysis = analyzeSku(observations, '2026-01-02')!;
    expect(isNewlyAtRisk(analysis)).toBe(true);
  });

  it('어제도 위험이었으면 false(계속 위험 상태일 뿐 신규 아님)', () => {
    const observations = [obs('2026-01-01', 5, { dangerQty: 10, warningQty: 20 }), obs('2026-01-02', 3, { dangerQty: 10, warningQty: 20 })];
    const analysis = analyzeSku(observations, '2026-01-02')!;
    expect(isNewlyAtRisk(analysis)).toBe(false);
  });

  it('직전 관측치가 없으면 false', () => {
    const analysis = analyzeSku([obs('2026-01-01', 5, { dangerQty: 10 })], '2026-01-01')!;
    expect(isNewlyAtRisk(analysis)).toBe(false);
  });
});

describe('analyzeSku 통합', () => {
  it('데이터가 없으면 null', () => {
    expect(analyzeSku([], '2026-01-01')).toBeNull();
  });

  it('위험수량 이하 + 재고증가 감지 태그가 함께 표시될 수 있다', () => {
    const observations = [obs('2026-01-01', 3, { dangerQty: 10, warningQty: 20 }), obs('2026-01-02', 8, { dangerQty: 10, warningQty: 20 })];
    const analysis = analyzeSku(observations, '2026-01-02');
    expect(analysis).not.toBeNull();
    expect(analysis!.thresholdRisk.level).toBe('DANGER');
    expect(analysis!.stockIncreasedToday).toBe(true);
    expect(analysis!.tags).toContain('[위험수량 이하]');
    expect(analysis!.tags).toContain('[재고 증가 감지]');
  });

  it('asOfDate 이후 관측치는 무시한다(미래 데이터 유출 방지)', () => {
    const observations = [obs('2026-01-01', 100), obs('2026-01-02', 90), obs('2026-01-05', 10)];
    const analysis = analyzeSku(observations, '2026-01-02');
    expect(analysis!.latest.date).toBe('2026-01-02');
  });
});
