// 배당 관리 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { sql } from "@/lib/db";
import { DividendClient } from "./dividend-client";

export default async function DividendPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [holdingsWithShares, dividends] = await Promise.all([
    sql`SELECT id, code, name, category FROM holdings WHERE user_id = ${userId} AND shares > 0 ORDER BY name`,
    sql`SELECT d.*, h.name AS holding_name, h.code AS holding_code FROM dividends d LEFT JOIN holdings h ON h.id = d.holding_id WHERE d.user_id = ${userId} ORDER BY d.date DESC`,
  ]);

  return (
    <DividendClient
      holdings={holdingsWithShares as any[]}
      initialDividends={dividends as any[]}
      userId={userId}
    />
  );
}
