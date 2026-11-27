import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 가족연금계획",
  description: "가족연금계획 앱과 웹 서비스의 개인정보 처리방침입니다.",
};

// 문의 이메일 — 설정돼 있으면 직접 표기, 없으면 스토어 등록정보/운영자 안내 문구로 대체
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

// 이 목록은 코드에서 확인한 실제 수집 항목·외부 호출만 적는다.
// 수집 항목: neon-schema.sql, src/lib/*.ts의 CREATE/ALTER TABLE / 외부 호출: src의 fetch 대상 URL
// 보존 기간, 서버 저장 시 암호화 등 코드로 확인되지 않는 내용은 적지 않는다.
const sections = [
  {
    title: "1. 수집하는 정보",
    body: [
      "가족연금계획은 이용자가 직접 입력하거나 로그인할 때 제공하는 아래 정보를 처리합니다.",
      "· 계정 정보 — 이메일, 비밀번호(원문은 저장하지 않고 bcrypt 해시만 저장), 로그인 세션 정보. 'Google로 로그인'을 쓰면 Google 계정 식별자·이메일·이름(표시 이름으로 저장)",
      "· 계좌·포트폴리오 — 계좌 이름, 명의 구분(본인·배우자·자녀·기타), 계좌 유형(연금저축·IRP·DC·ISA·일반·자녀), 보유 종목·수량·목표 비중·평균단가, 매수·매도 기록, 배당 기록과 메모, 배당 일정과 메모, 관심종목, 수익률 계산을 위한 계좌별 일별 평가금액·원가 기록",
      "· 연금·은퇴 계획 — 출생연도, 배우자 출생연도, 은퇴 나이, 목표 월 현금흐름, 기대수익률, 총급여 구간(본인·배우자), 월 적립 예산, 연도별 연금 계좌 납입액, 국민연금·퇴직연금·연금보험의 예상 월 수령액과 수령 기간(본인·배우자 구분), 메모",
      "· 자녀 기록 — 자녀 이름과 생년월일, 증여·입금 기록(금액, 날짜, 유형, 증여세 신고 여부·신고일, 메모), 자녀 계좌 보유 종목",
      "· 텔레그램 리포트 — 이용자가 웹 설정에서 발급한 연결 코드를 봇에게 보낸 텔레그램 채팅의 chat_id와 연결 확인 시각(연결 코드는 해시로만 잠시 보관하며 10분 뒤 만료)",
      "· 보안 — 가입·로그인·비밀번호 변경·계정 삭제 시도 횟수를 제한하기 위한 IP 주소, 이메일 또는 사용자 식별자",
      "배우자·자녀 등 가족의 정보는 이용자가 직접 입력합니다. 가족에게 알리고 필요한 범위에서만 입력해 주세요.",
      "수집하지 않는 정보: 위치, 연락처, 사진·파일, 마이크·카메라, 광고 식별자 등 기기 식별자, 결제 정보, 증권사·은행 계좌번호와 계좌 비밀번호, 주민등록번호. 광고·분석·오류 수집 SDK를 쓰지 않습니다. 증권사·은행 계좌와 연결하지 않습니다.",
    ],
  },
  {
    title: "2. 이용 목적",
    body: [
      "수집한 정보는 계정 로그인, 이용자가 입력한 포트폴리오·배당 현금흐름·연금 계획 계산과 표시, 자녀 증여 기록 관리, 이용자가 요청한 텔레그램 리포트 전송, 서비스 보안과 오류 대응에만 사용합니다.",
      "가족연금계획은 이용자가 입력한 보유 내역과 공개 시세·뉴스를 정리해 보여 주는 도구입니다. 특정 금융상품의 매수·매도 권유, 투자 자문, 중개, 수익 보장 기능을 제공하지 않습니다.",
    ],
  },
  {
    title: "3. 처리 위탁 및 외부 전송",
    body: [
      "서비스 운영을 위해 아래 업체를 이용하며, 각 업체에는 해당 기능에 필요한 데이터만 전달됩니다.",
      "· Vercel Inc. — 웹 서비스·API 호스팅. 모든 요청(입력한 데이터, IP 주소 포함)이 이 서버를 거쳐 처리됩니다.",
      "· Neon, Inc. — 데이터베이스. 1항의 저장 정보 전체가 저장됩니다.",
      "· Upstash, Inc. — 가입·로그인·비밀번호 변경·계정 삭제 시도 횟수 제한. IP 주소, 이메일 또는 사용자 식별자로 만든 키와 시도 횟수가 저장됩니다(운영자가 이 기능을 설정한 경우. 설정하지 않으면 서버 메모리에서만 처리).",
      "· Google LLC — 'Google로 로그인'을 선택한 경우에만 인증을 처리하고 Google 계정의 이메일·이름·식별자를 전달받습니다.",
      "· Telegram — 이용자가 대시보드에서 텔레그램 리포트를 보내면, 연결 코드로 본인 채팅임을 확인한 chat_id로만 해당 계좌의 이름·평가금액·원가·손익·기간별 수익률이 전송됩니다. 연결은 웹 설정에서 언제든 해제할 수 있습니다. 이미 전송된 메시지는 서비스에서 삭제할 수 없습니다.",
      "· OpenAI — 운영자 전용 기능에만 쓰입니다. 운영자가 허용한 텔레그램 채팅에서 봇에 보낸 질문 문장, 운영자 계정의 관심종목 이름·시세와 공개 뉴스 제목이 요약 생성을 위해 전달됩니다. 일반 이용자의 계정 데이터는 OpenAI로 보내지 않습니다.",
      "· 공개 시세·뉴스 조회 — 네이버 금융, Yahoo Finance, Google 뉴스 RSS, 한국투자증권 Open API에는 서버가 종목 코드·종목명·검색어만 보내 시세와 뉴스를 조회합니다. 이메일 등 이용자 식별 정보는 보내지 않습니다. 한국투자증권 API는 운영자 키로 시세만 조회하며 이용자 계좌와 연결되지 않습니다.",
      "· jsDelivr — 웹 화면의 글꼴(Pretendard)을 웹 브라우저가 직접 내려받으며, 이 과정에서 브라우저의 IP 주소가 전달됩니다. 모바일 앱은 해당하지 않습니다.",
      "광고 목적으로 개인정보를 판매하거나 공유하지 않습니다.",
    ],
  },
  {
    title: "4. 보관 및 삭제",
    body: [
      "계정과 입력한 기록은 이용자가 계정을 삭제할 때까지 데이터베이스에 보관됩니다. 계정을 삭제하면 계정과 연결된 데이터베이스의 기록(포트폴리오, 배당, 연금, 자녀 기록, 텔레그램 chat_id 등)이 함께 삭제됩니다.",
      "이미 텔레그램으로 전송된 메시지, 각 업체의 로그와 백업은 이 삭제 범위에 포함되지 않으며 각 업체의 정책에 따릅니다.",
      "앱·웹의 설정 화면에서 직접 삭제할 수 있으며, 자세한 방법은 계정 및 데이터 삭제 안내 페이지에서 확인할 수 있습니다.",
    ],
  },
  {
    title: "5. 이용자 권리",
    body: [
      "이용자는 본인이 입력한 정보를 웹 화면에서 열람·수정·삭제할 수 있습니다. 계정과 데이터는 설정 화면에서 직접 삭제할 수 있으며, 직접 삭제가 어려우면 계정 및 데이터 삭제 안내 페이지의 방법으로 요청할 수 있습니다.",
    ],
  },
  {
    title: "6. 아동 및 민감정보",
    body: [
      "가족연금계획은 성인 이용자가 쓰는 개인 기록 도구입니다. 자녀 기록 기능은 보호자가 직접 입력하고 관리하는 기능이며, 아동이 직접 가입하거나 정보를 입력하도록 설계하지 않았습니다.",
      "주민등록번호, 도장 이미지 등 고위험 정보를 입력하도록 요구하지 않습니다.",
    ],
  },
  {
    title: "7. 보안",
    body: [
      "서비스는 HTTPS 통신을 사용하고, 비밀번호는 해시로만 저장하며, 모바일 로그인 세션은 기기의 보안 저장소에 저장합니다. 이용자는 기기 잠금, 안전한 비밀번호 관리, 공용 기기 로그아웃으로 계정을 보호해 주세요.",
    ],
  },
  {
    title: "8. 문의",
    body: [
      supportEmail
        ? `개인정보 관련 문의는 ${supportEmail}로 보내주세요.`
        : "개인정보 관련 문의는 Google Play·App Store 등록정보에 표시된 개발자 연락처 또는 앱 운영자에게 요청할 수 있습니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-12 text-foreground dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          가족연금계획
        </Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-dark-header dark:text-white">개인정보처리방침</h1>
        <p className="mt-4 text-sm text-ink-mute dark:text-zinc-400">시행일: 2026년 11월 27일</p>
        <p className="mt-6 rounded-2xl border border-hairline bg-white p-5 text-sm leading-7 text-ink-mute shadow-card dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          가족연금계획은 연금 ETF, 배당, 은퇴 목표, 자녀 증여 기록을 이용자가 직접 입력하고 관리하는 개인 기록 서비스입니다. 이 방침은 웹 서비스와 모바일 앱에 적용됩니다.
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
          <p className="mt-3 text-sm leading-7 text-indigo-50">설정 화면에서 직접 삭제하는 방법과 이메일 요청 방법은 별도 안내 페이지에서 확인할 수 있습니다.</p>
          <Link href="/account-deletion" className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700">
            삭제 안내 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
