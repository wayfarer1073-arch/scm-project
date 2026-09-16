import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { AppNav } from '@/components/layout/app-nav';
import { SignOutButton } from '@/components/layout/sign-out-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-7 px-4 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-xl bg-slate-950 text-[10px] font-bold tracking-wider text-white" aria-hidden="true">SCM</span>
            <span className="hidden sm:inline">Inventory</span>
          </span>
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
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-7 outline-none sm:px-6 lg:px-8 lg:py-9">
        {children}
      </main>
    </div>
  );
}
