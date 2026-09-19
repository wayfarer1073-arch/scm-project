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
