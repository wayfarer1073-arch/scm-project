import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { getSkuDetail } from '@/server/services/inventory-analysis-service';
import { getSettings } from '@/server/repositories/settings-repository';
import { setSkuHiddenFromDashboard } from '@/server/repositories/inventory-repository';
import { todayKstDateString } from '@/lib/date';

export async function GET(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { skuId } = await params;
  const url = new URL(request.url);
  const asOfDate = url.searchParams.get('asOf') ?? todayKstDateString();

  const settings = await getSettings();
  const detail = await getSkuDetail(skuId, asOfDate, settings);
  if (!detail) return NextResponse.json({ error: 'SKU를 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json(detail);
}

const patchSchema = z.object({ isHiddenFromDashboard: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 변경할 수 있습니다.' }, { status: 403 });

  const { skuId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });

  try {
    const sku = await setSkuHiddenFromDashboard(skuId, parsed.data.isHiddenFromDashboard);
    return NextResponse.json({ skuId: sku.id, isHiddenFromDashboard: sku.isHiddenFromDashboard });
  } catch {
    return NextResponse.json({ error: 'SKU를 찾을 수 없습니다.' }, { status: 404 });
  }
}
