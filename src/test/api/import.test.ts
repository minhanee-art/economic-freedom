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

test("import: 날짜별로 매수 기록을 묶고 누적 투입원금을 남긴다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [] : []));

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
  assert.equal(db.find("INSERT INTO purchase_items").length, 3);
  assert.equal(db.find("INSERT INTO cost_basis").length, 3);
  assert.equal(db.find("UPDATE holdings SET shares = shares +").length, 3);

  // 날짜 오름차순 누적: 01-05 300,000 → 02-01 600,000
  const records = db.find("INSERT INTO purchase_records");
  assert.deepEqual(
    records.map((call) => [call.values[3], call.values[4], call.values[5]]),
    [
      ["2026-01-05", 300_000, 300_000],
      ["2026-02-01", 300_000, 600_000],
    ]
  );

  const [transaction] = db.find("<transaction>");
  assert.ok(transaction, "쓰기는 한 트랜잭션으로 묶인다");
});

test("import: 새 종목은 holdings에 자동 추가하고 autoAdded에 남긴다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [] : []));

  const body = await readJson<ImportBody>(
    await importRoute.POST(jsonRequest("POST", { items: [buy(), buy({ code: "069500", name: "KODEX 200" })] }))
  );

  const insert = db.find("INSERT INTO holdings");
  assert.equal(insert.length, 2);
  assert.deepEqual(body.autoAdded?.sort(), ["KODEX 200(069500)", "KODEX 200(305050)"]);
});

test("import: 이미 있는 매수를 건너뛰고 같은 파일 내 중복도 한 번만 넣는다", async () => {
  db.setHandler((query) => {
    if (query.includes("FROM purchase_items")) {
      return [{ code: "305050", quantity: 10, price_at_purchase: 50_000, date: "2026-01-05" }];
    }
    if (query.includes("FROM holdings")) return [];
    return [];
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
});

test("import: skipDuplicates=false면 중복 조회도 하지 않는다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [] : []));

  const response = await importRoute.POST(
    jsonRequest("POST", { items: [buy()], skipDuplicates: false })
  );
  assert.equal(response.status, 200);
  assert.equal(db.find("FROM purchase_items").length, 0);
  assert.equal(db.find("FROM sell_items").length, 0);
});

test("import: 매도는 원가를 SQL에서 차감하고 sell_items에 남긴다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h1", code: "305050", shares: 10 }] : []));

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", {
        items: [buy({ type: "매도", qty: 4, price: 55_000, amount: 220_000 })],
      })
    )
  );

  assert.equal(body.sellCount, 1);
  assert.equal(db.find("UPDATE holdings SET shares = GREATEST").length, 1);
  const costUpdate = db.find("UPDATE cost_basis").at(-1);
  assert.match(costUpdate?.query ?? "", /total_shares - \?/);
  assert.equal(db.find("INSERT INTO sell_items").length, 1);
});

test("import: 같은 파일의 같은 종목·날짜 배당은 1건으로 줄인다", async () => {
  db.setHandler((query) => (query.includes("FROM holdings") ? [{ id: "h1", code: "305050", shares: 10 }] : []));

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
  db.setHandler((query) => {
    if (query.includes("FROM dividends")) {
      return [{ date: "2026-01-05", code: "305050", amount: 15_000 }];
    }
    if (query.includes("FROM holdings")) return [{ id: "h1", code: "305050", shares: 10 }];
    return [];
  });

  const body = await readJson<ImportBody>(
    await importRoute.POST(
      jsonRequest("POST", { items: [buy({ type: "배당", qty: 1, price: 0, amount: 15_000 })] })
    )
  );

  assert.equal(body.dividendCount, 0);
  assert.equal(body.dupSkipped, 1);
});

test("import: 트랜잭션이 실패하면 500과 오류 메시지", async () => {
  db.setHandler((query) => {
    if (query.includes("FROM holdings")) return [];
    return [];
  });
  const originalTransaction = db.sql.transaction;
  db.sql.transaction = async () => {
    throw new Error("write conflict");
  };

  try {
    const response = await importRoute.POST(jsonRequest("POST", { items: [buy()] }));
    assert.equal(response.status, 500);
    assert.match((await readJson<ImportBody>(response)).error ?? "", /write conflict/);
  } finally {
    db.sql.transaction = originalTransaction;
  }
});
