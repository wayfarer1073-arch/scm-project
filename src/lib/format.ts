export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ko-KR');
}

export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatSigned(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded.toLocaleString('ko-KR')}`;
  return rounded.toLocaleString('ko-KR');
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatCoverageDays(days: number | null): string {
  if (days === null) return '소진 없음';
  if (!Number.isFinite(days)) return '-';
  return `${Math.floor(days)}일`;
}
