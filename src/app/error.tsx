'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <AlertTriangle className="size-10 text-status-danger" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold">문제가 발생했습니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">일시적인 오류일 수 있습니다. 다시 시도해주세요.</p>
        {error.digest && <p className="mt-1 text-xs text-muted-foreground/70">오류 코드: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          다시 시도
        </Button>
        <Button asChild>
          <Link href="/">대시보드로 이동</Link>
        </Button>
      </div>
    </div>
  );
}
