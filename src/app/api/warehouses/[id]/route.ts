import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ name: z.string().min(1).max(50) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 변경할 수 있습니다.' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '창고명을 확인하세요.' }, { status: 400 });

  const warehouse = await prisma.warehouse.update({ where: { id }, data: { name: parsed.data.name } });
  return NextResponse.json({ warehouse });
}
