// 연금 설계 데이터 — 스키마 보장 + 조회/저장 쿼리
// 스키마는 neon-schema.sql 끝과 같다. 기존 패턴대로 코드에서도 CREATE/ALTER IF NOT EXISTS로 보장한다.
import { sql } from "@/lib/db";
import { ensurePortfolioAccountSchema } from "@/lib/portfolio-accounts";
import { normalizeAccountType, type AccountType } from "@/lib/account-types";
import type { FamilyMember, IncomeSourceType } from "@/lib/pension-planning";
import type { SalaryBracket } from "@/lib/pension-rules";

let schemaReady: Promise<void> | null = null;

export async function ensurePensionSchema(): Promise<void> {
  schemaReady ??= (async () => {
    // pension_contributions.account_id가 portfolio_accounts를 참조하므로 먼저 보장
    await ensurePortfolioAccountSchema();

    await sql`
      CREATE TABLE IF NOT EXISTS pension_contributions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        amount BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
        memo TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (account_id, year)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pension_contributions_user_year ON pension_contributions(user_id, year)`;

    await sql`
      CREATE TABLE IF NOT EXISTS pension_income_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member TEXT NOT NULL DEFAULT 'self' CHECK (member IN ('self', 'spouse')),
        source_type TEXT NOT NULL CHECK (source_type IN ('national_pension', 'retirement_pension', 'pension_insurance')),
        label TEXT,
        monthly_amount BIGINT NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
        start_age INTEGER NOT NULL,
        end_age INTEGER,
        memo TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pension_income_sources_user ON pension_income_sources(user_id)`;

    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retirement_target_monthly BIGINT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retirement_age INTEGER`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year INTEGER`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_birth_year INTEGER`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expected_return_pct NUMERIC(5,2)`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS salary_bracket TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spouse_salary_bracket TEXT`;
  })().catch((error) => {
    // 실패하면 다음 요청에서 다시 시도
    schemaReady = null;
    throw error;
  });
  await schemaReady;
}

// ── 납입 기록 ───────────────────────────────────────────────

export type ContributionRow = {
  id: string;
  account_id: string;
  year: number;
  amount: number;
  memo: string | null;
  updated_at: string;
};

function toContribution(row: Record<string, unknown>): ContributionRow {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    year: Number(row.year),
    amount: Number(row.amount),
    memo: (row.memo as string | null) ?? null,
    updated_at: String(row.updated_at),
  };
}

export async function getContributions(userId: string, year: number): Promise<ContributionRow[]> {
  await ensurePensionSchema();
  const rows = await sql`
    SELECT id, account_id, year, amount, memo, updated_at::text
    FROM pension_contributions
    WHERE user_id = ${userId} AND year = ${year}
    ORDER BY created_at ASC
  `;
  return rows.map(toContribution);
}

/** 계좌·연도별 납입액을 저장(있으면 덮어씀). 본인 계좌가 아니면 null. */
export async function upsertContribution(
  userId: string,
  accountId: string,
  year: number,
  amount: number,
  memo: string | null
): Promise<ContributionRow | null> {
  await ensurePensionSchema();
  const [row] = await sql`
    INSERT INTO pension_contributions (user_id, account_id, year, amount, memo)
    SELECT ${userId}, pa.id, ${year}, ${amount}, ${memo}
    FROM portfolio_accounts pa
    WHERE pa.id = ${accountId} AND pa.user_id = ${userId}
    ON CONFLICT (account_id, year) DO UPDATE
      SET amount = EXCLUDED.amount, memo = EXCLUDED.memo, updated_at = NOW()
    RETURNING id, account_id, year, amount, memo, updated_at::text
  `;
  return row ? toContribution(row) : null;
}

export async function deleteContribution(userId: string, accountId: string, year: number): Promise<boolean> {
  await ensurePensionSchema();
  const rows = await sql`
    DELETE FROM pension_contributions
    WHERE user_id = ${userId} AND account_id = ${accountId} AND year = ${year}
    RETURNING id
  `;
  return rows.length > 0;
}

// ── 공적·퇴직연금 수동 입력 ──────────────────────────────────

export type IncomeSourceRow = {
  id: string;
  member: FamilyMember;
  source_type: IncomeSourceType;
  label: string | null;
  monthly_amount: number;
  start_age: number;
  end_age: number | null;
  memo: string | null;
};

export type IncomeSourceFields = {
  member: FamilyMember;
  sourceType: IncomeSourceType;
  label: string | null;
  monthlyAmount: number;
  startAge: number;
  endAge: number | null;
  memo: string | null;
};

function toIncomeSource(row: Record<string, unknown>): IncomeSourceRow {
  return {
    id: String(row.id),
    member: row.member as FamilyMember,
    source_type: row.source_type as IncomeSourceType,
    label: (row.label as string | null) ?? null,
    monthly_amount: Number(row.monthly_amount),
    start_age: Number(row.start_age),
    end_age: row.end_age === null || row.end_age === undefined ? null : Number(row.end_age),
    memo: (row.memo as string | null) ?? null,
  };
}

export async function getIncomeSources(userId: string): Promise<IncomeSourceRow[]> {
  await ensurePensionSchema();
  const rows = await sql`
    SELECT id, member, source_type, label, monthly_amount, start_age, end_age, memo
    FROM pension_income_sources
    WHERE user_id = ${userId}
    ORDER BY member ASC, start_age ASC, created_at ASC
  `;
  return rows.map(toIncomeSource);
}

export async function createIncomeSource(userId: string, fields: IncomeSourceFields): Promise<IncomeSourceRow> {
  await ensurePensionSchema();
  const [row] = await sql`
    INSERT INTO pension_income_sources (user_id, member, source_type, label, monthly_amount, start_age, end_age, memo)
    VALUES (${userId}, ${fields.member}, ${fields.sourceType}, ${fields.label}, ${fields.monthlyAmount},
            ${fields.startAge}, ${fields.endAge}, ${fields.memo})
    RETURNING id, member, source_type, label, monthly_amount, start_age, end_age, memo
  `;
  return toIncomeSource(row);
}

export async function updateIncomeSource(
  userId: string,
  id: string,
  fields: IncomeSourceFields
): Promise<IncomeSourceRow | null> {
  await ensurePensionSchema();
  const [row] = await sql`
    UPDATE pension_income_sources
    SET member = ${fields.member}, source_type = ${fields.sourceType}, label = ${fields.label},
        monthly_amount = ${fields.monthlyAmount}, start_age = ${fields.startAge}, end_age = ${fields.endAge},
        memo = ${fields.memo}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, member, source_type, label, monthly_amount, start_age, end_age, memo
  `;
  return row ? toIncomeSource(row) : null;
}

export async function deleteIncomeSource(userId: string, id: string): Promise<boolean> {
  await ensurePensionSchema();
  const rows = await sql`
    DELETE FROM pension_income_sources WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

// ── 은퇴 목표 (profiles) ──────────────────────────────────────

export type RetirementGoalRow = {
  targetMonthly: number | null;
  retirementAge: number | null;
  birthYear: number | null;
  spouseBirthYear: number | null;
  expectedReturnPct: number | null;
  salaryBracket: SalaryBracket | null;
  /** 배우자 총급여 구간. null이면 미입력 — 배우자 명의 계좌는 낮은 공제율로 가정한다 */
  spouseSalaryBracket: SalaryBracket | null;
};

const nullableNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export async function getRetirementGoal(userId: string): Promise<RetirementGoalRow | null> {
  await ensurePensionSchema();
  const [row] = await sql`
    SELECT retirement_target_monthly, retirement_age, birth_year, spouse_birth_year,
           expected_return_pct::float AS expected_return_pct, salary_bracket, spouse_salary_bracket
    FROM profiles WHERE id = ${userId}
  `;
  return row ? toRetirementGoal(row) : null;
}

const toSalaryBracket = (value: unknown): SalaryBracket | null => (value === "low" || value === "high" ? value : null);

function toRetirementGoal(row: Record<string, unknown>): RetirementGoalRow {
  return {
    targetMonthly: nullableNumber(row.retirement_target_monthly),
    retirementAge: nullableNumber(row.retirement_age),
    birthYear: nullableNumber(row.birth_year),
    spouseBirthYear: nullableNumber(row.spouse_birth_year),
    expectedReturnPct: nullableNumber(row.expected_return_pct),
    salaryBracket: toSalaryBracket(row.salary_bracket),
    spouseSalaryBracket: toSalaryBracket(row.spouse_salary_bracket),
  };
}

/**
 * 요청에 들어 있는 항목만 바꾼다 — 키가 없으면 그대로 두고, 값이 null이면 지운다.
 * 읽고 병합해 전체를 다시 쓰면 두 기기가 서로 다른 항목을 동시에 고칠 때 나중 요청이 앞 요청을 옛 값으로 되돌리므로,
 * 항목마다 "바꿀지" 플래그를 넘겨 한 UPDATE 안에서 CASE로 고른다. 저장 후 전체 목표를 돌려주고, 프로필이 없으면 null.
 */
export async function patchRetirementGoal(
  userId: string,
  patch: Partial<RetirementGoalRow>
): Promise<RetirementGoalRow | null> {
  await ensurePensionSchema();
  const has = (key: keyof RetirementGoalRow) => Object.prototype.hasOwnProperty.call(patch, key);
  const value = <K extends keyof RetirementGoalRow>(key: K) => (has(key) ? (patch[key] ?? null) : null);
  const [row] = await sql`
    UPDATE profiles
    SET retirement_target_monthly = CASE WHEN ${has("targetMonthly")}::boolean THEN ${value("targetMonthly")}::bigint ELSE retirement_target_monthly END,
        retirement_age = CASE WHEN ${has("retirementAge")}::boolean THEN ${value("retirementAge")}::integer ELSE retirement_age END,
        birth_year = CASE WHEN ${has("birthYear")}::boolean THEN ${value("birthYear")}::integer ELSE birth_year END,
        spouse_birth_year = CASE WHEN ${has("spouseBirthYear")}::boolean THEN ${value("spouseBirthYear")}::integer ELSE spouse_birth_year END,
        expected_return_pct = CASE WHEN ${has("expectedReturnPct")}::boolean THEN ${value("expectedReturnPct")}::numeric ELSE expected_return_pct END,
        salary_bracket = CASE WHEN ${has("salaryBracket")}::boolean THEN ${value("salaryBracket")}::text ELSE salary_bracket END,
        spouse_salary_bracket = CASE WHEN ${has("spouseSalaryBracket")}::boolean THEN ${value("spouseSalaryBracket")}::text ELSE spouse_salary_bracket END
    WHERE id = ${userId}
    RETURNING retirement_target_monthly, retirement_age, birth_year, spouse_birth_year,
              expected_return_pct::float AS expected_return_pct, salary_bracket, spouse_salary_bracket
  `;
  return row ? toRetirementGoal(row) : null;
}

/** 전달된 값 전체를 그대로 저장한다 (null은 지움). 프로필이 없으면 false. */
export async function saveRetirementGoal(userId: string, goal: RetirementGoalRow): Promise<boolean> {
  return (await patchRetirementGoal(userId, goal)) !== null;
}

// ── 계좌별 평가액·배당 (현금흐름 계산 입력) ──────────────────────

export type AccountSnapshotRow = {
  id: string;
  name: string;
  owner_type: string;
  account_type: AccountType;
  value: number;
  annual_dividend: number;
};

export async function getAccountSnapshots(userId: string): Promise<AccountSnapshotRow[]> {
  await ensurePensionSchema();
  const rows = await sql`
    SELECT pa.id, pa.name, pa.owner_type, pa.account_type,
           COALESCE((SELECT SUM(h.current_price::bigint * h.shares) FROM holdings h
                     WHERE h.account_id = pa.id AND h.user_id = pa.user_id), 0) AS value,
           COALESCE((SELECT SUM(d.amount) FROM dividends d
                     WHERE d.account_id = pa.id AND d.user_id = pa.user_id
                       AND d.date > CURRENT_DATE - INTERVAL '1 year'), 0) AS annual_dividend
    FROM portfolio_accounts pa
    WHERE pa.user_id = ${userId}
    ORDER BY pa.display_order ASC, pa.created_at ASC
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    owner_type: String(row.owner_type),
    account_type: normalizeAccountType(row.account_type),
    value: Number(row.value),
    annual_dividend: Number(row.annual_dividend),
  }));
}
