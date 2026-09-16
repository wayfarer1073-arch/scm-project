import { describe, expect, it } from 'vitest';
import { validateAgainstPreviousSnapshot } from './validator';
import type { ParsedInventoryRow } from './types';

function row(productCode: string): ParsedInventoryRow {
  return {
    rowNumber: 1,
    productCode,
    productName: '상품',
    option: null,
    barcode: null,
    unitCost: 1000,
    normalStock: 10,
    availableStock: 10,
    incomingStock: 0,
    defectiveStock: 0,
    warningQty: 0,
    dangerQty: 0,
    location: null,
    category: null,
    extra: {},
    costMissing: false,
  };
}

describe('validateAgainstPreviousSnapshot', () => {
  it('최초 업로드(이전 스냅샷 없음)는 비교하지 않는다', () => {
    const result = validateAgainstPreviousSnapshot([row('A'), row('B')], null);
    expect(result.issues).toHaveLength(0);
  });

  it('신규 SKU와 사라진 SKU를 각각 경고한다', () => {
    const result = validateAgainstPreviousSnapshot([row('A'), row('C')], ['A', 'B']);
    expect(result.newProductCodes).toEqual(['C']);
    expect(result.disappearedProductCodes).toEqual(['B']);
    expect(result.issues.some((i) => i.code === 'NEW_SKU_DETECTED')).toBe(true);
    expect(result.issues.some((i) => i.code === 'SKU_DISAPPEARED')).toBe(true);
  });

  it('SKU 수가 20% 이상 급감하면 경고한다', () => {
    const previous = Array.from({ length: 10 }, (_, i) => `P${i}`);
    const current = [row('P0'), row('P1'), row('P2'), row('P3'), row('P4'), row('P5'), row('P6')]; // 10 -> 7 (30% 감소)
    const result = validateAgainstPreviousSnapshot(current, previous);
    expect(result.issues.some((i) => i.code === 'SKU_COUNT_DROP')).toBe(true);
  });

  it('감소율이 임계값 미만이면 급감 경고를 만들지 않는다', () => {
    const previous = Array.from({ length: 10 }, (_, i) => `P${i}`);
    const current = previous.slice(0, 9).map(row); // 10% 감소
    const result = validateAgainstPreviousSnapshot(current, previous);
    expect(result.issues.some((i) => i.code === 'SKU_COUNT_DROP')).toBe(false);
  });
});
