'use client';

import { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatKstDate, todayKstDateString } from '@/lib/date';
import { cn } from '@/lib/utils';

export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

interface DateRangeCalendarInputProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function DateRangeCalendarInput({ value, onChange }: DateRangeCalendarInputProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(`${value.start}T00:00:00`));
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const today = todayKstDateString();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPendingStart(null);
      setMonth(new Date(`${value.start}T00:00:00`));
    }
  }

  function handleDayClick(dateStr: string) {
    if (pendingStart === null) {
      setPendingStart(dateStr);
      onChange({ start: dateStr, end: dateStr });
      return;
    }
    const start = pendingStart <= dateStr ? pendingStart : dateStr;
    const end = pendingStart <= dateStr ? dateStr : pendingStart;
    onChange({ start, end });
    setPendingStart(null);
    setOpen(false);
  }

  const label = value.start === value.end ? formatKstDate(value.start) : `${formatKstDate(value.start)} ~ ${formatKstDate(value.end)}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <p className="mb-2 text-[11px] text-muted-foreground">
          {pendingStart === null
            ? '시작일을 클릭하세요.'
            : '같은 날짜를 다시 클릭하면 하루, 다른 날짜를 클릭하면 그 기간으로 저장됩니다.'}
        </p>
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="이전 달">
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="text-xs font-semibold tabular-nums">{format(month, 'yyyy년 M월')}</span>
          <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="다음 달">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const inMonth = format(day, 'M') === format(month, 'M');
            const isToday = dateStr === today;
            const isPendingStart = dateStr === pendingStart;
            const inRange = dateStr >= value.start && dateStr <= value.end;
            const isRangeEdge = dateStr === value.start || dateStr === value.end;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDayClick(dateStr)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                  inRange && !isPendingStart && 'bg-brand-accent/20',
                  isRangeEdge && !isPendingStart && 'bg-brand-accent text-brand-accent-foreground font-semibold',
                  isPendingStart && 'bg-foreground text-background font-semibold ring-2 ring-offset-1 ring-brand-accent',
                  !inRange && !isPendingStart && isToday && 'border border-foreground',
                  'hover:bg-muted',
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
