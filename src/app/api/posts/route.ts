import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { createPost, listPosts } from '@/server/repositories/post-repository';

const PAGE_SIZE = 5;

const createPostSchema = z.object({
  tag: z.enum(['ISSUE', 'NOTICE', 'CHAT']),
  title: z.string().trim().min(1, '제목을 입력하세요.').max(50, '제목은 50자 이내로 작성하세요.'),
  body: z.string().trim().min(1, '내용을 입력하세요.').max(200, '본문은 200자 이내로 작성하세요.'),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const { posts, totalCount } = await listPosts(page, PAGE_SIZE);
  return NextResponse.json({
    posts,
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  const post = await createPost({ ...parsed.data, authorId: session.user.id });
  return NextResponse.json({ post }, { status: 201 });
}
