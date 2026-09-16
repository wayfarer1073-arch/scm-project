import type { SkuAnalysis } from '@/domain/inventory/types';

export type TableTab = 'ALL' | 'STOCKOUT_RISK' | 'ACCELERATING' | 'OVERSTOCK_CANDIDATE' | 'STAGNANT' | 'STOCK_INCREASE';

export const TABLE_TABS: { value: TableTab; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'STOCKOUT_RISK', label: '품절 위험' },
  { value: 'ACCELERATING', label: '소진 가속' },
  { value: 'OVERSTOCK_CANDIDATE', label: '과잉 후보' },
  { value: 'STAGNANT', label: '장기 정체' },
  { value: 'STOCK_INCREASE', label: '재고 증가' },
];

export function matchesTab(analysis: SkuAnalysis, tab: TableTab): boolean {
  switch (tab) {
    case 'ALL':
      return true;
    case 'STOCKOUT_RISK':
      return analysis.thresholdRisk.level !== 'NORMAL' || analysis.coverage.band === 'STOCKOUT_SOON';
    case 'ACCELERATING':
      return analysis.acceleration.trend === 'ACCELERATING';
    case 'OVERSTOCK_CANDIDATE':
      return analysis.overstock.isCandidate;
    case 'STAGNANT':
      return analysis.tags.some((t) => t.startsWith('[재고 정체'));
    case 'STOCK_INCREASE':
      return analysis.stockIncreasedToday;
    default:
      return true;
  }
}

/** Action Center 카드 클릭 시 테이블에 적용하는 추가 narrowing 조건. tab과 함께 적용된다. */
export type QuickFilter = 'NEW_DANGER' | 'STOCKOUT_SOON_ONLY' | null;

export function matchesQuickFilter(analysis: SkuAnalysis, quickFilter: QuickFilter): boolean {
  if (!quickFilter) return true;
  if (quickFilter === 'NEW_DANGER') return analysis.tags.includes('[신규 위험]');
  if (quickFilter === 'STOCKOUT_SOON_ONLY') return analysis.coverage.band === 'STOCKOUT_SOON';
  return true;
}
