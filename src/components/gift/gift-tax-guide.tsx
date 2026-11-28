// 증여세 신고 가이드 — 참고용 일반 정보. 개별 상황에 따라 다를 수 있으므로
// 실제 신고 전 국세청 홈택스(hometax.go.kr) 자동계산 또는 세무사 상담으로 반드시 확인할 것.
// 요점은 이모지 줄·짧은 표로 두고, 세부 근거(예외·예시)는 ⓘ 말풍선, 긴 절차는 접는 구역(<details>)에 둔다.
"use client";

import type { ReactNode } from "react";
import { EmojiLine, EmojiList, InfoTip } from "@/components/ui/info-tip";

const BRACKET_ROWS = [
  { range: "1억원 이하", rate: "10%", deduction: "없음" },
  { range: "1억원 초과 ~ 5억원 이하", rate: "20%", deduction: "1천만원" },
  { range: "5억원 초과 ~ 10억원 이하", rate: "30%", deduction: "6천만원" },
  { range: "10억원 초과 ~ 30억원 이하", rate: "40%", deduction: "1억 6천만원" },
  { range: "30억원 초과", rate: "50%", deduction: "4억 6천만원" },
];

const HOMETAX_STEPS: ReactNode[] = [
  <>
    자녀 명의 홈택스 계정을 준비합니다.
    <InfoTip label="자녀 계정 설명">미성년자는 법정대리인 휴대폰 인증으로 가입·로그인할 수 있습니다.</InfoTip>
  </>,
  "세금신고 → 증여세 신고 → 정기신고로 들어갑니다.",
  <>
    증여자(부모)와 수증자(자녀) 정보를 입력합니다. 신고 기준일은 <b>최초 입금일</b>입니다.
  </>,
  "증여재산가액은 유기정기금 평가명세서의 할인평가액 기준으로 입력합니다.",
  <>
    증여재산명세를 확인하고 공제 적용 후 <b>납부세액이 0원</b>인지 봅니다.
    <InfoTip label="납부세액 설명">공제한도를 넘으면 산출세액이 생길 수 있습니다.</InfoTip>
  </>,
  <>
    신고서 제출 뒤 부속서류 제출 메뉴에서 가족관계증명서, 통장 사본, 증여계약서, 유기정기금 평가명세서를 PDF로 첨부합니다.
  </>,
  "신고 완료 화면과 접수증을 저장하고, '입금/증여 기록'에서 '신고완료'를 눌러 표시합니다.",
];

const INSTALLMENT_DOC_STEPS: ReactNode[] = [
  "매월 같은 금액을 같은 날짜에 자녀 계좌로 자동이체합니다. 첫 입금일이 증여 시작일입니다.",
  "증여계약서에 앞으로 몇 년간 매월 얼마를 지급할지 명확히 적습니다.",
  "평가명세서에 월 증여액, 지급기간, 증여 시작일을 넣어 할인평가액을 계산합니다.",
  <>
    미성년 자녀는 최근 10년 공제한도 2,000만원에서 기증여액을 뺀 잔여 한도 안으로 할인평가액을 맞춥니다.
    <InfoTip label="월 19만원 예시 설명">
      월 19만원씩 10년은 원금 합계 2,280만원이지만 현재가치 할인평가로 공제한도 안에 맞추는 대표 예시입니다. 정확한 한도는 홈택스 또는 세무사에게 확인하세요.
    </InfoTip>
  </>,
  "계산 결과 파일을 PDF로 변환해 홈택스 첨부서류로 보관합니다.",
];

const CHILD_INVESTMENT_RECORDS: { emoji: string; title: string; tip: string }[] = [
  { emoji: "🏦", title: "자녀 계좌 입금 내역", tip: "부모 계좌 → 자녀 계좌로 이동한 금액과 날짜를 증명합니다." },
  { emoji: "🧾", title: "증여 신고 접수증·첨부서류 PDF", tip: "나중에 자금출처를 설명할 때 가장 먼저 보여줄 핵심 자료입니다." },
  { emoji: "📅", title: "정기 이체 이행표", tip: "유기정기금 계약서의 월 납입액·날짜와 실제 입금 내역이 일치하는지 확인합니다." },
  { emoji: "📚", title: "투자 교육 기록", tip: "자녀가 어떤 상품을 왜 선택했는지 가족회의·학습노트·퀴즈·대화 기록으로 남깁니다." },
  { emoji: "⚖️", title: "매수·매도 판단 기록", tip: "부모가 대신 매매했다는 오해를 줄이도록 자녀의 의견, 리밸런싱 이유, 보유 목적을 짧게 적습니다." },
  { emoji: "📈", title: "연 1회 결산 기록", tip: "평가금액, 수익률, 배당금, 다음 해 목표를 저장해 장기 투자 흐름을 설명할 수 있게 합니다." },
];

/** 접는 구역 — 첫 구역만 펼쳐 두고 나머지는 제목만 보이게 한다. */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="group overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
        {title}
        <svg aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1 text-sm text-zinc-600 dark:text-zinc-300">{children}</div>
    </details>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 font-medium text-zinc-800 dark:text-zinc-100">{children}</p>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 leading-relaxed">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function GiftTaxGuide() {
  return (
    <div className="space-y-3">
      <div role="note" className="flex gap-2 border border-caution/30 bg-caution-soft px-4 py-3 text-xs leading-relaxed text-caution">
        <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <p>
          참고용 일반 안내입니다. 실제 신고 전 <b>국세청 홈택스(hometax.go.kr)</b> 자동계산 또는 <b>세무사 상담</b>으로 확인하세요.
          <InfoTip label="안내 한계 설명" align="end">
            증여자·수증자 관계, 기존 증여 이력 같은 개별 상황에 따라 결과가 달라질 수 있고, 세법 개정으로 공제한도·세율·이자율이 바뀔 수 있습니다.
          </InfoTip>
        </p>
      </div>

      <Section title="기본 정보 — 공제한도 · 신고기한 · 세율" defaultOpen>
        <EmojiList className="text-zinc-600 dark:text-zinc-300">
          <EmojiLine emoji="🎁">
            증여재산공제(직계존속 → 직계비속, 10년 합산): 미성년(만 19세 미만) <b>2,000만원</b> · 성년(만 19세 이상) <b>5,000만원</b>
            <InfoTip label="10년 합산 설명" align="start">
              증여일 기준 최근 10년 내 같은 사람(부모)에게 받은 증여를 모두 합산합니다. 10년이 지나면 한도가 다시 채워집니다.
            </InfoTip>
          </EmojiLine>
          <EmojiLine emoji="📅">
            신고기한: 증여일이 속하는 달의 말일부터 <b>3개월 이내</b> 신고·납부
          </EmojiLine>
          <EmojiLine emoji="🧾">
            기한 내 자진신고 시 산출세액의 <b>3% 세액공제</b>
          </EmojiLine>
          <EmojiLine emoji="⚠️">
            무신고·과소신고 시 가산세(무신고 20%, 부정 40% 등) + 납부지연가산세
          </EmojiLine>
          <EmojiLine emoji="📎">
            구비서류: 증여세과세표준신고 및 자진납부계산서 · 증여재산 및 평가명세서 · 가족관계증명서 · 계좌이체 내역(통장사본)
          </EmojiLine>
        </EmojiList>

        <div>
          <SubTitle>증여세 세율 (초과누진세율)</SubTitle>
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">표가 넓으면 좌우로 밀어 보세요</p>
          <div tabIndex={0} role="region" aria-label="증여세 세율 표" className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">증여세 과세표준별 세율과 누진공제액</caption>
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th scope="col" className="px-1 py-1.5 text-left font-medium">과세표준</th>
                  <th scope="col" className="px-1 py-1.5 text-right font-medium">세율</th>
                  <th scope="col" className="px-1 py-1.5 text-right font-medium">누진공제액</th>
                </tr>
              </thead>
              <tbody>
                {BRACKET_ROWS.map((r) => (
                  <tr key={r.range} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-1 py-1.5">{r.range}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{r.rate}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{r.deduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">산출세액 = 과세표준 × 세율 − 누진공제액</p>
        </div>
      </Section>

      <Section title="1-1. 일괄 증여 시 처리 방법">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">목돈을 한 번에 자녀 계좌로 이체하는 경우</p>
        <Steps
          items={[
            <>
              <b>자녀 본인 명의</b> 계좌로 이체합니다.
              <InfoTip label="본인 명의 계좌 설명">부모가 실질적으로 관리하는 차명계좌는 증여로 인정되지 않을 수 있습니다.</InfoTip>
            </>,
            <>
              실제 <b>입금일이 곧 증여일</b>입니다.
            </>,
            <>
              신고기한은 입금월 말일부터 <b>3개월 이내</b>입니다.
              <InfoTip label="신고기한 예시">예) 3월 15일 입금 → 3월 31일부터 기산 → 6월 30일까지 신고.</InfoTip>
            </>,
            <>
              과세표준 = 증여금액 − 공제한도(10년 내 기증여액 포함, 미성년 2,000만원 / 성년 5,000만원). 공제 이내면 산출세액은 <b>0원</b>입니다.
            </>,
            <>
              공제 이내면 신고 의무는 없습니다.
              <InfoTip label="신고해 두는 이유">신고해 두면 나중에 자금출처를 소명할 때(취업·주택자금 등) 증여 사실과 날짜를 보여 주는 자료가 됩니다.</InfoTip>
            </>,
            <>
              공제 초과분이 있을 때만 세액 계산: 과세표준 × 세율 − 누진공제액. 기한 내 신고하면 3% 세액공제가 더해집니다.
            </>,
            <>
              홈택스 신고: 자녀 명의 로그인 → 세금신고 → 증여세 → 정기신고 → 증여자·수증자 정보 → 증여재산가액(이체금액) → 증빙서류 PDF 첨부 → 제출 → 납부.
              <InfoTip label="홈택스 신고 세부">
                미성년 저연령은 법정대리인이 대리 신고할 수 있습니다. 10년 내 기증여재산 합산 여부를 확인하면 세액이 자동계산되고, 증빙은 가족관계증명서·통장사본입니다. 납부는 국세청 가상계좌 등으로 합니다.
              </InfoTip>
            </>,
            "'입금/증여 기록'에 유형을 '일괄 증여'로 추가하고, 신고를 마치면 '신고완료'를 눌러 표시합니다.",
          ]}
        />
      </Section>

      <Section title="1-2. 분할 증여(적립식) 시 처리 방법 — 적금처럼 매달 넣는 경우">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">매달 자녀 계좌에 일정 금액을 입금하는 경우 두 가지 방식이 있습니다.</p>

        <div>
          <SubTitle>방식 A. 사전 신고 없이 매회 개별 증여로 처리</SubTitle>
          <EmojiLine emoji="⚠️" as="p" className="leading-relaxed">
            10년 누적액이 공제한도(2,000만원)를 넘을 때 초과분만 신고하는 방식입니다. 정기적·계획적 입금을 &quot;처음부터 예정된 증여&quot;로 보면
            자녀가 돈을 인출·사용하는 시점에 <b>그때까지의 누적 원리금 전체를 한꺼번에 증여로 보아 가산세를 포함해 과세</b>할 위험이 있습니다.
          </EmojiLine>
        </div>

        <div>
          <SubTitle>방식 B. 유기정기금 평가로 사전 1회 신고</SubTitle>
          <p className="mb-2 leading-relaxed">앞으로 줄 금액 전체를 처음에 한 번 신고해 증여가액을 확정합니다. 계약대로 이행하면 추가 신고가 없습니다.</p>
          <Steps
            items={[
              <>
                증여계약 체결: &apos;앞으로 N년간 매월 M만원씩 지급&apos;하는 증여계약서를 작성합니다.
                <InfoTip label="계약서 작성 설명">부모와 자녀의 법정대리인 간 계약이며, 자필 또는 세무서 비치 양식을 사용합니다.</InfoTip>
              </>,
              <>
                최초 불입일로부터 <b>3개월 이내</b> 홈택스에서 &apos;유기정기금 평가&apos; 방식으로 1회 신고합니다. 연 3% 할인율(변동 가능)로 현재가치를 평가해 총 증여가액을 확정합니다.
              </>,
              <>
                현재가치 계산(참고용): 월 20만원씩 10년(120회)이면 납입 총액 2,400만원이지만 현재가치는 대략 2,000만원 초반대입니다. 평가액이 미성년자 공제한도(2,000만원) 안이면 산출세액은 0원입니다.
                <InfoTip label="현재가치 계산 설명">정확한 금액은 홈택스 자동계산으로 확인하세요. 연 3% 할인율은 바뀔 수 있습니다.</InfoTip>
              </>,
              <>
                신고 후에는 계약대로 매달 입금합니다. 계약과 일치하면 추가 신고가 필요 없습니다.
                <InfoTip label="재신고가 필요한 경우">실제 불입액이 계약보다 많아지거나 중도에 증액하면 그 차액은 별도의 새로운 증여로 취급되어 재신고가 필요합니다.</InfoTip>
              </>,
              "구비서류: 증여계약서, 유기정기금 평가명세서, 부모·자녀 통장사본(매회 이체 확인용), 가족관계증명서.",
              "'입금/증여 기록'에 유형을 '분할(정기금) 증여'로 추가해 계약 내용을 남기고, 매월 이체할 때마다 입금 기록을 더해 통장사본과 대조합니다.",
            ]}
          />
        </div>
      </Section>

      <Section title="2. 홈택스 신고 실전 순서 — 유기정기금 방식">
        <EmojiLine emoji="🗓️" as="p" className="leading-relaxed">
          자녀 계좌에 매월 같은 금액을 자동이체하고, <b>최초 입금일이 속한 달의 말일부터 3개월 이내</b>에 1회 신고합니다.
        </EmojiLine>

        <div>
          <SubTitle>신고 전 준비물</SubTitle>
          <EmojiList className="text-zinc-600 dark:text-zinc-300">
            <EmojiLine emoji="🪪">부모 신분증, 부모 명의 휴대폰</EmojiLine>
            <EmojiLine emoji="🏦">자녀 명의 증권계좌 또는 입금계좌, 첫 입금 내역과 자동이체 설정</EmojiLine>
            <EmojiLine emoji="📎">증여자·수증자 통장 사본, 가족관계증명서 PDF</EmojiLine>
            <EmojiLine emoji="📝">증여계약서, 유기정기금 평가명세서 PDF</EmojiLine>
          </EmojiList>
        </div>

        <div>
          <SubTitle>서류 만드는 순서</SubTitle>
          <Steps items={INSTALLMENT_DOC_STEPS} />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            외부 계산 도구를 써도 최종 신고 전 홈택스 자동계산 결과와 첨부서류 금액이 일치하는지 확인하세요.
          </p>
        </div>

        <div>
          <SubTitle>홈택스 신고 순서</SubTitle>
          <Steps items={HOMETAX_STEPS} />
        </div>
      </Section>

      <Section title="3. 자녀 계좌 투자 전 체크포인트">
        <EmojiList className="text-zinc-600 dark:text-zinc-300">
          <EmojiLine emoji="💰">
            자녀 계좌의 투자 수익은 원칙적으로 자녀 재산이지만, 최초 증여와 계좌 지배관계가 명확해야 합니다.
          </EmojiLine>
          <EmojiLine emoji="⚠️">
            부모가 임의로 입출금하거나 본인 자금처럼 쓰면 증여 인정에 문제가 생길 수 있습니다.
          </EmojiLine>
          <EmojiLine emoji="🧾">
            미성년 자녀 계좌의 매도 차익이 커지면 부양가족 공제 등 다른 세무 이슈가 생길 수 있으니 매도 전 확인하세요.
          </EmojiLine>
          <EmojiLine emoji="⏳">
            성인이 될 때까지 보유할 상품인지, 수수료·환율·세금 부담은 어떤지 미리 확인하세요.
          </EmojiLine>
          <EmojiLine emoji="📝">
            첫 입금일, 매월 이체액, 신고 완료 여부, 첨부서류 보관 상태는 &lsquo;입금/증여 기록&rsquo;의 메모와 신고 표시로 남길 수 있습니다.
          </EmojiLine>
        </EmojiList>
      </Section>

      <Section title="4. 자녀 투자 증빙 관리">
        <EmojiLine emoji="🗂️" as="p" className="leading-relaxed">
          이체 내역만이 아니라 <b>신고했고, 계좌가 분리돼 있고, 자녀가 장기 투자 과정에 참여했다</b>는 기록이 함께 있으면 자금출처를 설명하기 쉽습니다.
        </EmojiLine>

        <div>
          <SubTitle>보관하면 좋은 증빙</SubTitle>
          <EmojiList className="text-zinc-600 dark:text-zinc-300">
            {CHILD_INVESTMENT_RECORDS.map((r) => (
              <EmojiLine key={r.title} emoji={r.emoji}>
                {r.title}
                <InfoTip label={`${r.title} 설명`} align="start">{r.tip}</InfoTip>
              </EmojiLine>
            ))}
          </EmojiList>
        </div>

        <div>
          <SubTitle>기록해 둘 것</SubTitle>
          <EmojiList className="text-zinc-600 dark:text-zinc-300">
            <EmojiLine emoji="🎁">
              증여 기록: <b>첫 입금일, 신고기한, 신고 완료일, 첨부서류 보관 여부</b>
            </EmojiLine>
            <EmojiLine emoji="👶">
              보유자산 메모: <b>매수 이유, 목표 보유기간, 리밸런싱 기준</b>을 짧게
            </EmojiLine>
            <EmojiLine emoji="🔔">
              자동이체가 계약과 다르게 실행되면 누락·초과 입금을 바로 확인하고 별도 신고가 필요한지 검토
            </EmojiLine>
            <EmojiLine emoji="⚖️">
              부모 계좌로 돈이 돌아오거나 생활비처럼 섞이면 불리하니 자녀 계좌의 입출금 목적을 분리
            </EmojiLine>
          </EmojiList>
        </div>
      </Section>

      <Section title="공통 주의사항">
        <EmojiList className="text-zinc-600 dark:text-zinc-300">
          <EmojiLine emoji="👶">
            반드시 자녀 <b>본인 명의</b> 계좌로 이체해야 증여로 인정됩니다.
            <InfoTip label="차명계좌 설명" align="start">
              부모가 자녀 이름으로 개설했지만 실질적으로 지배·관리하는 이른바 &quot;차명계좌&quot;는 증여로 인정되지 않으며, 실제 인출 시점에 증여로 재해석되어 과세될 수 있습니다.
            </InfoTip>
          </EmojiLine>
          <EmojiLine emoji="🗄️">통장 이체 내역·증여계약서 등 증빙은 10년 이상 보관하세요.</EmojiLine>
          <EmojiLine emoji="🔍">공제한도 이내여도 반복·정기적이면 자금출처조사 때 소명자료를 요구받을 수 있습니다.</EmojiLine>
          <EmojiLine emoji="⚠️">
            이 화면의 진행률과 정기금 현재가치 계산은 <b>참고용 추정치</b>이며 법적 효력이 있는 공식 세액 계산이 아닙니다.
          </EmojiLine>
        </EmojiList>
      </Section>
    </div>
  );
}
