// 배당 관리 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { sql } from "@/lib/db";
import { NoHoldingsState } from "@/components/portfolio/no-holdings-state";
import { DividendClient } from "./dividend-client";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export const metadata: Metadata = { title: "배당 기록 · 가족연금계획" };

export default async function DividendPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;
  const accountId = await getActivePortfolioAccountId(userId);

  let holdingsWithShares: { id: string; code: string; name: string; category: string; shares: number }[] = [];
  let dividends: {
    id: string; holding_id: string; amount: number; date: string; memo: string | null;
    created_at: string; holding_name: string | null; holding_code: string | null;
  }[] = [];

  try {
    const [h, d] = await Promise.all([
      sql`SELECT id, code, name, category, shares FROM holdings WHERE user_id = ${userId} AND account_id = ${accountId} AND shares > 0 ORDER BY name`,
      sql`SELECT d.id, d.holding_id, d.amount, d.memo, d.date::text, d.created_at::text, h.name AS holding_name, h.code AS holding_code FROM dividends d LEFT JOIN holdings h ON h.id = d.holding_id WHERE d.user_id = ${userId} AND d.account_id = ${accountId} ORDER BY d.date DESC`,
    ]);
    holdingsWithShares = h as unknown as typeof holdingsWithShares;
    dividends = d as unknown as typeof dividends;
  } catch (err) {
    console.error("[dividend/page] DB error:", err);
  }

  // 배당은 수량이 있는 종목에만 기록한다. 기록도 종목도 없으면 0원 요약 대신 빈 상태를 보인다
  if (holdingsWithShares.length === 0 && dividends.length === 0) {
    return (
      <NoHoldingsState
        title="배당을 기록할 종목이 없습니다"
        description="배당은 수량이 있는 종목에 기록합니다. 종목을 추가하고 이미 산 수량을 기록하면 이 화면에서 받은 배당을 입력할 수 있습니다."
      />
    );
  }

  return (
    <DividendClient
      holdings={holdingsWithShares}
      initialDividends={dividends}
      userId={userId}
    />
  );
}
