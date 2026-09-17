import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { setExpirationDate } from '@/server/repositories/expiration-repository';

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

const patchSchema = z.object({ expirationDate: z.string().refine(isValidCalendarDate, '존재하지 않는 날짜입니다.').nullable() });

export async function PATCH(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 변경할 수 있습니다.' }, { status: 403 });

  const { skuId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });

  const ok = await setExpirationDate(skuId, parsed.data.expirationDate);
  if (!ok) return NextResponse.json({ error: 'SKU를 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 });

  const { skuId } = await params;
  const ok = await setExpirationDate(skuId, null);
  if (!ok) return NextResponse.json({ error: 'SKU를 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
