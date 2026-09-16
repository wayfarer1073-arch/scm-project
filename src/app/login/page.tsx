import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-xs font-bold tracking-wider text-primary-foreground" aria-hidden="true">
            재고
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">재고관리 대시보드</h1>
            <p className="text-sm text-muted-foreground">사내 계정으로 로그인하세요</p>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
