import { prisma } from '@/lib/prisma';
import { dateOnlyToString } from '@/lib/date';
import type { StockObservation } from '@/domain/inventory/types';
import { resolveInventoryCost } from '@/domain/inventory/costs';
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

/**
 * SnapshotInbound는 특정 스냅샷 버전이 아니라 (SKU, 날짜)에 독립적으로 붙어있으므로
 * snapshot.status/isMock을 거칠 필요 없이 skuId·날짜로 바로 조회한다.
 */
async function loadInboundQuantityBySkuDate(skuIds: string[], asOfDate?: string): Promise<Map<string, number>> {
  if (skuIds.length === 0) return new Map();
  const entries = await prisma.snapshotInbound.findMany({
    where: {
      skuId: { in: skuIds },
      ...(asOfDate ? { snapshotDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) } } : {}),
    },
    select: { skuId: true, quantity: true, snapshotDate: true },
  });
  const result = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.skuId}|${dateOnlyToString(entry.snapshotDate)}`;
    result.set(key, (result.get(key) ?? 0) + entry.quantity);
  }
  return result;
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
  /** 관리자가 SKU 상세에서 직접 지정한 위험/경고수량. null이면 자동계산을 쓴다. */
  manualDangerQty: number | null;
  manualWarningQty: number | null;
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
    where: { id: { in: activeSkuIds }, isActive: true, isHiddenFromDashboard: false, ...(warehouseId ? { warehouseId } : {}) },
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
  const inboundQuantityBySkuDate = await loadInboundQuantityBySkuDate(skuIds, asOfDate);

  const observationsBySku = new Map<string, StockObservation[]>();
  const latestKnownUnitCostBySku = new Map<string, number>();
  // items가 snapshotDate asc로 정렬되어 있으므로, 마지막에 덮어써지는 값이 asOfDate 시점 기준
  // "가장 최근" 관측치의 상품 속성이 된다. sku.current*는 asOfDate와 무관하게 항상 "지금" 값이라
  // 과거 조회에 미래 변경 사항이 섞여 보이므로 쓰지 않는다.
  const latestAttrsBySku = new Map<string, { productName: string; option: string | null; barcode: string | null; location: string | null }>();
  for (const item of items) {
    const resolvedCost = resolveInventoryCost(
      {
        unitCost: Number(item.unitCost),
        unitCostProvided: item.unitCostProvided,
        totalCost: item.totalCost === null ? null : Number(item.totalCost),
        normalStock: item.normalStock,
      },
      latestKnownUnitCostBySku.get(item.skuId) ?? null,
    );
    if (resolvedCost.latestKnownUnitCost !== null) {
      latestKnownUnitCostBySku.set(item.skuId, resolvedCost.latestKnownUnitCost);
    }
    const list = observationsBySku.get(item.skuId) ?? [];
    list.push({
      date: dateOnlyToString(item.snapshot.snapshotDate),
      inboundQuantity: inboundQuantityBySkuDate.get(`${item.skuId}|${dateOnlyToString(item.snapshot.snapshotDate)}`) ?? 0,
      // 현재 업로드 규격은 정상재고를 유일한 재고 수량으로 사용한다. 과거 스냅샷도
      // 별도 가용재고 열이 비어 0으로 저장됐을 수 있으므로 정상재고로 분석한다.
      availableStock: item.normalStock,
      normalStock: item.normalStock,
      defectiveStock: item.defectiveStock,
      incomingStock: item.incomingStock,
      unitCost: resolvedCost.unitCost,
      totalCost: resolvedCost.totalCost,
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
        manualDangerQty: sku.manualDangerQty,
        manualWarningQty: sku.manualWarningQty,
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

/** 차트용 일자별 창고별 합계(재고수량/재고자산). ACTIVE 스냅샷만 집계하며, 숨김 처리된 SKU는 제외한다. */
export async function loadDailyWarehouseTotals(): Promise<DailyWarehouseTotal[]> {
  const mockFilter = await resolveMockFilter();
  const items = await prisma.inventoryItem.findMany({
    where: { snapshot: { status: 'ACTIVE', ...mockFilter }, sku: { isActive: true, isHiddenFromDashboard: false } },
    select: {
      skuId: true,
      normalStock: true,
      unitCost: true,
      unitCostProvided: true,
      totalCost: true,
      snapshot: { select: { warehouseId: true, snapshotDate: true } },
    },
    orderBy: { snapshot: { snapshotDate: 'asc' } },
  });
  const map = new Map<string, DailyWarehouseTotal>();
  const latestKnownUnitCostBySku = new Map<string, number>();
  for (const item of items) {
    const resolvedCost = resolveInventoryCost(
      {
        unitCost: Number(item.unitCost),
        unitCostProvided: item.unitCostProvided,
        totalCost: item.totalCost === null ? null : Number(item.totalCost),
        normalStock: item.normalStock,
      },
      latestKnownUnitCostBySku.get(item.skuId) ?? null,
    );
    if (resolvedCost.latestKnownUnitCost !== null) {
      latestKnownUnitCostBySku.set(item.skuId, resolvedCost.latestKnownUnitCost);
    }
    const date = dateOnlyToString(item.snapshot.snapshotDate);
    const key = `${date}|${item.snapshot.warehouseId}`;
    const existing = map.get(key) ?? { date, warehouseId: item.snapshot.warehouseId, totalAvailableStock: 0, totalInventoryValue: 0 };
    existing.totalAvailableStock += item.normalStock;
    existing.totalInventoryValue += resolvedCost.totalCost;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function loadSkuWithSeries(
  skuId: string,
  asOfDate?: string,
): Promise<{ descriptor: SkuDescriptor; observations: StockObservation[] } | null> {
  const sku = await prisma.sku.findUnique({ where: { id: skuId }, include: { warehouse: { select: { id: true, code: true, name: true } } } });
  if (!sku || !sku.isActive || sku.isHiddenFromDashboard) return null;

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
  const inboundQuantityBySkuDate = await loadInboundQuantityBySkuDate([skuId], asOfDate);

  let latestKnownUnitCost: number | null = null;
  const observations: StockObservation[] = items.map((item) => {
    const resolvedCost = resolveInventoryCost(
      {
        unitCost: Number(item.unitCost),
        unitCostProvided: item.unitCostProvided,
        totalCost: item.totalCost === null ? null : Number(item.totalCost),
        normalStock: item.normalStock,
      },
      latestKnownUnitCost,
    );
    latestKnownUnitCost = resolvedCost.latestKnownUnitCost;
    return {
      date: dateOnlyToString(item.snapshot.snapshotDate),
      inboundQuantity: inboundQuantityBySkuDate.get(`${item.skuId}|${dateOnlyToString(item.snapshot.snapshotDate)}`) ?? 0,
      availableStock: item.normalStock,
      normalStock: item.normalStock,
      defectiveStock: item.defectiveStock,
      incomingStock: item.incomingStock,
      unitCost: resolvedCost.unitCost,
      totalCost: resolvedCost.totalCost,
      warningQty: item.warningQty,
      dangerQty: item.dangerQty,
    };
  });

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
      manualDangerQty: sku.manualDangerQty,
      manualWarningQty: sku.manualWarningQty,
    },
    observations,
  };
}

export interface SkuVisibilityRow {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  isActive: boolean;
  isHiddenFromDashboard: boolean;
}

/** 설정 화면의 "SKU 숨기기" 관리용 — 최신 업로드에 남아 있는 SKU만 나열한다. */
export async function listAllSkusForVisibilityAdmin(): Promise<SkuVisibilityRow[]> {
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: { warehouse: { select: { code: true, name: true } } },
    orderBy: [{ warehouse: { sortOrder: 'asc' } }, { productCode: 'asc' }],
  });
  return skus.map((sku) => ({
    skuId: sku.id,
    warehouseId: sku.warehouseId,
    warehouseCode: sku.warehouse.code,
    warehouseName: sku.warehouse.name,
    productCode: sku.productCode,
    productName: sku.currentProductName,
    isActive: sku.isActive,
    isHiddenFromDashboard: sku.isHiddenFromDashboard,
  }));
}

export async function setSkuHiddenFromDashboard(skuId: string, hidden: boolean) {
  return prisma.sku.update({ where: { id: skuId }, data: { isHiddenFromDashboard: hidden } });
}

/** 위험/경고수량 직접 설정. 필드별로 null을 넘기면 그 필드만 자동계산으로 되돌린다. */
export async function setSkuManualThresholds(skuId: string, input: { dangerQty: number | null; warningQty: number | null }) {
  return prisma.sku.update({ where: { id: skuId }, data: { manualDangerQty: input.dangerQty, manualWarningQty: input.warningQty } });
}

export interface SkuSearchResult {
  skuId: string;
  productCode: string;
  productName: string;
}

/**
 * 입고 특이사항 등록용 SKU 드롭다운 검색 — 자유 텍스트 매칭 대신 실제 SKU를 골라 선택하게 한다.
 *
 * DB의 `contains`는 공백을 그대로 비교하는데, 실제 상품명은 월별 업로드마다 "750g 레몬" /
 * "750g  레몬"처럼 공백 개수가 들쭉날쭉한 경우가 흔하다. 검색어와 상품명 양쪽에서 공백을
 * 전부 제거하고 비교해, 검색창에 입력한 공백 형태가 DB에 저장된 형태와 정확히 일치하지
 * 않아도(예: "레몬 750g" vs "레몬750g") 같은 상품으로 찾아지도록 한다. 창고 하나의 SKU
 * 수는 수백 건 수준이라 전체를 불러와 메모리에서 비교해도 비용이 크지 않다.
 */
export async function searchSkusInWarehouse(warehouseId: string, query: string, limit = 20): Promise<SkuSearchResult[]> {
  const q = query.trim();
  if (q === '') return [];
  const normalizedQuery = q.replace(/\s+/g, '').toLowerCase();

  const skus = await prisma.sku.findMany({
    // isActive(가장 최근 스냅샷에 존재하는지)로 거르지 않는다 — 입고 처리는 최근 업로드에서
    // 빠진("사라진") SKU에 재고가 들어올 때 쓰는 경우가 많아, 여기서 걸러버리면 정작
    // 입고를 기록해야 할 SKU를 검색으로 찾을 수 없게 된다.
    where: { warehouseId },
    select: { id: true, productCode: true, currentProductName: true },
    orderBy: { productCode: 'asc' },
  });

  const matches = skus.filter((sku) => {
    const normalizedCode = sku.productCode.replace(/\s+/g, '').toLowerCase();
    const normalizedName = sku.currentProductName.replace(/\s+/g, '').toLowerCase();
    return normalizedCode.includes(normalizedQuery) || normalizedName.includes(normalizedQuery);
  });

  return matches.slice(0, limit).map((sku) => ({ skuId: sku.id, productCode: sku.productCode, productName: sku.currentProductName }));
}
