// 계좌 세제 유형 — 서버/클라이언트 공용 (next/headers 등 서버 전용 import 금지)

export const ACCOUNT_TYPES = ["pension_savings", "irp", "dc", "isa", "general", "child"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** 기존 계좌(컬럼 추가 전 생성)는 '일반'으로 간주한다. */
export const DEFAULT_ACCOUNT_TYPE: AccountType = "general";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  pension_savings: "연금저축",
  irp: "IRP",
  dc: "DC(확정기여형)",
  isa: "ISA",
  general: "일반",
  child: "자녀",
};

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && (ACCOUNT_TYPES as readonly string[]).includes(value);
}

/** 알 수 없는 값·빈 값은 '일반'으로 본다. */
export function normalizeAccountType(value: unknown): AccountType {
  return isAccountType(value) ? value : DEFAULT_ACCOUNT_TYPE;
}

/** 연금계좌 세액공제 대상(연금저축계좌·퇴직연금계좌) 여부 */
export function isPensionAccountType(type: AccountType): boolean {
  return type === "pension_savings" || type === "irp" || type === "dc";
}
