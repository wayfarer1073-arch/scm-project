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

export type DataReliability = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * 이 SKU의 소진량 추정이 얼마나 믿을 만한 관측 근거를 갖고 있는지 상/중/하로 나눈다.
 * "자료 갱신 필요"·"재고 정합성 확인"·"입고·조정 확인" 등 추정 자체가 불가능한 사유(reason)가
 * 있으면, 설령 예전에 쌓인 window 자료가 있더라도 지금은 근거가 없는 것이므로 무조건 하다.
 * 정상적으로 추정 가능할 때만 basisWindowDays(7/14/30일 중 실제로 근거로 쓴 기간)로 나눈다 —
 * 최근 7일 자료만으로 계산했으면 상, 14일까지 넓혀야 했으면 중, 30일까지 넓혔으면 하.
 */
export function dataReliabilityLevel(analysis: SkuAnalysis): DataReliability {
  const operating = analysis.operating;
  if (!operating || operating.reason !== null) return 'LOW';
  if (operating.basisWindowDays === 7) return 'HIGH';
  if (operating.basisWindowDays === 14) return 'MEDIUM';
  return 'LOW';
}

export function dataReliabilityLabel(level: DataReliability): string {
  return level === 'HIGH' ? '상' : level === 'MEDIUM' ? '중' : '하';
}

export function dataReliabilityClassName(level: DataReliability): string {
  return level === 'HIGH' ? 'text-status-normal' : level === 'MEDIUM' ? 'text-status-warning' : 'text-status-danger';
}

/** "[관측 2026-09-18]" 형태의 날짜 태그인지. 화면에는 이제 신뢰도(상/중/하)로 대체해 보여주므로
 * 별도로 걸러낼 수 있게 분리했다 — 엑셀 내보내기(analysis.tags 원본)에는 그대로 남는다. */
export function isObservedDateTag(tag: string): boolean {
  return /^\[관측 \d{4}-\d{2}-\d{2}\]$/.test(tag);
}

/** 모든 행에 항상 붙던 "[입고 보정 추정·반품/조정 미분리]" 안내 태그인지. 신뢰도(상/중/하) 표시가
 * 같은 정보를 더 짧게 전달하므로 화면에서는 걸러낸다 — 엑셀 내보내기 원본에는 그대로 남는다. */
export function isEstimateCaveatTag(tag: string): boolean {
  return tag === '[입고 보정 추정·반품/조정 미분리]';
}

/**
 * SKU 행에 붙는 "[...]" 요약 태그를 물류 용어를 몰라도 바로 이해할 수 있는 짧은 문구로 바꿔서
 * 보여준다. 빠른 필터("장기 정체"·"신규 위험")와 엑셀 내보내기는 원본 태그 문자열을 그대로 매칭에
 * 쓰므로(src/lib/inventory-filters.ts, src/domain/excel/export.ts) 여기서는 화면 표시만 바꾸고
 * analysis.tags 배열 자체는 건드리지 않는다. 모르는 형태의 태그는 원문 그대로 보여준다.
 */
export function humanizeTag(tag: string): string {
  const observedMatch = tag.match(/^\[관측 (\d{4}-\d{2}-\d{2})\]$/);
  if (observedMatch) return `[${observedMatch[1]} 자료 기준]`;

  const basisMatch = tag.match(/^\[최근 (\d+)일 중 (\d+)출고일\]$/);
  if (basisMatch) return `[최근 ${basisMatch[1]}일 중 실제 자료 ${basisMatch[2]}일]`;

  const stagnantMatch = tag.match(/^\[재고 정체 (\d+)출고일\]$/);
  if (stagnantMatch) return `[${stagnantMatch[1]}일째 재고 변화 없음]`;

  const known: Record<string, string> = {
    '[입고 보정 추정·반품/조정 미분리]': '[추정치 · 반품/조정 포함 가능]',
    '[품절]': '[품절]',
    '[B2B 개별 판단]': '[대량납품 상품 · 개별 확인 필요]',
    '[자료 갱신 필요]': '[최근 자료 없음]',
    '[재고 정합성 확인]': '[재고 수치 확인 필요]',
    '[입고·조정 확인]': '[입고/조정 내역 확인 필요]',
    '[관측 무재고]': '[현재 재고 없음]',
    '[관측 자료 부족]': '[판단할 자료 부족]',
    '[소진 미관측]': '[최근 변화 없음]',
    '[소비기한 확인 필요]': '[소비기한 임박]',
    '[신규 위험]': '[오늘 새로 위험 단계]',
  };
  return known[tag] ?? tag;
}
