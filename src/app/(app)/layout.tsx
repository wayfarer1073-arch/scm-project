import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { AppNav } from '@/components/layout/app-nav';
import { SignOutButton } from '@/components/layout/sign-out-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">재고관리 대시보드</span>
          <AppNav />
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <div className="font-medium text-foreground">{session.user.name}</div>
              <div className="text-muted-foreground">{session.user.role === 'ADMIN' ? '관리자' : '멤버'}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
