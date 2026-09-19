'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatKstDate } from '@/lib/date';

interface HolidayRow {
  id: string;
  date: string;
  name: string;
}

interface HolidayManagementProps {
  isAdmin: boolean;
  initialHolidays: HolidayRow[];
}

export function HolidayManagement({ isAdmin, initialHolidays }: HolidayManagementProps) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addHoliday() {
    if (!date || !name.trim()) {
      toast.error('날짜와 공휴일 이름을 입력하세요.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '추가에 실패했습니다.');
        return;
      }
      setHolidays((prev) => [...prev, body.holiday].sort((a, b) => a.date.localeCompare(b.date)));
      toast.success('공휴일을 추가했습니다.');
      setDate('');
      setName('');
    } catch {
      toast.error('네트워크 오류로 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  async function removeHoliday(holiday: HolidayRow) {
    if (!confirm(`${formatKstDate(holiday.date)} '${holiday.name}'을(를) 삭제할까요?`)) return;
    setDeletingId(holiday.id);
    try {
      const res = await fetch(`/api/holidays/${holiday.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? '삭제에 실패했습니다.');
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.id !== holiday.id));
      toast.success('공휴일을 삭제했습니다.');
    } catch {
      toast.error('네트워크 오류로 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle>공휴일 관리</CardTitle>
          <InfoTooltip className="text-brand-accent hover:text-brand-accent/80">
            여기서 지정한 날짜는 주말처럼 취급돼요. 업로드 화면에서 회색으로 표시되고 그 날짜엔 자료를 올릴 수 없습니다. 다만 매출·판매는
            공휴일에도 계속 일어난다고 보기 때문에, 통계에서 &quot;자료 없음&quot;으로 빼지 않고 바로 전 영업일 자료를 그대로 사용합니다.
          </InfoTooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {holidays.length === 0 ? (
          <p className="text-xs text-muted-foreground">등록된 공휴일이 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{formatKstDate(h.date)}</span>
                  <span className="font-medium">{h.name}</span>
                </div>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deletingId === h.id}
                    onClick={() => removeHoliday(h)}
                    aria-label={`${h.name} 삭제`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="holiday-date">날짜</Label>
              <Input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">공휴일 이름</Label>
              <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 설날" className="h-9 w-40" />
            </div>
            <Button size="sm" onClick={addHoliday} disabled={adding || !date || !name.trim()}>
              <Plus className="size-3.5" />
              추가
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
