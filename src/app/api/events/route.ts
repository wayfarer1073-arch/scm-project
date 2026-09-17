import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { createEvent, listEventsForSku, listEventsForWarehouse } from '@/server/repositories/event-repository';

const createEventSchema = z.object({
  warehouseId: z.string().min(1),
  skuId: z.string().min(1).nullable(),
  eventType: z.enum(['INBOUND', 'RETURN', 'ADJUSTMENT', 'PROMOTION', 'SOLD_OUT', 'OTHER']),
  quantity: z.number().int().nullable().optional(),
  note: z.string().min(1, '내용을 입력하세요.'),
  eventDate: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(request.url);
  const skuId = url.searchParams.get('skuId');
  const warehouseId = url.searchParams.get('warehouseId');

  if (skuId) {
    const events = await listEventsForSku(skuId);
    return NextResponse.json({ events });
  }
  if (warehouseId) {
    const events = await listEventsForWarehouse(warehouseId);
    return NextResponse.json({ events });
  }
  return NextResponse.json({ error: 'skuId 또는 warehouseId가 필요합니다.' }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.', issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.skuId) {
    const sku = await prisma.sku.findUnique({ where: { id: parsed.data.skuId }, select: { warehouseId: true, isActive: true } });
    if (!sku || !sku.isActive || sku.warehouseId !== parsed.data.warehouseId) {
      return NextResponse.json({ error: '현재 관리 중인 SKU가 아니거나 지정한 창고에 속하지 않습니다.' }, { status: 400 });
    }
  }

  const event = await createEvent({
    warehouseId: parsed.data.warehouseId,
    skuId: parsed.data.skuId,
    eventType: parsed.data.eventType,
    quantity: parsed.data.quantity ?? null,
    note: parsed.data.note,
    eventDate: new Date(parsed.data.eventDate),
    createdById: session.user.id,
  });

  return NextResponse.json({ event }, { status: 201 });
}
