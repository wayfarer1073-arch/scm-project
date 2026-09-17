import { prisma } from '@/lib/prisma';
import type { PostTag, Role } from '@prisma/client';

export class PostPermissionError extends Error {}

export async function listPosts(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.post.count(),
  ]);
  return { posts, totalCount };
}

export function createPost(input: { tag: PostTag; title: string; body: string; authorId: string }) {
  return prisma.post.create({ data: input, include: { author: { select: { id: true, name: true } } } });
}

export async function deletePost(id: string, requester: { id: string; role: Role }) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id } });
  if (post.authorId !== requester.id && requester.role !== 'ADMIN') {
    throw new PostPermissionError('본인 글 또는 관리자만 삭제할 수 있습니다.');
  }
  await prisma.post.delete({ where: { id } });
}
