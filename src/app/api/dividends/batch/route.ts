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
  const ownedSet = new Set(ownedHoldings.map((h: any) => h.id));

  const validItems = items.filter((i) => ownedSet.has(i.holdingId));
  if (validItems.length === 0) return NextResponse.json({ inserted: 0, updated: 0 });

  let inserted = 0;
  let updated = 0;

  for (const item of validItems) {
    const [existing] = await sql`
      SELECT id FROM dividends
      WHERE holding_id = ${item.holdingId} AND date = ${item.date} AND user_id = ${session.userId}
    `;
    if (existing) {
      await sql`
        UPDATE dividends
        SET amount = ${item.amount}, memo = ${item.memo}
        WHERE id = ${existing.id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO dividends (user_id, holding_id, amount, date, memo)
        VALUES (${session.userId}, ${item.holdingId}, ${item.amount}, ${item.date}, ${item.memo})
      `;
      inserted++;
    }
  }

  return NextResponse.json({ inserted, updated });
}
