import { Suspense } from 'react';
import { Package } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
            <Package className="size-8" aria-hidden="true" />
          </span>
          <p className="text-2xl font-semibold tracking-tight text-sidebar-foreground">StockBoard</p>
          <p className="text-sm text-sidebar-muted-foreground">사내 계정으로 로그인하세요</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
