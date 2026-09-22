import { describe, expect, it } from 'vitest';
import { areTitlesSimilar } from './title-similarity';

describe('areTitlesSimilar', () => {
  it('공유하는 핵심 단어가 있으면 유사하다고 본다', () => {
    expect(areTitlesSimilar('롯데마트 2+1', '롯데슈퍼 2+1')).toBe(true);
    expect(areTitlesSimilar('롯데마트', '롯데')).toBe(true);
  });

  it('완전히 동일한 문자열은 유사가 아니라고 본다(이미 자동 병합 대상)', () => {
    expect(areTitlesSimilar('롯데마트', '롯데마트')).toBe(false);
  });

  it('공유 단어가 전혀 없으면 유사하지 않다', () => {
    expect(areTitlesSimilar('롯데마트 2+1', '여름맞이 세일')).toBe(false);
  });

  it('같은 핵심 단어를 공유해도 방향성 단어가 서로 다르면 유사하지 않다', () => {
    expect(areTitlesSimilar('롯데마트 입고', '롯데마트 반품')).toBe(false);
  });

  it('한쪽에만 방향성 단어가 있으면(다른 쪽엔 없으면) 그대로 단어 공유 여부로 판단한다', () => {
    expect(areTitlesSimilar('롯데마트 입고', '롯데마트')).toBe(true);
  });

  it('짧은(1글자) 토큰은 무시한다', () => {
    expect(areTitlesSimilar('A 행사', 'B 행사')).toBe(true); // '행사' 공유
    expect(areTitlesSimilar('A', 'B')).toBe(false); // 1글자뿐이라 비교 대상 없음
  });
});
