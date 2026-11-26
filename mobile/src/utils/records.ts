/** 서버(src/lib/record-validation.ts)와 같은 상한 — INTEGER 컬럼 최댓값. */
export const INT_MAX = 2_147_483_647;
/** 이보다 이른 날짜는 오입력으로 본다(서버 MIN_RECORD_DATE와 동일). */
export const MIN_RECORD_DATE = "1970-01-01";

/**
 * 오늘 날짜(KST, YYYY-MM-DD). 서버가 KST 기준으로 "미래 날짜"를 판정하므로
 * 기기 시간대와 무관하게 KST로 계산한다(KST는 DST 없는 UTC+9 고정).
 */
export function todayString(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 존재하는 날짜이고 1970-01-01 이상, 오늘(KST) 이하이면 null, 아니면 오류 문구. */
export function validateDate(value: string, today = todayString()): string | null {
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "날짜를 YYYY-MM-DD 형식으로 입력해주세요.";
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return "존재하지 않는 날짜입니다.";
  if (text < MIN_RECORD_DATE) return `날짜는 ${MIN_RECORD_DATE} 이후여야 합니다.`;
  if (text > today) return "오늘 이후 날짜는 기록할 수 없습니다.";
  return null;
}

/** 쉼표·공백을 허용하는 1 이상 INT_MAX 이하의 정수 입력. 잘못되면 null. */
export function parsePositiveInt(value: string): number | null {
  const text = value.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 && n <= INT_MAX ? n : null;
}
