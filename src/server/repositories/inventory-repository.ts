import { prisma } from '@/lib/prisma';
import { dateOnlyToString } from '@/lib/date';
import type { StockObservation } from '@/domain/inventory/types';
import type { Prisma } from '@prisma/client';

/**
 * mock과 실데이터는 절대 같은 시계열에 섞이면 안 된다(README 참고). 창고별로 실데이터가
 * 하나라도 있으면 그 창고는 "실데이터 모드"로 보고 mock 스냅샷을 전부 제외하고, 아직 실데이터가
 * 없는 창고(개발/데모 단계)만 mock을 그대로 허용한다.
 */
async function resolveMockFilter(warehouseId?: string): Promise<Prisma.InventorySnapshotWhereInput> {
  const realWarehouses = await prisma.inventorySnapshot.findMany({
    where: { status: 'ACTIVE', isMock: false, ...(warehouseId ? { warehouseId } : {}) },
    select: { warehouseId: true },
    distinct: ['warehouseId'],
  });
  const realWarehouseIds = realWarehouses.map((w) => w.warehouseId);
  if (realWarehouseIds.length === 0) return {};
  return { OR: [{ isMock: false }, { isMock: true, warehouseId: { notIn: realWarehouseIds } }] };
}

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
  const mockFilter = await resolveMockFilter(warehouseId);
  const latestSnapshots = await prisma.inventorySnapshot.findMany({
    where: {
      status: 'ACTIVE',
      ...(warehouseId ? { warehouseId } : {}),
      ...(asOfDate ? { snapshotDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) } } : {}),
      ...mockFilter,
    },
    select: { id: true, warehouseId: true },
    orderBy: { snapshotDate: 'desc' },
  });
  // snapshotDate desc로 정렬되어 있으므로, 창고별로 "처음 등장하는" 항목만 남겨야 최신 스냅샷이 된다
  // (Map을 새 배열로 바로 만들면 뒤에 오는 과거 스냅샷이 값을 덮어써 가장 오래된 스냅샷이 선택되는 버그가 생긴다).
  const latestSnapshotIdByWarehouse = new Map<string, string>();
  for (const snapshot of latestSnapshots) {
    if (!latestSnapshotIdByWarehouse.has(snapshot.warehouseId)) {
      latestSnapshotIdByWarehouse.set(snapshot.warehouseId, snapshot.id);
    }
  }
  const latestSnapshotIds = [...latestSnapshotIdByWarehouse.values()];
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
        ...mockFilter,
      },
    },
    include: { snapshot: { select: { snapshotDate: true } } },
    orderBy: { snapshot: { snapshotDate: 'asc' } },
  });

  const observationsBySku = new Map<string, StockObservation[]>();
  // items가 snapshotDate asc로 정렬되어 있으므로, 마지막에 덮어써지는 값이 asOfDate 시점 기준
  // "가장 최근" 관측치의 상품 속성이 된다. sku.current*는 asOfDate와 무관하게 항상 "지금" 값이라
  // 과거 조회에 미래 변경 사항이 섞여 보이므로 쓰지 않는다.
  const latestAttrsBySku = new Map<string, { productName: string; option: string | null; barcode: string | null; location: string | null }>();
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
    latestAttrsBySku.set(item.skuId, { productName: item.productName, option: item.option, barcode: item.barcode, location: item.location });
  }

  return skus.map((sku) => {
    const attrs = latestAttrsBySku.get(sku.id);
    return {
      descriptor: {
        skuId: sku.id,
        warehouseId: sku.warehouseId,
        warehouseCode: sku.warehouse.code,
        warehouseName: sku.warehouse.name,
        productCode: sku.productCode,
        productName: attrs?.productName ?? sku.currentProductName,
        option: attrs ? attrs.option : sku.currentOption,
        barcode: attrs ? attrs.barcode : sku.currentBarcode,
        location: attrs ? attrs.location : sku.currentLocation,
      },
      observations: observationsBySku.get(sku.id) ?? [],
    };
  });
}

export interface DailyWarehouseTotal {
  date: string;
  warehouseId: string;
  totalAvailableStock: number;
  totalInventoryValue: number;
}

/** 차트용 일자별 창고별 합계(재고수량/재고자산). ACTIVE 스냅샷만 집계한다. */
export async function loadDailyWarehouseTotals(): Promise<DailyWarehouseTotal[]> {
  const mockFilter = await resolveMockFilter();
  const items = await prisma.inventoryItem.findMany({
    where: { snapshot: { status: 'ACTIVE', ...mockFilter } },
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

export async function loadSkuWithSeries(
  skuId: string,
  asOfDate?: string,
): Promise<{ descriptor: SkuDescriptor; observations: StockObservation[] } | null> {
  const sku = await prisma.sku.findUnique({ where: { id: skuId }, include: { warehouse: { select: { id: true, code: true, name: true } } } });
  if (!sku) return null;

  const mockFilter = await resolveMockFilter(sku.warehouseId);
  const items = await prisma.inventoryItem.findMany({
    where: {
      skuId,
      snapshot: {
        status: 'ACTIVE',
        ...(asOfDate ? { snapshotDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) } } : {}),
        ...mockFilter,
      },
    },
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

  // asOfDate 시점 기준 가장 최근 관측치의 상품 속성을 쓴다(과거 조회에 이후 변경분이 섞이지 않도록).
  const latestItem = items.at(-1);

  return {
    descriptor: {
      skuId: sku.id,
      warehouseId: sku.warehouseId,
      warehouseCode: sku.warehouse.code,
      warehouseName: sku.warehouse.name,
      productCode: sku.productCode,
      productName: latestItem?.productName ?? sku.currentProductName,
      option: latestItem ? latestItem.option : sku.currentOption,
      barcode: latestItem ? latestItem.barcode : sku.currentBarcode,
      location: latestItem ? latestItem.location : sku.currentLocation,
    },
    observations,
  };
}
