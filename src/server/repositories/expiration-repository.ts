import { prisma } from '@/lib/prisma';
import { dateOnlyToString } from '@/lib/date';
import type { ParsedExpirationRow } from '@/domain/excel/expiration-types';

export interface ExpirationRow {
  skuId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  expirationDate: string; // yyyy-MM-dd
}

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** 최신 업로드에 남아 있고 소비기한이 등록된 SKU만, 가장 임박한 순으로 나열한다. */
export async function listExpirations(): Promise<ExpirationRow[]> {
  const skus = await prisma.sku.findMany({
    where: { isActive: true, expirationDate: { not: null } },
    include: { warehouse: { select: { code: true, name: true } } },
    orderBy: { expirationDate: 'asc' },
  });
  return skus.map((sku) => ({
    skuId: sku.id,
    warehouseId: sku.warehouseId,
    warehouseCode: sku.warehouse.code,
    warehouseName: sku.warehouse.name,
    productCode: sku.productCode,
    productName: sku.currentProductName,
    expirationDate: dateOnlyToString(sku.expirationDate!),
  }));
}

export interface ApplyExpirationResult {
  updatedCount: number;
  unmatchedProductCodes: string[];
}

/**
 * 파싱된 소비기한 행을 해당 창고에 이미 알려진(캘린더 업로드를 통해 한 번이라도 인식된) SKU와
 * 상품코드로 매칭해 반영한다. 그 창고에 없는 상품코드는 건너뛰고 목록으로 보고한다.
 */
export async function applyExpirationRows(warehouseId: string, rows: ParsedExpirationRow[]): Promise<ApplyExpirationResult> {
  if (rows.length === 0) return { updatedCount: 0, unmatchedProductCodes: [] };

  const skus = await prisma.sku.findMany({
    where: { warehouseId, isActive: true, productCode: { in: rows.map((r) => r.productCode) } },
    select: { id: true, productCode: true },
  });
  const skuIdByCode = new Map(skus.map((s) => [s.productCode, s.id]));

  const unmatchedProductCodes: string[] = [];
  let updatedCount = 0;
  for (const row of rows) {
    const skuId = skuIdByCode.get(row.productCode);
    if (!skuId) {
      unmatchedProductCodes.push(row.productCode);
      continue;
    }
    await prisma.sku.update({ where: { id: skuId }, data: { expirationDate: toDateOnly(row.expirationDate) } });
    updatedCount += 1;
  }
  return { updatedCount, unmatchedProductCodes };
}

export async function setExpirationDate(skuId: string, date: string | null): Promise<boolean> {
  const result = await prisma.sku.updateMany({
    where: { id: skuId, isActive: true },
    data: { expirationDate: date ? toDateOnly(date) : null },
  });
  return result.count > 0;
}
