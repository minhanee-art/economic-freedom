// 배당금 배치 upsert API — 자동조회에서 사용
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

interface BatchItem {
  holdingId: string;
  amount: number;
  date: string;
  memo: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { items }: { items: BatchItem[] } = await request.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0 });
  }

  // holding이 실제로 이 사용자 소유인지 검증
  const holdingIds = [...new Set(items.map((i) => i.holdingId))];
  const ownedHoldings = await sql`
    SELECT id FROM holdings WHERE id = ANY(${holdingIds}::uuid[]) AND user_id = ${session.userId}
  `;
  const ownedSet = new Set(ownedHoldings.map((h) => h.id));

  const validItems = items.filter((i) => ownedSet.has(i.holdingId));
  if (validItems.length === 0) return NextResponse.json({ inserted: 0, updated: 0 });

  // 기존 (holding_id, date)를 한 번에 조회해 신규/갱신 수를 정확히 집계
  const existing = await sql`
    SELECT holding_id, date::text AS date FROM dividends
    WHERE user_id = ${session.userId} AND holding_id = ANY(${holdingIds}::uuid[])
  `;
  const existingSet = new Set(existing.map((e) => `${e.holding_id}|${e.date}`));
  let inserted = 0;
  let updated = 0;
  for (const item of validItems) {
    if (existingSet.has(`${item.holdingId}|${item.date}`)) updated++;
    else inserted++;
  }

  // 모든 upsert를 하나의 트랜잭션으로 (원자성 + N+1 제거). (holding_id,date) UNIQUE 활용.
  await sql.transaction(
    validItems.map((item) => sql`
      INSERT INTO dividends (user_id, holding_id, amount, date, memo)
      VALUES (${session.userId}, ${item.holdingId}, ${item.amount}, ${item.date}, ${item.memo})
      ON CONFLICT (holding_id, date) DO UPDATE SET amount = EXCLUDED.amount, memo = EXCLUDED.memo
    `)
  );

  return NextResponse.json({ inserted, updated });
}
