import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "계정 및 데이터 삭제 안내 - 경제적 자유",
  description: "경제적 자유 앱과 웹 서비스의 계정 및 데이터 삭제 요청 방법입니다.",
};

const deleteItems = [
  "계정 이메일 주소",
  "포트폴리오 보유 종목, 매수 기록, 손익 기록",
  "배당 기록과 배당 캘린더 입력 정보",
  "은퇴 목표와 설정값",
  "자녀 증여, 입금, 투자 증빙 기록",
];

export default function AccountDeletionPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-12 text-foreground dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          경제적 자유
        </Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-dark-header dark:text-white">계정 및 데이터 삭제 안내</h1>
        <p className="mt-4 text-sm text-ink-mute dark:text-zinc-400">최종 업데이트: 2026년 9월 29일</p>

        <section className="mt-8 rounded-2xl border border-hairline bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-dark-header dark:text-white">삭제 요청 방법</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-ink-mute dark:text-zinc-400">
            <p>
              경제적 자유 계정과 데이터를 삭제하려면 Google Play 스토어 등록정보에 표시된 개발자 연락처 또는 앱 운영자에게 삭제 요청을 보내주세요.
            </p>
            <p>요청 시 본인 확인을 위해 가입 이메일 주소를 함께 알려주세요. 비밀번호는 절대 보내지 마세요.</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-hairline bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-dark-header dark:text-white">삭제되는 데이터</h2>
          <ul className="mt-4 space-y-3">
            {deleteItems.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-ink-mute dark:text-zinc-400">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-hairline bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-dark-header dark:text-white">처리 기간과 보관 예외</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-ink-mute dark:text-zinc-400">
            <p>삭제 요청은 본인 확인 후 가능한 한 빠르게 처리합니다. 일반적으로 영업일 기준 30일 이내에 처리 결과를 안내합니다.</p>
            <p>법령상 보관이 필요한 정보가 있는 경우 해당 법령에서 정한 기간 동안 제한적으로 보관될 수 있습니다.</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-hairline bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-dark-header dark:text-white">앱에서 할 수 있는 조치</h2>
          <p className="mt-4 text-sm leading-7 text-ink-mute dark:text-zinc-400">
            모바일 앱의 설정 화면에서 로그아웃할 수 있습니다. 로그아웃은 기기에 저장된 로그인 세션을 삭제하는 기능이며, 서버 계정과 입력 데이터 삭제가 필요한 경우 별도 삭제 요청이 필요합니다.
          </p>
        </section>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl bg-indigo-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">개인정보처리방침</h2>
            <p className="mt-2 text-sm text-indigo-50">데이터 처리 기준은 개인정보처리방침에서 확인할 수 있습니다.</p>
          </div>
          <Link href="/privacy" className="inline-flex justify-center rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700">
            방침 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
