import type { EventTypeValue } from '@/lib/event-types';

export interface ScheduleEventRow {
  id: string;
  skuId: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string | null;
  productName: string | null;
  note: string;
  quantity: number | null;
}

export interface ScheduleRow {
  id: string;
  eventType: EventTypeValue;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  events: ScheduleEventRow[];
}
