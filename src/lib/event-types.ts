export type EventTypeValue = 'INBOUND' | 'RETURN' | 'ADJUSTMENT' | 'PROMOTION' | 'SOLD_OUT' | 'OTHER';

export const EVENT_TYPE_OPTIONS: { value: EventTypeValue; label: string }[] = [
  { value: 'INBOUND', label: '입고' },
  { value: 'RETURN', label: '반품' },
  { value: 'ADJUSTMENT', label: '재고조정' },
  { value: 'PROMOTION', label: '프로모션' },
  { value: 'SOLD_OUT', label: '품절' },
  { value: 'OTHER', label: '기타' },
];

export function eventTypeLabel(value: string): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
