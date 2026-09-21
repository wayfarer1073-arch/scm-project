import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { parsePackagingWorkbook } from '@/domain/excel/packaging-parser';
import { applyPackagingRows, listPackagingUploadStatus } from '@/server/repositories/packaging-repository';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const statuses = await listPackagingUploadStatus();
  return NextResponse.json({ statuses });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 업로드할 수 있습니다.' }, { status: 403 });

  const formData = await request.formData();
  const warehouseId = formData.get('warehouseId');
  const file = formData.get('file');

  if (typeof warehouseId !== 'string' || !(file instanceof File)) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다 (창고, 파일).' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다 (최대 ${MAX_FILE_BYTES / 1024 / 1024}MB).` }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const parseResult = parsePackagingWorkbook(Buffer.from(arrayBuffer));
  const errors = parseResult.issues.filter((i) => i.level === 'ERROR');
  if (errors.length > 0) {
    return NextResponse.json({ status: 'ERROR', issues: parseResult.issues }, { status: 422 });
  }

  const applyResult = await applyPackagingRows(warehouseId, parseResult.rows, session.user.id, file.name);
  return NextResponse.json({
    status: 'SUCCESS',
    updatedCount: applyResult.updatedCount,
    unmatchedProductCodes: applyResult.unmatchedProductCodes,
    issues: parseResult.issues,
  });
}
