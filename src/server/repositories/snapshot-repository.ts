import { prisma } from '@/lib/prisma';
import type { ParsedInventoryRow } from '@/domain/excel/types';

export function findActiveSnapshot(warehouseId: string, snapshotDate: Date) {
  return prisma.inventorySnapshot.findFirst({
    where: { warehouseId, snapshotDate, status: 'ACTIVE' },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });
}

export function getLatestActiveSnapshot(warehouseId: string) {
  return prisma.inventorySnapshot.findFirst({
    where: { warehouseId, status: 'ACTIVE' },
    orderBy: { snapshotDate: 'desc' },
  });
}

export function getLatestActiveSnapshotBefore(warehouseId: string, beforeDate: Date) {
  return prisma.inventorySnapshot.findFirst({
    where: { warehouseId, status: 'ACTIVE', snapshotDate: { lt: beforeDate } },
    orderBy: { snapshotDate: 'desc' },
  });
}

export async function getSnapshotProductCodes(snapshotId: string): Promise<string[]> {
  const items = await prisma.inventoryItem.findMany({ where: { snapshotId }, select: { productCode: true } });
  return items.map((i) => i.productCode);
}

export interface CreateSnapshotInput {
  warehouseId: string;
  snapshotDate: Date;
  sourceFileName: string;
  fileHash: string;
  uploadedById: string;
  isMock?: boolean;
  rows: ParsedInventoryRow[];
  replaceExisting?: boolean;
}

export class SnapshotConflictError extends Error {
  constructor() { super('A snapshot was created before this upload acquired the warehouse lock.'); }
}

/**
 * 같은 (창고, 기준일)에 이미 ACTIVE 스냅샷이 있으면 REPLACED로 남기고 새 버전을 만든다(덮어쓰기로
 * 이력을 지우지 않음). 이 스냅샷이 해당 창고의 가장 최신 스냅샷일 때만 "사라진 SKU"의 isActive를 갱신한다
 * (과거 날짜 스냅샷을 나중에 업로드해도 최신 상태 판정이 흔들리지 않도록).
 */
export async function createSnapshot(input: CreateSnapshotInput) {
  return prisma.$transaction(
    async (tx) => {
      // Serialize uploads per warehouse, not just per date: concurrent dates also update
      // the same current-SKU cache. Holding this parent lock makes version allocation safe.
      await tx.$queryRaw`SELECT id FROM warehouses WHERE id = ${input.warehouseId} FOR UPDATE`;
      const existing = await tx.inventorySnapshot.findFirst({
        where: { warehouseId: input.warehouseId, snapshotDate: input.snapshotDate, status: 'ACTIVE' },
      });

      let version = 1;
      if (existing) {
        if (input.replaceExisting === false) throw new SnapshotConflictError();
        await tx.inventorySnapshot.update({ where: { id: existing.id }, data: { status: 'REPLACED' } });
        version = existing.version + 1;
      }

      const snapshot = await tx.inventorySnapshot.create({
        data: {
          warehouseId: input.warehouseId,
          snapshotDate: input.snapshotDate,
          version,
          status: 'ACTIVE',
          sourceFileName: input.sourceFileName,
          fileHash: input.fileHash,
          rowCount: input.rows.length,
          isMock: input.isMock ?? false,
          uploadedById: input.uploadedById,
        },
      });

      const latestOther = await tx.inventorySnapshot.findFirst({
        where: { warehouseId: input.warehouseId, status: 'ACTIVE', id: { not: snapshot.id } },
        orderBy: { snapshotDate: 'desc' },
      });
      const isLatestSnapshot = !latestOther || latestOther.snapshotDate <= input.snapshotDate;

      // Batch inserts and updates avoid two database round trips for every Excel row.
      const touchedSkuIds: string[] = [];
      for (let offset = 0; offset < input.rows.length; offset += 1000) {
        const batch = input.rows.slice(offset, offset + 1000);
        await tx.sku.createMany({ skipDuplicates: true, data: batch.map((row) => ({
            warehouseId: input.warehouseId,
            productCode: row.productCode,
            currentProductName: row.productName,
            currentOption: row.option,
            currentBarcode: row.barcode,
            currentLocation: row.location,
            currentUnitCost: row.costMissing ? 0 : row.unitCost,
            currentWarningQty: row.warningQty,
            currentDangerQty: row.dangerQty,
            firstSeenDate: input.snapshotDate,
            lastSeenDate: input.snapshotDate,
            isActive: isLatestSnapshot,
        })) });

        const payload = JSON.stringify(batch);
        await tx.$executeRaw`
          UPDATE skus AS s SET
            "firstSeenDate" = LEAST(s."firstSeenDate", ${input.snapshotDate}::date),
            "lastSeenDate" = GREATEST(s."lastSeenDate", ${input.snapshotDate}::date),
            "currentProductName" = CASE WHEN ${isLatestSnapshot} THEN r."productName" ELSE s."currentProductName" END,
            "currentOption" = CASE WHEN ${isLatestSnapshot} THEN r.option ELSE s."currentOption" END,
            "currentBarcode" = CASE WHEN ${isLatestSnapshot} THEN r.barcode ELSE s."currentBarcode" END,
            "currentLocation" = CASE WHEN ${isLatestSnapshot} THEN r.location ELSE s."currentLocation" END,
            "currentUnitCost" = CASE WHEN ${isLatestSnapshot} AND NOT r."costMissing" THEN r."unitCost" ELSE s."currentUnitCost" END,
            "currentWarningQty" = CASE WHEN ${isLatestSnapshot} THEN r."warningQty" ELSE s."currentWarningQty" END,
            "currentDangerQty" = CASE WHEN ${isLatestSnapshot} THEN r."dangerQty" ELSE s."currentDangerQty" END,
            "isActive" = CASE WHEN ${isLatestSnapshot} THEN true ELSE s."isActive" END,
            "updatedAt" = NOW()
          FROM jsonb_to_recordset(${payload}::jsonb) AS r(
            "productCode" text, "productName" text, option text, barcode text, location text,
            "costMissing" boolean, "unitCost" numeric, "warningQty" integer, "dangerQty" integer
          )
          WHERE s."warehouseId" = ${input.warehouseId} AND s."productCode" = r."productCode"
        `;
        const skus = await tx.sku.findMany({
          where: { warehouseId: input.warehouseId, productCode: { in: batch.map(r => r.productCode) } },
          select: { id: true, productCode: true },
        });
        const skuIdByCode = new Map(skus.map(s => [s.productCode, s.id]));
        touchedSkuIds.push(...skus.map(s => s.id));
        await tx.inventoryItem.createMany({ data: batch.map((row) => ({
            snapshotId: snapshot.id,
            skuId: skuIdByCode.get(row.productCode)!,
            productCode: row.productCode,
            productName: row.productName,
            option: row.option,
            barcode: row.barcode,
            location: row.location,
            category: row.category,
            unitCost: row.unitCost,
            unitCostProvided: !row.costMissing,
            totalCost: row.totalCost,
            normalStock: row.normalStock,
            defectiveStock: row.defectiveStock,
            availableStock: row.availableStock,
            incomingStock: row.incomingStock,
            warningQty: row.warningQty,
            dangerQty: row.dangerQty,
        })) });
      }

      if (isLatestSnapshot && touchedSkuIds.length > 0) {
        await tx.sku.updateMany({
          where: { warehouseId: input.warehouseId, isActive: true, id: { notIn: touchedSkuIds } },
          data: { isActive: false },
        });
      }

      return snapshot;
    },
    { timeout: 60000, maxWait: 15000 },
  );
}

export function listSnapshotsForWarehouse(warehouseId: string) {
  return prisma.inventorySnapshot.findMany({
    where: { warehouseId, status: 'ACTIVE' },
    orderBy: { snapshotDate: 'asc' },
    include: { uploadedBy: { select: { name: true } } },
  });
}
