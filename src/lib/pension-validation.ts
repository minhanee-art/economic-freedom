// 연금 설계 API 요청 본문 검증 — 순수 함수
import type { IncomeSourceFields, RetirementGoalRow } from "@/lib/pension-data";
import type { FamilyMember, IncomeSourceType } from "@/lib/pension-planning";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT = 10_000_000_000; // 100억원 — 입력 실수 방지용 상한
const MEMBERS: FamilyMember[] = ["self", "spouse"];
const SOURCE_TYPES: IncomeSourceType[] = ["national_pension", "retirement_pension", "pension_insurance"];

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function parseYear(value: unknown, now = new Date()): number | null {
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : value;
  const current = now.getFullYear();
  return isInt(n) && n >= 2000 && n <= current + 1 ? n : null;
}

export function parseContributionBody(
  body: unknown,
  now = new Date()
): Parsed<{ accountId: string; year: number; amount: number; memo: string | null }> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.accountId !== "string" || !b.accountId) return { ok: false, error: "계좌를 선택해주세요." };
  const year = parseYear(b.year, now);
  if (year === null) return { ok: false, error: "연도가 올바르지 않습니다." };
  if (!isInt(b.amount) || b.amount < 0 || b.amount > MAX_AMOUNT) {
    return { ok: false, error: "납입액은 0 이상의 정수(원)여야 합니다." };
  }
  return { ok: true, value: { accountId: b.accountId, year, amount: b.amount, memo: optionalText(b.memo, 100) } };
}

export function parseIncomeSourceBody(body: unknown): Parsed<IncomeSourceFields> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!MEMBERS.includes(b.member as FamilyMember)) return { ok: false, error: "가족 구성원을 선택해주세요." };
  if (!SOURCE_TYPES.includes(b.sourceType as IncomeSourceType)) {
    return { ok: false, error: "연금 종류를 선택해주세요." };
  }
  if (!isInt(b.monthlyAmount) || b.monthlyAmount < 0 || b.monthlyAmount > MAX_AMOUNT) {
    return { ok: false, error: "예상 월 수령액은 0 이상의 정수(원)여야 합니다." };
  }
  if (!isInt(b.startAge) || b.startAge < 40 || b.startAge > 100) {
    return { ok: false, error: "수령 개시 나이는 40~100세 사이여야 합니다." };
  }
  let endAge: number | null = null;
  if (b.endAge !== undefined && b.endAge !== null && b.endAge !== "") {
    if (!isInt(b.endAge) || b.endAge < b.startAge || b.endAge > 120) {
      return { ok: false, error: "수령 종료 나이는 개시 나이 이상이어야 합니다." };
    }
    endAge = b.endAge;
  }
  return {
    ok: true,
    value: {
      member: b.member as FamilyMember,
      sourceType: b.sourceType as IncomeSourceType,
      label: optionalText(b.label, 50),
      monthlyAmount: b.monthlyAmount,
      startAge: b.startAge,
      endAge,
      memo: optionalText(b.memo, 200),
    },
  };
}

function nullableInt(value: unknown, min: number, max: number): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return isInt(value) && value >= min && value <= max ? value : undefined;
}

/**
 * 은퇴 목표 부분 수정. 본문에 있는 항목만 결과에 담는다(빈 값은 null = 지움).
 * 출생연도 대신 현재 나이(currentAge)를 주면 출생연도로 바꿔 저장한다.
 */
export function parseRetirementGoalBody(body: unknown, now = new Date()): Parsed<Partial<RetirementGoalRow>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const year = now.getFullYear();
  const out: Partial<RetirementGoalRow> = {};

  if (has("targetMonthly")) {
    const v = nullableInt(b.targetMonthly, 0, MAX_AMOUNT);
    if (v === undefined) return { ok: false, error: "목표 월 생활비는 0 이상의 정수(원)여야 합니다." };
    out.targetMonthly = v;
  }
  if (has("retirementAge")) {
    const v = nullableInt(b.retirementAge, 30, 100);
    if (v === undefined) return { ok: false, error: "은퇴 나이는 30~100세 사이여야 합니다." };
    out.retirementAge = v;
  }
  if (has("birthYear")) {
    const v = nullableInt(b.birthYear, year - 110, year);
    if (v === undefined) return { ok: false, error: "출생연도가 올바르지 않습니다." };
    out.birthYear = v;
  }
  if (has("currentAge") && !(has("birthYear") && out.birthYear !== null)) {
    const age = nullableInt(b.currentAge, 0, 110);
    if (age === undefined) return { ok: false, error: "현재 나이가 올바르지 않습니다." };
    out.birthYear = age === null ? null : year - age;
  }
  if (has("spouseBirthYear")) {
    const v = nullableInt(b.spouseBirthYear, year - 110, year);
    if (v === undefined) return { ok: false, error: "배우자 출생연도가 올바르지 않습니다." };
    out.spouseBirthYear = v;
  }
  if (has("expectedReturnPct")) {
    const r = b.expectedReturnPct;
    if (r === null || r === "") out.expectedReturnPct = null;
    else if (typeof r !== "number" || !Number.isFinite(r) || r < -10 || r > 20) {
      return { ok: false, error: "기대수익률은 -10~20% 사이로 입력해주세요." };
    } else out.expectedReturnPct = Math.round(r * 100) / 100;
  }
  if (has("salaryBracket")) {
    const v = b.salaryBracket;
    if (v === null || v === "") out.salaryBracket = null;
    else if (v === "low" || v === "high") out.salaryBracket = v;
    else return { ok: false, error: "총급여 구간이 올바르지 않습니다." };
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "저장할 항목이 없습니다." };
  return { ok: true, value: out };
}
