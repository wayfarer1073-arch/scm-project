import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { StockBoardLogoLockup } from '@/components/layout/stock-board-logo';

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <StockBoardLogoLockup iconSize={56} className="flex-col gap-2" textClassName="text-2xl" />
          <p className="text-sm text-muted-foreground">사내 계정으로 로그인하세요</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
