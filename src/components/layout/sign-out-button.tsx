'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // redirect:false로 직접 처리한다 — signOut의 기본 redirect:true는 NEXTAUTH_URL 설정이
      // 실제 배포 도메인과 어긋나 있으면 잘못된(깨진) URL로 이동시켜 에러 화면이 뜨는 경우가
      // 있다. 세션 정리 자체가 성공했는지만 확인하고 이동은 직접 router로 한다.
      await signOut({ redirect: false });
      router.push('/login');
      router.refresh();
    } catch {
      // 세션 정리 요청이 실패해도 사용자가 에러 화면에 갇히지 않도록 로그인 화면으로는 보낸다.
      toast.error('로그아웃 요청이 실패했습니다. 다시 시도해주세요.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={loading}>
      <LogOut className="size-4" />
      로그아웃
    </Button>
  );
}
