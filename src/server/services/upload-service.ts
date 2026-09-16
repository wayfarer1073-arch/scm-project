import { createHash } from 'node:crypto';
import { parseInventoryWorkbook } from '@/domain/excel/parser';
import { validateAgainstPreviousSnapshot } from '@/domain/excel/validator';
import type { ValidationIssue } from '@/domain/excel/types';
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

export async function processUpload(request: UploadRequest): Promise<UploadResult> {
  const parseResult = parseInventoryWorkbook(request.fileBuffer);

  const errors = parseResult.issues.filter((i) => i.level === 'ERROR');
  if (errors.length > 0) {
    return { status: 'ERROR', issues: parseResult.issues };
  }

  const fileHash = sha256(request.fileBuffer);

  const duplicate = await findSnapshotByFileHash(request.warehouseId, fileHash);
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
