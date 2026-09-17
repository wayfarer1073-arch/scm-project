import { prisma } from '@/lib/prisma';
import { dateOnlyToString } from '@/lib/date';

export interface InboundEntryRow {
  id: string;
  skuId: string;
  productCode: string;
  productName: string;
  quantity: number;
}

/** 특정 창고·날짜에 기록된 입고 특이사항 목록. 스냅샷 버전과 무관하게 (SKU, 날짜) 자체로 조회한다. */
export function listInboundEntriesForDate(warehouseId: string, date: string): Promise<InboundEntryRow[]> {
  return prisma.snapshotInbound.findMany({
    where: { snapshotDate: new Date(`${date}T00:00:00.000Z`), sku: { warehouseId } },
    orderBy: { productCode: 'asc' },
  });
}

/** 업로드 캘린더의 창고별 "입고 특이사항 N건" 뱃지용 — 전체 창고·날짜별 건수를 한 번에 로드한다(N+1 방지). */
export async function listInboundCountsByWarehouseAndDate(): Promise<Map<string, number>> {
  const entries = await prisma.snapshotInbound.findMany({
    select: { snapshotDate: true, sku: { select: { warehouseId: true } } },
  });
  const map = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.sku.warehouseId}|${dateOnlyToString(entry.snapshotDate)}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

const INT32_MAX = 2_147_483_647;

export interface AddInboundEntryInput {
  warehouseId: string;
  skuId: string;
  date: string;
  quantity: number;
}

export type AddInboundEntryResult = { ok: true; entry: InboundEntryRow } | { ok: false; error: string };

/** 같은 (SKU, 날짜)에 이미 기록이 있으면 수량을 더한다(하루에 여러 번 나눠 입고된 경우를 그대로 반영). */
export async function addInboundEntry(input: AddInboundEntryInput): Promise<AddInboundEntryResult> {
  const sku = await prisma.sku.findUnique({ where: { id: input.skuId } });
  if (!sku || sku.warehouseId !== input.warehouseId) {
    return { ok: false, error: '해당 SKU는 지정한 창고에 속하지 않습니다.' };
  }

  const snapshotDate = new Date(`${input.date}T00:00:00.000Z`);
  const existing = await prisma.snapshotInbound.findUnique({
    where: { skuId_snapshotDate: { skuId: input.skuId, snapshotDate } },
  });
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
  if (nextQuantity > INT32_MAX) {
    return { ok: false, error: '같은 상품의 입고 수량 합계가 허용 범위를 초과합니다.' };
  }

  const entry = await prisma.snapshotInbound.upsert({
    where: { skuId_snapshotDate: { skuId: input.skuId, snapshotDate } },
    create: {
      skuId: input.skuId,
      snapshotDate,
      productCode: sku.productCode,
      productName: sku.currentProductName,
      quantity: input.quantity,
    },
    update: { quantity: nextQuantity, productCode: sku.productCode, productName: sku.currentProductName },
  });
  return { ok: true, entry };
}

export async function deleteInboundEntry(id: string): Promise<boolean> {
  try {
    await prisma.snapshotInbound.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
