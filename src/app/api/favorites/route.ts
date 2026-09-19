import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { listFavoriteSkuIds } from '@/server/repositories/favorite-repository';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const skuIds = await listFavoriteSkuIds(session.user.id);
  return NextResponse.json({ skuIds });
}
