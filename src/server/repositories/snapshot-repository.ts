import { prisma } from '@/lib/prisma';
import type { ParsedInventoryRow } from '@/domain/excel/types';
import type { Prisma } from '@prisma/client';

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
}

/**
 * 같은 (창고, 기준일)에 이미 ACTIVE 스냅샷이 있으면 REPLACED로 남기고 새 버전을 만든다(덮어쓰기로
 * 이력을 지우지 않음). 이 스냅샷이 해당 창고의 가장 최신 스냅샷일 때만 "사라진 SKU"의 isActive를 갱신한다
 * (과거 날짜 스냅샷을 나중에 업로드해도 최신 상태 판정이 흔들리지 않도록).
 */
export async function createSnapshot(input: CreateSnapshotInput) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.inventorySnapshot.findFirst({
        where: { warehouseId: input.warehouseId, snapshotDate: input.snapshotDate, status: 'ACTIVE' },
      });

      let version = 1;
      if (existing) {
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

      const touchedSkuIds: string[] = [];

      for (const row of input.rows) {
        const sku = await tx.sku.upsert({
          where: { warehouseId_productCode: { warehouseId: input.warehouseId, productCode: row.productCode } },
          // "현재값" 캐시(current*)는 이 업로드가 해당 창고의 가장 최신 스냅샷일 때만 갱신한다.
          // 과거 날짜를 뒤늦게 백필하면서 무조건 덮어쓰면, 최신 실제 상품명이 옛 백필 값으로
          // 되돌아가버린다.
          update: {
            ...(isLatestSnapshot
              ? {
                  currentProductName: row.productName,
                  currentOption: row.option,
                  currentBarcode: row.barcode,
                  currentLocation: row.location,
                  currentUnitCost: row.unitCost,
                  currentWarningQty: row.warningQty,
                  currentDangerQty: row.dangerQty,
                  lastSeenDate: input.snapshotDate,
                  isActive: true,
                }
              : {}),
          },
          create: {
            warehouseId: input.warehouseId,
            productCode: row.productCode,
            currentProductName: row.productName,
            currentOption: row.option,
            currentBarcode: row.barcode,
            currentLocation: row.location,
            currentUnitCost: row.unitCost,
            currentWarningQty: row.warningQty,
            currentDangerQty: row.dangerQty,
            firstSeenDate: input.snapshotDate,
            lastSeenDate: input.snapshotDate,
            isActive: true,
          },
        });
        touchedSkuIds.push(sku.id);

        await tx.inventoryItem.create({
          data: {
            snapshotId: snapshot.id,
            skuId: sku.id,
            productCode: row.productCode,
            productName: row.productName,
            option: row.option,
            barcode: row.barcode,
            location: row.location,
            category: row.category,
            unitCost: row.unitCost,
            normalStock: row.normalStock,
            defectiveStock: row.defectiveStock,
            availableStock: row.availableStock,
            incomingStock: row.incomingStock,
            warningQty: row.warningQty,
            dangerQty: row.dangerQty,
            extra: row.extra as Prisma.InputJsonValue,
          },
        });
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
