import { describe, expect, it } from 'vitest';
import { resolveInventoryCost } from './costs';

describe('resolveInventoryCost', () => {
  it('원가가 비어 있으면 동일 SKU의 직전 원가를 이어받는다', () => {
    const first = resolveInventoryCost({ unitCost: 1000, unitCostProvided: true, totalCost: null, normalStock: 10 }, null);
    const second = resolveInventoryCost({ unitCost: 0, unitCostProvided: false, totalCost: null, normalStock: 7 }, first.latestKnownUnitCost);

    expect(second.unitCost).toBe(1000);
    expect(second.totalCost).toBe(7000);
  });

  it('나중에 명시된 상이한 원가가 이후 스냅샷의 기준이 된다', () => {
    const changed = resolveInventoryCost({ unitCost: 1250, unitCostProvided: true, totalCost: null, normalStock: 8 }, 1000);
    const next = resolveInventoryCost({ unitCost: 0, unitCostProvided: false, totalCost: null, normalStock: 4 }, changed.latestKnownUnitCost);

    expect(changed.unitCost).toBe(1250);
    expect(next.unitCost).toBe(1250);
    expect(next.totalCost).toBe(5000);
  });

  it('원가합이 명시되면 계산값보다 업로드 값을 우선한다', () => {
    const resolved = resolveInventoryCost({ unitCost: 1000, unitCostProvided: true, totalCost: 9500, normalStock: 10 }, null);
    expect(resolved.totalCost).toBe(9500);
  });

  it('기존 원가 없이 원가합만 있으면 단위원가를 역산해 다음 행에도 사용한다', () => {
    const first = resolveInventoryCost({ unitCost: 0, unitCostProvided: false, totalCost: 6000, normalStock: 12 }, null);
    const second = resolveInventoryCost({ unitCost: 0, unitCostProvided: false, totalCost: null, normalStock: 3 }, first.latestKnownUnitCost);

    expect(first.unitCost).toBe(500);
    expect(second.unitCost).toBe(500);
    expect(second.totalCost).toBe(1500);
  });
});
