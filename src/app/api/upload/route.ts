import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { processUpload } from '@/server/services/upload-service';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — 일반적인 재고 Excel보다 훨씬 넉넉한 상한

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const formData = await request.formData();
  const warehouseId = formData.get('warehouseId');
  const snapshotDateStr = formData.get('snapshotDate');
  const replaceExisting = formData.get('replaceExisting') === 'true';
  const file = formData.get('file');

  if (typeof warehouseId !== 'string' || typeof snapshotDateStr !== 'string' || !(file instanceof File)) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다 (창고, 기준일, 파일).' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다 (최대 ${MAX_FILE_BYTES / 1024 / 1024}MB).` }, { status: 413 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDateStr)) {
    return NextResponse.json({ error: '기준일 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const snapshotDate = new Date(`${snapshotDateStr}T00:00:00.000Z`);

  const result = await processUpload({
    warehouseId,
    snapshotDate,
    fileBuffer,
    fileName: file.name,
    uploadedById: session.user.id,
    replaceExisting,
  });

  if (result.status === 'ERROR') {
    return NextResponse.json({ status: 'ERROR', issues: result.issues }, { status: 422 });
  }
  if (result.status === 'CONFLICT') {
    return NextResponse.json({ status: 'CONFLICT', existing: result.existing }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
