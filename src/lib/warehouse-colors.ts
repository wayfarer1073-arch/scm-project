/** 업로드 캘린더에서 창고 A/B/C를 구분하는 고정 파스텔 색상. 재고 상태 색상(위험/주의/정상)과는 별개의 팔레트다. */
const WAREHOUSE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-warehouse-a-bg', text: 'text-warehouse-a', ring: 'ring-warehouse-a/40' },
  B: { bg: 'bg-warehouse-b-bg', text: 'text-warehouse-b', ring: 'ring-warehouse-b/40' },
  C: { bg: 'bg-warehouse-c-bg', text: 'text-warehouse-c', ring: 'ring-warehouse-c/40' },
};

const FALLBACK = { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' };

export function warehouseColor(code: string) {
  return WAREHOUSE_COLORS[code] ?? FALLBACK;
}
