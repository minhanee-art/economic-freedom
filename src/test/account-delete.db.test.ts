// 계정 삭제 통합 테스트 — 실제 Postgres에 neon-schema.sql(+ 코드 안 CREATE TABLE)을 적용하고
// DELETE /api/me 후 해당 사용자의 모든 테이블 행이 0건인지(다른 사용자 데이터는 그대로인지) 확인한다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach, mock } from "node:test";
import bcrypt from "bcryptjs";

import { jsonRequest } from "@/test/api-helpers";
import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const PASSWORD = "correct-password";
const U = {
  pw: { user: "aaaaaaaa-0000-4000-8000-000000000001", email: "pw-user@pension.local" },
  google: { user: "aaaaaaaa-0000-4000-8000-000000000002", email: "google-user@pension.local" },
  other: { user: "aaaaaaaa-0000-4000-8000-000000000003", email: "other-user@pension.local" },
};

// 사용자 데이터를 가진 모든 테이블. 새 테이블이 생기면 아래 "테이블 목록" 테스트가 실패해 이 목록 갱신을 강제한다.
const USER_TABLES = [
  "profiles", // user_id 대신 id가 사용자 id
  "portfolio_accounts",
  "holdings",
  "cost_basis",
  "purchase_records",
  "dividends",
  "watchlist",
  "dividend_calendar",
  "sell_items",
  "children",
  "child_gifts",
  "child_holdings",
  "portfolio_value_snapshots",
  "pension_contributions",
  "pension_income_sources",
];
const ALL_TABLES = ["users", ...USER_TABLES, "purchase_items"].sort();

const session = { userId: null as string | null };
let db: PgTestDb;
let me: typeof import("@/app/api/me/route");

mock.module("@/lib/session", {
  namedExports: {
    getSession: async () => (session.userId ? { userId: session.userId } : null),
    getBearerSession: async () => null,
    clearSessionCookie: (res: { cookies: { set: (n: string, v: string, o: object) => void } }) =>
      res.cookies.set("pension-session", "", { maxAge: 0, path: "/" }),
  },
});
mock.module("@/lib/rate-limit", {
  namedExports: { authRateLimit: async () => true, clientIp: () => "127.0.0.1" },
});

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });

  // 1) 저장소의 neon-schema.sql 그대로 적용
  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  // 2) 코드 안에서 CREATE/ALTER 하는 테이블·컬럼은 실제 코드로 만든다
  const accounts = await import("@/lib/portfolio-accounts");
  const returns = await import("@/lib/portfolio-returns");
  await accounts.ensurePortfolioAccountSchema();
  await returns.ensurePortfolioReturnSchema();
  const pension = await import("@/lib/pension-data");
  await pension.ensurePensionSchema();

  me = await import("@/app/api/me/route");
});

after(async () => {
  if (db) await db.pool.end();
});

async function seedUser(userId: string, email: string, passwordHash: string | null) {
  const n = userId.slice(-4);
  const [account] = await db.sql`
    INSERT INTO users (id, email, password_hash) VALUES (${userId}, ${email}, ${passwordHash}) RETURNING id
  `;
  assert.ok(account);
  await db.sql`INSERT INTO profiles (id, email, display_name) VALUES (${userId}, ${email}, ${"테스트"})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, telegram_chat_id) VALUES (${userId}, ${"내 계좌"}, ${"12345"}) RETURNING id
  `;
  const [holding] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, shares)
    VALUES (${userId}, ${acc.id}, ${"069500"}, ${"KODEX 200"}, ${"국내주식"}, ${"국내ETF"}, ${10}) RETURNING id
  `;
  await db.sql`
    INSERT INTO cost_basis (user_id, account_id, holding_id, total_cost, total_shares)
    VALUES (${userId}, ${acc.id}, ${holding.id}, ${100000}, ${10})
  `;
  const [record] = await db.sql`
    INSERT INTO purchase_records (user_id, account_id, total_spent) VALUES (${userId}, ${acc.id}, ${100000}) RETURNING id
  `;
  await db.sql`
    INSERT INTO purchase_items (record_id, holding_id, code, name, quantity, price_at_purchase, cost)
    VALUES (${record.id}, ${holding.id}, ${"069500"}, ${"KODEX 200"}, ${10}, ${10000}, ${100000})
  `;
  await db.sql`INSERT INTO dividends (user_id, account_id, holding_id, amount) VALUES (${userId}, ${acc.id}, ${holding.id}, ${500})`;
  await db.sql`INSERT INTO watchlist (user_id, account_id, name) VALUES (${userId}, ${acc.id}, ${`관심${n}`})`;
  await db.sql`INSERT INTO dividend_calendar (user_id, account_id, date, stock, type) VALUES (${userId}, ${acc.id}, ${"2026-12-01"}, ${"KODEX 200"}, ${"지급"})`;
  await db.sql`INSERT INTO sell_items (user_id, account_id, holding_id, code, name, quantity, price, date) VALUES (${userId}, ${acc.id}, ${holding.id}, ${"069500"}, ${"KODEX 200"}, ${1}, ${10000}, ${"2026-11-01"})`;
  const [child] = await db.sql`INSERT INTO children (user_id, name, birth_date) VALUES (${userId}, ${"자녀"}, ${"2020-01-01"}) RETURNING id`;
  await db.sql`INSERT INTO child_gifts (child_id, user_id, date, amount) VALUES (${child.id}, ${userId}, ${"2026-01-01"}, ${1000000})`;
  await db.sql`INSERT INTO child_holdings (child_id, user_id, code, name, shares) VALUES (${child.id}, ${userId}, ${"069500"}, ${"KODEX 200"}, ${3})`;
  await db.sql`INSERT INTO portfolio_value_snapshots (user_id, account_id, snapshot_date, total_value, total_cost) VALUES (${userId}, ${acc.id}, ${"2026-11-25"}, ${110000}, ${100000})`;
  await db.sql`INSERT INTO pension_contributions (user_id, account_id, year, amount) VALUES (${userId}, ${acc.id}, ${2026}, ${3000000})`;
  await db.sql`INSERT INTO pension_income_sources (user_id, member, source_type, monthly_amount, start_age) VALUES (${userId}, ${"self"}, ${"national_pension"}, ${1000000}, ${65})`;
}

/** 한 사용자 소유 행 수를 테이블별로 센다 (purchase_items는 record 경유). */
async function countRows(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  counts.users = Number((await db.sql`SELECT count(*) AS c FROM users WHERE id = ${userId}`)[0].c);
  counts.profiles = Number((await db.sql`SELECT count(*) AS c FROM profiles WHERE id = ${userId}`)[0].c);
  for (const table of USER_TABLES.filter((t) => t !== "profiles")) {
    const rows = await db.pool.query(`SELECT count(*) AS c FROM ${table} WHERE user_id = $1`, [userId]);
    counts[table] = Number(rows.rows[0].c);
  }
  counts.purchase_items = Number(
    (
      await db.sql`
        SELECT count(*) AS c FROM purchase_items pi
        JOIN purchase_records pr ON pr.id = pi.record_id WHERE pr.user_id = ${userId}
      `
    )[0].c
  );
  return counts;
}

async function totalRows(table: string): Promise<number> {
  const rows = await db.pool.query(`SELECT count(*) AS c FROM ${table}`);
  return Number(rows.rows[0].c);
}

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users WHERE id IN (${U.pw.user}, ${U.google.user}, ${U.other.user})`;
  await seedUser(U.pw.user, U.pw.email, await bcrypt.hash(PASSWORD, 4));
  await seedUser(U.google.user, U.google.email, null);
  await seedUser(U.other.user, U.other.email, await bcrypt.hash("x", 4));
  session.userId = null;
});

test("테이블 목록: DB의 사용자 데이터 테이블이 테스트가 아는 목록과 같다", { skip }, async () => {
  const rows = await db.sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  assert.deepEqual(rows.map((r) => r.table_name as string).sort(), ALL_TABLES);
});

test("FK: users를 직접 참조하는 모든 외래키가 ON DELETE CASCADE다", { skip }, async () => {
  const rows = await db.sql`
    SELECT conrelid::regclass::text AS tbl, confdeltype AS del
    FROM pg_constraint
    WHERE contype = 'f' AND confrelid = 'users'::regclass
  `;
  assert.ok(rows.length >= USER_TABLES.length - 1);
  for (const row of rows) assert.equal(row.del, "c", `${row.tbl} → users 가 CASCADE가 아님`);
});

test("비밀번호 계정 삭제: 모든 테이블에서 0건, 다른 사용자 데이터는 그대로", { skip }, async () => {
  const before = await countRows(U.pw.user);
  for (const [table, count] of Object.entries(before)) assert.ok(count >= 1, `${table} 시드 누락`);
  const otherBefore = await countRows(U.other.user);
  const totals = Object.fromEntries(await Promise.all(ALL_TABLES.map(async (t) => [t, await totalRows(t)])));

  session.userId = U.pw.user;
  const response = await me.DELETE(jsonRequest("DELETE", { password: PASSWORD }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /pension-session=;/);

  const after = await countRows(U.pw.user);
  for (const [table, count] of Object.entries(after)) assert.equal(count, 0, `${table}에 행이 남음`);
  assert.deepEqual(await countRows(U.other.user), otherBefore);
  // 전체 행 수도 정확히 "삭제한 사용자의 행"만큼만 줄었는지 (소유자 없는 고아 행 검출)
  for (const table of ALL_TABLES) {
    assert.equal(await totalRows(table), totals[table] - before[table], `${table} 행 수 불일치`);
  }
});

test("Google 전용 계정 삭제: confirmEmail 일치 시 모든 테이블에서 0건", { skip }, async () => {
  session.userId = U.google.user;
  const response = await me.DELETE(jsonRequest("DELETE", { confirmEmail: U.google.email }));
  assert.equal(response.status, 200);
  for (const [table, count] of Object.entries(await countRows(U.google.user))) {
    assert.equal(count, 0, `${table}에 행이 남음`);
  }
});

test("인증 실패 시 아무것도 지우지 않는다", { skip }, async () => {
  const before = await countRows(U.pw.user);

  session.userId = U.pw.user;
  assert.equal((await me.DELETE(jsonRequest("DELETE", { password: "wrong" }))).status, 403);
  assert.equal((await me.DELETE(jsonRequest("DELETE", { confirmEmail: U.pw.email }))).status, 400);
  assert.deepEqual(await countRows(U.pw.user), before);

  session.userId = U.google.user;
  assert.equal((await me.DELETE(jsonRequest("DELETE", { confirmEmail: "nope@pension.local" }))).status, 403);
  assert.ok((await countRows(U.google.user)).users === 1);

  session.userId = null;
  assert.equal((await me.DELETE(jsonRequest("DELETE", { password: PASSWORD }))).status, 401);
});
