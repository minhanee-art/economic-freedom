import { colors } from "@/styles/theme";

// ── 금액 표기 규칙(저장소 루트 DESIGN.md 'Money', 웹 src/lib/utils.ts 와 같은 규칙) ──
// 1) 요약 숫자(홈·카드 머리): formatKRW → "1억 6,289만원", "1,628만원", 1만원 미만은 "9,500원"
// 2) 목록·상세·입력 옆: formatKRWFull → "162,890,500원"
// 손익처럼 방향이 있는 금액은 formatSignedKRW 로 + 부호를 붙인다(음수는 -).
// '₩' 기호는 쓰지 않는다.

const MINUS = "-";

/** 요약 표기: 만원 단위 반올림. */
export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount)) return "0원";
  const sign = amount < 0 ? MINUS : "";
  const abs = Math.abs(amount);
  if (abs < 10_000) return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
  const totalMan = Math.round(abs / 10_000);
  const eok = Math.floor(totalMan / 10_000);
  const man = totalMan % 10_000;
  if (eok === 0) return `${sign}${man.toLocaleString("ko-KR")}만원`;
  if (man === 0) return `${sign}${eok.toLocaleString("ko-KR")}억원`;
  return `${sign}${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만원`;
}

/** 전체 표기: "162,890,500원" (원 단위 반올림). */
export function formatKRWFull(amount: number): string {
  if (!Number.isFinite(amount)) return "0원";
  const sign = amount < 0 ? MINUS : "";
  return `${sign}${Math.round(Math.abs(amount)).toLocaleString("ko-KR")}원`;
}

/** 방향이 있는 금액: 양수에 "+". full=true 면 전체 표기. */
export function formatSignedKRW(amount: number, full = false): string {
  const body = full ? formatKRWFull(amount) : formatKRW(amount);
  return amount > 0 ? `+${body}` : body;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// ── 손익 색(한국 관습: 상승·이익 = 빨강, 하락·손실 = 파랑, 보합 = 보조 잉크) ──
export type PnlTone = "gain" | "loss" | "flat";

export function pnlTone(value: number | null | undefined): PnlTone {
  if (value == null || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "gain" : "loss";
}

/** 손익 글자색. 색만으로 방향을 전하지 않도록 pnlArrow·부호와 함께 쓴다. */
export function pnlColor(value: number | null | undefined): string {
  const tone = pnlTone(value);
  return tone === "gain" ? colors.gain : tone === "loss" ? colors.loss : colors.inkMuted;
}

/** ▲(상승) / ▼(하락) / 빈 문자열(보합) */
export function pnlArrow(value: number | null | undefined): string {
  const tone = pnlTone(value);
  return tone === "gain" ? "▲" : tone === "loss" ? "▼" : "";
}
