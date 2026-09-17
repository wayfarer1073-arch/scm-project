import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { searchSkusInWarehouse } from '@/server/repositories/inventory-repository';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(request.url);
  const warehouseId = url.searchParams.get('warehouseId');
  const q = url.searchParams.get('q') ?? '';
  if (!warehouseId) return NextResponse.json({ error: 'warehouseId가 필요합니다.' }, { status: 400 });

  const results = await searchSkusInWarehouse(warehouseId, q);
  return NextResponse.json({ results });
}
