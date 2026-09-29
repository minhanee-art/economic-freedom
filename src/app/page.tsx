import Link from "next/link";

const productPillars = [
  {
    title: "연금 포트폴리오",
    body: "계좌별 보유 종목, 설정 비중, 현재 비중, 손익을 한 화면에서 정리합니다.",
    href: "/dashboard",
    cta: "대시보드 보기",
  },
  {
    title: "배당 현금흐름",
    body: "누적 배당과 월별 분배금 흐름을 확인하고 은퇴 후 현금흐름 목표와 연결합니다.",
    href: "/dashboard/dividend",
    cta: "배당 관리",
  },
  {
    title: "자녀 증여 관리",
    body: "일괄 증여, 유기정기금 방식, 신고 여부, 투자 증빙 기록을 함께 관리합니다.",
    href: "/dashboard/children",
    cta: "증여 기록",
  },
  {
    title: "ETF 비교와 리밸런싱",
    body: "ETF 비교, 테마별 비중, 부족한 자산군을 확인해 다음 매수 결정을 돕습니다.",
    href: "/dashboard/compare",
    cta: "ETF 비교",
  },
];

const familyTruths = [
  {
    title: "증여만 하면 끝이 아닙니다",
    body: "자녀 명의 계좌, 신고 접수증, 입금 이행 내역, 투자 판단 기록까지 남겨야 나중에 설명이 쉬워집니다.",
  },
  {
    title: "목표 없는 적립은 흐려집니다",
    body: "연금, 배당, 자녀계좌를 따로 보지 않고 같은 목표 안에서 관리해야 장기 계획이 흔들리지 않습니다.",
  },
  {
    title: "투자 기록도 교육입니다",
    body: "왜 샀는지, 얼마나 보유할지, 언제 리밸런싱할지를 짧게 남기면 가족 금융교육의 자료가 됩니다.",
  },
  {
    title: "세금과 수익률은 같이 봐야 합니다",
    body: "수익이 커질수록 자금출처, 증여 신고, 계좌 분리 같은 기본 증빙이 더 중요해집니다.",
  },
];

const workflows = [
  "부모 계좌에서 자녀 계좌로 이체한 내역 기록",
  "유기정기금 평가액과 신고기한 확인",
  "보유 종목과 매수 이유를 자녀별로 보관",
  "연금 ETF 목표 비중과 현재 비중 비교",
  "배당 현금흐름과 은퇴 목표 연결",
  "모바일 앱에서 주요 지표 확인",
];

const stats = [
  ["연금", "ETF 중심 장기 포트폴리오"],
  ["배당", "월별 현금흐름 관리"],
  ["자녀", "증여 신고와 투자 증빙"],
  ["모바일", "Play Store 출시 준비 중"],
];

function PreviewCard() {
  return (
    <div className="rounded-[28px] border border-indigo-100 bg-white p-4 shadow-float dark:border-indigo-900/50 dark:bg-zinc-950">
      <div className="rounded-[22px] bg-canvas-soft p-4 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-hairline pb-3 dark:border-zinc-800">
          <div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">경제적 자유</p>
            <p className="mt-1 text-lg font-bold text-dark-header dark:text-white">가족 자산 현황</p>
          </div>
          <div className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">실행 중</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-3 dark:bg-zinc-950">
            <p className="text-xs text-ink-mute dark:text-zinc-400">총 평가금액</p>
            <p className="mt-2 text-xl font-bold text-dark-header dark:text-white">128,400,000원</p>
            <p className="mt-1 text-xs font-semibold text-emerald-600">+7.8%</p>
          </div>
          <div className="rounded-2xl bg-white p-3 dark:bg-zinc-950">
            <p className="text-xs text-ink-mute dark:text-zinc-400">월 배당 목표</p>
            <p className="mt-2 text-xl font-bold text-dark-header dark:text-white">620,000원</p>
            <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">목표의 41%</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-3 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-dark-header dark:text-white">자녀 증여 기록</span>
            <span className="text-indigo-600 dark:text-indigo-400">신고기한 확인</span>
          </div>
          <div className="mt-3 space-y-2">
            {["월 160,000원 정기금", "유기정기금 평가명세서", "투자교육 메모"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs dark:bg-indigo-950/40">
                <span className="font-medium text-dark-header dark:text-zinc-100">{item}</span>
                <span className="text-indigo-600 dark:text-indigo-400">관리</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-background/90 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-base font-black tracking-tight text-dark-header dark:text-white">
            경제적 자유
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-ink-mute dark:text-zinc-400 md:flex">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">기능</a>
            <a href="#family" className="hover:text-indigo-600 dark:hover:text-indigo-400">자녀자산</a>
            <a href="#workflow" className="hover:text-indigo-600 dark:hover:text-indigo-400">관리흐름</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink hover:bg-white dark:text-zinc-200 dark:hover:bg-zinc-900">
              로그인
            </Link>
            <Link href="/signup" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-indigo-700 active:scale-[0.98]">
              시작하기
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-20">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-600 shadow-card dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-400">
            연금, 배당, 자녀 증여를 한 계정에서
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-dark-header dark:text-white sm:text-5xl lg:text-6xl">
            가족의 장기 자산을 기록하고 증명하는 금융 관리 앱
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-mute dark:text-zinc-400">
            참고 사이트의 가족 투자교육 흐름을 우리 서비스에 맞게 재구성했습니다. 연금 ETF, 배당, 자녀 증여 증빙을 함께 관리합니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-full bg-indigo-600 px-7 text-sm font-bold text-white shadow-float transition hover:bg-indigo-700 active:scale-[0.98]">
              대시보드 열기
            </Link>
            <Link href="/dashboard/children" className="inline-flex h-12 items-center justify-center rounded-full border border-hairline bg-white px-7 text-sm font-bold text-ink shadow-card transition hover:shadow-float active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
              자녀 증여 관리
            </Link>
          </div>
        </div>
        <PreviewCard />
      </section>

      <section className="border-y border-hairline bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-6 sm:px-6 md:grid-cols-4 lg:px-8">
          {stats.map(([label, value]) => (
            <div key={label} className="p-4">
              <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{label}</p>
              <p className="mt-1 text-sm text-ink-mute dark:text-zinc-400">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight text-dark-header dark:text-white sm:text-4xl">매일 쓰는 가족 금융 허브</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-mute dark:text-zinc-400">
            참고 사이트처럼 기능을 한곳에 모으되, 우리 서비스는 실제 보유자산 관리와 신고 기록에 집중합니다.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {productPillars.map((item, index) => (
            <Link
              key={item.title}
              href={item.href}
              className={[
                "group rounded-[24px] border p-5 transition hover:-translate-y-1 hover:shadow-float active:scale-[0.99]",
                index === 0
                  ? "border-indigo-200 bg-indigo-600 text-white dark:border-indigo-700"
                  : "border-hairline bg-white text-ink dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
              ].join(" ")}
            >
              <p className={index === 0 ? "text-lg font-black" : "text-lg font-black text-dark-header dark:text-white"}>{item.title}</p>
              <p className={index === 0 ? "mt-4 text-sm leading-relaxed text-indigo-50" : "mt-4 text-sm leading-relaxed text-ink-mute dark:text-zinc-400"}>{item.body}</p>
              <p className={index === 0 ? "mt-6 text-sm font-bold text-white" : "mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400"}>{item.cta}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="family" className="bg-white py-20 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-dark-header dark:text-white sm:text-4xl">자녀 증여는 신고와 교육 기록이 같이 가야 합니다</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-mute dark:text-zinc-400">
              유기정기금 계산, 신고 가이드, 자녀 계좌 투자 메모를 연결해 나중에 설명 가능한 기록을 만듭니다.
            </p>
            <Link href="/dashboard/children" className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-6 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]">
              자녀 관리 시작
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {familyTruths.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-hairline bg-canvas-soft p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-lg font-black text-dark-header dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-mute dark:text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-indigo-100 bg-white p-6 shadow-card dark:border-indigo-900/40 dark:bg-zinc-900 sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-dark-header dark:text-white sm:text-4xl">우리 페이지에 적용한 관리 흐름</h2>
              <p className="mt-4 text-base leading-relaxed text-ink-mute dark:text-zinc-400">
                참고 사이트의 넓은 자료 구조를 그대로 복제하지 않고, 우리 앱에서 바로 쓸 수 있는 기록 중심 흐름으로 압축했습니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workflows.map((item, index) => (
                <div key={item} className="rounded-2xl border border-hairline bg-background p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-ink dark:text-zinc-100">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-indigo-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-black tracking-tight">경제적 자유를 가족 단위로 관리하세요</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100">
              웹 대시보드와 모바일 앱을 함께 준비 중입니다. 먼저 웹에서 자산과 증여 기록을 정리해두세요.
            </p>
          </div>
          <Link href="/login" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-7 text-sm font-black text-indigo-950 transition hover:bg-indigo-50 active:scale-[0.98]">
            로그인하기
          </Link>
        </div>
      </section>
    </main>
  );
}
