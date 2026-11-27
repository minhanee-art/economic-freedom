// 손익 분석 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getDividends } from "@/lib/queries";
import { sql } from "@/lib/db";
import { NoHoldingsState } from "@/components/portfolio/no-holdings-state";
import { PnLClient } from "./pnl-client";
import type { PurchaseRecord } from "@/types";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export const metadata: Metadata = { title: "자산·손익 · 가족연금계획" };

export default async function PnLPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;
  const accountId = await getActivePortfolioAccountId(userId);

  const [holdings, costBases, purchaseRecords, dividends] = await Promise.all([
    getHoldings(userId, accountId),
    getCostBases(userId, accountId),
    sql`SELECT id, user_id, account_id, total_spent, total_value_after, date::text, created_at::text FROM purchase_records WHERE user_id = ${userId} AND account_id = ${accountId} ORDER BY date ASC`,
    getDividends(userId, accountId),
  ]);

  const totalDividend = dividends.reduce((s, d) => s + Number(d.amount), 0);

  // 수량이 있는 종목이 없으면 손익이 전부 0원·0%가 되므로 계산 화면 대신 빈 상태를 보인다
  if (!holdings.some((h) => Number(h.shares) > 0)) {
    return holdings.length === 0 ? (
      <NoHoldingsState description="손익은 기록한 매수 원가와 현재가로 계산합니다. 종목을 추가하고 이미 산 수량과 단가를 기록하면 종목별 손익이 여기에 표시됩니다." />
    ) : (
      <NoHoldingsState
        title="손익을 계산할 보유 수량이 없습니다"
        actionLabel="매수 기록"
        description="추가한 종목이 모두 0주입니다. 이미 산 수량과 단가를 기록하면 종목별 손익이 여기에 표시됩니다."
      />
    );
  }

  return (
    <PnLClient
      holdings={holdings}
      costBases={costBases}
      purchaseRecords={purchaseRecords as unknown as PurchaseRecord[]}
      totalDividend={totalDividend}
    />
  );
}
