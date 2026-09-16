import { createHash } from 'node:crypto';
import { parseInventoryWorkbook } from '@/domain/excel/parser';
import { validateAgainstPreviousSnapshot } from '@/domain/excel/validator';
import type { ValidationIssue } from '@/domain/excel/types';
import {
  createSnapshot,
  findActiveSnapshot,
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
  | { status: 'SUCCESS'; snapshotId: string; rowCount: number; issues: ValidationIssue[] };

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function processUpload(request: UploadRequest): Promise<UploadResult> {
  const parseResult = parseInventoryWorkbook(request.fileBuffer);

  const errors = parseResult.issues.filter((i) => i.level === 'ERROR');
  if (errors.length > 0) {
    return { status: 'ERROR', issues: parseResult.issues };
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

  const fileHash = sha256(request.fileBuffer);

  const snapshot = await createSnapshot({
    warehouseId: request.warehouseId,
    snapshotDate: request.snapshotDate,
    sourceFileName: request.fileName,
    fileHash,
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
