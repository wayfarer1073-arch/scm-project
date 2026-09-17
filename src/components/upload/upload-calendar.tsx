'use client';

import { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarUploadDialog } from '@/components/upload/calendar-upload-dialog';
import { warehouseColor } from '@/lib/warehouse-colors';
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
  inboundEntries: { productIdentifier: string; productName: string; quantity: string }[];
}

interface UploadCalendarProps {
  warehouses: { id: string; code: string; name: string }[];
  entries: CalendarEntry[];
}

interface SelectedSlot {
  warehouseId: string;
  warehouseName: string;
  date: string;
  existing: { uploadedByName: string; uploadedAt: string; rowCount: number; inboundEntries: { productIdentifier: string; quantity: string }[] } | null;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function UploadCalendar({ warehouses, entries }: UploadCalendarProps) {
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

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">업로드 현황 캘린더</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            날짜별로 어떤 창고가 자료를 올렸는지 한눈에 확인하고, 블록을 눌러 바로 업로드하거나 교체할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-24 text-center text-sm font-semibold tabular-nums">{format(month, 'yyyy년 M월')}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

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
          return (
            <div
              key={dateStr}
              className={cn(
                'flex min-h-[92px] flex-col gap-1.5 rounded-lg border p-2',
                inMonth ? 'bg-background' : 'bg-muted/30',
                isToday && 'border-today-highlight-border bg-today-highlight-bg',
              )}
            >
              <span
                className={cn(
                  'text-xs tabular-nums',
                  inMonth ? 'text-foreground' : 'text-muted-foreground/60',
                  isToday && 'font-semibold text-primary',
                )}
              >
                {format(day, 'd')}
              </span>
              {!isFuture && (
                <div className="flex flex-wrap gap-1">
                  {warehouses.map((w) => {
                    const entry = entryByKey.get(`${w.id}|${dateStr}`);
                    const c = warehouseColor(w.code);
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
                                    inboundEntries: entry.inboundEntries.map(({ productIdentifier, quantity }) => ({ productIdentifier, quantity })),
                                  },
                                })
                              }
                              className={cn(
                                'flex size-6 items-center justify-center rounded-md text-[11px] font-bold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                c.bg,
                                c.text,
                              )}
                              aria-label={`${entry.warehouseName} ${dateStr} 자료, ${entry.uploadedByName} 업로드, 누르면 교체`}
                            >
                              {w.code}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {entry.warehouseName} · {entry.uploadedByName} 업로드 · {formatKstDateTime(entry.uploadedAt)} · {entry.rowCount.toLocaleString()}건
                            {entry.inboundEntries.length > 0 ? ` · 입고 특이사항 ${entry.inboundEntries.length}건` : ''}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return (
                      <Tooltip key={w.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setSelected({ warehouseId: w.id, warehouseName: w.name, date: dateStr, existing: null })}
                            className="flex size-6 items-center justify-center rounded-md border border-dashed border-border text-[11px] font-bold text-muted-foreground/50 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {selected && (
        <CalendarUploadDialog
          open
          onOpenChange={(open) => !open && setSelected(null)}
          warehouseId={selected.warehouseId}
          warehouseName={selected.warehouseName}
          date={selected.date}
          existing={selected.existing}
        />
      )}
    </section>
  );
}
