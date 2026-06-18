// 텔레그램 리포트 — 월간(1일)/주간(월요일)/투자알림(5일) 메시지 생성 및 전송
import { sql } from "@/lib/db";
import { getHoldings, getCostBases, getProfile, getDividends } from "@/lib/queries";
import {
  computeHoldingsWithPnL,
  computeRebalance,
  getCategoryAdvice,
} from "@/lib/portfolio";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatKRW, formatPercent } from "@/lib/utils";
import type {
  Holding,
  CostBasis,
  Profile,
  Dividend,
  HoldingWithPnL,
} from "@/types";

const APP_URL = process.env.APP_URL ?? "https://economic-freedom.vercel.app";
const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 서버 타임존과 무관하게 KST 기준 시각 */
function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** 대상 유저 id — REPORT_USER_ID 우선, 없으면 REPORT_USER_EMAIL로 users 테이블 조회 */
export async function resolveUserId(): Promise<string | null> {
  const directId = process.env.REPORT_USER_ID;
  if (directId) return directId;

  const email = process.env.REPORT_USER_EMAIL;
  if (!email) return null;
  const [row] = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (row?.id as string) ?? null;
}

export interface PortfolioData {
  holdings: HoldingWithPnL[];
  active: HoldingWithPnL[];
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPct: number;
  totalDividend: number;
  monthlyBudget: number;
}

/** 유저의 포트폴리오 데이터 로드 + 파생값 계산 (대시보드와 동일) */
export async function loadPortfolio(userId: string): Promise<PortfolioData> {
  const [holdings, costBases, profile, dividends] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getDividends(userId),
  ]);

  const withPnL = computeHoldingsWithPnL(
    holdings as unknown as Holding[],
    costBases as unknown as CostBasis[]
  );
  const active = withPnL.filter((h) => h.shares > 0 || h.target_pct > 0);
  const totalValue = withPnL.reduce((s, h) => s + h.current_value, 0);
  const totalCost = withPnL.reduce((s, h) => s + h.total_cost, 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const totalDividend = (dividends as unknown as Dividend[]).reduce(
    (s, d) => s + Number(d.amount),
    0
  );
  // profiles가 비어 있으면 대시보드와 동일하게 기본값 30만
  const monthlyBudget =
    (profile as unknown as Profile | null)?.monthly_budget ?? 300000;

  return { holdings: withPnL, active, totalValue, totalCost, pnl, pnlPct, totalDividend, monthlyBudget };
}

// ── 메시지 빌더 ───────────────────────────────────────────

/** 월간 리포트 (매월 1일) — 전체 요약 + 자산군 비중 + 리밸런싱 */
function buildMonthlyMessage(d: PortfolioData): string {
  const kst = kstNow();
  const label = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월`;
  const pnlEmoji = d.pnl >= 0 ? "📈" : "📉";
  const { categories, categoryAlerts, holdingAlerts } = computeRebalance(d.active);

  const lines: string[] = [
    `📊 <b>연금 포트폴리오 월간 리포트</b>`,
    label,
    "",
    `💰 총 평가금액: <b>${formatKRW(d.totalValue)}</b>`,
    `${pnlEmoji} 총 손익: <b>${formatKRW(d.pnl)}</b> (${formatPercent(d.pnlPct)})`,
    `💵 누적 배당: ${formatKRW(d.totalDividend)}`,
    `🗓 월 적립금: ${formatKRW(d.monthlyBudget)}`,
  ];

  if (categories.length > 0) {
    lines.push("", `<b>자산군별 비중</b> (현재 / 목표)`);
    for (const c of categories) {
      const sign = c.diff > 0 ? "+" : "";
      const alert =
        c.target > 0 && Math.abs(c.diff) >= 3
          ? c.diff > 0
            ? " 🔴초과"
            : " 🔵부족"
          : "";
      lines.push(
        `• ${esc(c.name)} ${c.current.toFixed(1)}% / ${c.target.toFixed(1)}% (${sign}${c.diff}%p)${alert}`
      );
    }
  }

  if (categoryAlerts.length > 0 || holdingAlerts.length > 0) {
    lines.push("", `<b>⚠️ 리밸런싱 조언</b>`);
    for (const c of categoryAlerts) {
      lines.push(`• ${esc(getCategoryAdvice(c.name, c.diff))}`);
    }
    for (const h of holdingAlerts) {
      const sign = h.diff > 0 ? "+" : "";
      lines.push(
        `• ${esc(h.name)}: 목표 ${h.target_pct}% → 현재 ${h.actual_pct.toFixed(1)}% (${sign}${h.diff}%p)`
      );
    }
  }

  return lines.join("\n");
}

/** 주간 리포트 (매주 월요일) — 간단 요약 + 손익 상위 3종목 */
function buildWeeklyMessage(d: PortfolioData): string {
  const kst = kstNow();
  const label = `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${WEEKDAY_KR[kst.getUTCDay()]})`;
  const pnlEmoji = d.pnl >= 0 ? "📈" : "📉";

  const top3 = d.holdings
    .filter((h) => h.shares > 0 && h.total_cost > 0)
    .sort((a, b) => b.profit_loss_pct - a.profit_loss_pct)
    .slice(0, 3);

  const lines: string[] = [
    `📅 <b>주간 포트폴리오 리포트</b>`,
    label,
    "",
    `💰 총 평가금액: <b>${formatKRW(d.totalValue)}</b>`,
    `${pnlEmoji} 총 손익: <b>${formatKRW(d.pnl)}</b> (${formatPercent(d.pnlPct)})`,
  ];

  if (top3.length > 0) {
    lines.push("", `🏆 <b>손익 상위 ${top3.length}종목</b>`);
    const medal = ["🥇", "🥈", "🥉"];
    top3.forEach((h, i) => {
      lines.push(
        `${medal[i]} ${esc(h.name)}  <b>${formatPercent(h.profit_loss_pct)}</b> (${formatKRW(h.profit_loss)})`
      );
    });
  } else {
    lines.push("", `보유 종목이 없습니다.`);
  }

  return lines.join("\n");
}

/** 투자알림 (매월 5일) — 적립 리마인더 */
function buildReminderMessage(d: PortfolioData): string {
  const kst = kstNow();
  const label = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;

  return [
    `🔔 <b>이번 달 투자 알림</b>`,
    label,
    "",
    `이번 달 적립 투자할 시점입니다.`,
    `💵 월 적립금: <b>${formatKRW(d.monthlyBudget)}</b>`,
    `💰 현재 총 평가금액: ${formatKRW(d.totalValue)}`,
    "",
    `아래 버튼에서 매수 계획을 확인하세요. 👇`,
  ].join("\n");
}

// ── 전송 ──────────────────────────────────────────────────

export type ReportType = "monthly" | "weekly" | "reminder";

export const REPORT_TYPES: ReportType[] = ["monthly", "weekly", "reminder"];

export async function sendReport(type: ReportType, d: PortfolioData): Promise<void> {
  if (type === "monthly") {
    await sendTelegramMessage(buildMonthlyMessage(d), {
      buttonUrl: `${APP_URL}/dashboard`,
      buttonText: "📊 대시보드 열기",
    });
  } else if (type === "weekly") {
    await sendTelegramMessage(buildWeeklyMessage(d), {
      buttonUrl: `${APP_URL}/dashboard`,
      buttonText: "📊 대시보드 열기",
    });
  } else {
    await sendTelegramMessage(buildReminderMessage(d), {
      buttonUrl: `${APP_URL}/dashboard/buy`,
      buttonText: "🛒 매수 계획 보기",
    });
  }
}

/** 오늘(KST) 발송해야 할 리포트 종류 — 1일=월간, 월요일=주간, 5일=투자알림 */
export function dueReports(date: Date = kstNow()): ReportType[] {
  const day = date.getUTCDate();
  const weekday = date.getUTCDay(); // 0=일 .. 1=월
  const due: ReportType[] = [];
  if (day === 1) due.push("monthly");
  if (weekday === 1) due.push("weekly");
  if (day === 5) due.push("reminder");
  return due;
}
