import { format } from "date-fns";
import { ko } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "yyyy-MM-dd") {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return format(d, pattern, { locale: ko });
}

/** 원화 축약 표시: 1억↑ → "X.X억", 1만↑ → "X.X만", 그 외 → "₩1,234" */
export function formatKRW(amount: number): string {
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

/** 원화 전체 표시: ₩1,234,567 */
export function formatFullKRW(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
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
