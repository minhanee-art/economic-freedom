// 텔레그램 연결 코드 통합 테스트 — 실제 Postgres에 neon-schema.sql(+ 코드 안 CREATE/ALTER)을 적용하고
// 발급·사용(만료·1회용·동시 사용·세션 폐기·다른 사용자 계좌)과 리포트 대상 chat_id 판정을 실제 SQL로 확인한다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach, mock } from "node:test";

import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const USER = "cccccccc-0000-4000-8000-000000000001";
const OTHER = "cccccccc-0000-4000-8000-000000000002";
const ACCOUNT = "cccccccc-0000-4000-8000-0000000000a1";
const OTHER_ACCOUNT = "cccccccc-0000-4000-8000-0000000000a2";

let db: PgTestDb;
let link: typeof import("@/lib/telegram-link");
let returns: typeof import("@/lib/portfolio-returns");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });
  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const accounts = await import("@/lib/portfolio-accounts");
  await accounts.ensurePortfolioAccountSchema();
  link = await import("@/lib/telegram-link");
  returns = await import("@/lib/portfolio-returns");
  // 코드 안 스키마 보장이 neon-schema.sql 적용 뒤에도 문제없이 다시 돌아야 한다(IF NOT EXISTS)
  await link.ensureTelegramLinkSchema();
});

after(async () => {
  if (!db) return;
  await db.pool.end();
});

beforeEach(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users WHERE id IN (${USER}, ${OTHER})`;
  await db.sql`INSERT INTO users (id, email) VALUES (${USER}, ${"link-me@pension.local"}), (${OTHER}, ${"link-other@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${USER}, ${"link-me@pension.local"}), (${OTHER}, ${"link-other@pension.local"})`;
  await db.sql`INSERT INTO portfolio_accounts (id, user_id, name) VALUES (${ACCOUNT}, ${USER}, ${"내 계좌"}), (${OTHER_ACCOUNT}, ${OTHER}, ${"남의 계좌"})`;
});

async function account(id: string) {
  const [row] = await db.sql`SELECT telegram_chat_id, telegram_chat_verified_at FROM portfolio_accounts WHERE id = ${id}`;
  return row;
}

test("스키마: 연결 코드 테이블과 확인 시각 컬럼이 있다", { skip }, async () => {
  const cols = await db.sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'telegram_link_codes' ORDER BY column_name
  `;
  assert.deepEqual(
    cols.map((c) => c.column_name),
    ["account_id", "code_hash", "created_at", "expires_at", "id", "session_version", "used_at", "user_id"]
  );
  const [verified] = await db.sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'portfolio_accounts' AND column_name = 'telegram_chat_verified_at'
  `;
  assert.equal(verified.data_type, "timestamp with time zone");
});

test("발급: 해시만 저장하고 약 10분 뒤 만료된다. 남의 계좌에는 발급되지 않는다", { skip }, async () => {
  const issued = await link.issueTelegramLinkCode(USER, ACCOUNT);
  assert.ok(issued);
  const [row] = await db.sql`
    SELECT code_hash, EXTRACT(EPOCH FROM (expires_at - created_at))::int AS ttl
    FROM telegram_link_codes WHERE account_id = ${ACCOUNT}
  `;
  assert.equal(row.code_hash, link.hashLinkCode(issued.code));
  assert.notEqual(row.code_hash, issued.code);
  assert.ok(Math.abs(Number(row.ttl) - 600) <= 2);

  assert.equal(await link.issueTelegramLinkCode(USER, OTHER_ACCOUNT), null);
  const [{ count }] = await db.sql`SELECT COUNT(*)::int AS count FROM telegram_link_codes WHERE account_id = ${OTHER_ACCOUNT}`;
  assert.equal(count, 0);
});

test("사용: 한 번만 성공하고 그 chat_id가 확인됨으로 저장된다", { skip }, async () => {
  const issued = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  assert.equal(await link.redeemTelegramLinkCode(issued.code.toLowerCase(), "-1001234567890"), true);
  assert.equal(await link.redeemTelegramLinkCode(issued.code, "555555555"), false);
  const row = await account(ACCOUNT);
  assert.equal(row.telegram_chat_id, "-1001234567890");
  assert.ok(row.telegram_chat_verified_at);

  const summary = await returns.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(summary.telegramChatId, "-1001234567890");
  assert.equal(summary.telegramChatIdMasked, "…7890");
  assert.equal(summary.telegramNeedsRelink, false);
});

test("동시 사용: 같은 코드를 동시에 보내도 하나만 성공한다", { skip }, async () => {
  const issued = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  const results = await Promise.all(
    ["100000001", "100000002", "100000003", "100000004"].map((chat) => link.redeemTelegramLinkCode(issued.code, chat))
  );
  assert.equal(results.filter(Boolean).length, 1);
});

test("만료된 코드는 실패한다", { skip }, async () => {
  const issued = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  await db.sql`UPDATE telegram_link_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE account_id = ${ACCOUNT}`;
  assert.equal(await link.redeemTelegramLinkCode(issued.code, "123456789"), false);
  assert.equal((await account(ACCOUNT)).telegram_chat_id, null);
});

test("세션 버전이 바뀌면(비밀번호 변경·Google 첫 연결) 그 전에 발급한 코드는 실패한다", { skip }, async () => {
  const issued = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  await db.sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${USER}`;
  assert.equal(await link.redeemTelegramLinkCode(issued.code, "123456789"), false);
  assert.equal((await account(ACCOUNT)).telegram_chat_id, null);
});

test("새로 발급하면 같은 계좌의 이전 코드는 지워진다", { skip }, async () => {
  const first = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  const second = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  assert.equal(await link.redeemTelegramLinkCode(first.code, "123456789"), false);
  assert.equal(await link.redeemTelegramLinkCode(second.code, "123456789"), true);
});

test("다른 사용자의 코드는 그 사용자의 계좌에만 연결된다", { skip }, async () => {
  const others = (await link.issueTelegramLinkCode(OTHER, OTHER_ACCOUNT))!;
  assert.equal(await link.redeemTelegramLinkCode(others.code, "777777777"), true);
  assert.equal((await account(OTHER_ACCOUNT)).telegram_chat_id, "777777777");
  assert.equal((await account(ACCOUNT)).telegram_chat_id, null);
  const mine = await returns.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(mine.telegramChatId, null);
});

test("미확인 chat_id(이번 변경 전 직접 입력한 값)는 발송 대상이 아니고 다시 연결 필요로 표시된다", { skip }, async () => {
  await db.sql`UPDATE portfolio_accounts SET telegram_chat_id = ${"987654321"} WHERE id = ${ACCOUNT}`;
  const summary = await returns.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(summary.telegramChatId, null);
  assert.equal(summary.telegramNeedsRelink, true);
  const status = await link.getTelegramLinkStatus(USER, ACCOUNT);
  assert.deepEqual(status, { linked: false, chatIdMasked: null, verifiedAt: null, needsRelink: true });
});

test("Google 첫 연결처럼 chat_id만 지워져도 확인 상태가 남지 않는다", { skip }, async () => {
  const issued = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  await link.redeemTelegramLinkCode(issued.code, "123456789");
  await db.sql`UPDATE portfolio_accounts SET telegram_chat_id = NULL WHERE user_id = ${USER}`;
  const summary = await returns.getPortfolioReturnSummary(USER, ACCOUNT);
  assert.equal(summary.telegramChatId, null);
  assert.equal(summary.telegramNeedsRelink, false);
});

test("연결 해제는 내 계좌만 지우고 남은 코드도 지운다. 남의 계좌는 해제할 수 없다", { skip }, async () => {
  const mine = (await link.issueTelegramLinkCode(USER, ACCOUNT))!;
  await link.redeemTelegramLinkCode(mine.code, "123456789");
  const others = (await link.issueTelegramLinkCode(OTHER, OTHER_ACCOUNT))!;
  await link.redeemTelegramLinkCode(others.code, "777777777");
  await link.issueTelegramLinkCode(USER, ACCOUNT);

  assert.equal(await link.unlinkTelegram(USER, OTHER_ACCOUNT), false);
  assert.equal((await account(OTHER_ACCOUNT)).telegram_chat_id, "777777777");

  assert.equal(await link.unlinkTelegram(USER, ACCOUNT), true);
  const row = await account(ACCOUNT);
  assert.equal(row.telegram_chat_id, null);
  assert.equal(row.telegram_chat_verified_at, null);
  const [{ count }] = await db.sql`SELECT COUNT(*)::int AS count FROM telegram_link_codes WHERE account_id = ${ACCOUNT}`;
  assert.equal(count, 0);
});

test("계정이 삭제되면 연결 코드도 함께 지워진다(ON DELETE CASCADE)", { skip }, async () => {
  await link.issueTelegramLinkCode(USER, ACCOUNT);
  await db.sql`DELETE FROM users WHERE id = ${USER}`;
  const [{ count }] = await db.sql`SELECT COUNT(*)::int AS count FROM telegram_link_codes WHERE user_id = ${USER}`;
  assert.equal(count, 0);
});
