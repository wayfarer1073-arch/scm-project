import type { ParsedInventoryRow, ValidationIssue } from './types';

/** 전일 대비 SKU 수 급감으로 간주하는 감소율(%) */
const SKU_DROP_WARNING_RATIO = 0.2;

export interface CrossSnapshotCheckResult {
  issues: ValidationIssue[];
  newProductCodes: string[];
  disappearedProductCodes: string[];
}

/**
 * 직전 스냅샷과 비교해 신규/소실 SKU, 급격한 SKU 수 감소를 경고로 알린다.
 * 직전 스냅샷이 없으면(최초 업로드) 비교 자체를 건너뛴다.
 */
export function validateAgainstPreviousSnapshot(
  currentRows: ParsedInventoryRow[],
  previousProductCodes: string[] | null,
): CrossSnapshotCheckResult {
  const issues: ValidationIssue[] = [];
  if (previousProductCodes === null) {
    return { issues, newProductCodes: [], disappearedProductCodes: [] };
  }

  const currentSet = new Set(currentRows.map((r) => r.productCode));
  const previousSet = new Set(previousProductCodes);

  const newProductCodes = [...currentSet].filter((c) => !previousSet.has(c));
  const disappearedProductCodes = [...previousSet].filter((c) => !currentSet.has(c));

  if (newProductCodes.length > 0) {
    issues.push({
      level: 'WARNING',
      code: 'NEW_SKU_DETECTED',
      message: `새로 등장한 상품코드가 ${newProductCodes.length}건 있습니다: ${newProductCodes.slice(0, 5).join(', ')}${newProductCodes.length > 5 ? ' 외' : ''}`,
    });
  }
  if (disappearedProductCodes.length > 0) {
    issues.push({
      level: 'WARNING',
      code: 'SKU_DISAPPEARED',
      message: `이전 스냅샷에 있던 상품코드가 ${disappearedProductCodes.length}건 사라졌습니다: ${disappearedProductCodes.slice(0, 5).join(', ')}${disappearedProductCodes.length > 5 ? ' 외' : ''}`,
    });
  }

  if (previousSet.size > 0) {
    const dropRatio = (previousSet.size - currentSet.size) / previousSet.size;
    if (dropRatio >= SKU_DROP_WARNING_RATIO) {
      issues.push({
        level: 'WARNING',
        code: 'SKU_COUNT_DROP',
        message: `전일 대비 SKU 수가 ${Math.round(dropRatio * 100)}% 감소했습니다 (${previousSet.size}건 → ${currentSet.size}건).`,
      });
    }
  }

  return { issues, newProductCodes, disappearedProductCodes };
}
