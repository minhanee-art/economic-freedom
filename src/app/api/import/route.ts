// 거래내역 일괄 등록 API (매수/매도/배당 + 중복 필터)
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";

interface ImportItem {
  date: string;
  code: string;
  name: string;
  type?: string;
  qty: number;
  price: number;
  amount: number;
}

const NAME_CODE_MAP: Record<string, string> = {
  "TIGER200": "102110",
  "TIGER골드선물": "319640",
  "TIGER나스닥100": "133690",
  "TIGER미국S&P500": "360750",
  "TIGER미국SP500": "360750",
  "TIGER미국에스앤피500": "360750",
  "TIGER미국채10년선물": "305080",
  "TIGERMSCI": "182480",
  "TIGER미국MSCI리츠": "182480",
  "TIGER미국배당": "458730",
  "TIGER필라델피아": "497570",
  "필라델피아AI반도체": "497570",
  "KODEXMSCI": "251350",
  "KODEXWTI": "261220",
  "KODEX인도": "453810",
  "KODEX코스피100": "237350",
  "KODEX은선물": "144600",
  "KODEX단기채권": "153130",
  "KODEX200": "069500",
  "KODEX레버리지": "122630",
  "KODEX인버스": "114800",
  "ACE코스피": "305050",
  "ACE코스닥": "354500",
  "ACE싱가포르": "316300",
  "ACE테슬라": "457480",
  "PLUS고배당": "161510",
  "KINDEX": "354350",
  "ARIRANG": "195980",
};

function matchFundCode(name: string): string {
  const normalized = name.replace(/\s/g, "");
  for (const [key, code] of Object.entries(NAME_CODE_MAP)) {
    if (normalized.includes(key)) return code;
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    const userId = session.userId;
    const selected = await selectRequestAccount(request, userId);
    if (!selected.ok) return selected.response;
    const accountId = selected.accountId;

    const body = (await request.json().catch(() => null)) as { items?: ImportItem[]; skipDuplicates?: boolean } | null;
    const items = body?.items;
    const skipDuplicates = body?.skipDuplicates ?? true;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "데이터 없음" }, { status: 400 });
    }

    const normalizedItems = items.map((it) => ({
      ...it,
      code: String(it.code || matchFundCode(it.name || "")).trim(),
    }));

    // 입력 검증 — INTEGER 오버플로/NaN/음수/빈 종목코드로 인한 데이터 오염 방지
    const INT_MAX = 2_147_483_647;
    for (const it of normalizedItems) {
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

    // 이미 있는 종목은 미리 읽어 새 종목 INSERT 여부만 정한다. 이 읽기는 계획용일 뿐이고, 동시 요청이 같은 종목을
    // 먼저 만들어도 아래 INSERT가 ON CONFLICT DO NOTHING 이라 안전하다 (이후 문장은 종목 id를 코드로 다시 찾는다).
    const holdings = await sql`SELECT code FROM holdings WHERE user_id = ${userId} AND account_id = ${accountId}`;
    const knownCodes = new Set<string>(holdings.map((h) => h.code as string));

    const buyItems = normalizedItems.filter((i) => !i.type || i.type === "매수");
    const sellItems = normalizedItems.filter((i) => i.type === "매도");
    const dividendItems = normalizedItems.filter((i) => i.type === "배당");
    let buyCount = 0, sellCount = 0, dividendCount = 0, totalRecords = 0, dupSkipped = 0;
    const autoAdded: string[] = [];

    // 중복 판정은 전부 이 트랜잭션 안의 SQL 이 한다. Neon HTTP 트랜잭션은 앞 쿼리 결과로 분기할 수 없으므로,
    //  1) 맨 앞에서 계좌 단위 advisory lock 을 잡아 같은 계좌의 가져오기를 한 번에 하나씩만 실행하고,
    //  2) 이어지는 각 문장이 "이미 있으면 아무것도 안 함"을 스스로 판단한다 (READ COMMITTED 라 문장마다 앞 트랜잭션의
    //     커밋 결과를 새로 본다). 같은 파일을 동시에 두 번 보내면 뒤 요청은 앞 요청이 커밋된 뒤 전부 중복으로 건너뛴다.
    // 각 문장은 실제로 반영한 건수를 `inserted` 한 행으로 돌려준다 (응답 건수는 이 값으로 센다).
    const lock = sql`SELECT pg_advisory_xact_lock(hashtextextended(${`import:${accountId}`}, 0))`;
    const queries: ReturnType<typeof sql>[] = [];
    type Tally =
      | { kind: "holding"; label: string }
      | { kind: "buy"; items: number }
      | { kind: "sell" }
      | { kind: "dividend" };
    const tallies: Tally[] = [];

    function planHolding(item: ImportItem) {
      if (knownCodes.has(item.code)) return;
      knownCodes.add(item.code);
      queries.push(sql`
        WITH ins AS (
          INSERT INTO holdings (id, user_id, account_id, code, name, category, sub_category, current_price, target_pct)
          VALUES (${randomUUID()}, ${userId}, ${accountId}, ${item.code}, ${item.name}, '주식', '기타', ${item.price || 0}, 0)
          ON CONFLICT DO NOTHING
          RETURNING id
        )
        SELECT COUNT(*)::int AS inserted FROM ins
      `);
      tallies.push({ kind: "holding", label: `${item.name}(${item.code})` });
    }

    // --- 매수 ---
    // 같은 파일 안의 중복은 먼저 JS 에서 걸러 (첫 건만 남김), 이미 DB 에 있는 건은 SQL 이 건너뛴다.
    const seenBuy = new Set<string>();
    const filteredBuys = skipDuplicates
      ? buyItems.filter((row) => {
          const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
          if (seenBuy.has(key)) { dupSkipped++; return false; }
          seenBuy.add(key);
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
    // 날짜 그룹마다 문장 하나: 중복이 아닌 항목만 골라 기록·항목·수량·원가를 함께 반영한다 (새 항목이 없으면 기록도 만들지 않음).
    // 누적값은 "이번 가져오기에서 실제로 만든 앞 기록들의 합 + 이 기록의 합"이라, 건너뛴 중복 건은 포함되지 않는다.
    const createdRecordIds: string[] = [];
    for (const date of [...dateGroups.keys()].sort()) {
      const rows = dateGroups.get(date)!;
      const recordId = randomUUID();
      const previousRecordIds = [...createdRecordIds];
      createdRecordIds.push(recordId);
      rows.forEach(planHolding);
      const payload = JSON.stringify(
        rows.map((r) => ({ code: r.code, name: r.name ?? "", qty: Number(r.qty), price: Number(r.price), amount: Number(r.amount) }))
      );
      queries.push(sql`
        WITH src AS (
          SELECT x.code, x.name, x.qty, x.price, x.amount
          FROM jsonb_to_recordset(${payload}::jsonb) AS x(code text, name text, qty int, price int, amount int)
          WHERE NOT ${skipDuplicates}::boolean OR NOT EXISTS (
            SELECT 1 FROM purchase_items pi JOIN purchase_records pr ON pr.id = pi.record_id
            WHERE pr.user_id = ${userId} AND pr.account_id = ${accountId} AND pr.date = ${date}::date
              AND pi.code = x.code AND pi.quantity = x.qty AND pi.price_at_purchase = x.price
          )
        ),
        rec AS (
          INSERT INTO purchase_records (id, user_id, account_id, date, total_spent, total_value_after)
          SELECT ${recordId}::uuid, ${userId}, ${accountId}, ${date}::date, SUM(amount)::int,
                 (COALESCE((SELECT SUM(total_spent) FROM purchase_records WHERE id = ANY(${previousRecordIds}::uuid[])), 0) + SUM(amount))::int
          FROM src HAVING COUNT(*) > 0
          RETURNING id
        ),
        ins AS (
          INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
          SELECT rec.id, h.id, src.code, src.name, src.qty, src.price, src.amount
          FROM src CROSS JOIN rec
          JOIN holdings h ON h.user_id = ${userId} AND h.account_id = ${accountId} AND h.code = src.code
          RETURNING holding_id, quantity, cost
        ),
        bumped AS (
          UPDATE holdings SET shares = holdings.shares + s.q
          FROM (SELECT holding_id, SUM(quantity)::int AS q FROM ins GROUP BY holding_id) s
          WHERE holdings.id = s.holding_id
          RETURNING holdings.id
        ),
        costed AS (
          INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
          SELECT ${userId}, ${accountId}, holding_id, SUM(cost)::int, SUM(quantity)::int FROM ins GROUP BY holding_id
          ON CONFLICT (user_id, holding_id)
          DO UPDATE SET total_cost = cost_basis.total_cost + EXCLUDED.total_cost,
                        total_shares = cost_basis.total_shares + EXCLUDED.total_shares
          RETURNING id
        )
        SELECT COUNT(*)::int AS inserted FROM ins
      `);
      tallies.push({ kind: "buy", items: rows.length });
    }

    // --- 매도 --- (sell_items에 영속화 → 재임포트 시 중복 차감 방지. 같은 파일의 같은 매도도 앞 건이 이미 INSERT 돼 있어 건너뜀)
    for (const row of sellItems) {
      planHolding(row);
      queries.push(sql`
        WITH h AS (
          SELECT id FROM holdings WHERE user_id = ${userId} AND account_id = ${accountId} AND code = ${row.code}
        ),
        ins AS (
          INSERT INTO sell_items (user_id, account_id, holding_id, code, name, quantity, price, date)
          SELECT ${userId}, ${accountId}, h.id, ${row.code}, ${row.name ?? ""}, ${row.qty}::int, ${row.price}::int, ${row.date}::date
          FROM h
          WHERE NOT ${skipDuplicates}::boolean OR NOT EXISTS (
            SELECT 1 FROM sell_items s
            WHERE s.user_id = ${userId} AND s.account_id = ${accountId} AND s.date = ${row.date}::date
              AND s.code = ${row.code} AND s.quantity = ${row.qty}::int AND s.price = ${row.price}::int
          )
          RETURNING holding_id
        ),
        sold AS (
          UPDATE holdings SET shares = GREATEST(0, shares - ${row.qty}::int) WHERE id IN (SELECT holding_id FROM ins) RETURNING id
        ),
        costed AS (
          UPDATE cost_basis
          SET total_cost = GREATEST(0, ROUND(total_cost - (total_cost::numeric / NULLIF(total_shares, 0)) * ${row.qty}::int)),
              total_shares = GREATEST(0, total_shares - ${row.qty}::int)
          WHERE holding_id IN (SELECT holding_id FROM ins) AND total_shares > 0
          RETURNING id
        )
        SELECT COUNT(*)::int AS inserted FROM ins
      `);
      tallies.push({ kind: "sell" });
    }

    // --- 배당 --- (dividends는 (holding_id,date) UNIQUE이므로 같은 종목·날짜는 1건만 존재)
    const seenDiv = new Set<string>();
    for (const row of dividendItems) {
      const key = `${row.date}|${row.code}`;
      // 같은 파일 내 (종목,날짜) 중복은 항상 1건으로 축약 — UNIQUE 위반 abort·이중 카운트 방지
      if (seenDiv.has(key)) { dupSkipped++; continue; }
      seenDiv.add(key);
      planHolding(row);
      // DO NOTHING: 기존 (종목,날짜) 배당을 조용히 덮어쓰지 않는다(실제 금액 유실 방지).
      queries.push(sql`
        WITH ins AS (
          INSERT INTO dividends (user_id, account_id, holding_id, amount, date, memo)
          SELECT ${userId}, ${accountId}, h.id, ${row.amount}::int, ${row.date}::date, 'CSV 자동 등록'
          FROM holdings h WHERE h.user_id = ${userId} AND h.account_id = ${accountId} AND h.code = ${row.code}
          ON CONFLICT (holding_id, date) DO NOTHING
          RETURNING id
        )
        SELECT COUNT(*)::int AS inserted FROM ins
      `);
      tallies.push({ kind: "dividend" });
    }

    if (queries.length > 0) {
      const results = (await sql.transaction([lock, ...queries])) as Record<string, unknown>[][];
      tallies.forEach((tally, index) => {
        const inserted = Number(results[index + 1]?.[0]?.inserted ?? 0);
        if (tally.kind === "holding") {
          if (inserted > 0) autoAdded.push(tally.label);
        } else if (tally.kind === "buy") {
          buyCount += inserted;
          dupSkipped += tally.items - inserted;
          if (inserted > 0) totalRecords++;
        } else if (tally.kind === "sell") {
          if (inserted > 0) sellCount++; else dupSkipped++;
        } else {
          if (inserted > 0) dividendCount++; else dupSkipped++;
        }
      });
    }

    return NextResponse.json({ success: true, totalRecords, buyCount, sellCount, dividendCount, dupSkipped, autoAdded: [...new Set(autoAdded)] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
