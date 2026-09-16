import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { softDeleteEvent, updateEvent } from '@/server/repositories/event-repository';

const updateEventSchema = z.object({
  eventType: z.enum(['INBOUND', 'RETURN', 'ADJUSTMENT', 'PROMOTION', 'SOLD_OUT', 'OTHER']).optional(),
  quantity: z.number().int().nullable().optional(),
  note: z.string().min(1).optional(),
  eventDate: z.string().min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  await updateEvent(id, session.user.id, {
    ...parsed.data,
    eventDate: parsed.data.eventDate ? new Date(parsed.data.eventDate) : undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  await softDeleteEvent(id, session.user.id);

  return NextResponse.json({ ok: true });
}
