import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { templateDownloadResponse } from '@/server/services/template-download';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  return templateDownloadResponse('packaging');
}
