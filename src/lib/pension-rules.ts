// 연금·절세계좌 세법 수치 — 연도별 설정을 이 파일 한 곳에만 둔다.
// 화면·계산 코드는 숫자를 직접 쓰지 말고 getPensionRules(year)로 읽는다.
// 각 수치 옆 주석에 확인한 공식 출처 URL을 적는다. verified=false 항목은 공식 출처로 확인하지 못한 값이다.

export type SalaryBracket = "low" | "high";

export type RuleSource = {
  /** 무엇을 확인했는지 */
  topic: string;
  url: string;
  /** 공식 출처(법령·국세청·금감원)에서 직접 확인했는지 */
  verified: boolean;
};

export type PensionRuleSet = {
  year: number;
  taxCredit: {
    /** 연금저축 공제 대상 납입 한도 (원/년) */
    pensionSavingsLimit: number;
    /** 연금저축 + 퇴직연금(IRP·DC 본인 추가납입) 합산 공제 대상 한도 (원/년) */
    combinedLimit: number;
    /** 총급여 기준 공제율 구간 (지방소득세 포함) */
    rates: Record<SalaryBracket, { rate: number; label: string }>;
  };
  /** 연금계좌(연금저축+퇴직연금) 연간 납입 한도 (원/년, ISA 만기 전환금 등 제외) */
  annualContributionLimit: number;
  isaTransferCredit: {
    /** ISA 만기 자금을 연금계좌로 옮길 때 추가 공제 대상 비율 */
    rate: number;
    /** 추가 공제 대상 한도 (원) */
    max: number;
  };
  isa: {
    annualLimit: number;
    totalLimit: number;
    taxFreeGeneral: number;
    taxFreeLowIncome: number;
    /** 비과세 한도 초과분 분리과세 세율 (지방세 포함) */
    excessTaxRate: number;
  };
  pensionIncomeTax: {
    /** 연금수령 나이별 연금소득세율 (지방세 포함). minAge 이상 maxAge 이하 */
    byAge: { minAge: number; maxAge: number | null; rate: number }[];
    /** 사적연금 분리과세 선택 기준 (원/년) — 초과 시 종합과세 또는 16.5% 분리과세 선택 */
    /** 종신계약 연금수령 세율 (지방세 포함). 나이별 세율과 겹치면 낮은 쪽 적용 */
    lifetimeContractRate: number;
    separateTaxThreshold: number;
    separateTaxRateOverThreshold: number;
  };
  sources: RuleSource[];
};

// ── 출처 (국가법령정보센터 법령 본문, 2026-11-26 확인) ─────────────────────
// 소득세법(2026.7.1 시행, 법률 제21221호):  https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=280405&efYd=20260701&chrClsCd=010202&ancYnChk=0
// 소득세법(2025.1.1 시행, 법률 제20615호):  https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=267581&efYd=20250101&chrClsCd=010202&ancYnChk=0
// 소득세법 시행령(2026.10.1 시행):          https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=290841&efYd=20261001&chrClsCd=010202&ancYnChk=0
// 조세특례제한법(2026.9.18 시행):           https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=284389&efYd=20260918&chrClsCd=010202&ancYnChk=0
// 법령은 국세 세율(12%/15%, 5%/4%/3%, 9%, 15%)만 정한다. 화면에 쓰는 "지방소득세 포함" 값은
// 지방소득세를 국세의 10%로 보고 곱한 값이며, 지방세법 원문은 확인하지 못했다(미검증).
const LAW_INCOME_TAX_2026 = "https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=280405&efYd=20260701&chrClsCd=010202&ancYnChk=0";
const LAW_INCOME_TAX_2025 = "https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=267581&efYd=20250101&chrClsCd=010202&ancYnChk=0";
const LAW_INCOME_TAX_DECREE = "https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=290841&efYd=20261001&chrClsCd=010202&ancYnChk=0";
const LAW_SPECIAL_TAX = "https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=284389&efYd=20260918&chrClsCd=010202&ancYnChk=0";

/**
 * 연금계좌에서 연금수령을 개시할 수 있는 최소 나이 — 소득세법 시행령 §40의2③1
 * ("가입자가 55세 이후 연금계좌취급자에게 연금수령 개시를 신청한 후 인출할 것"), LAW_INCOME_TAX_DECREE 본문에서 2026-11-27 확인.
 * 같은 항 2호의 '가입일부터 5년 경과' 요건은 계좌 가입일을 저장하지 않아 계산에 반영하지 않는다.
 */
export const PENSION_WITHDRAWAL_MIN_AGE = 55;

/** 국세 세율에 지방소득세(국세의 10%)를 더한 값 — 지방세법 미검증 */
function withLocalTax(nationalRate: number): number {
  return Math.round(nationalRate * 1.1 * 10000) / 10000;
}

function sourcesFor(incomeTaxLawUrl: string): RuleSource[] {
  return [
    { topic: "연금저축 600만원·합산 900만원 공제 한도 (소득세법 제59조의3①)", url: incomeTaxLawUrl, verified: true },
    { topic: "공제율 12%·15%(종합소득 4,500만원/총급여 5,500만원 이하) (소득세법 제59조의3①)", url: incomeTaxLawUrl, verified: true },
    { topic: "ISA 만기 전환 추가공제 10%·300만원 (소득세법 제59조의3③④)", url: incomeTaxLawUrl, verified: true },
    { topic: "연금계좌 연 1,800만원 납입 한도 (소득세법 시행령 제40조의2②)", url: LAW_INCOME_TAX_DECREE, verified: true },
    { topic: "ISA 연 2,000만원·총 1억원, 비과세 200·400만원, 초과분 9% (조세특례제한법 제91조의18)", url: LAW_SPECIAL_TAX, verified: true },
    { topic: "연금소득세 나이별 5%·4%·3%, 종신계약 세율 (소득세법 제129조①5의2)", url: incomeTaxLawUrl, verified: true },
    { topic: "사적연금 분리과세 기준 연 1,500만원 (소득세법 제14조③9), 초과 시 15% 분리과세 선택 (제64조의4)", url: incomeTaxLawUrl, verified: true },
    { topic: "연금수령 요건: 55세 이후 연금수령 개시 신청·가입 5년 경과 (소득세법 시행령 제40조의2③1·2)", url: LAW_INCOME_TAX_DECREE, verified: true },
    { topic: "지방소득세 포함 세율(16.5%·13.2%, 5.5%·4.4%·3.3%, 9.9%, 16.5%) — 국세×1.1로 계산, 지방세법 미확인", url: "https://www.law.go.kr/법령/지방세법", verified: false },
  ];
}

// ── 2025년 ───────────────────────────────────────────────────────────
const RULES_2025: PensionRuleSet = {
  year: 2025,
  taxCredit: {
    pensionSavingsLimit: 6_000_000, // 소득세법 §59의3① — LAW_INCOME_TAX_2025
    combinedLimit: 9_000_000, // 소득세법 §59의3① — LAW_INCOME_TAX_2025
    rates: {
      // 국세 15% / 12% (소득세법 §59의3①) + 지방소득세
      low: { rate: withLocalTax(0.15), label: "총급여 5,500만원 이하 (종합소득 4,500만원 이하)" },
      high: { rate: withLocalTax(0.12), label: "총급여 5,500만원 초과" },
    },
  },
  annualContributionLimit: 18_000_000, // 소득세법 시행령 §40의2②1가 — LAW_INCOME_TAX_DECREE
  isaTransferCredit: { rate: 0.1, max: 3_000_000 }, // 소득세법 §59의3③④
  isa: {
    // 조세특례제한법 §91의18 — LAW_SPECIAL_TAX (2024년 한도 상향안은 입법되지 않음)
    annualLimit: 20_000_000,
    totalLimit: 100_000_000,
    taxFreeGeneral: 2_000_000,
    taxFreeLowIncome: 4_000_000,
    excessTaxRate: withLocalTax(0.09),
  },
  pensionIncomeTax: {
    // 소득세법 §129①5의2 — 국세 5% / 4% / 3%
    byAge: [
      { minAge: 55, maxAge: 69, rate: withLocalTax(0.05) },
      { minAge: 70, maxAge: 79, rate: withLocalTax(0.04) },
      { minAge: 80, maxAge: null, rate: withLocalTax(0.03) },
    ],
    lifetimeContractRate: withLocalTax(0.04), // 2025년: 종신계약 4%
    separateTaxThreshold: 15_000_000, // 소득세법 §14③9다 (2024.1.1~)
    separateTaxRateOverThreshold: withLocalTax(0.15), // 소득세법 §64의4
  },
  sources: sourcesFor(LAW_INCOME_TAX_2025),
};

// ── 2026년 ───────────────────────────────────────────────────────────
// 법률 제21221호(2025.12.23): 종신계약 연금소득세 4% → 3% (2026.1.1 이후 수령분).
// 2026년 세제개편안(생산적 ISA 등)은 2026-11-26 현재 시행 법령에 없어 반영하지 않았다.
const RULES_2026: PensionRuleSet = {
  ...RULES_2025,
  year: 2026,
  pensionIncomeTax: {
    ...RULES_2025.pensionIncomeTax,
    lifetimeContractRate: withLocalTax(0.03), // LAW_INCOME_TAX_2026
  },
  sources: sourcesFor(LAW_INCOME_TAX_2026),
};

const RULES_BY_YEAR: Record<number, PensionRuleSet> = {
  2025: RULES_2025,
  2026: RULES_2026,
};

export const SUPPORTED_RULE_YEARS = Object.keys(RULES_BY_YEAR).map(Number).sort((a, b) => a - b);

/**
 * 해당 연도의 세법 수치. 등록되지 않은 연도는 그 이전 가장 가까운 연도 값을,
 * 그보다 이른 연도는 가장 이른 등록 연도 값을 쓴다. `exact`로 정확히 일치했는지 알려준다.
 */
export function getPensionRules(year: number): PensionRuleSet & { exact: boolean } {
  const exact = RULES_BY_YEAR[year];
  if (exact) return { ...exact, exact: true };
  const earlier = SUPPORTED_RULE_YEARS.filter((y) => y <= year);
  const fallbackYear = earlier.length > 0 ? earlier[earlier.length - 1] : SUPPORTED_RULE_YEARS[0];
  return { ...RULES_BY_YEAR[fallbackYear], exact: false };
}

/** 연금수령 나이에 해당하는 연금소득세율. 55세 미만이면 null (연금수령 요건 미충족). */
export function pensionIncomeTaxRate(rules: PensionRuleSet, age: number): number | null {
  const band = rules.pensionIncomeTax.byAge.find(
    (item) => age >= item.minAge && (item.maxAge === null || age <= item.maxAge)
  );
  return band ? band.rate : null;
}

/** 공식 출처로 확인하지 못한 항목 목록 (화면·PR 표기용) */
export function unverifiedRuleTopics(rules: PensionRuleSet): string[] {
  return rules.sources.filter((source) => !source.verified).map((source) => source.topic);
}
