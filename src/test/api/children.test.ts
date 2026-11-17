import test, { before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createFakeSql, createSessionState, jsonRequest, readJson } from "@/test/api-helpers";

const session = createSessionState("user-1");
const db = createFakeSql();

mock.module("@/lib/session", { namedExports: session.namedExports });
mock.module("@/lib/db", { namedExports: { sql: db.sql } });

type Params = { params: Promise<Record<string, string>> };

function withParams(values: Record<string, string>): Params {
  return { params: Promise.resolve(values) };
}

let children: typeof import("@/app/api/children/route");
let child: typeof import("@/app/api/children/[id]/route");
let holdings: typeof import("@/app/api/children/[id]/holdings/route");
let holding: typeof import("@/app/api/children/[id]/holdings/[hid]/route");
let gifts: typeof import("@/app/api/children/[id]/gifts/route");
let gift: typeof import("@/app/api/children/[id]/gifts/[gid]/route");

before(async () => {
  [children, child, holdings, holding, gifts, gift] = await Promise.all([
    import("@/app/api/children/route"),
    import("@/app/api/children/[id]/route"),
    import("@/app/api/children/[id]/holdings/route"),
    import("@/app/api/children/[id]/holdings/[hid]/route"),
    import("@/app/api/children/[id]/gifts/route"),
    import("@/app/api/children/[id]/gifts/[gid]/route"),
  ]);
});

beforeEach(() => {
  db.reset();
  session.state.userId = "user-1";
});

// ── 자녀 프로필 ──────────────────────────────
test("children GET: 본인 자녀로 범위를 제한한다", async () => {
  db.setHandler(() => [{ id: "c1", name: "첫째", birth_date: "2019-03-01", created_at: "" }]);

  const rows = await readJson<{ id: string }[]>(await children.GET());
  assert.equal(rows.length, 1);
  assert.equal(db.find("WHERE user_id = ?")[0].values[0], "user-1");
});

test("children POST: 이름이 없거나 50자를 넘으면 400", async () => {
  for (const body of [{ birthDate: "2019-03-01" }, { name: "  ", birthDate: "2019-03-01" }, { name: "가".repeat(51), birthDate: "2019-03-01" }]) {
    const response = await children.POST(jsonRequest("POST", body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("children POST: 생년월일 형식과 미래 날짜를 막는다", async () => {
  for (const birthDate of ["2019/03/01", "2019-13-45", "2999-01-01"]) {
    const response = await children.POST(jsonRequest("POST", { name: "둘째", birthDate }));
    assert.equal(response.status, 400, birthDate);
  }
});

test("children POST: 정상 입력은 201과 저장된 행", async () => {
  db.setHandler((query) =>
    query.includes("INSERT INTO children")
      ? [{ id: "c2", name: "둘째", birth_date: "2021-07-15", created_at: "" }]
      : []
  );

  const response = await children.POST(jsonRequest("POST", { name: "  둘째  ", birthDate: "2021-07-15" }));
  assert.equal(response.status, 201);

  const insert = db.find("INSERT INTO children")[0];
  assert.deepEqual(insert.values, ["user-1", "둘째", "2021-07-15"]);
});

test("children[id] PATCH: 검증 실패는 400, 없는 자녀는 404", async () => {
  assert.equal((await child.PATCH(jsonRequest("PATCH", { name: "" }), withParams({ id: "c1" }) as never)).status, 400);
  assert.equal(
    (await child.PATCH(jsonRequest("PATCH", { birthDate: "2020/01/01" }), withParams({ id: "c1" }) as never)).status,
    400
  );

  db.setHandler(() => []);
  const response = await child.PATCH(jsonRequest("PATCH", { name: "새이름" }), withParams({ id: "c1" }) as never);
  assert.equal(response.status, 404);

  const update = db.find("UPDATE children");
  assert.deepEqual(update[0].values.slice(-1), ["user-1"], "본인 자녀만 수정");
});

test("children[id] DELETE: 본인 범위로만 지운다", async () => {
  const response = await child.DELETE(jsonRequest("DELETE"), withParams({ id: "c1" }) as never);
  assert.equal(response.status, 200);

  const remove = db.find("DELETE FROM children");
  assert.deepEqual(remove[0].values, ["c1", "user-1"]);
});

// ── 자녀 보유 종목 ────────────────────────────
test("holdings GET: 자녀·사용자 범위로 조회한다", async () => {
  db.setHandler(() => [{ id: "h1", code: "305050", name: "KODEX 200" }]);

  const rows = await readJson<{ id: string }[]>(await holdings.GET(jsonRequest("GET"), withParams({ id: "c1" }) as never));
  assert.equal(rows.length, 1);
  assert.deepEqual(db.find("FROM child_holdings")[0].values, ["c1", "user-1"]);
});

test("holdings POST: 남의 자녀면 404", async () => {
  db.setHandler(() => []);

  const response = await holdings.POST(
    jsonRequest("POST", { code: "305050", name: "KODEX 200", shares: 1 }),
    withParams({ id: "c1" }) as never
  );
  assert.equal(response.status, 404);
});

test("holdings POST: 코드·이름이 없거나 숫자가 이상하면 400", async () => {
  db.setHandler((query) => (query.includes("FROM children") ? [{ id: "c1" }] : []));

  const cases = [
    { name: "KODEX 200" },
    { code: "305050" },
    { code: "305050", name: "x", shares: -1 },
    { code: "305050", name: "x", avgPrice: 3_000_000_000 },
    { code: "305050", name: "x", currentPrice: "abc" },
  ];

  for (const body of cases) {
    const response = await holdings.POST(jsonRequest("POST", body), withParams({ id: "c1" }) as never);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("holdings POST: 정상 입력은 반올림해 저장하고 201", async () => {
  db.setHandler((query) =>
    query.includes("FROM children") ? [{ id: "c1" }] : [{ id: "h9", code: "305050", name: "KODEX 200" }]
  );

  const response = await holdings.POST(
    jsonRequest("POST", { code: " 305050 ", name: " KODEX 200 ", shares: 10.6, avgPrice: 50_000.4, currentPrice: 57_000.5 }),
    withParams({ id: "c1" }) as never
  );
  assert.equal(response.status, 201);

  const insert = db.find("INSERT INTO child_holdings")[0];
  assert.deepEqual(insert.values, ["c1", "user-1", "305050", "KODEX 200", 11, 50000, 57001]);
});

test("holdings[hid] PATCH: 검증 400, 없는 종목 404, 정상 수정", async () => {
  const bad = await holding.PATCH(jsonRequest("PATCH", { shares: -5 }), withParams({ id: "c1", hid: "h1" }) as never);
  assert.equal(bad.status, 400);

  db.setHandler(() => []);
  const missing = await holding.PATCH(jsonRequest("PATCH", { shares: 3 }), withParams({ id: "c1", hid: "h1" }) as never);
  assert.equal(missing.status, 404);

  db.setHandler(() => [{ id: "h1", shares: 3 }]);
  const ok = await holding.PATCH(jsonRequest("PATCH", { shares: 3.4, currentPrice: 58_000 }), withParams({ id: "c1", hid: "h1" }) as never);
  assert.equal(ok.status, 200);

  const update = db.find("UPDATE child_holdings").at(-1);
  assert.deepEqual(update?.values.slice(0, 3), [3, null, 58000], "지정하지 않은 값은 null → COALESCE로 유지");
  assert.deepEqual(update?.values.slice(-3), ["h1", "c1", "user-1"]);
});

test("holdings[hid] DELETE: 본인·자녀 범위로 지운다", async () => {
  await holding.DELETE(jsonRequest("DELETE"), withParams({ id: "c1", hid: "h1" }) as never);
  assert.deepEqual(db.find("DELETE FROM child_holdings")[0].values, ["h1", "c1", "user-1"]);
});

// ── 증여 기록 ────────────────────────────────
test("gifts GET: 자녀·사용자 범위로 조회한다", async () => {
  db.setHandler(() => [{ id: "g1", amount: 1_000_000 }]);

  const rows = await readJson<{ id: string }[]>(await gifts.GET(jsonRequest("GET"), withParams({ id: "c1" }) as never));
  assert.equal(rows.length, 1);
  assert.deepEqual(db.find("FROM child_gifts")[0].values, ["c1", "user-1"]);
});

test("gifts POST: 남의 자녀 404, 날짜·금액 검증 400", async () => {
  db.setHandler(() => []);
  assert.equal(
    (await gifts.POST(jsonRequest("POST", { date: "2026-01-01", amount: 1000 }), withParams({ id: "c1" }) as never)).status,
    404
  );

  db.setHandler((query) => (query.includes("FROM children") ? [{ id: "c1" }] : []));
  const cases = [
    { date: "2026/01/01", amount: 1000 },
    { date: "2026-01-01", amount: 0 },
    { date: "2026-01-01", amount: -5 },
    { date: "2026-01-01", amount: 3_000_000_000 },
  ];

  for (const body of cases) {
    const response = await gifts.POST(jsonRequest("POST", body), withParams({ id: "c1" }) as never);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("gifts POST: 알 수 없는 증여 유형은 lump로, 메모는 200자로 자른다", async () => {
  db.setHandler((query) =>
    query.includes("FROM children") ? [{ id: "c1" }] : [{ id: "g1", amount: 5_000_000 }]
  );

  const response = await gifts.POST(
    jsonRequest("POST", { date: "2026-05-05", amount: 5_000_000, giftType: "weird", memo: "가".repeat(300) }),
    withParams({ id: "c1" }) as never
  );
  assert.equal(response.status, 201);

  const insert = db.find("INSERT INTO child_gifts")[0];
  assert.deepEqual(insert.values.slice(0, 5), ["c1", "user-1", "2026-05-05", 5_000_000, "lump"]);
  assert.equal(String(insert.values[5]).length, 200);
});

test("gifts POST: installment 유형은 그대로 저장한다", async () => {
  db.setHandler((query) =>
    query.includes("FROM children") ? [{ id: "c1" }] : [{ id: "g1" }]
  );

  await gifts.POST(
    jsonRequest("POST", { date: "2026-05-05", amount: 1_000_000, giftType: "installment" }),
    withParams({ id: "c1" }) as never
  );

  assert.equal(db.find("INSERT INTO child_gifts")[0].values[4], "installment");
});

test("gifts[gid] PATCH: 신고여부·신고일·금액 검증", async () => {
  const badAmount = await gift.PATCH(
    jsonRequest("PATCH", { amount: 0 }),
    withParams({ id: "c1", gid: "g1" }) as never
  );
  assert.equal(badAmount.status, 400);

  const badDate = await gift.PATCH(
    jsonRequest("PATCH", { reportDate: "2026.01.01" }),
    withParams({ id: "c1", gid: "g1" }) as never
  );
  assert.equal(badDate.status, 400);

  db.setHandler(() => []);
  const missing = await gift.PATCH(
    jsonRequest("PATCH", { reported: true }),
    withParams({ id: "c1", gid: "g1" }) as never
  );
  assert.equal(missing.status, 404);
});

test("gifts[gid] PATCH: 신고일을 null로 보내면 지우고, 생략하면 유지한다", async () => {
  db.setHandler(() => [{ id: "g1", reported: true }]);

  const cleared = await gift.PATCH(
    jsonRequest("PATCH", { reported: true, reportDate: null }),
    withParams({ id: "c1", gid: "g1" }) as never
  );
  assert.equal(cleared.status, 200);

  const update = db.find("UPDATE child_gifts")[0];
  assert.match(update.query, /CASE WHEN \? THEN report_date ELSE \? END/);
  assert.deepEqual(update.values.slice(0, 3), [true, false, null], "null → CASE ELSE NULL");

  db.reset();
  db.setHandler(() => [{ id: "g1", reported: true }]);
  await gift.PATCH(jsonRequest("PATCH", { reported: false }), withParams({ id: "c1", gid: "g1" }) as never);
  const kept = db.find("UPDATE child_gifts")[0];
  assert.deepEqual(kept.values.slice(0, 3), [false, true, null], "생략 → CASE THEN report_date");
});

test("gifts[gid] DELETE: 본인·자녀 범위로 지운다", async () => {
  await gift.DELETE(jsonRequest("DELETE"), withParams({ id: "c1", gid: "g1" }) as never);
  assert.deepEqual(db.find("DELETE FROM child_gifts")[0].values, ["g1", "c1", "user-1"]);
});
