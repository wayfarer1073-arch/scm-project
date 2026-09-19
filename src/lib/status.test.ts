import { describe, expect, it } from 'vitest';
import { humanizeTag } from './status';

describe('humanizeTag', () => {
  it('물류 용어를 모르는 사용자도 이해할 수 있는 문구로 바꾼다', () => {
    expect(humanizeTag('[관측 2026-09-18]')).toBe('[2026-09-18 자료 기준]');
    expect(humanizeTag('[최근 7일 중 5출고일]')).toBe('[최근 7일 중 실제 자료 5일]');
    expect(humanizeTag('[재고 정체 12출고일]')).toBe('[12일째 재고 변화 없음]');
    expect(humanizeTag('[입고 보정 추정·반품/조정 미분리]')).toBe('[추정치 · 반품/조정 포함 가능]');
    expect(humanizeTag('[B2B 개별 판단]')).toBe('[대량납품 상품 · 개별 확인 필요]');
    expect(humanizeTag('[자료 갱신 필요]')).toBe('[최근 자료 없음]');
    expect(humanizeTag('[신규 위험]')).toBe('[오늘 새로 위험 단계]');
    expect(humanizeTag('[소비기한 확인 필요]')).toBe('[소비기한 임박]');
  });

  it('알 수 없는 형태의 태그는 원문 그대로 보여준다(향후 새 태그 추가에도 화면이 깨지지 않도록)', () => {
    expect(humanizeTag('[알 수 없는 태그]')).toBe('[알 수 없는 태그]');
  });
});
