import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** 이 앱의 모든 "기준일/날짜 표시"는 한국 시간(KST) 달력 기준으로 통일한다. */
export const KST_TIMEZONE = 'Asia/Seoul';

export function todayKstDateString(): string {
  return formatInTimeZone(new Date(), KST_TIMEZONE, 'yyyy-MM-dd');
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

/** KST 달력 날짜('yyyy-MM-dd')의 00:00:00 KST 시점을 UTC Date로 변환한다 (기간 검색의 시작 경계용). */
export function kstDateStartToUtc(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00.000`, KST_TIMEZONE);
}

/** KST 달력 날짜('yyyy-MM-dd')의 23:59:59.999 KST 시점을 UTC Date로 변환한다 (기간 검색의 종료 경계용). */
export function kstDateEndToUtc(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T23:59:59.999`, KST_TIMEZONE);
}
