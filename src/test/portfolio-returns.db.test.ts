// getPortfolioReturnSummary 통합 테스트 — 실제 Postgres에 스냅샷을 쌓고 수익률 계산을 확인한다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import test, { after, before, mock } from "node:test";

import {
  createPgTestDb,
  ensureSnapshotTestSchema,
  shiftDate,
  todayKst,
  type PgTestDb,
} from "@/test/pg-sql";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "33333333-3333-4333-8333-333333333333";
const OTHER_ACCOUNT = "44444444-4444-4444-8444-444444444444";
const HOLDING_A = "55555555-5555-4555-8555-555555555555";
const HOLDING_B = "66666666-6666-4666-8666-666666666666";

let db: PgTestDb;
let lib: typeof import("@/lib/portfolio-returns");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  await ensureSnapshotTestSchema(db.sql);
  await db.sql`
    CREATE TABLE IF NOT EXISTS portfolio_value_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
      snapshot_date DATE NOT NULL,
      total_value NUMERIC NOT NULL DEFAULT 0,
      total_cost NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, account_id, snapshot_date)
    )
  `;
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });
  lib = await import("@/lib/portfolio-returns");
});

after(async () => {
  if (!db) return;
  await cleanup();
  await db.pool.end();
});

async function cleanup() {
  await db.sql`DELETE FROM portfolio_value_snapshots WHERE user_id IN (${USER}, ${OTHER_USER})`;
  await db.sql`DELETE FROM cost_basis WHERE user_id IN (${USER}, ${OTHER_USER})`;
  await db.sql`DELETE FROM holdings WHERE user_id IN (${USER}, ${OTHER_USER})`;
  await db.sql`DELETE FROM portfolio_accounts WHERE user_id IN (${USER}, ${OTHER_USER})`;
  await db.sql`DELETE FROM profiles WHERE id IN (${USER}, ${OTHER_USER})`;
  await db.sql`DELETE FROM users WHERE id IN (${USER}, ${OTHER_USER})`;
}

/** 사용자·계좌·보유 2종목(평가 2,249,100 / 원가 2,000,000)을 심는다. */
async function seedPortfolio() {
  await cleanup();
  await db.sql`INSERT INTO users (id, email) VALUES (${USER}, ${"snapshot-test@pension.local"})`;
  await db.sql`INSERT INTO users (id, email) VALUES (${OTHER_USER}, ${"snapshot-other@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email, display_name) VALUES (${USER}, ${"snapshot-test@pension.local"}, ${"검증용"})`;
  await db.sql`INSERT INTO profiles (id, email, display_name) VALUES (${OTHER_USER}, ${"snapshot-other@pension.local"}, ${"남"})`;
  await db.sql`INSERT INTO portfolio_accounts (id, user_id, name) VALUES (${ACCOUNT}, ${USER}, ${"내 계좌"})`;
  await db.sql`INSERT INTO portfolio_accounts (id, user_id, name) VALUES (${OTHER_ACCOUNT}, ${OTHER_USER}, ${"남의 계좌"})`;

  await db.sql`
    INSERT INTO holdings (id, user_id, account_id, code, name, category, sub_category, current_price, shares)
    VALUES (${HOLDING_A}, ${USER}, ${ACCOUNT}, ${"069500"}, ${"KODEX 200"}, ${"국내주식"}, ${"국내ETF"}, ${41250}, ${30})
  `;
  await db.sql`
    INSERT INTO holdings (id, user_id, account_id, code, name, category, sub_category, current_price, shares)
    VALUES (${HOLDING_B}, ${USER}, ${ACCOUNT}, ${"360750"}, ${"TIGER 미국S&P500"}, ${"해외주식"}, ${"해외ETF"}, ${22480}, ${45})
  `;
  await db.sql`
    INSERT INTO cost_basis (user_id, holding_id, account_id, total_cost, total_shares)
    VALUES (${USER}, ${HOLDING_A}, ${ACCOUNT}, ${1200000}, ${30})
  `;
  await db.sql`
    INSERT INTO cost_basis (user_id, holding_id, account_id, total_cost, total_shares)
    VALUES (${USER}, ${HOLDING_B}, ${ACCOUNT}, ${800000}, ${45})
  `;
}

async function addSnapshot(userId: string, accountId: string, date: string, value: number, cost: number) {
  await db.sql`
    INSERT INTO portfolio_value_snapshots (user_id, account_id, snapshot_date, total_value, total_cost)
    VALUES (${userId}, ${accountId}, ${date}, ${value}, ${cost})
    ON CONFLICT (user_id, account_id, snapshot_date)
    DO UPDATE SET total_value = EXCLUDED.total_value, total_cost = EXCLUDED.total_cost
  `;
}

const round = (value: number) => Math.round(value * 100) / 100;

test("계좌가 없으면 예외를 던진다", { skip }, async () => {
  await seedPortfolio();
  await assert.rejects(
    () => lib.getPortfolioReturnSummary(USER, "99999999-9999-4999-8999-999999999999"),
    /계좌를 찾을 수 없습니다/
  );
});

test("남의 계좌는 조회되지 않는다", { skip }, async () => {
  await seedPortfolio();
  await assert.rejects(() => lib.getPortfolioReturnSummary(USER, OTHER_ACCOUNT), /계좌를 찾을 수 없습니다/);
});

test("스냅샷이 없으면 기간 수익률은 모두 null이고 오늘 값이 기록된다", { skip }, async () => {
  await seedPortfolio();
  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);

  assert.equal(summary.accountId, ACCOUNT);
  assert.equal(summary.accountName, "내 계좌");
  assert.equal(summary.telegramChatId, null);
  assert.equal(summary.asOfDate, todayKst());
  assert.equal(summary.totalValue, 2_249_100);
  assert.equal(summary.totalCost, 2_000_000);
  assert.equal(summary.totalPnL, 249_100);
  assert.equal(round(summary.totalPnLPct), 12.46);

  for (const key of ["day", "week", "month"] as const) {
    const period = summary.periods[key];
    assert.equal(period.snapshotDate, null);
    assert.equal(period.returnPct, null);
    assert.equal(period.returnAmount, null);
  }

  const [saved] = await db.sql`
    SELECT snapshot_date::text, total_value::float, total_cost::float
    FROM portfolio_value_snapshots
    WHERE user_id = ${USER} AND account_id = ${ACCOUNT}
  `;
  assert.equal(saved.snapshot_date, todayKst());
  assert.equal(Number(saved.total_value), 2_249_100);
  assert.equal(Number(saved.total_cost), 2_000_000);
});

test("가장 가까운 과거 스냅샷으로 기간 수익률을 계산한다", { skip }, async () => {
  await seedPortfolio();
  const today = todayKst();
  const yesterday = shiftDate(today, -1);
  // 어제: 평가 2,200,000 / 원가 1,950,000 → 오늘 대비 +49,100, 원가 +50,000
  await addSnapshot(USER, ACCOUNT, yesterday, 2_200_000, 1_950_000);

  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  const day = summary.periods.day;
  assert.equal(day.snapshotDate, yesterday);
  assert.equal(day.valueChange, 49_100);
  assert.equal(day.netContribution, 50_000);
  assert.equal(day.returnAmount, -900);
  assert.equal(round(day.returnPct as number), -0.04);
  // 주간·월간은 7일/30일 전을 목표일로 삼으므로, 하루 전 스냅샷은 기준이 될 수 없다
  assert.equal(summary.periods.week.snapshotDate, null);
  assert.equal(summary.periods.month.snapshotDate, null);
});

test("기간마다 목표일 이전의 가장 최근 스냅샷을 고른다", { skip }, async () => {
  await seedPortfolio();
  const today = todayKst();
  const longAgo = shiftDate(today, -40);
  const midRange = shiftDate(today, -8);
  const yesterday = shiftDate(today, -1);
  await addSnapshot(USER, ACCOUNT, longAgo, 2_000_000, 1_900_000);
  await addSnapshot(USER, ACCOUNT, midRange, 2_100_000, 1_920_000);
  await addSnapshot(USER, ACCOUNT, yesterday, 2_200_000, 1_950_000);

  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);

  // 목표일(1일/7일/30일 전) 이전에서 가장 가까운 스냅샷을 고른다
  assert.equal(summary.periods.day.snapshotDate, yesterday);
  assert.equal(summary.periods.week.snapshotDate, midRange);
  assert.equal(summary.periods.month.snapshotDate, longAgo);
  // 일별: 2,249,100 - 2,200,000 = +49,100 / 원가 +50,000 → -900
  assert.equal(summary.periods.day.returnAmount, -900);
  // 주간: 2,249,100 - 2,100,000 = +149,100 / 원가 +80,000 → +69,100 (3.29%)
  assert.equal(summary.periods.week.returnAmount, 69_100);
  assert.equal(round(summary.periods.week.returnPct as number), 3.29);
  // 월간: 2,249,100 - 2,000,000 = +249,100 / 원가 +100,000 → +149,100 (7.46%)
  assert.equal(summary.periods.month.returnAmount, 149_100);
  assert.equal(round(summary.periods.month.returnPct as number), 7.46);
});

test("같은 날 두 번 계산해도 스냅샷은 1건이고 최신 값으로 갱신된다", { skip }, async () => {
  await seedPortfolio();
  const first = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(first.totalValue, 2_249_100);

  await db.sql`UPDATE holdings SET current_price = 45000 WHERE id = ${HOLDING_A}`;
  const second = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(second.totalValue, 2_249_100 + 30 * (45000 - 41250));

  const rows = await db.sql`
    SELECT snapshot_date::text, total_value::float
    FROM portfolio_value_snapshots
    WHERE user_id = ${USER} AND account_id = ${ACCOUNT}
  `;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].total_value), second.totalValue);
});

test("다른 사용자·다른 계좌의 스냅샷은 기준값으로 쓰이지 않는다", { skip }, async () => {
  await seedPortfolio();
  const yesterday = shiftDate(todayKst(), -1);
  await addSnapshot(OTHER_USER, OTHER_ACCOUNT, yesterday, 99_999_999, 1);
  await addSnapshot(USER, OTHER_ACCOUNT, yesterday, 88_888_888, 1);

  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(summary.periods.day.snapshotDate, null);
  assert.equal(summary.periods.day.returnPct, null);
});

test("직전 평가금액이 0이면 수익률은 null, 금액은 계산한다", { skip }, async () => {
  await seedPortfolio();
  const dayOnly = shiftDate(todayKst(), -1);
  await addSnapshot(USER, ACCOUNT, dayOnly, 0, 0);

  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  const day = summary.periods.day;
  assert.equal(day.snapshotDate, dayOnly);
  // 원가도 0이었으므로 입금분 2,000,000을 빼고 순수 평가차익만 남는다
  assert.equal(day.valueChange, 2_249_100);
  assert.equal(day.netContribution, 2_000_000);
  assert.equal(day.returnAmount, 249_100);
  assert.equal(day.returnPct, null);
});

test("소유 확인된 텔레그램 chat_id만 요약에 담는다(미확인은 다시 연결 필요)", { skip }, async () => {
  await seedPortfolio();
  await db.sql`UPDATE portfolio_accounts SET telegram_chat_id = ${"-1001234567890"} WHERE id = ${ACCOUNT}`;

  const unverified = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(unverified.telegramChatId, null);
  assert.equal(unverified.telegramNeedsRelink, true);

  await db.sql`UPDATE portfolio_accounts SET telegram_chat_verified_at = NOW() WHERE id = ${ACCOUNT}`;
  const summary = await lib.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(summary.telegramChatId, "-1001234567890");
  assert.equal(summary.telegramChatIdMasked, "…7890");
  assert.equal(summary.telegramNeedsRelink, false);

  const report = lib.formatReturnReport(summary);
  assert.match(report, /📊 내 계좌 수익률 리포트/);
  assert.match(report, /· 일별: 기준 스냅샷 없음/);
});
