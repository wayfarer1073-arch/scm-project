'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { PostFormDialog } from '@/components/board/post-form-dialog';
import { formatKstDateTime } from '@/lib/date';
import { postTagLabel, postTagBadgeVariant, type PostTagValue } from '@/lib/post-tags';

export interface BoardPost {
  id: string;
  tag: PostTagValue;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface BoardClientProps {
  posts: BoardPost[];
  page: number;
  totalPages: number;
  totalCount: number;
  currentUserId: string;
  currentUserRole: 'MEMBER' | 'ADMIN';
}

export function BoardClient({ posts, page, totalPages, totalCount, currentUserId, currentUserRole }: BoardClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function goToPage(next: number) {
    router.push(`/board?page=${next}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('이 게시글을 삭제할까요?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? '삭제에 실패했습니다.');
        return;
      }
      toast.success('삭제되었습니다.');
      router.refresh();
    } catch {
      toast.error('네트워크 오류로 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">게시판</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalCount.toLocaleString('ko-KR')}건의 글이 있습니다.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <PenSquare className="size-4" />
          글쓰기
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <p className="text-sm font-medium">아직 작성된 글이 없습니다</p>
          <p className="text-xs text-muted-foreground">글쓰기 버튼을 눌러 첫 글을 남겨보세요.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {posts.map((post) => {
            const canDelete = post.authorId === currentUserId || currentUserRole === 'ADMIN';
            return (
              <li key={post.id} className="flex items-start gap-3 px-5 py-4">
                <Badge variant={postTagBadgeVariant(post.tag)} className="mt-0.5 shrink-0">
                  {postTagLabel(post.tag)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{post.title}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{post.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {post.authorName} · {formatKstDateTime(post.createdAt)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deletingId === post.id}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    aria-label="삭제"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={goToPage} />

      <PostFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          if (page === 1) router.refresh();
          else goToPage(1);
        }}
      />
    </div>
  );
}
