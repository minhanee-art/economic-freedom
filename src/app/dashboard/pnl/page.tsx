// 손익 분석 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings, getCostBases, getDividends } from "@/lib/queries";
import { sql } from "@/lib/db";
import { PnLClient } from "./pnl-client";
import type { Holding, CostBasis } from "@/types";

export default async function PnLPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdings, costBases, purchaseRecords, dividends] = await Promise.all([
    getHoldings(userId),
    getCostBases(userId),
    sql`SELECT id, user_id, total_spent, total_value_after, date::text, created_at::text FROM purchase_records WHERE user_id = ${userId} ORDER BY date ASC`,
    getDividends(userId),
  ]);

  const totalDividend = (dividends as any[]).reduce(
    (s: number, d: any) => s + Number(d.amount),
    0
  );

  return (
    <PnLClient
      holdings={holdings as unknown as Holding[]}
      costBases={costBases as unknown as CostBasis[]}
      purchaseRecords={purchaseRecords as any[]}
      totalDividend={totalDividend}
    />
  );
}
