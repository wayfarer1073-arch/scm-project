'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangeCalendarInput, type DateRange } from '@/components/events/date-range-calendar-input';
import { EVENT_TYPE_OPTIONS, type EventTypeValue } from '@/lib/event-types';
import { todayKstDateString } from '@/lib/date';

interface SimilarScheduleCandidate {
  scheduleId: string;
  title: string;
  startDate: string;
  endDate: string;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  skuId: string | null;
  skuLabel?: string;
  defaultQuantity?: number;
  defaultEventDate?: string;
  onCreated?: () => void;
}

export function EventFormDialog({ open, onOpenChange, warehouseId, skuId, skuLabel, defaultQuantity, defaultEventDate, onCreated }: EventFormDialogProps) {
  const [eventType, setEventType] = useState<EventTypeValue>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ start: todayKstDateString(), end: todayKstDateString() });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<SimilarScheduleCandidate | null>(null);

  useEffect(() => {
    if (open) {
      const day = defaultEventDate ?? todayKstDateString();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuantity(defaultQuantity !== undefined ? String(defaultQuantity) : '');
      setDateRange({ start: day, end: day });
      setTitle('');
      setNote('');
      setEventType('ADJUSTMENT');
      setConfirmation(null);
    }
  }, [open, defaultQuantity, defaultEventDate]);

  async function postEvent(extra?: { confirmChoice: 'use_existing' | 'create_new'; existingScheduleId?: string }) {
    return fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouseId,
        skuId,
        eventType,
        quantity: quantity === '' ? null : Number(quantity),
        note,
        eventDate: `${dateRange.start}T09:00:00`,
        endDate: dateRange.end !== dateRange.start ? `${dateRange.end}T09:00:00` : null,
        title: title.trim() || null,
        ...extra,
      }),
    });
  }

  async function submit() {
    if (!note.trim()) {
      toast.error('내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postEvent();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '저장에 실패했습니다.');
        return;
      }
      if (body.needsConfirmation) {
        setConfirmation(body.candidate);
        return;
      }
      toast.success('이벤트가 기록되었습니다.');
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveConfirmation(choice: 'use_existing' | 'create_new') {
    if (!confirmation) return;
    setSubmitting(true);
    try {
      const res = await postEvent({ confirmChoice: choice, existingScheduleId: choice === 'use_existing' ? confirmation.scheduleId : undefined });
      if (!res.ok) throw new Error();
      toast.success('이벤트가 기록되었습니다.');
      setConfirmation(null);
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>재고 이벤트 / 메모 추가</DialogTitle>
          <DialogDescription>{skuLabel ? `대상 상품: ${skuLabel}` : '창고 전체에 대한 메모입니다.'}</DialogDescription>
        </DialogHeader>

        {confirmation ? (
          <div className="space-y-4">
            <p className="text-sm">
              동일한 기간에 등록된 유사한 이벤트 <span className="font-semibold">&apos;{confirmation.title}&apos;</span>이(가) 있습니다. 기존
              일정에 추가하시겠습니까?
            </p>
            <p className="text-xs text-muted-foreground">
              추가하면 이 이벤트도 &apos;{confirmation.title}&apos; 일정으로 캘린더에 함께 표시됩니다. 아니오를 선택하면 입력한 제목(&apos;
              {title.trim()}&apos;)으로 새 일정을 만듭니다.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => resolveConfirmation('create_new')} disabled={submitting}>
                아니오, 새 일정으로
              </Button>
              <Button onClick={() => resolveConfirmation('use_existing')} disabled={submitting}>
                예, 기존 일정에 추가
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                이벤트는 메모로만 저장되며 재고·소진 계산에는 반영되지 않습니다. 실제 입고 수량은 업로드 캘린더의 &quot;입고 특이사항&quot;에
                등록하세요.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-type">이벤트 유형</Label>
                  <Select value={eventType} onValueChange={(v) => setEventType(v as EventTypeValue)}>
                    <SelectTrigger id="event-type" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-quantity">수량 (선택)</Label>
                  <Input id="event-quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="예: 150" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-title">일정 제목 (선택)</Label>
                <Input
                  id="event-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 롯데마트 — 입력하면 업로드 캘린더에 이 이름으로 표시됩니다"
                />
              </div>
              <div className="space-y-1.5">
                <Label>날짜</Label>
                <DateRangeCalendarInput value={dateRange} onChange={setDateRange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-note">내용</Label>
                <Textarea id="event-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 입고 일정 변경으로 담당자 확인 필요" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? '저장 중...' : '저장'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
