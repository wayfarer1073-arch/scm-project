export interface InventoryCostInput {
  unitCost: number;
  unitCostProvided: boolean;
  totalCost: number | null;
  normalStock: number;
}

export interface ResolvedInventoryCost {
  unitCost: number;
  totalCost: number;
  latestKnownUnitCost: number | null;
}

/**
 * 날짜순 SKU 시계열에서 사용할 원가를 결정한다.
 * 명시 원가가 있으면 그 값을 새로운 기준으로 삼고, 비어 있으면 직전 기준 원가를 이어받는다.
 * 원가 이력이 전혀 없고 원가합만 있으면 정상재고로 나눠 단위원가를 추정한다.
 */
export function resolveInventoryCost(input: InventoryCostInput, latestKnownUnitCost: number | null): ResolvedInventoryCost {
  let unitCost = latestKnownUnitCost ?? 0;
  let nextKnownUnitCost = latestKnownUnitCost;

  if (input.unitCostProvided) {
    unitCost = input.unitCost;
    nextKnownUnitCost = input.unitCost;
  } else if (nextKnownUnitCost === null && input.totalCost !== null && input.normalStock !== 0) {
    unitCost = input.totalCost / input.normalStock;
    nextKnownUnitCost = unitCost;
  }

  return {
    unitCost,
    totalCost: input.totalCost ?? unitCost * input.normalStock,
    latestKnownUnitCost: nextKnownUnitCost,
  };
}
