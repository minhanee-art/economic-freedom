import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 경제적 자유",
  description: "경제적 자유 앱과 웹 서비스의 개인정보 처리방침입니다.",
};

const sections = [
  {
    title: "1. 수집하는 정보",
    body: [
      "경제적 자유는 사용자가 직접 입력하거나 계정으로 로그인할 때 제공하는 이메일, 비밀번호 인증 정보, 포트폴리오 보유 종목, 매수 기록, 배당 기록, 은퇴 목표, 자녀 증여 및 투자 기록을 처리할 수 있습니다.",
      "비밀번호는 원문으로 저장하지 않으며, 인증에 필요한 형태로 안전하게 처리합니다. 모바일 앱은 로그인 세션 토큰을 기기 보안 저장소에 저장합니다.",
    ],
  },
  {
    title: "2. 이용 목적",
    body: [
      "수집한 정보는 계정 로그인, 사용자가 입력한 포트폴리오와 배당 현금흐름 표시, 자녀 증여 기록 관리, 은퇴 목표 관리, 서비스 보안 및 오류 대응을 위해 사용합니다.",
      "경제적 자유는 특정 금융상품의 매수·매도 추천, 투자 자문, 중개, 수익 보장 기능을 제공하지 않습니다.",
    ],
  },
  {
    title: "3. 제3자 제공 및 외부 처리",
    body: [
      "서비스 운영을 위해 호스팅, 데이터베이스, 인증, 배포 인프라 제공업체가 데이터를 처리할 수 있습니다. 이 경우 서비스 제공에 필요한 범위에서만 처리됩니다.",
      "광고 SDK를 사용하지 않으며, 광고 목적의 개인정보 판매나 공유를 하지 않습니다.",
    ],
  },
  {
    title: "4. 보관 기간",
    body: [
      "계정과 사용자가 입력한 기록은 사용자가 서비스를 이용하는 동안 보관됩니다. 사용자가 계정 및 데이터 삭제를 요청하면 법령상 보관이 필요한 정보를 제외하고 삭제합니다.",
      "삭제 요청 방법은 계정 및 데이터 삭제 안내 페이지에서 확인할 수 있습니다.",
    ],
  },
  {
    title: "5. 이용자 권리",
    body: [
      "사용자는 본인이 입력한 정보의 열람, 정정, 삭제를 요청할 수 있습니다. 계정 삭제 또는 데이터 삭제가 필요한 경우 계정 및 데이터 삭제 안내 페이지의 절차를 따라 요청할 수 있습니다.",
    ],
  },
  {
    title: "6. 아동 및 민감정보",
    body: [
      "경제적 자유는 만 18세 이상 사용자를 대상으로 하는 개인 자산 관리 도구입니다. 자녀 증여 기록 기능은 보호자가 직접 관리하는 기록 도구이며, 아동을 대상으로 개인정보를 직접 수집하도록 설계하지 않았습니다.",
      "주민등록번호, 도장 이미지 등 고위험 민감정보를 앱에 저장하도록 요구하지 않습니다.",
    ],
  },
  {
    title: "7. 보안",
    body: [
      "서비스는 HTTPS 통신을 사용하며, 모바일 로그인 세션은 기기의 보안 저장소에 저장합니다. 사용자는 기기 잠금, 안전한 비밀번호 관리, 공용 기기 로그아웃을 통해 계정을 보호해야 합니다.",
    ],
  },
  {
    title: "8. 문의",
    body: [
      "개인정보 관련 문의는 Google Play 스토어 등록정보에 표시된 개발자 연락처 또는 앱 운영자에게 요청할 수 있습니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-12 text-foreground dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          경제적 자유
        </Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-dark-header dark:text-white">개인정보처리방침</h1>
        <p className="mt-4 text-sm text-ink-mute dark:text-zinc-400">시행일: 2026년 9월 29일</p>
        <p className="mt-6 rounded-2xl border border-hairline bg-white p-5 text-sm leading-7 text-ink-mute shadow-card dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          경제적 자유는 연금 ETF, 배당, 은퇴 목표, 자녀 증여 기록을 사용자가 직접 입력하고 관리하는 개인 자산 관리 서비스입니다. 이 방침은 웹 서비스와 모바일 앱에 적용됩니다.
        </p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-hairline bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-xl font-black text-dark-header dark:text-white">{section.title}</h2>
              <div className="mt-4 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-ink-mute dark:text-zinc-400">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-indigo-600 p-6 text-white">
          <h2 className="text-xl font-black">계정 및 데이터 삭제</h2>
          <p className="mt-3 text-sm leading-7 text-indigo-50">계정 삭제 또는 데이터 삭제 요청 방법은 별도 안내 페이지에서 확인할 수 있습니다.</p>
          <Link href="/account-deletion" className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700">
            삭제 안내 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
