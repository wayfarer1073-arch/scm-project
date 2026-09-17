import { createHash } from 'node:crypto';
import { parseInventoryWorkbook } from '@/domain/excel/parser';
import { validateAgainstPreviousSnapshot } from '@/domain/excel/validator';
import type { ParsedInventoryRow, ValidationIssue } from '@/domain/excel/types';
import {
  createSnapshot,
  findActiveSnapshot,
  findSnapshotByFileHash,
  getLatestActiveSnapshotBefore,
  getSnapshotProductCodes,
} from '@/server/repositories/snapshot-repository';

export interface UploadRequest {
  warehouseId: string;
  snapshotDate: Date;
  fileBuffer: Buffer;
  fileName: string;
  uploadedById: string;
  replaceExisting: boolean;
  isMock?: boolean;
}

export type UploadResult =
  | { status: 'ERROR'; issues: ValidationIssue[] }
  | {
      status: 'CONFLICT';
      existing: { snapshotId: string; uploadedAt: Date; uploadedByName: string; rowCount: number; version: number };
    }
  | {
      status: 'DUPLICATE';
      existing: { snapshotDate: Date; uploadedAt: Date; uploadedByName: string; rowCount: number };
    }
  | { status: 'SUCCESS'; snapshotId: string; rowCount: number; issues: ValidationIssue[] };

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * 품목코드와 재고수량(정상/불량/가용/입고대기)만으로 데이터 동일성을 판단한다. 파일명·헤더 순서·부가
 * 컬럼(공급처, 판매가 등)이 달라도 품목·수량이 같으면 "동일한 데이터"로 취급한다.
 */
function computeContentSignature(rows: ParsedInventoryRow[]): string {
  const normalized = rows
    .map((r) => ({
      productCode: r.productCode,
      normalStock: r.normalStock,
      defectiveStock: r.defectiveStock,
      availableStock: r.availableStock,
      incomingStock: r.incomingStock,
    }))
    .sort((a, b) => a.productCode.localeCompare(b.productCode));
  return sha256(Buffer.from(JSON.stringify(normalized)));
}

export async function processUpload(request: UploadRequest): Promise<UploadResult> {
  const parseResult = parseInventoryWorkbook(request.fileBuffer);

  const errors = parseResult.issues.filter((i) => i.level === 'ERROR');
  if (errors.length > 0) {
    return { status: 'ERROR', issues: parseResult.issues };
  }

  const contentSignature = computeContentSignature(parseResult.rows);

  const duplicate = await findSnapshotByFileHash(request.warehouseId, contentSignature);
  if (duplicate) {
    return {
      status: 'DUPLICATE',
      existing: {
        snapshotDate: duplicate.snapshotDate,
        uploadedAt: duplicate.uploadedAt,
        uploadedByName: duplicate.uploadedBy.name,
        rowCount: duplicate.rowCount,
      },
    };
  }

  if (!request.replaceExisting) {
    const existing = await findActiveSnapshot(request.warehouseId, request.snapshotDate);
    if (existing) {
      return {
        status: 'CONFLICT',
        existing: {
          snapshotId: existing.id,
          uploadedAt: existing.uploadedAt,
          uploadedByName: existing.uploadedBy.name,
          rowCount: existing.rowCount,
          version: existing.version,
        },
      };
    }
  }

  const previousSnapshot = await getLatestActiveSnapshotBefore(request.warehouseId, request.snapshotDate);
  const previousProductCodes = previousSnapshot ? await getSnapshotProductCodes(previousSnapshot.id) : null;
  const crossCheck = validateAgainstPreviousSnapshot(parseResult.rows, previousProductCodes);

  const snapshot = await createSnapshot({
    warehouseId: request.warehouseId,
    snapshotDate: request.snapshotDate,
    sourceFileName: request.fileName,
    fileHash: contentSignature,
    uploadedById: request.uploadedById,
    isMock: request.isMock ?? false,
    rows: parseResult.rows,
  });

  return {
    status: 'SUCCESS',
    snapshotId: snapshot.id,
    rowCount: parseResult.rows.length,
    issues: [...parseResult.issues, ...crossCheck.issues],
  };
}
