import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="size-14" />
          <p className="text-2xl font-semibold tracking-tight text-sidebar-foreground">Limenote</p>
          <p className="text-sm text-sidebar-muted-foreground">사내 계정으로 로그인하세요</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
