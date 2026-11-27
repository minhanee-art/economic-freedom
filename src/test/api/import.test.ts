import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createAccountsState, createFakeSql, createSessionState, jsonRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();
const accounts = createAccountsState();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/portfolio-accounts", { namedExports: accounts.namedExports });

let importRoute: typeof import("@/app/api/import/route");

before(async () => {
  importRoute = await import("@/app/api/import/route");
});

beforeEach(() => {
  db.reset();
  // 가짜 sql 은 호출 즉시 handler 를 돌리므로, 트랜잭션 결과는 각 문장의 handler 결과(건수 행)다.
  db.sql.transaction = async (queries: unknown[]) => {
    db.calls.push({ query: "<transaction>", values: queries });
    return Promise.all(queries as Promise<unknown>[]);
  };
  session.state.userId = "user-1";
  accounts.state.activeAccountId = "acc-1";
});

type ImportBody = {
  success?: boolean;
  totalRecords?: number;
  buyCount?: number;
  sellCount?: number;
  dividendCount?: number;
  dupSkipped?: number;
  autoAdded?: string[];
  error?: string;
};

function buy(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-05",
    code: "305050",
    name: "KODEX 200",
    type: "매수",
    qty: 10,
    price: 50_000,
    amount: 500_000,
    ...overrides,
  };
}

test("import: items가 없으면 400", async () => {
  const response = await importRoute.POST(jsonRequest("POST", { items: [] }));
  assert.equal(response.status, 400);
  assert.equal((await readJson<ImportBody>(response)).error, "데이터 없음");
});

test("import: 인증이 없으면 401", async () => {
  session.state.userId = null;

  const response = await importRoute.POST(jsonRequest("POST", { items: [buy()] }));
  assert.equal(response.status, 401);
});

test("import: 음수·오버플로·빈 코드는 400", async () => {
  const cases = [
    buy({ qty: -1 }),
    buy({ price: 3_000_000_000 }),
    buy({ amount: -1 }),
    buy({ code: "", name: "알수없는펀드" }),
  ];

  for (const item of cases) {
    db.reset();
    const response = await importRoute.POST(jsonRequest("POST", { items: [item] }));
    assert.equal(response.status, 400, JSON.stringify(item));
  }
});

test("import: 종목명으로 코드를 채운다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [] : []));

  const response = await importRoute.POST(
    jsonRequest("POST", { items: [buy({ code: "", name: "TIGER 미국배당" })] })
  );
  assert.equal(response.status, 200);

  const holdingInsert = db.find("INSERT INTO holdings")[0];
  assert.equal(holdingInsert.values[3], "458730");
});

type Handlers = {
  /** 계좌에 이미 있는 종목 코드 */
  held?: string[];
  /** 문장 조각 → 돌려줄 inserted 건수 (기본: 매수 그룹은 항목 수 전체, 나머지는 1) */
  inserted?: Record<string, number>;
};

/** 가져오기 문장은 반영한 건수를 `inserted` 한 행으로 돌려준다 — 실제 SQL 의 중복 판정 결과를 흉내 낸다. */
function importHandler({ held = [], inserted = {} }: Handlers = {}) {
  return (query: string, values: unknown[]) => {
    if (query.includes("SELECT code FROM holdings")) return held.map((code) => ({ code }));
    if (query.includes("pg_advisory_xact_lock")) return [{}];
    for (const [fragment, count] of Object.entries(inserted)) {
      if (query.includes(fragment)) return [{ inserted: count }];
    }
    if (query.includes("jsonb_to_recordset")) {
      const payload = values.find((v) => typeof v === "string" && v.startsWith("[")) as string;
      return [{ inserted: (JSON.parse(payload) as unknown[]).length }];
    }
    if (query.includes("AS inserted")) return [{ inserted: 1 }];
    return [];
  };
}

function transactionStatements() {
  const [transaction] = db.find("<transaction>");
  return (transaction?.values ?? []) as unknown[];
}

test("import: 날짜별로 매수 기록을 묶고 누적 투입원금을 남긴다", async () => {
  db.setHandler(importHandler({ held: ["305050", "069500"] }));

  const response = await importRoute.POST(
    jsonRequest("POST", {
      items: [
        buy({ date: "2026-02-01", amount: 100_000, qty: 2, price: 50_000 }),
        buy({ date: "2026-01-05", amount: 300_000, qty: 6, price: 50_000 }),
        buy({ date: "2026-02-01", code: "069500", name: "KODEX 200 2", amount: 200_000, qty: 4, price: 50_000 }),
      ],
    })
  );

  const body = await readJson<ImportBody>(response);
  assert.equal(body.success, true);
  assert.equal(body.totalRecords, 2, "날짜 2개 → 기록 2개");
  assert.equal(body.buyCount, 3);

  // 날짜 그룹마다 문장 하나 (기록·항목·수량·원가를 함께). 날짜 오름차순.
  const groups = db.find("jsonb_to_recordset");
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((call) => call.values.find((v) => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v))),
    ["2026-01-05", "2026-02-01"]
  );
  assert.match(groups[0].query, /INSERT INTO purchase_records/);
  assert.match(groups[0].query, /INSERT INTO purchase_items/);
  assert.match(groups[0].query, /UPDATE holdings SET shares = holdings\.shares \+/);
  assert.match(groups[0].query, /INSERT INTO cost_basis/);
  // 누적 투입원금은 앞 그룹에서 실제 만든 기록 id 들을 기준으로 SQL 이 계산한다.
  const [first, second] = groups.map((call) => call.values.filter((v) => Array.isArray(v)) as string[][]);
  assert.deepEqual(first[0], []);
  assert.equal(second[0].length, 1);

  assert.ok(db.find("<transaction>").length === 1, "쓰기는 한 트랜잭션으로 묶인다");
});

test("import: 트랜잭션 맨 앞에서 계좌 단위 advisory lock 을 잡는다", async () => {
  db.setHandler(importHandler({ held: ["305050"] }));

  await importRoute.POST(jsonRequest("POST", { items: [buy()] }));

  const statements = transactionStatements();
  assert.equal(statements.length, 2);
  const [lock] = db.find("pg_advisory_xact_lock");
  assert.match(lock.query, /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)/);
  assert.deepEqual(lock.values, ["import:acc-1"]);
  assert.equal(db.calls.findIndex((c) => c.query.includes("pg_advisory_xact_lock")) < db.calls.findIndex((c) => c.query.includes("jsonb_to_recordset")), true);
});

test("import: 중복 판정을 앱에서 미리 읽지 않고 SQL 안에서 한다", async () => {
  db.setHandler(importHandler({ held: ["305050"] }));

  await importRoute.POST(
    jsonRequest("POST", {
      items: [buy(), buy({ type: "매도", qty: 1 }), buy({ type: "배당", qty: 1, price: 0, amount: 10 })],
    })
  );

  assert.equal(db.find("FROM purchase_items").filter((c) => !c.query.includes("INSERT")).length, 0, "별도 사전 조회 없음");
  assert.equal(db.find("SELECT code, quantity, price, date::text").length, 0);
  assert.match(db.find("jsonb_to_recordset")[0].query, /NOT EXISTS \( SELECT 1 FROM purchase_items/);
  assert.match(db.find("INSERT INTO sell_items")[0].query, /NOT EXISTS \( SELECT 1 FROM sell_items/);
  assert.match(db.find("INSERT INTO dividends")[0].query, /ON CONFLICT \(holding_id, date\) DO NOTHING/);
});

test("import: 새 종목은 holdings에 자동 추가하고 autoAdded에 남긴다", async () => {
  db.setHandler(importHandler());

  const body = await readJson<ImportBody>(
    await importRoute.POST(jsonRequest("POST", { items: [buy(), buy({ code: "069500", name: "KODEX 200" })] }))
  );

  const insert = db.find("INSERT INTO holdings");
  assert.equal(insert.length, 2);
  assert.match(insert[0].query, /ON CONFLICT DO NOTHING/);
  assert.deepEqual(body.autoAdded?.sort(), ["KODEX 200(069500)", "KODEX 200(305050)"]);
});

test("import: 동시 요청이 같은 종목을 먼저 만들었으면 autoAdded 에 넣지 않는다", async () => {
  db.setHandler(importHandler({ inserted: { "INSERT INTO holdings": 0 } }));

  const body = await readJson<ImportBody>(await importRoute.POST(jsonRequest("POST", { items: [buy()] })));

  assert.deepEqual(body.autoAdded, []);
});

test("import: 이미 있는 매수는 SQL 이 건너뛰고 같은 파일 내 중복은 한 번만 보낸다", async () => {
  // 2026-01-05 그룹(1건)은 DB 에 이미 있어 inserted 0, 2026-01-06 그룹은 신규 1건
  let call = 0;
  const base = importHandler({ held: ["305050"] });
  db.setHandler((query, values) => {
    if (query.includes("jsonb_to_recordset")) return [{ inserted: call++ === 0 ? 0 : 1 }];
    return base(query, values);
  });

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", {
        items: [
          buy(), // DB에 이미 있음
          buy({ date: "2026-01-06" }), // 신규
          buy({ date: "2026-01-06" }), // 같은 파일 중복
        ],
      })
    )
  );

  assert.equal(body.dupSkipped, 2);
  assert.equal(body.buyCount, 1);
  assert.equal(body.totalRecords, 1, "새 항목이 없는 그룹은 기록도 만들지 않는다");
  const payloads = db.find("jsonb_to_recordset").map((c) => JSON.parse(c.values[0] as string) as unknown[]);
  assert.deepEqual(payloads.map((p) => p.length), [1, 1]);
});

test("import: skipDuplicates=false면 중복 판정을 SQL 에 켜지 않는다", async () => {
  db.setHandler(importHandler({ held: ["305050"] }));

  const response = await importRoute.POST(
    jsonRequest("POST", { items: [buy(), buy()], skipDuplicates: false })
  );
  assert.equal(response.status, 200);
  const [group] = db.find("jsonb_to_recordset");
  assert.equal(group.values.includes(false), true, "NOT $skip 가 false 로 전달");
  assert.equal(JSON.parse(group.values[0] as string).length, 2, "같은 파일 중복도 걸러내지 않는다");
});

test("import: 매도는 원가를 SQL에서 차감하고 sell_items에 남긴다", async () => {
  db.setHandler(importHandler({ held: ["305050"] }));

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", {
        items: [buy({ type: "매도", qty: 4, price: 55_000, amount: 220_000 })],
      })
    )
  );

  assert.equal(body.sellCount, 1);
  const [sell] = db.find("INSERT INTO sell_items");
  // 한 문장 안에서 INSERT 가 반영된 경우에만 수량·원가를 줄인다 (GREATEST(0, …) 설계는 그대로)
  assert.match(sell.query, /UPDATE holdings SET shares = GREATEST\(0, shares - \?::int\) WHERE id IN \(SELECT holding_id FROM ins\)/);
  assert.match(sell.query, /total_shares - \?/);
  assert.match(sell.query, /holding_id IN \(SELECT holding_id FROM ins\) AND total_shares > 0/);
});

test("import: 이미 있는 매도는 건수에 넣지 않고 중복으로 센다", async () => {
  db.setHandler(importHandler({ held: ["305050"], inserted: { "INSERT INTO sell_items": 0 } }));

  const body = await readJson<ImportBody>(
    await importRoute.POST(jsonRequest("POST", { items: [buy({ type: "매도", qty: 4, price: 55_000, amount: 220_000 })] }))
  );

  assert.equal(body.sellCount, 0);
  assert.equal(body.dupSkipped, 1);
});

test("import: 같은 파일의 같은 종목·날짜 배당은 1건으로 줄인다", async () => {
  db.setHandler(importHandler({ held: ["305050"] }));

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", {
        items: [
          buy({ type: "배당", qty: 1, price: 0, amount: 15_000 }),
          buy({ type: "배당", qty: 1, price: 0, amount: 15_000 }),
        ],
      })
    )
  );

  assert.equal(body.dividendCount, 1);
  assert.equal(body.dupSkipped, 1);
  assert.match(db.find("INSERT INTO dividends")[0].query, /ON CONFLICT \(holding_id, date\) DO NOTHING/);
});

test("import: 이미 있는 배당(종목·날짜)은 건너뛴다", async () => {
  db.setHandler(importHandler({ held: ["305050"], inserted: { "INSERT INTO dividends": 0 } }));

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", { items: [buy({ type: "배당", qty: 1, price: 0, amount: 15_000 })] })
    )
  );

  assert.equal(body.dividendCount, 0);
  assert.equal(body.dupSkipped, 1);
});

test("import: 트랜잭션이 실패하면 500과 오류 메시지", async () => {
  db.setHandler(importHandler());
  db.sql.transaction = async () => {
    throw new Error("write conflict");
  };

  const response = await importRoute.POST(jsonRequest("POST", { items: [buy()] }));
  assert.equal(response.status, 500);
  assert.match((await readJson<ImportBody>(response)).error ?? "", /write conflict/);
});
