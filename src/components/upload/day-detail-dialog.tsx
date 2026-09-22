'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseDayPanel } from '@/components/upload/warehouse-day-panel';
import { formatKstDate } from '@/lib/date';
import type { CalendarEntry } from '@/components/upload/upload-calendar';

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  warehouses: { id: string; code: string; name: string }[];
  entryByWarehouseId: Map<string, CalendarEntry>;
  blocked: boolean;
  isAdmin: boolean;
}

export function DayDetailDialog({ open, onOpenChange, date, warehouses, entryByWarehouseId, blocked, isAdmin }: DayDetailDialogProps) {
  const [activeWarehouseId, setActiveWarehouseId] = useState(warehouses[0]?.id ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formatKstDate(date)} 업로드 관리</DialogTitle>
          <DialogDescription>
            {blocked
              ? '주말·공휴일에는 자료를 업로드하거나 교체할 수 없습니다. 필요하면 초기화만 할 수 있습니다.'
              : '창고를 선택해 재고 Excel을 업로드하고 입고 특이사항을 기록하세요.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeWarehouseId} onValueChange={setActiveWarehouseId}>
          <TabsList>
            {warehouses.map((w) => (
              <TabsTrigger key={w.id} value={w.id} className="gap-1">
                {w.name}
                {entryByWarehouseId.has(w.id) && <CheckCircle2 className="size-3.5 text-status-normal" aria-label="업로드 완료" />}
              </TabsTrigger>
            ))}
          </TabsList>
          {warehouses.map((w) => (
            <TabsContent key={w.id} value={w.id}>
              <WarehouseDayPanel
                warehouseId={w.id}
                warehouseName={w.name}
                date={date}
                existing={entryByWarehouseId.get(w.id) ? {
                  uploadedByName: entryByWarehouseId.get(w.id)!.uploadedByName,
                  uploadedAt: entryByWarehouseId.get(w.id)!.uploadedAt,
                  rowCount: entryByWarehouseId.get(w.id)!.rowCount,
                } : null}
                blocked={blocked}
                isAdmin={isAdmin}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
