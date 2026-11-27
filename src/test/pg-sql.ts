// 실제 Postgres에 붙는 태그드 템플릿 sql — DB 통합 테스트 전용.
// 앱의 db.ts(Neon 서버리스)와 같은 호출 모양(sql`...`)을 유지한다.
export type PgSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  transaction: (queries: unknown[]) => Promise<unknown>;
};

export type PgTestDb = {
  sql: PgSql;
  pool: { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; end: () => Promise<void> };
};

/** `pg`는 통합 테스트에서만 쓰므로 동적 import 한다 (일반 테스트 실행에서는 이 경로를 타지 않음). */
export async function createPgTestDb(connectionString: string): Promise<PgTestDb> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 4 });

  type Rows = Record<string, unknown>[];
  type QueryClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Rows }> };
  type LazyQuery = PromiseLike<Rows> & {
    catch: Promise<Rows>["catch"];
    finally: Promise<Rows>["finally"];
    runOn: (client: QueryClient) => Promise<Rows>;
  };

  // Neon의 sql``처럼 await(then) 될 때 실행되는 지연 쿼리 — transaction([...])이 같은 연결에서 순서대로,
  // BEGIN/COMMIT 안에서 실행할 수 있게 한다 (즉시 실행하면 풀의 다른 연결에서 병렬로 돌아 원자성이 깨진다).
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce(
      (acc, chunk, index) => `${acc}${chunk}${index < values.length ? `$${index + 1}` : ""}`,
      ""
    );
    let started: Promise<Rows> | null = null;
    const run = () => (started ??= pool.query(text, values).then((result) => result.rows));
    const query: LazyQuery = {
      runOn: (client) => client.query(text, values).then((result) => result.rows),
      then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
      catch: (onRejected) => run().catch(onRejected),
      finally: (onFinally) => run().finally(onFinally),
    };
    return query;
  }) as unknown as PgSql;

  sql.transaction = async (queries: unknown[]) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results: unknown[] = [];
      for (const query of queries) {
        if (query && typeof (query as LazyQuery).runOn === "function") {
          results.push(await (query as LazyQuery).runOn(client));
        } else if (typeof query === "function") {
          results.push(await (query as (tx: unknown) => Promise<unknown>)(sql));
        }
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  return { sql, pool };
}

/** 스냅샷 기능이 건드리는 테이블만 실제 스키마와 같게 만든다 (neon-schema.sql 기준). */
export async function ensureSnapshotTestSchema(sql: PgSql): Promise<void> {
  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      display_name TEXT,
      monthly_budget INTEGER NOT NULL DEFAULT 300000,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portfolio_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      owner_type TEXT NOT NULL DEFAULT 'self',
      display_order INTEGER NOT NULL DEFAULT 0,
      telegram_chat_id TEXT,
      account_type TEXT NOT NULL DEFAULT 'general',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, name)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS holdings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT NOT NULL,
      current_price INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      target_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      expense_ratio NUMERIC(5,3) NOT NULL DEFAULT 0,
      account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cost_basis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
      total_cost INTEGER NOT NULL DEFAULT 0,
      total_shares INTEGER NOT NULL DEFAULT 0,
      account_id UUID REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** 오늘 날짜(KST)를 앱과 같은 방식으로 구한다. */
export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
