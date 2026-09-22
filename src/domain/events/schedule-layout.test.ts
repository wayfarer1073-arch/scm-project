import { describe, expect, it } from 'vitest';
import { assignScheduleLanes } from './schedule-layout';

describe('assignScheduleLanes', () => {
  it('겹치지 않는 일정은 모두 레인 0에 배정한다', () => {
    const lanes = assignScheduleLanes([
      { id: 'a', startDate: '2026-09-01', endDate: '2026-09-03' },
      { id: 'b', startDate: '2026-09-04', endDate: '2026-09-05' },
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
  });

  it('겹치는 일정은 서로 다른 레인에 배정한다', () => {
    const lanes = assignScheduleLanes([
      { id: 'a', startDate: '2026-09-01', endDate: '2026-09-10' },
      { id: 'b', startDate: '2026-09-05', endDate: '2026-09-07' },
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
  });

  it('먼저 끝난 일정의 레인을 재사용한다', () => {
    const lanes = assignScheduleLanes([
      { id: 'a', startDate: '2026-09-01', endDate: '2026-09-03' },
      { id: 'b', startDate: '2026-09-02', endDate: '2026-09-04' },
      { id: 'c', startDate: '2026-09-05', endDate: '2026-09-06' }, // a가 끝난 뒤라 레인 0 재사용 가능
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(0);
  });

  it('경계가 맞닿기만 해도(끝난 날 = 시작일) 겹치는 것으로 본다(같은 날 다른 레인)', () => {
    const lanes = assignScheduleLanes([
      { id: 'a', startDate: '2026-09-01', endDate: '2026-09-05' },
      { id: 'b', startDate: '2026-09-05', endDate: '2026-09-08' },
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
  });
});
