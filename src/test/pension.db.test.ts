// 연금 설계 데이터 통합 테스트 — 실제 Postgres에 neon-schema.sql을 적용하고 pension-data 쿼리를 검증한다.
// TEST_DATABASE_URL이 없으면 전체를 건너뛴다. 실행: scripts/verify-snapshot-db.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, mock } from "node:test";

import { createPgTestDb, type PgTestDb } from "@/test/pg-sql";

const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : "TEST_DATABASE_URL이 없어 건너뜀 (scripts/verify-snapshot-db.sh로 실행)";

const USER = "bbbbbbbb-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const LEGACY_ACCOUNT = "bbbbbbbb-0000-4000-8000-0000000000a1";
const IRP_ACCOUNT = "bbbbbbbb-0000-4000-8000-0000000000a2";
const OTHER_ACCOUNT = "bbbbbbbb-0000-4000-8000-0000000000b1";

let db: PgTestDb;
let data: typeof import("@/lib/pension-data");
let accounts: typeof import("@/lib/portfolio-accounts");

before(async () => {
  if (!connectionString) return;
  db = await createPgTestDb(connectionString);
  mock.module("@/lib/db", { namedExports: { sql: db.sql } });

  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  // 운영 DB처럼 account_type 컬럼이 없던 시절의 계좌를 만든 뒤 코드의 ALTER로 컬럼을 붙인다
  await db.sql`ALTER TABLE portfolio_accounts DROP COLUMN account_type`;
  // 운영 DB처럼 배우자 총급여 구간 컬럼이 없던 프로필에 코드의 ALTER로 컬럼을 붙인다
  await db.sql`ALTER TABLE profiles DROP COLUMN spouse_salary_bracket`;
  await db.sql`INSERT INTO users (id, email) VALUES (${USER}, ${"pension-user@pension.local"}), (${OTHER}, ${"pension-other@pension.local"})`;
  await db.sql`INSERT INTO profiles (id, email) VALUES (${USER}, ${"pension-user@pension.local"}), (${OTHER}, ${"pension-other@pension.local"})`;
  await db.sql`INSERT INTO portfolio_accounts (id, user_id, name, display_order) VALUES (${LEGACY_ACCOUNT}, ${USER}, ${"내 계좌"}, ${0})`;
  await db.sql`INSERT INTO portfolio_accounts (id, user_id, name) VALUES (${OTHER_ACCOUNT}, ${OTHER}, ${"남의 계좌"})`;

  data = await import("@/lib/pension-data");
  accounts = await import("@/lib/portfolio-accounts");
  await data.ensurePensionSchema();
});

after(async () => {
  if (!db) return;
  await db.sql`DELETE FROM users WHERE id IN (${USER}, ${OTHER})`;
  await db.pool.end();
});

test("기존 계좌는 account_type 'general'로 채워지고, 새 계좌는 지정 유형으로 저장된다", { skip }, async () => {
  const [legacy] = await db.sql`SELECT account_type FROM portfolio_accounts WHERE id = ${LEGACY_ACCOUNT}`;
  assert.equal(legacy.account_type, "general");

  const created = await accounts.createPortfolioAccount(USER, "IRP", "self", "irp");
  assert.equal(created.account_type, "irp");
  await db.sql`UPDATE portfolio_accounts SET id = ${IRP_ACCOUNT} WHERE id = ${created.id}`;

  const list = await accounts.getPortfolioAccounts(USER);
  assert.deepEqual(list.map((a) => a.account_type), ["general", "irp"]);
});

test("updatePortfolioAccount: 본인 계좌만 유형을 바꾼다", { skip }, async () => {
  const updated = await accounts.updatePortfolioAccount(USER, LEGACY_ACCOUNT, { accountType: "pension_savings" });
  assert.equal(updated?.account_type, "pension_savings");
  assert.equal(updated?.name, "내 계좌", "이름은 그대로");
  assert.equal(await accounts.updatePortfolioAccount(USER, OTHER_ACCOUNT, { accountType: "isa" }), null);
  const [other] = await db.sql`SELECT account_type FROM portfolio_accounts WHERE id = ${OTHER_ACCOUNT}`;
  assert.equal(other.account_type, "general");
});

test("납입 기록: 계좌·연도당 한 행으로 덮어쓰고, 남의 계좌에는 저장하지 않는다", { skip }, async () => {
  assert.ok(await data.upsertContribution(USER, LEGACY_ACCOUNT, 2026, 3_000_000, null));
  const second = await data.upsertContribution(USER, LEGACY_ACCOUNT, 2026, 5_000_000, "12월 추가");
  assert.equal(second?.amount, 5_000_000);
  await data.upsertContribution(USER, LEGACY_ACCOUNT, 2025, 6_000_000, null);
  await data.upsertContribution(USER, IRP_ACCOUNT, 2026, 3_000_000, null);

  assert.equal(await data.upsertContribution(USER, OTHER_ACCOUNT, 2026, 1, null), null);
  assert.equal(await data.upsertContribution(OTHER, LEGACY_ACCOUNT, 2026, 1, null), null);

  const rows = await data.getContributions(USER, 2026);
  assert.deepEqual(
    rows.map((r) => [r.account_id, r.amount, r.memo]).sort(),
    [
      [IRP_ACCOUNT, 3_000_000, null],
      [LEGACY_ACCOUNT, 5_000_000, "12월 추가"],
    ].sort()
  );
  assert.equal((await data.getContributions(OTHER, 2026)).length, 0);

  assert.equal(await data.deleteContribution(OTHER, LEGACY_ACCOUNT, 2025), false);
  assert.equal(await data.deleteContribution(USER, LEGACY_ACCOUNT, 2025), true);
});

test("납입 기록: 음수 금액은 DB CHECK로 막힌다", { skip }, async () => {
  await assert.rejects(data.upsertContribution(USER, LEGACY_ACCOUNT, 2024, -1, null));
});

test("연금 항목: 사용자별로 분리되고 종신(end_age NULL)을 보존한다", { skip }, async () => {
  const created = await data.createIncomeSource(USER, {
    member: "spouse",
    sourceType: "national_pension",
    label: "배우자 국민연금",
    monthlyAmount: 900_000,
    startAge: 65,
    endAge: null,
    memo: null,
  });
  assert.equal(created.end_age, null);
  assert.equal(created.monthly_amount, 900_000);

  assert.equal(
    await data.updateIncomeSource(OTHER, created.id, { ...toFields(created), monthlyAmount: 1 }),
    null
  );
  const updated = await data.updateIncomeSource(USER, created.id, { ...toFields(created), endAge: 90 });
  assert.equal(updated?.end_age, 90);

  assert.equal((await data.getIncomeSources(USER)).length, 1);
  assert.equal((await data.getIncomeSources(OTHER)).length, 0);
  assert.equal(await data.deleteIncomeSource(OTHER, created.id), false);
  assert.equal(await data.deleteIncomeSource(USER, created.id), true);
});

test("은퇴 목표: profiles에 저장·조회, 프로필 없는 사용자는 false/null", { skip }, async () => {
  assert.deepEqual(await data.getRetirementGoal(USER), {
    targetMonthly: null,
    retirementAge: null,
    birthYear: null,
    spouseBirthYear: null,
    expectedReturnPct: null,
    salaryBracket: null,
    spouseSalaryBracket: null,
  });
  const goal = {
    targetMonthly: 3_500_000,
    retirementAge: 60,
    birthYear: 1980,
    spouseBirthYear: 1982,
    expectedReturnPct: 4.5,
    salaryBracket: "low" as const,
    spouseSalaryBracket: "high" as const,
  };
  assert.equal(await data.saveRetirementGoal(USER, goal), true);
  assert.deepEqual(await data.getRetirementGoal(USER), goal);
  assert.equal((await data.getRetirementGoal(OTHER))?.targetMonthly, null, "다른 사용자 영향 없음");

  const ghost = "bbbbbbbb-0000-4000-8000-00000000ffff";
  assert.equal(await data.saveRetirementGoal(ghost, goal), false);
  assert.equal(await data.getRetirementGoal(ghost), null);
});

test("배우자 총급여 구간: 코드의 ALTER로 컬럼이 생기고, 보낸 항목만 바꾸며 다른 사용자와 섞이지 않는다", { skip }, async () => {
  const [column] = await db.sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'spouse_salary_bracket'
  `;
  assert.equal(column?.data_type, "text", "ensurePensionSchema가 없던 컬럼을 붙인다");

  await data.patchRetirementGoal(USER, { salaryBracket: "high", spouseSalaryBracket: null });
  const saved = await data.patchRetirementGoal(USER, { spouseSalaryBracket: "low" });
  assert.equal(saved?.spouseSalaryBracket, "low");
  assert.equal(saved?.salaryBracket, "high", "본인 구간은 그대로");
  assert.equal((await data.getRetirementGoal(USER))?.spouseSalaryBracket, "low");
  assert.equal((await data.getRetirementGoal(OTHER))?.spouseSalaryBracket, null, "다른 사용자 프로필은 그대로");

  // 다른 항목만 바꾸면 배우자 구간은 유지, null을 보내면 지운다
  assert.equal((await data.patchRetirementGoal(USER, { retirementAge: 62 }))?.spouseSalaryBracket, "low");
  assert.equal((await data.patchRetirementGoal(USER, { spouseSalaryBracket: null }))?.spouseSalaryBracket, null);

  // 알 수 없는 값이 DB에 들어 있어도(직접 수정 등) 응답은 null(미입력)로 읽는다
  await db.sql`UPDATE profiles SET spouse_salary_bracket = 'mid' WHERE id = ${USER}`;
  assert.equal((await data.getRetirementGoal(USER))?.spouseSalaryBracket, null);
  await db.sql`UPDATE profiles SET spouse_salary_bracket = NULL WHERE id = ${USER}`;
});

test("계좌 스냅샷: 평가액과 최근 1년 배당만 합산한다", { skip }, async () => {
  const [holding] = await db.sql`
    INSERT INTO holdings (user_id, account_id, code, name, category, sub_category, current_price, shares)
    VALUES (${USER}, ${LEGACY_ACCOUNT}, ${"069500"}, ${"KODEX 200"}, ${"주식"}, ${"국장"}, ${40000}, ${100000})
    RETURNING id
  `;
  await db.sql`INSERT INTO dividends (user_id, account_id, holding_id, amount, date) VALUES (${USER}, ${LEGACY_ACCOUNT}, ${holding.id}, ${70000}, CURRENT_DATE - 30)`;
  await db.sql`INSERT INTO dividends (user_id, account_id, holding_id, amount, date) VALUES (${USER}, ${LEGACY_ACCOUNT}, ${holding.id}, ${99999}, CURRENT_DATE - 400)`;

  const snapshots = await data.getAccountSnapshots(USER);
  const legacy = snapshots.find((s) => s.id === LEGACY_ACCOUNT)!;
  assert.equal(legacy.value, 4_000_000_000, "INT 범위를 넘는 평가액도 BIGINT로 계산");
  assert.equal(legacy.annual_dividend, 70_000);
  assert.equal(legacy.account_type, "pension_savings");
  assert.equal(snapshots.find((s) => s.id === IRP_ACCOUNT)!.value, 0);
  assert.equal((await data.getAccountSnapshots(OTHER)).length, 1);
});

test("계좌를 지우면 납입 기록도 함께 지워진다 (ON DELETE CASCADE)", { skip }, async () => {
  await data.upsertContribution(USER, IRP_ACCOUNT, 2023, 1_000, null);
  await db.sql`DELETE FROM portfolio_accounts WHERE id = ${IRP_ACCOUNT}`;
  const [{ c }] = await db.sql`SELECT count(*)::int AS c FROM pension_contributions WHERE account_id = ${IRP_ACCOUNT}`;
  assert.equal(c, 0);
});

test("neon-schema.sql은 이미 적용된 DB에 다시 돌려도 안전하다", { skip }, async () => {
  await db.pool.query(readFileSync("neon-schema.sql", "utf8"));
  const [{ c }] = await db.sql`SELECT count(*)::int AS c FROM portfolio_accounts WHERE user_id = ${USER}`;
  assert.equal(c, 1);
});

function toFields(row: import("@/lib/pension-data").IncomeSourceRow) {
  return {
    member: row.member,
    sourceType: row.source_type,
    label: row.label,
    monthlyAmount: row.monthly_amount,
    startAge: row.start_age,
    endAge: row.end_age,
    memo: row.memo,
  };
}
