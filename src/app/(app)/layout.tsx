import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { AppNav } from '@/components/layout/app-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { StockBoardLogoLockup } from '@/components/layout/stock-board-logo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const roleLabel = session.user.role === 'ADMIN' ? '관리자' : '멤버';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:gap-7 sm:px-6 lg:px-8">
          <MobileNav userName={session.user.name ?? ''} userRole={roleLabel} />
          <StockBoardLogoLockup iconSize={28} textClassName="hidden text-sm sm:inline" />
          <div className="hidden sm:block">
            <AppNav />
          </div>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <div className="text-right text-xs leading-tight">
              <div className="font-medium text-foreground">{session.user.name}</div>
              <div className="text-muted-foreground">{roleLabel}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-7 outline-none sm:px-6 lg:px-8 lg:py-9">
        {children}
      </main>
    </div>
  );
}
