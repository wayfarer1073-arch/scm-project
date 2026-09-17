import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { parseInventoryWorkbook } from '@/domain/excel/parser';
import { validateAgainstPreviousSnapshot } from '@/domain/excel/validator';
import type { ParsedInventoryRow, ValidationIssue } from '@/domain/excel/types';
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
  | {
      status: 'DUPLICATE';
      existing: { snapshotDate: Date; uploadedAt: Date; uploadedByName: string; rowCount: number };
    }
  | { status: 'SUCCESS'; snapshotId: string; rowCount: number; issues: ValidationIssue[] };

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * 실제 분석에 쓰는 최소 필드만으로 데이터 동일성을 판단한다. 파일명·헤더 순서·무시되는 부가 컬럼이
 * 달라도 상품코드/상품명/원가/원가합/정상재고가 같으면 "동일한 데이터"로 취급한다.
 */
function computeContentSignature(rows: ParsedInventoryRow[]): string {
  const normalizedRows = rows
    .map((r) => ({
      productCode: r.productCode,
      productName: r.productName,
      unitCost: r.unitCost,
      unitCostProvided: !r.costMissing,
      totalCost: r.totalCost,
      normalStock: r.normalStock,
    }))
    .sort((a, b) => a.productCode.localeCompare(b.productCode));
  return sha256(Buffer.from(JSON.stringify(normalizedRows)));
}

export async function processUpload(request: UploadRequest): Promise<UploadResult> {
  const parseResult = parseInventoryWorkbook(request.fileBuffer);

  const errors = parseResult.issues.filter((i) => i.level === 'ERROR');
  if (errors.length > 0) {
    return { status: 'ERROR', issues: parseResult.issues };
  }

  const contentSignature = computeContentSignature(parseResult.rows);

  // 중복 판단은 "같은 날짜" 범위에서만 한다. 다른 날짜에 우연히 같은 재고 수치가 관측되는 것은
  // (예: 며칠간 출고가 없었던 경우) 정당한 데이터이므로 저장을 막으면 안 된다 — 막으면 소진/정체
  // 분석에 필요한 "변화 없음" 관측 자체가 사라진다.
  const existingForDate = await findActiveSnapshot(request.warehouseId, request.snapshotDate);
  if (existingForDate) {
    if (existingForDate.fileHash === contentSignature) {
      // 같은 날짜에 내용까지 동일한 재전송 → 새 버전을 만들지 않고 멱등 처리한다.
      return {
        status: 'DUPLICATE',
        existing: {
          snapshotDate: existingForDate.snapshotDate,
          uploadedAt: existingForDate.uploadedAt,
          uploadedByName: existingForDate.uploadedBy.name,
          rowCount: existingForDate.rowCount,
        },
      };
    }
    if (!request.replaceExisting) {
      return {
        status: 'CONFLICT',
        existing: {
          snapshotId: existingForDate.id,
          uploadedAt: existingForDate.uploadedAt,
          uploadedByName: existingForDate.uploadedBy.name,
          rowCount: existingForDate.rowCount,
          version: existingForDate.version,
        },
      };
    }
  }

  const previousSnapshot = await getLatestActiveSnapshotBefore(request.warehouseId, request.snapshotDate);
  const previousProductCodes = previousSnapshot ? await getSnapshotProductCodes(previousSnapshot.id) : null;
  const crossCheck = validateAgainstPreviousSnapshot(parseResult.rows, previousProductCodes);

  // findActiveSnapshot으로 본 "충돌 없음" 판단과 createSnapshot의 실제 쓰기 사이에는 시간차가 있어
  // 같은 (창고, 기준일)에 동시에 두 건이 업로드되면 경쟁이 생길 수 있다. 그 경우 DB의
  // @@unique([warehouseId, snapshotDate, version]) 제약이 둘째 요청을 막아주므로 데이터는 깨지지
  // 않지만, 원인이 불명확한 500 에러 대신 재시도를 안내하는 명확한 에러로 바꿔준다.
  let snapshot;
  try {
    snapshot = await createSnapshot({
      warehouseId: request.warehouseId,
      snapshotDate: request.snapshotDate,
      sourceFileName: request.fileName,
      fileHash: contentSignature,
      uploadedById: request.uploadedById,
      isMock: request.isMock ?? false,
      rows: parseResult.rows,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        status: 'ERROR',
        issues: [
          {
            level: 'ERROR',
            code: 'CONCURRENT_UPLOAD_CONFLICT',
            message: '다른 업로드가 같은 창고·기준일에 동시에 처리되어 충돌했습니다. 잠시 후 다시 시도해주세요.',
          },
        ],
      };
    }
    throw err;
  }

  return {
    status: 'SUCCESS',
    snapshotId: snapshot.id,
    rowCount: parseResult.rows.length,
    issues: [...parseResult.issues, ...crossCheck.issues],
  };
}
