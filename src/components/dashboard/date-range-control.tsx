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
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            재고 조회 기준
          </div>
          <p className="mt-1 pl-10 text-xs text-muted-foreground">하루의 재고를 보거나 두 날짜 사이를 비교합니다. 업로드가 없는 날짜는 가장 가까운 이전 스냅샷을 사용합니다.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-lg bg-muted p-1" aria-label="조회 방식">
            <button
              type="button"
              onClick={() => setMode('day')}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition', mode === 'day' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              특정 날짜
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition', mode === 'range' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              기간 비교
            </button>
          </div>

          {mode === 'day' ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              기준일
              <input type="date" value={day} max={maxDate} onChange={(event) => setDay(event.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </label>
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" value={start} max={maxDate} onChange={(event) => setStart(event.target.value)} aria-label="비교 시작일" className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <MoveRight className="size-4 text-muted-foreground" aria-hidden="true" />
              <input type="date" value={end} max={maxDate} onChange={(event) => setEnd(event.target.value)} aria-label="비교 종료일" className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}

          <Button size="sm" onClick={apply} disabled={pending || (mode === 'day' ? !day : !start || !end)}>
            {pending && <LoaderCircle className="size-3.5 animate-spin" />}
            적용
          </Button>
        </div>
      </div>
    </section>
  );
}
