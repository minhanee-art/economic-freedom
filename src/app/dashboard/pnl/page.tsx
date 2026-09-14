// 손익 분석 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getDividends } from "@/lib/queries";
import { sql } from "@/lib/db";
import { PnLClient } from "./pnl-client";
import type { PurchaseRecord } from "@/types";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

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

  return (
    <PnLClient
      holdings={holdings}
      costBases={costBases}
      purchaseRecords={purchaseRecords as unknown as PurchaseRecord[]}
      totalDividend={totalDividend}
    />
  );
}
