'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/upload', label: '업로드' },
  { href: '/settings', label: '설정' },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 rounded-lg border bg-card/80 p-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
