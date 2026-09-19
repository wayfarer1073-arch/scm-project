import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { addFavorite, removeFavorite } from '@/server/repositories/favorite-repository';

// 즐겨찾기는 개인 설정이라 관리자 권한이 필요 없다 — 로그인한 사용자라면 누구나 자신의 목록을 관리한다.
export async function POST(_: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { skuId } = await params;
  await addFavorite(session.user.id, skuId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { skuId } = await params;
  await removeFavorite(session.user.id, skuId);
  return NextResponse.json({ ok: true });
}
