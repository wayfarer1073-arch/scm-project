import { auth } from '@/server/auth';
import { listPosts } from '@/server/repositories/post-repository';
import { BoardClient } from '@/components/board/board-client';

const PAGE_SIZE = 5;

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const session = await auth();
  const page = Math.max(1, Number(params.page) || 1);

  const { posts, totalCount } = await listPosts(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <BoardClient
      posts={posts.map((p) => ({
        id: p.id,
        tag: p.tag,
        title: p.title,
        body: p.body,
        authorId: p.authorId,
        authorName: p.author.name,
        createdAt: p.createdAt.toISOString(),
      }))}
      page={Math.min(page, totalPages)}
      totalPages={totalPages}
      totalCount={totalCount}
      currentUserId={session!.user.id}
      currentUserRole={session!.user.role}
    />
  );
}
