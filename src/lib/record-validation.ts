// 매수·배당 기록 입력 서버 검증 — 웹/모바일 공통.
// DB 컬럼(quantity·price_at_purchase·cost·amount·total_spent)이 모두 INTEGER라 소수는 어차피 저장되지 않는다
// (지금까지는 Postgres 오류로 500이 났다). 서버에서 먼저 400으로 거절한다.

export const INT_MAX = 2_147_483_647;
/** 한 번에 기록할 수 있는 매수 항목 수 상한 — 정상 화면 입력은 종목 수(수십 개)를 넘지 않는다 */
export const MAX_PURCHASE_ITEMS = 100;
export const MAX_MEMO_LENGTH = 500;
/** 이보다 이른 날짜는 오입력으로 본다 */
export const MIN_RECORD_DATE = "1970-01-01";

/** 오늘 날짜(KST, YYYY-MM-DD) — 앱의 다른 KST 날짜 계산(portfolio-returns 등)과 같은 방식 */
export function todayKstDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type DateCheck = { ok: true; date: string } | { ok: false; error: string };

/**
 * 기록 날짜 검증: YYYY-MM-DD 형식, 실제 존재하는 날짜, 1970-01-01 이후, 오늘(KST) 이하.
 * 웹은 `new Date().toISOString()`(UTC) 날짜를 보내는데, UTC 날짜는 KST 날짜보다 늦을 수 없으므로 항상 통과한다.
 */
export function checkRecordDate(value: unknown, now: Date = new Date()): DateCheck {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "날짜는 YYYY-MM-DD 형식이어야 합니다." };
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "존재하지 않는 날짜입니다." };
  }
  if (value < MIN_RECORD_DATE) {
    return { ok: false, error: `날짜는 ${MIN_RECORD_DATE} 이후여야 합니다.` };
  }
  if (value > todayKstDateKey(now)) {
    return { ok: false, error: "미래 날짜는 기록할 수 없습니다." };
  }
  return { ok: true, date: value };
}

/** 1 이상 INT_MAX 이하의 정수인지. 숫자 문자열("10")도 허용한다(기존 Number() 변환과 동일). */
export function toPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > INT_MAX) return null;
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID 형식인지 — 아니면 Postgres가 uuid 캐스팅 오류(500)를 내므로 쿼리 전에 거른다 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
