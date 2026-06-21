// 매수 이력 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPurchaseRecords, getPurchaseRecordsCount, getHoldings, type PurchaseRecordRow } from "@/lib/queries";
import { HistoryClient } from "./history-client";
import type { Holding } from "@/types";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  let initialRecords: PurchaseRecordRow[] = [];
  let totalCount = 0;
  let holdings: Holding[] = [];

  try {
    const [r, c, h] = await Promise.all([
      getPurchaseRecords(userId, 20, 0),
      getPurchaseRecordsCount(userId),
      getHoldings(userId),
    ]);
    initialRecords = r;
    totalCount = c;
    holdings = h;
  } catch (err) {
    console.error("[history/page] DB error:", err);
  }

  return (
    <HistoryClient
      initialRecords={initialRecords}
      totalCount={totalCount}
      userId={userId}
      holdings={holdings}
    />
  );
}
