'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, MessagesSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { postTagLabel, postTagDotClassName, type PostTagValue } from '@/lib/post-tags';

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/upload', label: '캘린더', icon: CalendarDays },
  { href: '/board', label: '게시판', icon: MessagesSquare },
  { href: '/settings', label: '설정', icon: Settings },
];

export interface SidebarRecentPost {
  id: string;
  tag: PostTagValue;
  title: string;
}

interface AppSidebarProps {
  userName: string;
  userRole: string;
  recentPosts?: SidebarRecentPost[];
  className?: string;
}

export function AppSidebar({ userName, userRole, recentPosts, className }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-5 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="size-9 shrink-0" />
        <span className="text-base font-semibold tracking-tight">Limenote</span>
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

      {recentPosts && recentPosts.length > 0 && (
        <div className="mt-auto flex flex-col gap-1 px-3 py-3">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground">최근 게시글</p>
          {recentPosts.map((post) => (
            <Link
              key={post.id}
              href={`/board?tags=${post.tag}`}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-sidebar-muted-foreground transition-colors hover:bg-sidebar-hover-bg hover:text-sidebar-foreground"
            >
              <span className={cn('size-1.5 shrink-0 rounded-full', postTagDotClassName(post.tag))} aria-hidden="true" />
              <span className="truncate" title={`[${postTagLabel(post.tag)}] ${post.title}`}>
                {post.title}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className={cn('flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-4', !recentPosts?.length && 'mt-auto')}>
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate font-medium text-sidebar-foreground">{userName}</div>
          <div className="text-sidebar-muted-foreground">{userRole}</div>
        </div>
        <SignOutButton className="text-sidebar-muted-foreground hover:bg-sidebar-hover-bg hover:text-sidebar-foreground" />
      </div>
    </aside>
  );
}
