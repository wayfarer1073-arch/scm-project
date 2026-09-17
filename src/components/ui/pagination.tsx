'use client';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageNumbers(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="페이지 내비게이션">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        이전
      </Button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            className="min-w-9"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        다음
      </Button>
    </nav>
  );
}
