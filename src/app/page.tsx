import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/guide/public-site";
import { EmojiLine, EmojiList, InfoTip } from "@/components/ui/info-tip";

// 랜딩. 이 제품이 실제로 계산해 보여 주는 두 화면(연금 설계의 '은퇴 목표와 예상 월 현금흐름',
// '연금계좌 세액공제 진행률')을 같은 구조로 본뜬 예시를 보여 준다.
// - 구조 출처: src/components/pension/retirement-goal-section.tsx, contribution-section.tsx
// 예시의 숫자는 가상의 계정 값이며 화면마다 '예시'라고 적는다.

const primaryButton =
  "inline-flex h-12 items-center justify-center bg-indigo-500 px-6 text-base font-bold text-white transition-colors hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
const secondaryButton =
  "inline-flex h-12 items-center justify-center border border-zinc-300 bg-white px-6 text-base font-bold text-ink transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800";

const h2 = "text-2xl font-bold tracking-tight text-dark-header text-balance break-keep dark:text-white sm:text-3xl";
const lead = "mt-4 text-base leading-7 text-zinc-600 break-keep dark:text-zinc-400";

function ExampleFrame({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <figure className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm font-bold text-dark-header break-keep dark:text-white">{title}</p>
        <p className="shrink-0 border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          예시
        </p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
      <figcaption className="border-t border-zinc-200 px-4 py-3 text-xs leading-5 text-zinc-600 break-keep dark:border-zinc-800 dark:text-zinc-400">
        {note}
      </figcaption>
    </figure>
  );
}

function Progress({ label, value, fill }: { label: string; value: string; fill: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink tabular-nums dark:text-zinc-200">{label}</span>
        <span className="font-semibold text-ink tabular-nums dark:text-zinc-200">{value}</span>
      </div>
      <div className="mt-2 h-2 bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full bg-indigo-500 ${fill}`} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-bold text-dark-header tabular-nums dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

const cashflowRows = [
  { age: "65세", national: "110만", retirement: "45만", personal: "69.6만", dividend: "53.5만", total: "278.1만" },
  { age: "70세", national: "175만", retirement: "45만", personal: "69.6만", dividend: "53.5만", total: "343.1만" },
  { age: "85세", national: "175만", retirement: "45만", personal: "0", dividend: "53.5만", total: "273.5만" },
];

function CashflowExample() {
  return (
    <ExampleFrame
      title="은퇴 목표와 예상 월 현금흐름"
      note="가상의 부부 계정으로 만든 예시입니다. 실제 화면은 입력한 계좌·연금 예상액·배당 기록으로 계산하며, 세전·현재 가치 기준 참고용입니다."
    >
      <Progress label="65세 예상 월 278.1만 / 목표 250만" value="111%" fill="w-full" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="1층 국민연금" value="110만" />
        <Stat label="2층 퇴직연금" value="45만" />
        <Stat label="3층 개인연금" value="69.6만" />
        <Stat label="배당" value="53.5만" hint="최근 1년 기준" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-80 text-right text-xs tabular-nums sm:text-sm">
          <caption className="sr-only">나이별 예상 월 현금흐름 예시</caption>
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <th scope="col" className="py-2 text-left font-medium">나이</th>
              <th scope="col" className="py-2 font-medium">국민연금</th>
              <th scope="col" className="py-2 font-medium">퇴직연금</th>
              <th scope="col" className="py-2 font-medium">개인연금</th>
              <th scope="col" className="py-2 font-medium">배당</th>
              <th scope="col" className="py-2 font-medium">합계</th>
            </tr>
          </thead>
          <tbody className="text-ink dark:text-zinc-200">
            {cashflowRows.map((row) => (
              <tr key={row.age} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <th scope="row" className="py-2 text-left font-medium">{row.age}</th>
                <td className="py-2">{row.national}</td>
                <td className="py-2">{row.retirement}</td>
                <td className="py-2">{row.personal}</td>
                <td className="py-2">{row.dividend}</td>
                <td className="py-2 font-bold text-dark-header dark:text-white">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-zinc-600 break-keep dark:text-zinc-400">
        본인 65세, 배우자 63세부터 국민연금을 받는다고 입력한 경우입니다. 개인연금은 연금계좌 평가액을 20년에 나눠 받는다고 가정했습니다.
      </p>
    </ExampleFrame>
  );
}

function ContributionExample() {
  return (
    <ExampleFrame
      title="2026년 연금계좌 세액공제 진행률"
      note="가상의 계정으로 만든 예시입니다. 예상 세액공제액은 결정세액보다 클 수 없고, 다른 공제·감면에 따라 실제 환급액은 달라집니다."
    >
      <Progress label="가족 합계 공제 대상 720만 / 1,800만" value="40%" fill="w-2/5" />
      <dl className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink dark:text-zinc-200">
            본인 연금저축 <span className="text-zinc-600 dark:text-zinc-400">· 공제율 16.5%</span>
          </dt>
          <dd className="font-semibold text-ink tabular-nums dark:text-zinc-200">420만 / 900만</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink dark:text-zinc-200">
            배우자 IRP <span className="text-zinc-600 dark:text-zinc-400">· 공제율 13.2%</span>
          </dt>
          <dd className="font-semibold text-ink tabular-nums dark:text-zinc-200">300만 / 900만</dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="예상 세액공제액" value="1,089,000원" />
        <Stat label="남은 공제 한도" value="1,080만" />
      </div>
    </ExampleFrame>
  );
}

const steps = [
  {
    emoji: "🏦",
    title: "계좌를 등록하고 유형을 정합니다",
    body: "연금저축·IRP·DC·ISA·일반 계좌의 유형과 명의(본인·배우자)를 지정합니다.",
    tip: "세액공제와 개인연금 계산이 이 정보로 나뉩니다.",
  },
  {
    emoji: "💸",
    title: "매수와 배당을 기록합니다",
    body: "직접 입력하거나 증권사 엑셀·CSV 거래내역을 가져옵니다.",
    tip: "보유 수량과 평균단가는 이 기록으로 계산합니다.",
  },
  {
    emoji: "📅",
    title: "국민연금·퇴직연금 예상액을 적습니다",
    body: "예상 월 수령액과 수령 시작 나이를 본인·배우자별로 옮겨 적습니다.",
    tip: "국민연금공단 '내 연금 알아보기'나 통합연금포털에서 조회할 수 있습니다.",
  },
  {
    emoji: "🌴",
    title: "은퇴 나이와 목표 월 생활비를 정합니다",
    body: "나이별 예상 월 현금흐름과 목표 대비 부족액이 표로 나옵니다.",
    tip: "올해 납입액을 적으면 세액공제 진행률도 함께 갱신됩니다.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground dark:bg-zinc-950">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto grid max-w-280 grid-cols-1 gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:pt-16">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-dark-header text-balance break-keep dark:text-white sm:text-4xl lg:text-5xl">
              은퇴하면 매달 얼마가 들어올지, 직접 남긴 기록으로 계산합니다
            </h1>
            <EmojiList className="mt-5 max-w-prose text-base sm:text-lg">
              <EmojiLine emoji="🌴">나이별 월 현금흐름을 본인·배우자 기준으로 계산</EmojiLine>
              <EmojiLine emoji="🧾">올해 연금저축·IRP 세액공제 한도 채움 정도</EmojiLine>
              <EmojiLine emoji="💸">
                국민연금·퇴직연금 예상액, 계좌 평가액, 배당 기록을 합산
              </EmojiLine>
            </EmojiList>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={primaryButton}>
                회원가입
              </Link>
              <Link href="/login" className={secondaryButton}>
                로그인
              </Link>
            </div>
            <div className="mt-8 max-w-prose border border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-ink break-keep dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <p>
                <strong className="font-bold text-dark-header dark:text-white">기록과 계산만 하는 도구입니다.</strong>{" "}
                주문을 실행하지 않습니다. 투자 자문이나 중개를 하지 않으며, 세액과 수령액 계산은 참고용입니다.
              </p>
            </div>
          </div>
          <CashflowExample />
        </section>

        <section aria-labelledby="tax-credit" className="border-t border-hairline bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto grid max-w-280 grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 id="tax-credit" className={h2}>
                올해 연금계좌 세액공제 한도를 얼마나 채웠는지 봅니다
              </h2>
              <EmojiList className="mt-5 text-base">
                <EmojiLine emoji="🧾">
                  연금저축 600만원, IRP·DC 합산 900만원까지가 한 사람의 공제 대상
                </EmojiLine>
                <EmojiLine emoji="💰">
                  계좌별 올해 납입액으로 공제 대상 금액·예상 세액공제액·남은 한도 계산
                  <InfoTip label="공제율 설명" align="start">
                    공제율은 명의자의 총급여 구간에 따라 16.5% 또는 13.2%(지방소득세 포함)로 계산합니다.
                  </InfoTip>
                </EmojiLine>
              </EmojiList>
            </div>
            <ContributionExample />
          </div>
        </section>

        <section aria-labelledby="records" className="border-t border-hairline dark:border-zinc-800">
          <div className="mx-auto max-w-280 px-4 py-16 sm:px-6">
            <h2 id="records" className={`${h2} max-w-prose`}>
              기록을 채우는 순서
            </h2>
            <p className={`${lead} max-w-prose`}>
              계좌를 연결하지 않으므로 거래·배당·연금 예상액은 직접 입력합니다.
              <InfoTip label="평가금액 계산 설명" align="start">
                평가금액은 기록한 보유 수량에 공개 시세를 곱해 계산합니다.
              </InfoTip>
            </p>
            <ol className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 text-base font-bold text-indigo-600 tabular-nums dark:text-indigo-300">
                    {index + 1}.
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-dark-header break-keep dark:text-white">
                      {step.title}
                      <InfoTip label={`${step.title} 설명`} align="start">
                        {step.tip}
                      </InfoTip>
                    </h3>
                    <EmojiList className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                      <EmojiLine emoji={step.emoji}>{step.body}</EmojiLine>
                    </EmojiList>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="more" className="border-t border-hairline bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto grid max-w-280 grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 id="more" className={h2}>
                그 밖에 할 수 있는 일
              </h2>
              <EmojiList className="mt-6 space-y-5 text-base break-keep dark:text-zinc-300">
                <EmojiLine emoji="🎁">
                  <strong className="font-bold text-dark-header dark:text-white">자녀 증여 기록.</strong> 증여·입금과 증여세 신고 여부를 자녀별로 적어 둡니다.
                </EmojiLine>
                <EmojiLine emoji="🔔">
                  <strong className="font-bold text-dark-header dark:text-white">텔레그램 리포트.</strong> 평가금액·손익·기간별 수익률을 내 텔레그램 채팅으로 받습니다.{" "}
                  <Link href="/guide/telegram" className="font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-300">
                    연결 방법
                  </Link>
                </EmojiLine>
              </EmojiList>
            </div>
            <div>
              <h2 className={h2}>입력한 데이터</h2>
              <EmojiList className="mt-4 text-base">
                <EmojiLine emoji="🔒">계좌번호·계좌 비밀번호는 받지 않습니다</EmojiLine>
                <EmojiLine emoji="🗑️">계정을 삭제하면 입력한 기록이 함께 지워집니다</EmojiLine>
              </EmojiList>
              <p className="mt-4 flex flex-wrap gap-x-5 text-base">
                <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-300">
                  개인정보처리방침
                </Link>
                <Link href="/account-deletion" className="inline-flex min-h-11 items-center font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-300">
                  계정 및 데이터 삭제 안내
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-hairline dark:border-zinc-800">
          <div className="mx-auto flex max-w-280 flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="text-xl font-bold text-dark-header break-keep dark:text-white">
              계정을 만들고 첫 계좌부터 등록해 보세요.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={primaryButton}>
                회원가입
              </Link>
              <Link href="/login" className={secondaryButton}>
                로그인
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
