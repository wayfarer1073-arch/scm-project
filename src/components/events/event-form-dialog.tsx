'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EVENT_TYPE_OPTIONS, type EventTypeValue } from '@/lib/event-types';

function nowLocalInputValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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
  const [note, setNote] = useState('');
  const [eventDate, setEventDate] = useState(nowLocalInputValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity(defaultQuantity !== undefined ? String(defaultQuantity) : '');
      setEventDate(defaultEventDate ? `${defaultEventDate}T09:00` : nowLocalInputValue());
      setNote('');
      setEventType('ADJUSTMENT');
    }
  }, [open, defaultQuantity, defaultEventDate]);

  async function submit() {
    if (!note.trim()) {
      toast.error('내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          skuId,
          eventType,
          quantity: quantity === '' ? null : Number(quantity),
          note,
          eventDate: new Date(eventDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('이벤트가 기록되었습니다.');
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이벤트 유형</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventTypeValue)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>수량 (선택)</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="예: 150" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>날짜/시간</Label>
            <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>내용</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 발주 입고 150개 반영" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? '저장 중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
