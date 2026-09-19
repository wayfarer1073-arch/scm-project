'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UploadCloud, MessagesSquare, Settings, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/layout/sign-out-button';

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/upload', label: '업로드', icon: UploadCloud },
  { href: '/board', label: '게시판', icon: MessagesSquare },
  { href: '/settings', label: '설정', icon: Settings },
];

interface AppSidebarProps {
  userName: string;
  userRole: string;
  className?: string;
}

export function AppSidebar({ userName, userRole, className }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-brand-accent-foreground">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        <span className="text-base font-semibold tracking-tight">StockBoard</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground">메뉴</p>
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-accent text-brand-accent-foreground'
                  : 'text-sidebar-muted-foreground hover:bg-sidebar-hover-bg hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-4">
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate font-medium text-sidebar-foreground">{userName}</div>
          <div className="text-sidebar-muted-foreground">{userRole}</div>
        </div>
        <SignOutButton className="text-sidebar-muted-foreground hover:bg-sidebar-hover-bg hover:text-sidebar-foreground" />
      </div>
    </aside>
  );
}
