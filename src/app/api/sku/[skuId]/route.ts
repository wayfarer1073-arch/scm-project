import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { getSkuDetail } from '@/server/services/inventory-analysis-service';
import { getSettings } from '@/server/repositories/settings-repository';
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
