'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { POST_TAG_OPTIONS, type PostTagValue } from '@/lib/post-tags';

const TITLE_MAX = 50;
const BODY_MAX = 200;

export interface EditingPost {
  id: string;
  tag: PostTagValue;
  title: string;
  body: string;
}

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPost?: EditingPost | null;
  onCreated: () => void;
}

function CounterLabel({ length, max }: { length: number; max: number }) {
  const ratio = length / max;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        ratio >= 1 ? 'text-destructive font-medium' : ratio >= 0.8 ? 'text-status-warning' : 'text-muted-foreground',
      )}
    >
      {length}/{max}
    </span>
  );
}

export function PostFormDialog({ open, onOpenChange, editingPost, onCreated }: PostFormDialogProps) {
  const [tag, setTag] = useState<PostTagValue>('NOTICE');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editingPost;

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTag(editingPost.tag);
      setTitle(editingPost.title);
      setBody(editingPost.body);
    } else {
      setTag('NOTICE');
      setTitle('');
      setBody('');
    }
  }, [open, editingPost]);

  async function submit() {
    if (!title.trim()) {
      toast.error('제목을 입력하세요.');
      return;
    }
    if (!body.trim()) {
      toast.error('내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { tag, title: title.trim(), body: body.trim() };
      const res = isEditing
        ? await fetch(`/api/posts/${editingPost.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? (isEditing ? '수정에 실패했습니다.' : '등록에 실패했습니다.'));
        return;
      }
      toast.success(isEditing ? '게시글이 수정되었습니다.' : '게시글이 등록되었습니다.');
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error(isEditing ? '네트워크 오류로 수정에 실패했습니다.' : '네트워크 오류로 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? '글 수정' : '새 글 작성'}</DialogTitle>
          <DialogDescription>태그를 선택하고 제목과 내용을 작성하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="post-tag">태그</Label>
            <div id="post-tag" role="radiogroup" aria-label="태그" className="inline-flex rounded-lg bg-muted p-1">
              {POST_TAG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={tag === opt.value}
                  onClick={() => setTag(opt.value)}
                  className={cn(
                    'rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors',
                    tag === opt.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-title">제목</Label>
              <CounterLabel length={title.length} max={TITLE_MAX} />
            </div>
            <Input id="post-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-body">내용</Label>
              <CounterLabel length={body.length} max={BODY_MAX} />
            </div>
            <Textarea id="post-body" value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="내용을 입력하세요" rows={5} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (isEditing ? '수정 중...' : '등록 중...') : isEditing ? '수정' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
