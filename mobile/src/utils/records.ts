/** 기기 시간대 기준 오늘 날짜(YYYY-MM-DD). */
export function todayString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 존재하는 날짜이고 오늘 이후가 아니면 null, 아니면 오류 문구. */
export function validateDate(value: string, today = todayString()): string | null {
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "날짜를 YYYY-MM-DD 형식으로 입력해주세요.";
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return "존재하지 않는 날짜입니다.";
  if (text > today) return "오늘 이후 날짜는 기록할 수 없습니다.";
  return null;
}

/** 쉼표·공백을 허용하는 양의 정수 입력. 잘못되면 null. */
export function parsePositiveInt(value: string): number | null {
  const text = value.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
