// 거래내역 일괄 등록 API (매수/매도/배당 + 중복 필터)
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

interface ImportItem {
  date: string;
  code: string;
  name: string;
  type?: string;
  qty: number;
  price: number;
  amount: number;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    const userId = session.userId;

    const { items, skipDuplicates = true } = (await request.json()) as {
      items: ImportItem[];
      skipDuplicates?: boolean;
    };
    if (!items?.length) return NextResponse.json({ error: "데이터 없음" }, { status: 400 });

    const holdings = await sql`SELECT id, code, shares FROM holdings WHERE user_id = ${userId}`;
    const holdingMap = new Map((holdings as any[]).map((h) => [h.code, { ...h }]));

    const existingBuyKeys = new Set<string>();
    const existingDividendKeys = new Set<string>();

    if (skipDuplicates) {
      const existingItems = await sql`
        SELECT pi.code, pi.quantity, pi.price_at_purchase, pr.date
        FROM purchase_items pi
        JOIN purchase_records pr ON pr.id = pi.record_id
        WHERE pr.user_id = ${userId}
      `;
      (existingItems as any[]).forEach((item) => {
        existingBuyKeys.add(`${item.date}|${item.code}|${item.quantity}|${item.price_at_purchase}`);
      });

      const existingDivs = await sql`
        SELECT d.holding_id, d.amount, d.date, h.code
        FROM dividends d JOIN holdings h ON h.id = d.holding_id
        WHERE d.user_id = ${userId}
      `;
      (existingDivs as any[]).forEach((d) => {
        existingDividendKeys.add(`${d.date}|${d.code}|${d.amount}`);
      });
    }

    const buyItems = items.filter((i) => !i.type || i.type === "매수");
    const sellItems = items.filter((i) => i.type === "매도");
    const dividendItems = items.filter((i) => i.type === "배당");
    let buyCount = 0, sellCount = 0, dividendCount = 0, totalRecords = 0, dupSkipped = 0;
    const autoAdded: string[] = [];

    async function getOrCreateHolding(item: ImportItem) {
      let holding = holdingMap.get(item.code) as any;
      if (!holding) {
        const [h] = await sql`
          INSERT INTO holdings (user_id, code, name, category, sub_category, current_price, target_pct)
          VALUES (${userId}, ${item.code}, ${item.name}, '주식', '기타', ${item.price || 0}, 0)
          RETURNING id, code, shares
        `;
        holding = h;
        holdingMap.set(item.code, holding);
        autoAdded.push(`${item.name}(${item.code})`);
      }
      return holding;
    }

    const filteredBuys = skipDuplicates
      ? buyItems.filter((row) => {
          const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
          if (existingBuyKeys.has(key)) { dupSkipped++; return false; }
          return true;
        })
      : buyItems;

    const dateGroups = new Map<string, ImportItem[]>();
    filteredBuys.forEach((item) => {
      const arr = dateGroups.get(item.date) ?? [];
      arr.push(item);
      dateGroups.set(item.date, arr);
    });

    for (const [date, rows] of dateGroups) {
      const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
      const [record] = await sql`
        INSERT INTO purchase_records (user_id, date, total_spent, total_value_after)
        VALUES (${userId}, ${date}, ${totalSpent}, 0) RETURNING id
      `;
      totalRecords++;
      for (const row of rows) {
        const h = await getOrCreateHolding(row);
        await sql`INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost) VALUES (${record.id}, ${h.id}, ${row.code}, ${row.name}, ${row.qty}, ${row.price}, ${row.amount})`;
        await sql`UPDATE holdings SET shares = shares + ${row.qty} WHERE id = ${h.id}`;
        h.shares += row.qty;
        const [cb] = await sql`SELECT * FROM cost_basis WHERE user_id = ${userId} AND holding_id = ${h.id}`;
        if (cb) {
          await sql`UPDATE cost_basis SET total_cost = total_cost + ${row.amount}, total_shares = total_shares + ${row.qty} WHERE id = ${cb.id}`;
        } else {
          await sql`INSERT INTO cost_basis (user_id, holding_id, total_cost, total_shares) VALUES (${userId}, ${h.id}, ${row.amount}, ${row.qty})`;
        }
        buyCount++;
      }
    }

    for (const row of sellItems) {
      if (skipDuplicates) {
        const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
        if (existingBuyKeys.has(key)) { dupSkipped++; continue; }
      }
      const h = await getOrCreateHolding(row);
      await sql`UPDATE holdings SET shares = GREATEST(0, shares - ${row.qty}) WHERE id = ${h.id}`;
      const [cb] = await sql`SELECT * FROM cost_basis WHERE user_id = ${userId} AND holding_id = ${h.id}`;
      if (cb && cb.total_shares > 0) {
        const avgCost = cb.total_cost / cb.total_shares;
        await sql`UPDATE cost_basis SET total_cost = GREATEST(0, total_cost - ${Math.round(avgCost * row.qty)}), total_shares = GREATEST(0, total_shares - ${row.qty}) WHERE id = ${cb.id}`;
      }
      sellCount++;
    }

    for (const row of dividendItems) {
      const h = await getOrCreateHolding(row);
      if (skipDuplicates) {
        const key = `${row.date}|${h.code}|${row.amount}`;
        if (existingDividendKeys.has(key)) { dupSkipped++; continue; }
      }
      await sql`INSERT INTO dividends (user_id, holding_id, amount, date, memo) VALUES (${userId}, ${h.id}, ${row.amount}, ${row.date}, 'CSV 자동 등록')`;
      dividendCount++;
    }

    return NextResponse.json({ success: true, totalRecords, buyCount, sellCount, dividendCount, dupSkipped, autoAdded: [...new Set(autoAdded)] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
