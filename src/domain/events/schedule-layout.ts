export interface ScheduleLayoutInput {
  id: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
}

/**
 * 캘린더에서 여러 주에 걸쳐 이어지는 막대들이 같은 줄(레인)을 유지하도록, 월 전체 기준으로
 * 한 번만 겹치지 않는 레인 번호를 배정한다(구글 캘린더처럼 주가 바뀌어도 같은 일정은 같은
 * 줄에 그려지게 하기 위함). 시작일이 빠른 일정부터 그리디하게 비어있는 첫 레인에 배정한다.
 */
export function assignScheduleLanes(schedules: ScheduleLayoutInput[]): Map<string, number> {
  const sorted = [...schedules].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const laneEnds: string[] = [];
  const laneOf = new Map<string, number>();
  for (const s of sorted) {
    let lane = laneEnds.findIndex((end) => end < s.startDate);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endDate);
    } else {
      laneEnds[lane] = s.endDate;
    }
    laneOf.set(s.id, lane);
  }
  return laneOf;
}
