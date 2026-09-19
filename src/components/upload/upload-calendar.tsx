'use client';

import { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarUploadDialog } from '@/components/upload/calendar-upload-dialog';
import { formatKstDateTime, todayKstDateString } from '@/lib/date';
import { cn } from '@/lib/utils';

export interface CalendarEntry {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  date: string; // yyyy-MM-dd
  rowCount: number;
  uploadedByName: string;
  uploadedAt: string;
  inboundCount: number;
}

interface UploadCalendarProps {
  warehouses: { id: string; code: string; name: string }[];
  entries: CalendarEntry[];
  holidays: { date: string; name: string }[];
  isAdmin: boolean;
}

interface SelectedSlot {
  warehouseId: string;
  warehouseName: string;
  date: string;
  existing: { uploadedByName: string; uploadedAt: string; rowCount: number } | null;
  blocked: boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function UploadCalendar({ warehouses, entries, holidays, isAdmin }: UploadCalendarProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedSlot | null>(null);

  const today = todayKstDateString();

  const entryByKey = useMemo(() => {
    const map = new Map<string, CalendarEntry>();
    for (const entry of entries) {
      map.set(`${entry.warehouseId}|${entry.date}`, entry);
    }
    return map;
  }, [entries]);

  const holidayByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-sidebar px-5 py-3.5 text-sidebar-foreground">
        <div>
          <h2 className="text-base font-semibold">업로드 현황 캘린더</h2>
          <p className="mt-0.5 text-xs text-sidebar-muted-foreground">
            날짜별로 어떤 창고가 자료를 올렸는지 한눈에 확인하고, 블록을 눌러 바로 업로드하거나 교체할 수 있습니다. 주말·공휴일(옅은 회색)은
            업로드할 수 없지만 KPI 계산에는 직전 영업일 자료가 그대로 포함됩니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="text-foreground hover:text-brand-accent" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-24 text-center text-sm font-semibold tabular-nums">{format(month, 'yyyy년 M월')}</span>
          <Button variant="outline" size="icon" className="text-foreground hover:text-brand-accent" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, month);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const holidayName = holidayByDate.get(dateStr);
          const isWeekendDay = getDay(day) === 0 || getDay(day) === 6;
          const isBlocked = isWeekendDay || holidayName !== undefined;
          return (
            <div
              key={dateStr}
              className={cn(
                'flex min-h-[92px] flex-col gap-1.5 rounded-lg border p-2',
                inMonth ? 'bg-background' : 'bg-muted/30',
                isBlocked && !isToday && 'bg-muted/60',
                isToday && 'border-foreground bg-foreground',
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    inMonth ? 'text-foreground' : 'text-muted-foreground/60',
                    isToday && 'font-semibold text-background',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {holidayName && (
                  <span className={cn('truncate text-[9px] font-medium', isToday ? 'text-background/80' : 'text-muted-foreground')}>
                    {holidayName}
                  </span>
                )}
              </div>
              {!isFuture && (
                <div className="flex flex-wrap gap-1">
                  {warehouses.map((w) => {
                    const entry = entryByKey.get(`${w.id}|${dateStr}`);
                    if (entry) {
                      return (
                        <Tooltip key={w.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() =>
                                setSelected({
                                  warehouseId: entry.warehouseId,
                                  warehouseName: entry.warehouseName,
                                  date: entry.date,
                                  existing: {
                                    uploadedByName: entry.uploadedByName,
                                    uploadedAt: entry.uploadedAt,
                                    rowCount: entry.rowCount,
                                  },
                                  blocked: isBlocked,
                                })
                              }
                              className={cn(
                                'flex size-6 items-center justify-center rounded-md text-[11px] font-bold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isToday ? 'bg-background text-foreground' : 'bg-foreground text-background',
                              )}
                              aria-label={`${entry.warehouseName} ${dateStr} 자료, ${entry.uploadedByName} 업로드, 누르면 상세 보기`}
                            >
                              {w.code}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {entry.warehouseName} · {entry.uploadedByName} 업로드 · {formatKstDateTime(entry.uploadedAt)} · {entry.rowCount.toLocaleString()}건
                            {entry.inboundCount > 0 ? ` · 입고 특이사항 ${entry.inboundCount}건` : ''}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    if (isBlocked) return null;
                    return (
                      <Tooltip key={w.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setSelected({ warehouseId: w.id, warehouseName: w.name, date: dateStr, existing: null, blocked: false })}
                            className={cn(
                              'flex size-6 items-center justify-center rounded-md border border-dashed text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isToday
                                ? 'border-background/50 text-background/70 hover:border-background hover:text-background'
                                : 'border-border text-muted-foreground/50 hover:border-primary/40 hover:text-primary',
                            )}
                            aria-label={`${w.name} ${dateStr} 자료 업로드`}
                          >
                            {w.code}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {w.name} · 업로드된 자료 없음 · 눌러서 업로드
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {selected && (
        <CalendarUploadDialog
          open
          onOpenChange={(open) => !open && setSelected(null)}
          warehouseId={selected.warehouseId}
          warehouseName={selected.warehouseName}
          date={selected.date}
          existing={selected.existing}
          blocked={selected.blocked}
          isAdmin={isAdmin}
        />
      )}
    </section>
  );
}
