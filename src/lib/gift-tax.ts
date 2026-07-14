// 증여세 계산 헬퍼 — 참고용 추정치. 정확한 세액은 홈택스 자동계산/세무사 상담으로 확인할 것.
// 근거: 국세청(nts.go.kr) 증여세 안내, 상속세및증여세법 §53(증여재산공제), §56(세율).

/** 미성년자(만 19세 미만) 10년간 증여재산공제 한도 (직계존속→직계비속) */
export const MINOR_EXEMPTION = 20_000_000;
/** 성년(만 19세 이상) 10년간 증여재산공제 한도 (직계존속→직계비속) */
export const ADULT_EXEMPTION = 50_000_000;
/** 성년 판정 기준 나이 */
export const ADULT_AGE = 19;
/** 유기정기금 평가 시 적용 할인율 (기획재정부령 — 변동 가능하므로 참고용) */
export const ANNUITY_DISCOUNT_RATE = 0.03;

export function getAge(birthDate: string, atDate: Date = new Date()): number {
  const b = new Date(birthDate);
  let age = atDate.getFullYear() - b.getFullYear();
  const m = atDate.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && atDate.getDate() < b.getDate())) age--;
  return age;
}

export function isMinor(birthDate: string, atDate: Date = new Date()): boolean {
  return getAge(birthDate, atDate) < ADULT_AGE;
}

/** 현재 나이 기준 10년간 증여재산공제 한도 (간이 계산 — 실제로는 증여 시점마다 나이가 달라질 수 있음) */
export function exemptionLimit(birthDate: string, atDate: Date = new Date()): number {
  return isMinor(birthDate, atDate) ? MINOR_EXEMPTION : ADULT_EXEMPTION;
}

/** 기준일로부터 최근 10년(rolling) 내 증여 합계 */
export function cumulativeGiftsWithin10Years(
  gifts: { date: string; amount: number; gift_type?: string }[],
  atDate: Date = new Date()
): number {
  const tenYearsAgo = new Date(atDate);
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  return gifts
    .filter((g) => {
      if (g.gift_type && g.gift_type !== "lump" && g.gift_type !== "installment") return false;
      const d = new Date(g.date);
      return d > tenYearsAgo && d <= atDate;
    })
    .reduce((s, g) => s + g.amount, 0);
}

interface TaxBracket {
  upTo: number;
  rate: number;
  deduction: number;
}

/** 증여세 5단계 초과누진세율 (과세표준 × 세율 − 누진공제액) */
const BRACKETS: TaxBracket[] = [
  { upTo: 100_000_000, rate: 0.10, deduction: 0 },
  { upTo: 500_000_000, rate: 0.20, deduction: 10_000_000 },
  { upTo: 1_000_000_000, rate: 0.30, deduction: 60_000_000 },
  { upTo: 3_000_000_000, rate: 0.40, deduction: 160_000_000 },
  { upTo: Infinity, rate: 0.50, deduction: 460_000_000 },
];

export function getBracket(taxableBase: number): TaxBracket {
  return BRACKETS.find((b) => taxableBase <= b.upTo) ?? BRACKETS[BRACKETS.length - 1];
}

/** 산출세액 = 과세표준 × 세율 − 누진공제액 */
export function calcGiftTax(taxableBase: number): { tax: number; rate: number } {
  if (taxableBase <= 0) return { tax: 0, rate: 0 };
  const b = getBracket(taxableBase);
  return { tax: Math.max(0, Math.round(taxableBase * b.rate - b.deduction)), rate: b.rate };
}

/** 신고기한 내 자진신고 시 3% 세액공제 반영한 납부세액 */
export function applySelfReportCredit(tax: number): number {
  return Math.round(tax * 0.97);
}

/**
 * 유기정기금(월 지급) 현재가치 — 매월 monthlyRate로 할인.
 * 참고용 추정치이며, 실제 국세청 평가 방식(연 단위 현가할인·잔존기간 기준)과
 * 소수 차이가 날 수 있음. 정확한 금액은 홈택스 "정기금 평가" 메뉴로 확인할 것.
 */
export function presentValueOfInstallments(
  monthlyAmount: number,
  months: number,
  annualRate: number = ANNUITY_DISCOUNT_RATE
): number {
  if (monthlyAmount <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  let pv = 0;
  for (let i = 1; i <= months; i++) {
    pv += monthlyAmount / Math.pow(1 + monthlyRate, i);
  }
  return Math.round(pv);
}

/** 신고기한 = 증여일이 속하는 달의 말일부터 3개월 이내 */
export function reportDeadline(giftDate: string): Date {
  const d = new Date(giftDate);
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0); // 해당 월 말일
  const deadline = new Date(endOfMonth);
  deadline.setMonth(deadline.getMonth() + 3);
  return deadline;
}
