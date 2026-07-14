// 증여세 신고 가이드 — 참고용 일반 정보. 개별 상황에 따라 다를 수 있으므로
// 실제 신고 전 국세청 홈택스(hometax.go.kr) 자동계산 또는 세무사 상담으로 반드시 확인할 것.
"use client";

const BRACKET_ROWS = [
  { range: "1억원 이하", rate: "10%", deduction: "없음" },
  { range: "1억원 초과 ~ 5억원 이하", rate: "20%", deduction: "1천만원" },
  { range: "5억원 초과 ~ 10억원 이하", rate: "30%", deduction: "6천만원" },
  { range: "10억원 초과 ~ 30억원 이하", rate: "40%", deduction: "1억 6천만원" },
  { range: "30억원 초과", rate: "50%", deduction: "4억 6천만원" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden group" open>
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-sm flex items-center justify-between">
        {title}
        <svg className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">{children}</div>
    </details>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="leading-relaxed">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function GiftTaxGuide() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        ⚠️ 아래 내용은 일반적인 안내이며 개별 상황(증여자·수증자 관계, 기존 증여 이력 등)에 따라 결과가 달라질 수 있습니다.
        실제 신고 전 반드시 <b>국세청 홈택스(hometax.go.kr)</b> 자동계산 또는 <b>세무사 상담</b>으로 확인하세요.
        세법 개정으로 공제한도·세율·이자율이 바뀔 수 있습니다.
      </div>

      <Section title="📋 기본 정보 — 공제한도 · 신고기한 · 세율">
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100 mb-1">증여재산공제 (직계존속 → 직계비속, 10년간 합산)</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>미성년자(만 19세 미만): <b>2,000만원</b></li>
            <li>성년(만 19세 이상): <b>5,000만원</b></li>
          </ul>
          <p className="text-xs text-zinc-400 mt-1">
            증여일 기준 최근 10년 내 같은 사람(부모)에게 받은 증여를 모두 합산합니다. 10년이 지나면 한도가 다시 채워집니다.
          </p>
        </div>
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100 mb-1">신고기한 · 세액공제</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>증여일이 속하는 <b>달의 말일부터 3개월 이내</b> 신고·납부</li>
            <li>기한 내 자진신고 시 산출세액의 <b>3% 세액공제</b></li>
            <li>무신고·과소신고 시 가산세(무신고 20%, 부정 40% 등) + 납부지연가산세 부과</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100 mb-1">증여세 세율 (초과누진세율)</p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left font-medium py-1.5 px-1">과세표준</th>
                  <th className="text-right font-medium py-1.5 px-1">세율</th>
                  <th className="text-right font-medium py-1.5 px-1">누진공제액</th>
                </tr>
              </thead>
              <tbody>
                {BRACKET_ROWS.map((r) => (
                  <tr key={r.range} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="py-1.5 px-1">{r.range}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums">{r.rate}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums">{r.deduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-1">산출세액 = 과세표준 × 세율 − 누진공제액</p>
        </div>
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100 mb-1">공통 구비서류</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>증여세과세표준신고 및 자진납부계산서</li>
            <li>증여재산 및 평가명세서</li>
            <li>가족관계증명서 (증여자·수증자 관계 입증)</li>
            <li>계좌이체 내역(통장사본) — 증여재산 입증</li>
          </ul>
        </div>
      </Section>

      <Section title="1-1. 일괄 증여 시 처리 방법">
        <p className="text-xs text-zinc-400">목돈을 한 번에 자녀 계좌로 이체하는 경우</p>
        <Steps
          items={[
            "증여 실행: 부모 계좌에서 자녀 본인 명의 계좌로 목돈을 이체합니다. 반드시 자녀 명의 계좌여야 하며, 부모가 실질적으로 관리하는 차명계좌는 증여로 인정되지 않을 수 있습니다.",
            "증여일 확정: 실제 입금일이 곧 증여일이 됩니다.",
            "신고기한 계산: 입금월의 말일부터 3개월 이내입니다. 예) 3월 15일 입금 → 3월 31일부터 기산 → 6월 30일까지 신고.",
            "과세표준 계산: 증여금액에서 10년 내 기증여액을 포함한 공제한도(미성년 2,000만원 / 성년 5,000만원)를 차감합니다. 공제 이내면 산출세액은 0원입니다.",
            "신고 여부 판단: 공제 이내라도 나중에 자금출처를 소명해야 할 상황(취업·주택자금 등)을 대비해 '증여재산공제 신고'를 해두면 유리합니다(의무는 아닌 선택 사항).",
            "세액 계산 (공제 초과분이 있을 때만): 과세표준 × 세율 − 누진공제액. 신고기한 내 신고 시 3% 세액공제가 추가로 적용됩니다.",
            "홈택스 신고: 자녀 명의로 홈택스 로그인(미성년 저연령은 법정대리인이 대리 신고 가능) → 신고/납부 → 세금신고 → 증여세 → 정기신고 → 증여자·수증자 정보 입력 → 증여재산가액(이체금액) 입력 → 10년 내 기증여재산 합산 여부 확인 → 세액 자동계산 → 증빙서류(가족관계증명서·통장사본) PDF 첨부 → 제출 → 납부(국세청 가상계좌 등).",
            "이 앱에 기록: '증여 기록'에 유형을 '일괄'로 등록하고, 실제 신고를 마치면 신고여부를 체크해 이력을 관리하세요.",
          ]}
        />
      </Section>

      <Section title="1-2. 분할 증여(적립식) 시 처리 방법 — 적금처럼 매달 넣는 경우">
        <p className="text-xs text-zinc-400">
          적금 넣듯 매달 자녀 계좌에 일정 금액을 입금하는 경우, 두 가지 처리 방식이 있습니다.
        </p>

        <div>
          <p className="font-medium text-red-500 mb-1">방식 A. 사전 신고 없이 매회 개별 증여로 처리 (권장하지 않음)</p>
          <p className="leading-relaxed">
            매달 그냥 입금만 하고, 10년 누적액이 공제한도(2,000만원)를 넘는 시점에 그 초과분만 신고하는 방식입니다.
            간편해 보이지만, 국세청이 정기적·계획적인 입금을 &quot;처음부터 예정된 증여&quot;로 판단할 경우
            자녀가 실제로 그 돈을 인출·사용하는 시점(예: 성인이 된 후 학자금·주택자금 등)에
            <b>그때까지의 누적 원리금 전체를 한꺼번에 증여로 보아 가산세를 포함해 과세</b>할 위험이 있습니다.
          </p>
        </div>

        <div>
          <p className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">방식 B. 유기정기금 평가로 사전 1회 신고 (권장)</p>
          <Steps
            items={[
              "증여계약 체결: '앞으로 N년간 매월 M만원씩 지급한다'는 증여계약서를 작성합니다(부모와 자녀의 법정대리인 간 계약, 자필 또는 세무서 비치 양식 사용).",
              "최초 불입일로부터 3개월 이내 신고: 홈택스에서 '유기정기금 평가' 방식으로 1회 신고합니다. 앞으로 지급할 금액까지 현재가치로 할인평가(연 3% 할인율, 변동 가능)하여 총 증여가액을 한 번에 확정합니다.",
              "현재가치 계산 (참고용): 예를 들어 월 20만원씩 10년(120회)을 약정하면 실제 납입 총액은 2,400만원이지만, 연 3% 할인율을 적용한 현재가치는 이보다 낮게 평가됩니다(대략 2,000만원 초반대 — 정확한 금액은 홈택스 자동계산으로 확인). 미성년자 공제한도(2,000만원) 안에 들어오도록 월 납입액·기간을 설계하면 세금 없이 진행할 수 있습니다.",
              "신고 후 이행: 계약대로 매달 실제로 입금합니다. 계약과 일치하게 이행되는 한 최초 1회 신고로 종결되며 추가 신고가 필요 없습니다. 단, 실제 불입액이 계약보다 많아지거나 중도에 증액하면 그 차액은 별도의 새로운 증여로 취급되어 재신고가 필요합니다.",
              "구비서류: 증여계약서, 유기정기금 평가명세서, 부모·자녀 통장사본(매회 이체 확인용), 가족관계증명서.",
              "이 앱에 기록: '증여 기록'에 유형을 '분할(정기금)'로 등록해 계약 내용을 남기고, 매월 실제 이체할 때마다 이행 기록을 추가해 통장사본과 대조할 수 있는 증빙을 확보하세요.",
            ]}
          />
        </div>
      </Section>

      <Section title="⚠️ 공통 주의사항">
        <ul className="list-disc list-inside space-y-1">
          <li>반드시 자녀 <b>본인 명의</b> 계좌로 이체해야 증여로 인정됩니다. 부모가 자녀 이름으로 개설했지만 실질적으로 지배·관리하는 이른바 &quot;차명계좌&quot;는 증여로 인정되지 않으며, 오히려 나중에 실제 인출 시점에 증여로 재해석되어 과세될 수 있습니다.</li>
          <li>통장 이체 내역·증여계약서 등 증빙은 최소 10년 이상 보관하는 것을 권장합니다(추후 자금출처 소명 대비).</li>
          <li>공제한도 이내의 증여라도 반복적·정기적으로 이루어지면 자금출처조사 시 소명자료를 요구받을 수 있습니다.</li>
          <li>이 앱의 진행률 계산기와 정기금 현재가치 계산은 <b>참고용 추정치</b>이며 법적 효력이 있는 공식 세액 계산이 아닙니다.</li>
        </ul>
      </Section>
    </div>
  );
}
