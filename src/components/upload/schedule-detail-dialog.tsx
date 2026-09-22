'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatKstDate } from '@/lib/date';
import { eventTypeLabel } from '@/lib/event-types';
import { SCHEDULE_COLORS, SCHEDULE_COLOR_CLASSNAMES, SCHEDULE_COLOR_LABEL, type ScheduleColor } from '@/lib/schedule-colors';
import { cn } from '@/lib/utils';
import type { ScheduleRow } from '@/domain/events/schedule-types';

interface ScheduleDetailDialogProps {
  schedule: ScheduleRow | null;
  onOpenChange: (open: boolean) => void;
  onColorChanged: (scheduleId: string, color: ScheduleColor) => void;
}

export function ScheduleDetailDialog({ schedule, onOpenChange, onColorChanged }: ScheduleDetailDialogProps) {
  const [savingColor, setSavingColor] = useState<ScheduleColor | null>(null);

  if (!schedule) return null;

  const dateLabel = schedule.startDate === schedule.endDate
    ? formatKstDate(schedule.startDate)
    : `${formatKstDate(schedule.startDate)} ~ ${formatKstDate(schedule.endDate)}`;

  async function changeColor(color: ScheduleColor) {
    if (!schedule || color === schedule.color) return;
    setSavingColor(color);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error();
      onColorChanged(schedule.id, color);
    } catch {
      toast.error('색상 변경에 실패했습니다.');
    } finally {
      setSavingColor(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{eventTypeLabel(schedule.eventType)}</Badge>
            <DialogTitle>{schedule.title}</DialogTitle>
          </div>
          <DialogDescription>{dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">색상</p>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeColor(c)}
                  disabled={savingColor !== null}
                  aria-label={`${SCHEDULE_COLOR_LABEL[c]} 색상으로 변경`}
                  aria-pressed={schedule.color === c}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full ring-1 ring-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                    SCHEDULE_COLOR_CLASSNAMES[c].swatch,
                  )}
                >
                  {schedule.color === c && <Check className="size-4 text-foreground/70" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">SKU별 메모 ({schedule.events.length}건)</p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {schedule.events.map((e) => (
                <div key={e.id} className="rounded-md border px-2.5 py-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="shrink-0 text-[11px]">{e.warehouseCode}</Badge>
                    <span className="truncate font-medium">{e.productName ?? '창고 전체'}</span>
                    {e.productCode && <span className="shrink-0 text-xs text-muted-foreground">{e.productCode}</span>}
                    {e.quantity !== null && <span className="shrink-0 text-xs text-muted-foreground">· {e.quantity}개</span>}
                  </div>
                  {e.note && <p className="mt-1 text-xs text-muted-foreground">{e.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
