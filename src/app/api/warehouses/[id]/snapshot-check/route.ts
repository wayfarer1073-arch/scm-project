import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { findActiveSnapshot } from '@/server/repositories/snapshot-repository';

/** 특정 창고·기준일에 이미 등록된 스냅샷이 있는지 미리 확인한다 (과거 자료 업로드 시 사전 경고용). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const dateStr = new URL(request.url).searchParams.get('date');
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const existing = await findActiveSnapshot(id, new Date(`${dateStr}T00:00:00.000Z`));
  if (!existing) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists: true,
    snapshot: {
      rowCount: existing.rowCount,
      uploadedAt: existing.uploadedAt,
      uploadedByName: existing.uploadedBy.name,
      version: existing.version,
    },
  });
}
