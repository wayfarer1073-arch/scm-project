'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, LoaderCircle, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DateRangeControlProps {
  asOfDate: string;
  fromDate: string | null;
  maxDate: string;
}

export function DateRangeControl({ asOfDate, fromDate, maxDate }: DateRangeControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'day' | 'range'>(fromDate ? 'range' : 'day');
  const [day, setDay] = useState(asOfDate);
  const [start, setStart] = useState(fromDate ?? asOfDate);
  const [end, setEnd] = useState(asOfDate);

  function apply() {
    const query = new URLSearchParams();
    if (mode === 'day') {
      query.set('date', day);
    } else {
      query.set('mode', 'range');
      query.set('from', start <= end ? start : end);
      query.set('to', start <= end ? end : start);
    }
    startTransition(() => router.push(`${pathname}?${query.toString()}`));
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
      <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5 text-xs" aria-label="조회 방식">
        <button
          type="button"
          onClick={() => setMode('day')}
          className={cn('rounded px-2.5 py-1 font-medium transition-colors', mode === 'day' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          특정 날짜
        </button>
        <button
          type="button"
          onClick={() => setMode('range')}
          className={cn('rounded px-2.5 py-1 font-medium transition-colors', mode === 'range' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          기간 비교
        </button>
      </div>

      {mode === 'day' ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <input type="date" value={day} max={maxDate} onChange={(event) => setDay(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      ) : (
        <div className="flex items-center gap-1.5">
          <input type="date" value={start} max={maxDate} onChange={(event) => setStart(event.target.value)} aria-label="비교 시작일" className="h-8 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <MoveRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <input type="date" value={end} max={maxDate} onChange={(event) => setEnd(event.target.value)} aria-label="비교 종료일" className="h-8 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      )}

      <Button size="sm" onClick={apply} disabled={pending || (mode === 'day' ? !day : !start || !end)}>
        {pending && <LoaderCircle className="size-3.5 animate-spin" />}
        적용
      </Button>
    </div>
  );
}
