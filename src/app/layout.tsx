import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "가족연금계획 - 연금·배당 기록과 은퇴 현금흐름 계산",
  description:
    "연금저축·IRP 납입과 세액공제 한도 진행, 배당 기록, 본인·배우자 기준 은퇴 후 예상 월 현금흐름을 계산하는 기록 도구입니다. 증권사 계좌와 연결하지 않고 주문을 실행하지 않습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 테마 깜빡임 방지 — 첫 렌더 전에 .dark 클래스 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        {/* Pretendard: jsDelivr의 동적 서브셋(unicode-range로 나뉜 92개 woff2 중 페이지에 쓰인 글자 조각만 받음).
            next/font/local은 파일별 unicode-range를 지정할 수 없어 단일 2MB 파일을 모든 페이지에 내려받게 되므로 쓰지 않는다.
            preconnect로 CSS·글꼴 요청의 DNS·TLS 연결을 미리 열어 렌더 차단 시간을 줄인다.
            (jsDelivr 사용은 개인정보처리방침 3항에 적혀 있다 — 자체 호스팅으로 바꾸면 방침도 함께 고칠 것) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
