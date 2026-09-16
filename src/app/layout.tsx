import type { Metadata } from 'next';
import { Geist_Mono, Noto_Sans_KR } from 'next/font/google';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

// 본문 텍스트 대부분이 한글이므로 라틴 전용 폰트 대신 한글 전용 웨이트를 갖춘 서체를 기본으로 쓴다.
const notoSansKr = Noto_Sans_KR({
  variable: '--font-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '재고관리 대시보드',
  description: '창고별 재고 Snapshot 기반 재고관리 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
        >
          본문으로 건너뛰기
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
