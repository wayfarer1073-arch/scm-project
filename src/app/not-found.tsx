import Link from 'next/link';
import { PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <PackageSearch className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">주소가 바뀌었거나 존재하지 않는 페이지입니다.</p>
      </div>
      <Button asChild>
        <Link href="/">대시보드로 이동</Link>
      </Button>
    </div>
  );
}
