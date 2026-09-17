'use client';

import { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarUploadDialog } from '@/components/upload/calendar-upload-dialog';
import { warehouseColor } from '@/lib/warehouse-colors';
import { formatKstDateTime, todayKstDateString } from '@/lib/date';

export interface CalendarEntry {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  date: string; // yyyy-MM-dd
  rowCount: number;
  uploadedByName: string;
  uploadedAt: string;
}

interface UploadCalendarProps {
  warehouses: { id: string; code: string; name: string }[];
  entries: CalendarEntry[];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function UploadCalendar({ warehouses, entries }: UploadCalendarProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);

  const today = todayKstDateString();

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
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
            날짜별로 어떤 창고가 자료를 올렸는지 한눈에 확인하고, 블록을 눌러 바로 교체할 수 있습니다.
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

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {warehouses.map((w) => {
          const c = warehouseColor(w.code);
          return (
            <span key={w.id} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden="true" />
              {w.name}
            </span>
          );
        })}
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
          const dayEntries = entriesByDate.get(dateStr) ?? [];
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`flex min-h-[92px] flex-col gap-1.5 rounded-lg border p-2 ${inMonth ? 'bg-background' : 'bg-muted/30'} ${
                isToday ? 'border-primary/50 ring-1 ring-primary/40' : ''
              }`}
            >
              <span className={`text-xs tabular-nums ${inMonth ? 'text-foreground' : 'text-muted-foreground/60'} ${isToday ? 'font-semibold text-primary' : ''}`}>
                {format(day, 'd')}
              </span>
              <div className="flex flex-wrap gap-1">
                {dayEntries.map((entry) => {
                  const c = warehouseColor(entry.warehouseCode);
                  return (
                    <Tooltip key={entry.warehouseId}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className={`flex size-6 items-center justify-center rounded-md text-[11px] font-bold text-white transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${c.dot}`}
                          aria-label={`${entry.warehouseName} ${dateStr} 자료, ${entry.uploadedByName} 업로드, 누르면 교체`}
                        >
                          {entry.warehouseCode}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {entry.warehouseName} · {entry.uploadedByName} 업로드 · {formatKstDateTime(entry.uploadedAt)} · {entry.rowCount.toLocaleString()}건
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEntry && (
        <CalendarUploadDialog
          open
          onOpenChange={(open) => !open && setSelectedEntry(null)}
          warehouseId={selectedEntry.warehouseId}
          warehouseName={selectedEntry.warehouseName}
          date={selectedEntry.date}
          existing={{ uploadedByName: selectedEntry.uploadedByName, uploadedAt: selectedEntry.uploadedAt, rowCount: selectedEntry.rowCount }}
        />
      )}
    </section>
  );
}
