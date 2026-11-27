import { format } from "date-fns";
import { ko } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "yyyy-MM-dd") {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return format(d, pattern, { locale: ko });
}

// ── 금액 표기 규칙(DESIGN.md 'Money') ─────────────────────────────
// 1) 요약 숫자(카드 머리·한 줄 상태·차트 툴팁): formatKRW → "1억 6,289만원"
// 2) 표·목록·입력 옆 표시: formatKRWFull → "162,890,500원"
// 3) 차트 축 눈금처럼 자리가 아주 좁은 곳: formatKRWAxis → "1.6억", "450만"
// 손익처럼 방향이 있는 금액은 formatSignedKRW 로 +/- 부호를 항상 붙인다.

const MINUS = "-";

/** 요약 표기: 만원 단위로 반올림해 "1억 6,289만원", "1,628만원", 만원 미만은 "9,500원". */
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

/** 손익처럼 방향이 있는 금액: 양수에 "+"를 붙인다. full=true 면 전체 표기. */
export function formatSignedKRW(amount: number, full = false): string {
  const body = full ? formatKRWFull(amount) : formatKRW(amount);
  return amount > 0 ? `+${body}` : body;
}

/** 차트 축 눈금 전용 짧은 표기: "1.6억", "450만", "9,500". */
export function formatKRWAxis(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? MINUS : "";
  if (abs >= 100_000_000) {
    const v = abs / 100_000_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}억`;
  }
  if (abs >= 10_000) {
    const v = Math.round(abs / 10_000);
    return `${sign}${v.toLocaleString("ko-KR")}만`;
  }
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}`;
}

/** 텔레그램 리포트 문구 전용(채팅 메시지 형식 유지): "1.6억", "92만", "₩1,234". 화면에는 쓰지 않는다. */
export function formatKRWCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const v = abs / 100_000_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}억`;
  }
  if (abs >= 10_000) {
    const v = abs / 10_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
}

/** 입력칸 표시용: 숫자만 남겨 천 단위 구분 기호를 넣는다("2500000" → "2,500,000"). 빈 값은 "". */
export function formatAmountInput(raw: string | number): string {
  const digits = String(raw).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

/** 입력칸 표시 문자열을 저장용 숫자 문자열로("2,500,000" → "2500000"). */
export function parseAmountInput(display: string): string {
  return display.replace(/[^0-9]/g, "");
}

// ── 손익 색(한국 관습: 상승·이익 = 빨강, 하락·손실 = 파랑) ─────────────
export type PnlTone = "gain" | "loss" | "flat";

export function pnlTone(value: number | null | undefined): PnlTone {
  if (value == null || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "gain" : "loss";
}

/** 손익 숫자 글자색. 숫자에는 반드시 부호(+/-)나 ▲▼ 를 함께 쓴다. */
export function pnlTextClass(value: number | null | undefined): string {
  const tone = pnlTone(value);
  return tone === "gain" ? "text-gain" : tone ==="loss" ? "text-loss" : "text-ink-mute";
}

/** ▲(상승) / ▼(하락) / 빈 문자열(보합) */
export function pnlArrow(value: number | null | undefined): string {
  const tone = pnlTone(value);
  return tone === "gain" ? "▲" : tone === "loss" ? "▼" : "";
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatPctPoint(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%p`;
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
