/** 이벤트 제목의 "방향성"을 나타내는 업무 용어 — 둘 다 방향성 단어를 갖고 있는데 서로 다르면
 *  같은 핵심 단어를 공유해도 다른 사안으로 본다(예: "롯데마트 입고" vs "롯데마트 반품"). */
const DIRECTION_WORDS = ['입고', '반품', '조정', '프로모션', '품절', '출고', '재고조정'];

/** 숫자·기호로만 이루어진 조각(예: "2+1", "10")은 의미 있는 공유 단어로 보지 않는다. */
function isMeaningfulSubstring(s: string): boolean {
  return /[가-힣a-zA-Z]{2,}/.test(s);
}

/**
 * 두 문자열이 길이 minLen 이상 겹치는 "의미 있는"(문자 포함) 부분 문자열을 공유하는지 본다.
 * 전체적으로 가장 긴 공통 부분 문자열만 보면 "2+1"처럼 의미 없는 조각이 더 길어서 "롯데"같은
 * 짧지만 의미 있는 조각을 가려버릴 수 있어, 길이 minLen 이상인 매칭 구간을 찾을 때마다 바로
 * 의미 있는지 확인한다(가장 긴 것만 보지 않는다).
 */
function hasMeaningfulCommonSubstring(a: string, b: string, minLen = 2): boolean {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] !== b[j - 1]) continue;
      dp[i][j] = dp[i - 1][j - 1] + 1;
      if (dp[i][j] >= minLen && isMeaningfulSubstring(a.slice(i - dp[i][j], i))) return true;
    }
  }
  return false;
}

/**
 * 두 제목이 "같은 사안을 가리키는 것 같다"고 판단되면 true. 완전히 동일한 문자열은 별도로
 * 자동 병합되므로 여기서는 false를 반환한다.
 *  - 방향성 단어(입고/반품/조정/프로모션/품절/출고 등)가 둘 다 있는데 겹치는 게 하나도 없으면
 *    유사하지 않다고 본다.
 *  - 공백을 무시했을 때 2글자 이상 겹치는 부분 문자열이 있으면(예: "롯데마트"·"롯데슈퍼"의
 *    "롯데") 유사하다고 본다.
 */
export function areTitlesSimilar(a: string, b: string): boolean {
  const na = a.trim();
  const nb = b.trim();
  if (na === '' || nb === '' || na === nb) return false;

  const dirA = DIRECTION_WORDS.filter((w) => na.includes(w));
  const dirB = DIRECTION_WORDS.filter((w) => nb.includes(w));
  if (dirA.length > 0 && dirB.length > 0 && !dirA.some((w) => dirB.includes(w))) return false;

  return hasMeaningfulCommonSubstring(na.replace(/\s+/g, ''), nb.replace(/\s+/g, ''));
}
