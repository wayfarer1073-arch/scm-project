import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { deletePost, PostPermissionError } from '@/server/repositories/post-repository';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  try {
    await deletePost(id, { id: session.user.id, role: session.user.role });
  } catch (error) {
    if (error instanceof PostPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
