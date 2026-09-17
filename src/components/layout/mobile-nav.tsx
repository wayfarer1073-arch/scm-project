'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { StockBoardLogoLockup } from '@/components/layout/stock-board-logo';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/upload', label: '업로드' },
  { href: '/board', label: '게시판' },
  { href: '/settings', label: '설정' },
];

interface MobileNavProps {
  userName: string;
  userRole: string;
}

/** sm 미만 화면 전용 — 좁은 폭에서 가로 탭 4개+사용자 정보가 글자 단위로 줄바꿈되며 깨지는 문제를 드로어로 해결한다. */
export function MobileNav({ userName, userRole }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('로그아웃 요청이 실패했습니다. 다시 시도해주세요.');
      router.push('/login');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기">
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
        <SheetHeader>
          <SheetTitle asChild>
            <StockBoardLogoLockup iconSize={26} textClassName="text-base" />
          </SheetTitle>
          <SheetDescription className="sr-only">사이트 이동 메뉴</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-3 border-t p-4">
          <div className="text-xs leading-tight">
            <div className="font-medium text-foreground">{userName}</div>
            <div className="text-muted-foreground">{userRole}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
            <LogOut className="size-4" />
            로그아웃
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
