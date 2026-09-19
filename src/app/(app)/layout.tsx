import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { StockBoardLogoLockup } from '@/components/layout/stock-board-logo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const roleLabel = session.user.role === 'ADMIN' ? '관리자' : '멤버';

  return (
    <div className="flex min-h-screen">
      <AppSidebar userName={session.user.name ?? ''} userRole={roleLabel} className="hidden sm:flex" />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 sm:hidden">
          <MobileNav userName={session.user.name ?? ''} userRole={roleLabel} />
          <StockBoardLogoLockup iconSize={26} textClassName="text-sm" />
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1840px] flex-1 px-4 py-7 outline-none sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
