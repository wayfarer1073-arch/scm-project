import type { StockObservation } from './types';
import { NO_HOLIDAYS, shippingDateAfter } from './shipping-calendar';

export interface DatedInbound { date: string; quantity: number }

/**
 * Observations are date-ascending. Each inbound normally belongs to (previous date, current date].
 *
 * 등록일이 실제 재고 증가가 관측된 날짜와 어긋나 있어도(입력 착오) 반영되도록, 아래 두 경우에
 * 한해 ±1 "영업일" 관용을 둔다 — 자료 업로드 자체가 영업일 기준이라(주말/공휴일 건너뜀), 두
 * 관측치 사이의 실제 캘린더 간격은 주말/공휴일을 낀 만큼 하루보다 길어질 수 있다. 둘 다 "원래
 * 자리에서는 이 입고가 어차피 아무것도 설명하지 못했을 때"만 옮긴다 — 원래 자리에 실제로
 * 필요했다면(그 구간도 재고가 늘었다면) 그대로 둔다. 그래서 이 관용은 기존에 올바르게 붙던
 * 입고를 절대 빼앗지 않는다.
 *  - 마지막 관측일 다음 영업일: 아직 그 날짜의 스냅샷이 없어 어느 구간에도 못 속하던 입고를
 *    마지막 관측치에 반영한다("업로드는 아직이지만 실제로는 이미 반영된 입고"로 취급).
 *  - 어느 관측일과 정확히 같은 날짜로 등록됐는데, 그 관측일로 끝나는 구간은 재고가 늘지
 *    않았고(그 등록이 거기선 아무 효과가 없었던 것) 바로 다음 관측이 정확히 다음 영업일이며
 *    재고가 늘었다면, 다음 구간으로 옮긴다.
 */
export function attachIntervalInbounds(
  observations: StockObservation[],
  entries: DatedInbound[],
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): StockObservation[] {
  const n = observations.length;
  if (n === 0) return [];
  const inbounds = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const perIntervalEntries: DatedInbound[][] = Array.from({ length: n }, () => []);
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    while (cursor < inbounds.length && inbounds[cursor].date <= observations[i].date) {
      if (i > 0 && inbounds[cursor].date > observations[i - 1].date) {
        perIntervalEntries[i].push(inbounds[cursor]);
      }
      cursor++;
    }
  }
  const leftover = inbounds.slice(cursor); // strictly dated after the very last observation

  const rawChange = (i: number) => observations[i].availableStock - observations[i - 1].availableStock;

  // 경계일 공유 재배정: interval i가 필요 없었고, 바로 다음(정확히 다음 영업일) 구간이 필요로 하면 옮긴다.
  for (let i = 1; i < n - 1; i++) {
    if (perIntervalEntries[i].length === 0) continue;
    if (rawChange(i) > 0) continue;
    if (observations[i + 1].date !== shippingDateAfter(observations[i].date, 1, holidays)) continue;
    if (rawChange(i + 1) <= 0) continue;
    const boundaryDated = perIntervalEntries[i].filter((e) => e.date === observations[i].date);
    if (boundaryDated.length === 0) continue;
    perIntervalEntries[i] = perIntervalEntries[i].filter((e) => e.date !== observations[i].date);
    perIntervalEntries[i + 1] = [...perIntervalEntries[i + 1], ...boundaryDated];
  }

  // 마지막 관측일 다음 영업일 등록분(하루 늦은 등록)은 마지막 관측치에 반영한다.
  if (leftover.length > 0) {
    const graceDate = shippingDateAfter(observations[n - 1].date, 1, holidays);
    const graced = graceDate ? leftover.filter((e) => e.date === graceDate) : [];
    if (graced.length > 0) perIntervalEntries[n - 1] = [...perIntervalEntries[n - 1], ...graced];
  }

  return observations.map((observation, index) => ({
    ...observation,
    inboundQuantity: perIntervalEntries[index].reduce((sum, e) => sum + e.quantity, 0),
  }));
}
