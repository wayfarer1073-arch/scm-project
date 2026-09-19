import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { processUpload } from '@/server/services/upload-service';
import { resetUploadForDate } from '@/server/repositories/snapshot-repository';
import { todayKstDateString } from '@/lib/date';

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

  const snapshotDate = new Date(`${snapshotDateStr}T00:00:00.000Z`);
  // new Date()는 "2026-02-30" 같은 존재하지 않는 날짜를 3월 2일 등으로 자동 보정하므로,
  // 되돌린 날짜 문자열이 입력과 일치하는지 검사해 실제 달력 날짜인지 확인한다.
  if (Number.isNaN(snapshotDate.getTime()) || snapshotDate.toISOString().slice(0, 10) !== snapshotDateStr) {
    return NextResponse.json({ error: '존재하지 않는 날짜입니다.' }, { status: 400 });
  }
  if (snapshotDateStr > todayKstDateString()) {
    return NextResponse.json({ error: '미래 날짜는 기준일로 선택할 수 없습니다.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

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

/** 일자별 업로드 탭에서 특정 창고·날짜에 올라간 자료 전체를 초기화(삭제)한다. 다른 창고/날짜에는 영향 없음. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 초기화할 수 있습니다.' }, { status: 403 });

  const url = new URL(request.url);
  const warehouseId = url.searchParams.get('warehouseId');
  const snapshotDateStr = url.searchParams.get('snapshotDate');
  if (!warehouseId || !snapshotDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDateStr)) {
    return NextResponse.json({ error: '창고와 날짜를 지정해야 합니다.' }, { status: 400 });
  }

  const snapshotDate = new Date(`${snapshotDateStr}T00:00:00.000Z`);
  if (Number.isNaN(snapshotDate.getTime()) || snapshotDate.toISOString().slice(0, 10) !== snapshotDateStr) {
    return NextResponse.json({ error: '존재하지 않는 날짜입니다.' }, { status: 400 });
  }

  const result = await resetUploadForDate(warehouseId, snapshotDate);
  if (result.deletedSnapshotCount === 0) {
    return NextResponse.json({ error: '해당 날짜에 업로드된 자료가 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deletedSnapshotCount: result.deletedSnapshotCount });
}
