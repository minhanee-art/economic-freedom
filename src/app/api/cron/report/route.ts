// 매월 1일 텔레그램 월간 리포트 — Vercel Cron이 호출 (vercel.json 참고)
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getHoldings, getCostBases, getProfile, getDividends } from "@/lib/queries";
import {
  computeHoldingsWithPnL,
  computeRebalance,
  getCategoryAdvice,
} from "@/lib/portfolio";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatKRW, formatPercent } from "@/lib/utils";
import type { Holding, CostBasis, Profile, Dividend } from "@/types";

// DB를 읽으므로 항상 동적 실행 (캐시 금지)
export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 대상 유저 id 확인 — REPORT_USER_ID 우선, 없으면 REPORT_USER_EMAIL로 users 테이블 조회 */
async function resolveUserId(): Promise<string | null> {
  const directId = process.env.REPORT_USER_ID;
  if (directId) return directId;

  const email = process.env.REPORT_USER_EMAIL;
  if (!email) return null;
  const [row] = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (row?.id as string) ?? null;
}

function buildMessage(
  holdings: Holding[],
  costBases: CostBasis[],
  dividends: Dividend[],
  monthlyBudget: number
): string {
  const withPnL = computeHoldingsWithPnL(holdings, costBases);
  const active = withPnL.filter((h) => h.shares > 0 || h.target_pct > 0);

  const totalValue = withPnL.reduce((s, h) => s + h.current_value, 0);
  const totalCost = withPnL.reduce((s, h) => s + h.total_cost, 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const totalDividend = dividends.reduce((s, d) => s + Number(d.amount), 0);

  const { categories, categoryAlerts, holdingAlerts } = computeRebalance(active);

  // YYYY년 M월 (서버 타임존 영향 없이 KST 기준으로 표기)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const label = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월`;

  const pnlEmoji = pnl >= 0 ? "📈" : "📉";

  const lines: string[] = [
    `📊 <b>연금 포트폴리오 월간 리포트</b>`,
    label,
    "",
    `💰 총 평가금액: <b>${formatKRW(totalValue)}</b>`,
    `${pnlEmoji} 총 손익: <b>${formatKRW(pnl)}</b> (${formatPercent(pnlPct)})`,
    `💵 누적 배당: ${formatKRW(totalDividend)}`,
    `🗓 월 적립금: ${formatKRW(monthlyBudget)}`,
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

async function handle(request: NextRequest) {
  // 인증: Vercel Cron은 Authorization: Bearer <CRON_SECRET> 자동 첨부.
  // 수동 테스트는 ?secret=<CRON_SECRET> 쿼리로도 허용.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const querySecret = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "대상 유저 미지정 (REPORT_USER_ID 또는 REPORT_USER_EMAIL 설정 필요)" },
      { status: 400 }
    );
  }

  const [holdings, costBases, profile, dividends] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    getProfile(userId),
    getDividends(userId),
  ]);

  // profiles 테이블이 비어 있을 수 있음 — 대시보드와 동일하게 기본값 30만 사용
  const monthlyBudget =
    (profile as unknown as Profile | null)?.monthly_budget ?? 300000;

  const message = buildMessage(
    holdings as unknown as Holding[],
    costBases as unknown as CostBasis[],
    dividends as unknown as Dividend[],
    monthlyBudget
  );

  const appUrl = process.env.APP_URL ?? "https://economic-freedom.vercel.app";
  await sendTelegramMessage(message, {
    buttonUrl: `${appUrl}/dashboard`,
    buttonText: "📊 대시보드 열기",
  });

  return NextResponse.json({ success: true, sentTo: userId });
}

// Vercel Cron은 GET으로 호출. 수동 트리거도 GET.
export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
