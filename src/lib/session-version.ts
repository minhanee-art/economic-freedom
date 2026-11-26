// 세션 버전 — JWT 폐기용 users.session_version 스키마 보장·조회.
// 토큰의 sv 클레임이 DB 값과 다르면(또는 사용자 행이 없으면) 그 토큰은 무효다.
// 비밀번호 변경·계정 삭제·Google 첫 연결 시 값을 올려 그 전에 발급된 모든 토큰을 폐기한다.
import { sql } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * users.session_version 컬럼 보장 — 저장소의 "코드 안 ALTER ... IF NOT EXISTS" 패턴.
 * 인스턴스당 한 번만 실행하고, 실패하면 다음 호출에서 다시 시도한다.
 * (PostgreSQL 11+에서 NOT NULL DEFAULT 상수 컬럼 추가는 테이블 재작성 없이 메타데이터만 바뀐다.)
 */
export function ensureSessionVersionSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0`;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

/** DB 값을 세션 버전으로 해석한다. 정수가 아니면 예외(조용히 0으로 보지 않는다). */
export function toSessionVersion(value: unknown): number {
  const version = typeof value === "string" ? Number(value) : value;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("session_version 값이 올바르지 않습니다.");
  }
  return version;
}

function isUndefinedColumn(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "42703";
}

/**
 * 사용자의 현재 세션 버전. 사용자가 없으면(삭제됨) null.
 * 요청마다 불리는 경로라 평소에는 ALTER 없이 PK 조회 한 번만 한다.
 * 컬럼이 아직 없을 때(운영 DB 마이그레이션 전)만 스키마를 만든 뒤 다시 읽는다.
 */
export async function getSessionVersion(userId: string): Promise<number | null> {
  const read = () => sql`SELECT session_version FROM users WHERE id = ${userId}`;
  let rows: Record<string, unknown>[];
  try {
    rows = (await read()) as Record<string, unknown>[];
  } catch (err) {
    if (!isUndefinedColumn(err)) throw err;
    await ensureSessionVersionSchema();
    rows = (await read()) as Record<string, unknown>[];
  }
  const row = rows[0];
  return row ? toSessionVersion(row.session_version) : null;
}
