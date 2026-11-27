// GET /api/purchases 의 date 가 서버 시간대와 무관하게 'YYYY-MM-DD' 문자열인지 실제 Postgres로 확인한다.
// 드라이버가 DATE를 JS Date(로컬 자정)로 바꿔 직렬화하면 UTC보다 앞선 시간대(KST 등)에서 전날 15:00Z로 밀린다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach, mock } from "node:test";

import { authRequest } from "@/test/api-helpers";
import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const U1 = "dddddddd-0000-4000-8000-000000000001";

const session = { userId: null as string | null };
mock.module("@/lib/session", {
  namedExports: {
    getSession: async () => (session.userId ? { userId: session.userId } : null),
    getBearerSession: async () => null,
    getRequestSession: async () => (session.userId ? { userId: session.userId, source: "cookie" as const } : null),
  },
});

let db: PgTestDb;
let purchases: typeof import("@/app/api/purchases/route");
const originalTz = process.env.TZ;

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });
  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();
  purchases = await import("@/app/api/purchases/route");
});

after(async () => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
  if (db) await db.pool.end();
});

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users`;
  await db.sql`INSERT INTO users (id, email) VALUES (${U1}, ${"date@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${U1}, ${"date@pension.local"})`;
  const [acc] = await db.sql`
    INSERT INTO portfolio_accounts (user_id, name, display_order) VALUES (${U1}, ${"내 계좌"}, ${0}) RETURNING id
  `;
  await db.sql`
    INSERT INTO purchase_records (user_id, account_id, date, total_spent, total_value_after)
    VALUES (${U1}, ${acc.id}, ${"2025-03-01"}::date, ${1000}, ${0}),
           (${U1}, ${acc.id}, ${"2025-01-01"}::date, ${2000}, ${0})
  `;
  session.userId = U1;
});

test("date는 TZ(KST·UTC·LA·시드니)와 무관하게 같은 YYYY-MM-DD 문자열", { skip }, async () => {
  for (const tz of ["Asia/Seoul", "UTC", "America/Los_Angeles", "Pacific/Auckland"]) {
    process.env.TZ = tz;
    const response = await purchases.GET(authRequest("GET", { url: "https://pension.test/api/purchases" }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as { records: { date: unknown }[]; count: number };
    assert.deepEqual(
      body.records.map((r) => r.date),
      ["2025-03-01", "2025-01-01"],
      `TZ=${tz}`
    );
    assert.equal(body.count, 2);
  }
});
