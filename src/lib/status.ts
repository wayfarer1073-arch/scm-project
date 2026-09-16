import type { RiskLevel } from '@/domain/inventory/types';

export function riskLabel(level: RiskLevel): string {
  if (level === 'DANGER') return '위험';
  if (level === 'WARNING') return '주의';
  return '정상';
}

export function riskBadgeVariant(level: RiskLevel): 'danger' | 'warning' | 'normal' {
  if (level === 'DANGER') return 'danger';
  if (level === 'WARNING') return 'warning';
  return 'normal';
}
