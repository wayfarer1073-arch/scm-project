import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { processUpload } from '@/server/services/upload-service';
import { todayKstDateString } from '@/lib/date';
import { z } from 'zod';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — 일반적인 재고 Excel보다 훨씬 넉넉한 상한
const inboundEntriesSchema = z.array(z.object({
  productIdentifier: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(2_147_483_647),
})).max(100);

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
  const inboundEntriesRaw = formData.get('inboundEntries');

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

  let inboundEntries: z.infer<typeof inboundEntriesSchema> = [];
  if (typeof inboundEntriesRaw === 'string' && inboundEntriesRaw !== '') {
    try {
      const parsed = inboundEntriesSchema.safeParse(JSON.parse(inboundEntriesRaw));
      if (!parsed.success) {
        return NextResponse.json({ error: '입고 특이사항의 상품명/상품코드와 수량을 확인하세요.' }, { status: 400 });
      }
      inboundEntries = parsed.data;
    } catch {
      return NextResponse.json({ error: '입고 특이사항 형식이 올바르지 않습니다.' }, { status: 400 });
    }
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
    inboundEntries,
  });

  if (result.status === 'ERROR') {
    return NextResponse.json({ status: 'ERROR', issues: result.issues }, { status: 422 });
  }
  if (result.status === 'CONFLICT') {
    return NextResponse.json({ status: 'CONFLICT', existing: result.existing }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
