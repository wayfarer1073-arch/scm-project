import { prisma } from '@/lib/prisma';
import { dateOnlyToString } from '@/lib/date';
import type { StockObservation } from '@/domain/inventory/types';

export interface SkuDescriptor {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  option: string | null;
  barcode: string | null;
  location: string | null;
}

/** isActive(최신 스냅샷에 존재) SKU 목록과, 각 SKU의 전체 관측 시계열을 한 번에 로드한다(N+1 방지) */
export async function loadActiveSkusWithSeries(
  warehouseId?: string,
  asOfDate?: string,
): Promise<{ descriptor: SkuDescriptor; observations: StockObservation[] }[]> {
  const latestSnapshots = await prisma.inventorySnapshot.findMany({
    where: {
      status: 'ACTIVE',
      ...(warehouseId ? { warehouseId } : {}),
      ...(asOfDate ? { snapshotDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) } } : {}),
    },
    select: { id: true, warehouseId: true },
    orderBy: { snapshotDate: 'desc' },
  });
  const latestSnapshotIds = [...new Map(latestSnapshots.map((snapshot) => [snapshot.warehouseId, snapshot.id])).values()];
  if (latestSnapshotIds.length === 0) return [];

  const latestItems = await prisma.inventoryItem.findMany({
    where: { snapshotId: { in: latestSnapshotIds } },
    select: { skuId: true },
  });
  const activeSkuIds = [...new Set(latestItems.map((item) => item.skuId))];

  const skus = await prisma.sku.findMany({
    where: { id: { in: activeSkuIds }, ...(warehouseId ? { warehouseId } : {}) },
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  });
  if (skus.length === 0) return [];

  const skuIds = skus.map((s) => s.id);
  const items = await prisma.inventoryItem.findMany({
    where: {
      skuId: { in: skuIds },
      snapshot: {
        status: 'ACTIVE',
        ...(asOfDate ? { snapshotDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) } } : {}),
      },
    },
    include: { snapshot: { select: { snapshotDate: true } } },
    orderBy: { snapshot: { snapshotDate: 'asc' } },
  });

  const observationsBySku = new Map<string, StockObservation[]>();
  for (const item of items) {
    const list = observationsBySku.get(item.skuId) ?? [];
    list.push({
      date: dateOnlyToString(item.snapshot.snapshotDate),
      availableStock: item.availableStock,
      normalStock: item.normalStock,
      defectiveStock: item.defectiveStock,
      incomingStock: item.incomingStock,
      unitCost: Number(item.unitCost),
      warningQty: item.warningQty,
      dangerQty: item.dangerQty,
    });
    observationsBySku.set(item.skuId, list);
  }

  return skus.map((sku) => ({
    descriptor: {
      skuId: sku.id,
      warehouseId: sku.warehouseId,
      warehouseCode: sku.warehouse.code,
      warehouseName: sku.warehouse.name,
      productCode: sku.productCode,
      productName: sku.currentProductName,
      option: sku.currentOption,
      barcode: sku.currentBarcode,
      location: sku.currentLocation,
    },
    observations: observationsBySku.get(sku.id) ?? [],
  }));
}

export interface DailyWarehouseTotal {
  date: string;
  warehouseId: string;
  totalAvailableStock: number;
  totalInventoryValue: number;
}

/** 차트용 일자별 창고별 합계(재고수량/재고자산). ACTIVE 스냅샷만 집계한다. */
export async function loadDailyWarehouseTotals(): Promise<DailyWarehouseTotal[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { snapshot: { status: 'ACTIVE' } },
    select: {
      availableStock: true,
      normalStock: true,
      unitCost: true,
      snapshot: { select: { warehouseId: true, snapshotDate: true } },
    },
  });

  const map = new Map<string, DailyWarehouseTotal>();
  for (const item of items) {
    const date = dateOnlyToString(item.snapshot.snapshotDate);
    const key = `${date}|${item.snapshot.warehouseId}`;
    const existing = map.get(key) ?? { date, warehouseId: item.snapshot.warehouseId, totalAvailableStock: 0, totalInventoryValue: 0 };
    existing.totalAvailableStock += item.availableStock;
    existing.totalInventoryValue += item.normalStock * Number(item.unitCost);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function loadSkuWithSeries(skuId: string): Promise<{ descriptor: SkuDescriptor; observations: StockObservation[] } | null> {
  const sku = await prisma.sku.findUnique({ where: { id: skuId }, include: { warehouse: { select: { id: true, code: true, name: true } } } });
  if (!sku) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { skuId, snapshot: { status: 'ACTIVE' } },
    include: { snapshot: { select: { snapshotDate: true } } },
    orderBy: { snapshot: { snapshotDate: 'asc' } },
  });

  const observations: StockObservation[] = items.map((item) => ({
    date: dateOnlyToString(item.snapshot.snapshotDate),
    availableStock: item.availableStock,
    normalStock: item.normalStock,
    defectiveStock: item.defectiveStock,
    incomingStock: item.incomingStock,
    unitCost: Number(item.unitCost),
    warningQty: item.warningQty,
    dangerQty: item.dangerQty,
  }));

  return {
    descriptor: {
      skuId: sku.id,
      warehouseId: sku.warehouseId,
      warehouseCode: sku.warehouse.code,
      warehouseName: sku.warehouse.name,
      productCode: sku.productCode,
      productName: sku.currentProductName,
      option: sku.currentOption,
      barcode: sku.currentBarcode,
      location: sku.currentLocation,
    },
    observations,
  };
}
