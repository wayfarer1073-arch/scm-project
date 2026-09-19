import { addDays, format, parseISO } from 'date-fns';

export const NO_HOLIDAYS: ReadonlySet<string> = new Set();
export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}
export function isShippingDay(date: string, holidays: ReadonlySet<string> = NO_HOLIDAYS): boolean {
  const day = parseISO(date).getDay();
  return day !== 0 && day !== 6 && !holidays.has(date);
}
/** Close-of-day snapshots: count shipping days in (previous observation, current observation]. */
export function shippingDaysBetween(from: string, to: string, holidays: ReadonlySet<string> = NO_HOLIDAYS): number {
  let count = 0;
  for (let day = shiftDate(from, 1); day <= to; day = shiftDate(day, 1)) {
    if (isShippingDay(day, holidays)) count++;
  }
  return count;
}
export function latestShippingDay(date: string, holidays: ReadonlySet<string> = NO_HOLIDAYS): string {
  let day = date;
  while (!isShippingDay(day, holidays)) day = shiftDate(day, -1);
  return day;
}
/** No fractional shipping date: exhaust on the next whole shipping day. Cap unrealistic horizons. */
export function shippingDateAfter(from: string, days: number, holidays: ReadonlySet<string> = NO_HOLIDAYS): string | null {
  if (!Number.isFinite(days) || days < 0 || days > 2600) return null;
  let left = Math.ceil(days);
  let date = from;
  while (left > 0) {
    date = shiftDate(date, 1);
    if (isShippingDay(date, holidays)) left--;
  }
  return date;
}
