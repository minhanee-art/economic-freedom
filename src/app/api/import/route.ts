// 거래내역 일괄 등록 API (매수/매도/배당 + 중복 필터)
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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

interface PlannedHolding {
  id: string;
  code: string;
  shares: number;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    const userId = session.userId;

    const body = (await request.json().catch(() => null)) as { items?: ImportItem[]; skipDuplicates?: boolean } | null;
    const items = body?.items;
    const skipDuplicates = body?.skipDuplicates ?? true;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "데이터 없음" }, { status: 400 });
    }

    // 입력 검증 — INTEGER 오버플로/NaN/음수로 인한 500·데이터 오염 방지
    const INT_MAX = 2_147_483_647;
    for (const it of items) {
      const qty = Number(it.qty);
      const price = Number(it.price);
      const amount = Number(it.amount);
      if (
        !it.code || typeof it.code !== "string" ||
        !it.date || typeof it.date !== "string" ||
        !Number.isFinite(qty) || qty < 0 || qty > INT_MAX ||
        !Number.isFinite(price) || price < 0 || price > INT_MAX ||
        !Number.isFinite(amount) || amount < 0 || amount > INT_MAX
      ) {
        return NextResponse.json({ error: "유효하지 않은 거래 항목이 포함됐습니다." }, { status: 400 });
      }
    }

    const holdings = await sql`SELECT id, code, shares FROM holdings WHERE user_id = ${userId}`;
    const holdingMap = new Map<string, PlannedHolding>(
      holdings.map((h) => [h.code as string, { id: h.id as string, code: h.code as string, shares: h.shares as number }])
    );

    const existingBuyKeys = new Set<string>();
    const existingSellKeys = new Set<string>();
    const existingDividendKeys = new Set<string>();

    if (skipDuplicates) {
      // date::text 로 비교 — Neon이 DATE를 JS Date로 파싱하므로 ::text 없이는 키 형식이 어긋나 dedup이 무력해진다.
      const existingItems = await sql`
        SELECT pi.code, pi.quantity, pi.price_at_purchase, pr.date::text AS date
        FROM purchase_items pi
        JOIN purchase_records pr ON pr.id = pi.record_id
        WHERE pr.user_id = ${userId}
      `;
      existingItems.forEach((item) => {
        existingBuyKeys.add(`${item.date}|${item.code}|${item.quantity}|${item.price_at_purchase}`);
      });

      const existingSells = await sql`
        SELECT code, quantity, price, date::text AS date FROM sell_items WHERE user_id = ${userId}
      `;
      existingSells.forEach((s) => {
        existingSellKeys.add(`${s.date}|${s.code}|${s.quantity}|${s.price}`);
      });

      const existingDivs = await sql`
        SELECT d.amount, d.date::text AS date, h.code
        FROM dividends d JOIN holdings h ON h.id = d.holding_id
        WHERE d.user_id = ${userId}
      `;
      existingDivs.forEach((d) => {
        existingDividendKeys.add(`${d.date}|${d.code}`);
      });
    }

    const buyItems = items.filter((i) => !i.type || i.type === "매수");
    const sellItems = items.filter((i) => i.type === "매도");
    const dividendItems = items.filter((i) => i.type === "배당");
    let buyCount = 0, sellCount = 0, dividendCount = 0, totalRecords = 0, dupSkipped = 0;
    const autoAdded: string[] = [];

    // 모든 쓰기를 하나의 트랜잭션으로 누적 — 부분 실패 시 전체 롤백.
    const queries: ReturnType<typeof sql>[] = [];

    // 신규 holding은 트랜잭션 전에 UUID를 미리 발급해 INSERT를 큐에 넣고 메모리 맵에 캐시한다.
    function planHolding(item: ImportItem): PlannedHolding {
      let holding = holdingMap.get(item.code);
      if (!holding) {
        holding = { id: randomUUID(), code: item.code, shares: 0 };
        holdingMap.set(item.code, holding);
        queries.push(sql`
          INSERT INTO holdings (id, user_id, code, name, category, sub_category, current_price, target_pct)
          VALUES (${holding.id}, ${userId}, ${item.code}, ${item.name}, '주식', '기타', ${item.price || 0}, 0)
        `);
        autoAdded.push(`${item.name}(${item.code})`);
      }
      return holding;
    }

    // --- 매수 ---
    const filteredBuys = skipDuplicates
      ? buyItems.filter((row) => {
          const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
          if (existingBuyKeys.has(key)) { dupSkipped++; return false; }
          existingBuyKeys.add(key); // 같은 파일 내 중복도 방지
          return true;
        })
      : buyItems;

    const dateGroups = new Map<string, ImportItem[]>();
    filteredBuys.forEach((item) => {
      const arr = dateGroups.get(item.date) ?? [];
      arr.push(item);
      dateGroups.set(item.date, arr);
    });

    // 날짜 오름차순으로 누적 투입원금을 total_value_after에 기록(과거 시장가는 복원 불가하므로 원가 기준선).
    let cumulativeInvested = 0;
    for (const date of [...dateGroups.keys()].sort()) {
      const rows = dateGroups.get(date)!;
      const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
      cumulativeInvested += totalSpent;
      const recordId = randomUUID();
      queries.push(sql`
        INSERT INTO purchase_records (id, user_id, date, total_spent, total_value_after)
        VALUES (${recordId}, ${userId}, ${date}, ${totalSpent}, ${cumulativeInvested})
      `);
      totalRecords++;
      for (const row of rows) {
        const h = planHolding(row);
        queries.push(sql`INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost) VALUES (${recordId}, ${h.id}, ${row.code}, ${row.name}, ${row.qty}, ${row.price}, ${row.amount})`);
        queries.push(sql`UPDATE holdings SET shares = shares + ${row.qty} WHERE id = ${h.id}`);
        queries.push(sql`
          INSERT INTO cost_basis (user_id, holding_id, total_cost, total_shares)
          VALUES (${userId}, ${h.id}, ${row.amount}, ${row.qty})
          ON CONFLICT (user_id, holding_id)
          DO UPDATE SET total_cost = cost_basis.total_cost + EXCLUDED.total_cost,
                        total_shares = cost_basis.total_shares + EXCLUDED.total_shares
        `);
        buyCount++;
      }
    }

    // --- 매도 --- (sell_items에 영속화 → 재임포트 시 중복 차감 방지)
    for (const row of sellItems) {
      if (skipDuplicates) {
        const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
        if (existingSellKeys.has(key)) { dupSkipped++; continue; }
        existingSellKeys.add(key);
      }
      const h = planHolding(row);
      queries.push(sql`UPDATE holdings SET shares = GREATEST(0, shares - ${row.qty}) WHERE id = ${h.id}`);
      // 평균단가 기반 원가 차감 — read 없이 SQL 내에서 계산
      queries.push(sql`
        UPDATE cost_basis
        SET total_cost = GREATEST(0, ROUND(total_cost - (total_cost::numeric / NULLIF(total_shares, 0)) * ${row.qty})),
            total_shares = GREATEST(0, total_shares - ${row.qty})
        WHERE user_id = ${userId} AND holding_id = ${h.id} AND total_shares > 0
      `);
      queries.push(sql`
        INSERT INTO sell_items (user_id, holding_id, code, name, quantity, price, date)
        VALUES (${userId}, ${h.id}, ${row.code}, ${row.name}, ${row.qty}, ${row.price}, ${row.date})
      `);
      sellCount++;
    }

    // --- 배당 --- (dividends는 (holding_id,date) UNIQUE이므로 같은 종목·날짜는 1건만 존재)
    const seenDiv = new Set<string>();
    for (const row of dividendItems) {
      const h = planHolding(row);
      const key = `${row.date}|${h.code}`;
      // 같은 파일 내 (종목,날짜) 중복은 항상 1건으로 축약 — UNIQUE 위반 abort·이중 카운트 방지
      if (seenDiv.has(key)) { dupSkipped++; continue; }
      seenDiv.add(key);
      if (skipDuplicates && existingDividendKeys.has(key)) { dupSkipped++; continue; }
      // DO NOTHING: 기존 (종목,날짜) 배당을 조용히 덮어쓰지 않는다(실제 금액 유실 방지).
      queries.push(sql`
        INSERT INTO dividends (user_id, holding_id, amount, date, memo)
        VALUES (${userId}, ${h.id}, ${row.amount}, ${row.date}, 'CSV 자동 등록')
        ON CONFLICT (holding_id, date) DO NOTHING
      `);
      dividendCount++;
    }

    if (queries.length > 0) {
      await sql.transaction(queries);
    }

    return NextResponse.json({ success: true, totalRecords, buyCount, sellCount, dividendCount, dupSkipped, autoAdded: [...new Set(autoAdded)] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
