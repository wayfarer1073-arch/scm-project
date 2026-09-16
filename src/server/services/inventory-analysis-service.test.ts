import { describe, expect, it } from 'vitest';
import { calculatePeriodComparison } from '@/domain/inventory/calculations';
import type { StockObservation } from '@/domain/inventory/types';

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
