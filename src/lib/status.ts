import type { RiskLevel, SkuAnalysis } from '@/domain/inventory/types';

export function riskLabel(level: RiskLevel): string {
  if (level === 'DANGER') return '위험';
  if (level === 'WARNING') return '주의';
  if (level === 'UNKNOWN') return '개별 확인';
  return '기준 내';
}

export function analysisStatusLabel(analysis: SkuAnalysis): string {
  return analysis.operating?.reason ?? riskLabel(analysis.thresholdRisk.level);
}

export function riskBadgeVariant(level: RiskLevel): 'danger' | 'warning' | 'normal' | 'secondary' {
  if (level === 'DANGER') return 'danger';
  if (level === 'WARNING') return 'warning';
  if (level === 'UNKNOWN') return 'secondary';
  return 'normal';
}
