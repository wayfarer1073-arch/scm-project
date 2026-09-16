import { formatInTimeZone } from 'date-fns-tz';

/** 이 앱의 모든 "기준일/날짜 표시"는 한국 시간(KST) 달력 기준으로 통일한다. */
export const KST_TIMEZONE = 'Asia/Seoul';

export function todayKstDateString(): string {
  return formatInTimeZone(new Date(), KST_TIMEZONE, 'yyyy-MM-dd');
}

/** 오늘(KST 기준)의 전날짜를 'yyyy-MM-dd'로 반환한다. */
export function yesterdayKstDateString(): string {
  const d = new Date(`${todayKstDateString()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function formatKstDate(date: Date | string): string {
  return formatInTimeZone(date, KST_TIMEZONE, 'yyyy-MM-dd');
}

export function formatKstDateDot(date: Date | string): string {
  return formatInTimeZone(date, KST_TIMEZONE, 'yyyy.MM.dd');
}

export function formatKstDateTime(date: Date | string): string {
  return formatInTimeZone(date, KST_TIMEZONE, 'yyyy-MM-dd HH:mm');
}

export function formatKstDateTimeSeconds(date: Date | string): string {
  return formatInTimeZone(date, KST_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

/** DB @db.Date 컬럼(자정 UTC로 저장됨)을 'yyyy-MM-dd' 문자열로 안전하게 변환 */
export function dateOnlyToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
