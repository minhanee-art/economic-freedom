// 매수 이력 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPurchaseRecords, getPurchaseRecordsCount, getHoldings } from "@/lib/queries";
import { HistoryClient } from "./history-client";
import type { Holding } from "@/types";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [initialRecords, totalCount, holdings] = await Promise.all([
    getPurchaseRecords(userId, 20, 0),
    getPurchaseRecordsCount(userId),
    getHoldings(userId),
  ]);

  return (
    <HistoryClient
      initialRecords={initialRecords as any[]}
      totalCount={totalCount as number}
      userId={userId}
      holdings={holdings as unknown as Holding[]}
    />
  );
}
