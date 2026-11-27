import { formatKRW } from "@/lib/utils";

// 화면 낭독기가 읽을 차트 요약 문장(차트 래퍼의 aria-label)

export function allocationSummary(data: { name: string; current: number; target: number }[]): string {
  if (data.length === 0) return "현재 vs 목표 비중: 데이터 없음";
  return `현재 vs 목표 비중: ${data.map((d) => `${d.name} 현재 ${d.current.toFixed(1)}%, 목표 ${d.target.toFixed(1)}%`).join("; ")}`;
}

export function categorySummary(data: { name: string; value: number; pct: number }[]): string {
  if (data.length === 0) return "자산군별 비중: 데이터 없음";
  return `자산군별 비중: ${data.map((d) => `${d.name} ${d.pct.toFixed(1)}% (${formatKRW(d.value)})`).join(", ")}`;
}

export function pnlTrendSummary(data: { date: string; invested: number; value: number }[]): string {
  if (data.length === 0) return "누적 투입과 평가금액 추이: 데이터 없음";
  const first = data[0];
  const last = data[data.length - 1];
  return `누적 투입과 평가금액 추이, ${first.date}부터 ${last.date}까지. 마지막 날 누적 투입 ${formatKRW(last.invested)}, 평가금액 ${formatKRW(last.value)}`;
}

export function dividendSummary(data: { month: string; amount: number }[]): string {
  if (data.length === 0) return "월별 배당금: 데이터 없음";
  const total = data.reduce((s, d) => s + d.amount, 0);
  const max = data.reduce((m, d) => (d.amount > m.amount ? d : m), data[0]);
  return `월별 배당금 ${data.length}개월, 합계 ${formatKRW(total)}, 가장 많은 달 ${max.month} ${formatKRW(max.amount)}`;
}
