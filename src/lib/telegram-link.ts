// 텔레그램 채팅 소유 확인(연결 코드).
//
// 흐름: 웹 설정에서 로그인 사용자가 계좌별 일회용 코드를 발급 → 사용자가 봇에게 `/start <코드>`(또는 코드만) 전송
// → 웹훅이 코드를 확인해 그 메시지의 chat.id를 해당 계좌의 "확인된" 채팅으로 저장.
// 사용자가 누르는 리포트 발송은 확인된 채팅으로만 나간다(portfolio_accounts.telegram_chat_verified_at이 있어야 함).
//
// 코드 성질
// - 31자 알파벳(헷갈리는 0/O/1/I/L 제외) 10자리 ≈ 2^49.5. 만료 10분, 1회용.
// - DB에는 SHA-256 해시만 저장한다(평문 코드는 발급 응답에만 한 번 나간다).
// - 발급 당시 users.session_version을 함께 저장하고, 사용 시점의 값과 같아야만 인정한다
//   → 비밀번호 변경·Google 첫 연결(계정 선점 차단) 등으로 세션이 폐기되면 그 전에 발급된 코드도 무효.
// - 같은 계좌에 새 코드를 발급하면 이전 미사용 코드는 지운다(계좌당 유효 코드 1개).
// - 무차별 대입 제한은 호출하는 쪽(웹훅: chat_id별, 발급 API: 사용자별)에서 건다.
import { createHash, randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { ensureSessionVersionSchema } from "@/lib/session-version";

export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 10;
export const LINK_CODE_TTL_MINUTES = 10;

/** 웹훅 답장 문구 — 실패 이유(틀림·만료·재사용)를 구분하지 않는다 */
export const LINK_SUCCESS_REPLY =
  "✅ 이 채팅을 가족연금계획 계좌에 연결했습니다. 웹 설정 화면에서 연결 상태를 확인할 수 있습니다. 본인이 요청한 연결이 아니면 웹 설정에서 연결을 해제해 주세요.";
export const LINK_FAILURE_REPLY =
  "연결하지 못했습니다. 코드가 맞지 않거나 이미 사용됐거나 만료됐을 수 있습니다. 웹 설정 화면에서 새 코드를 발급해 다시 보내 주세요.";

const CODE_PATTERN = new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`);
const CHAT_ID_PATTERN = /^-?\d{1,20}$/;

let schemaReady: Promise<void> | null = null;

/**
 * 연결 코드 테이블과 확인 시각 컬럼 보장 — 코드 안 CREATE/ALTER IF NOT EXISTS 패턴(neon-schema.sql과 같은 정의).
 * users·portfolio_accounts는 이미 있다고 본다(계좌 선택 단계에서 ensurePortfolioAccountSchema가 만든다).
 */
export function ensureTelegramLinkSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await ensureSessionVersionSchema();
    await sql`ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS telegram_chat_verified_at TIMESTAMPTZ`;
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_link_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL UNIQUE,
        session_version INTEGER NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_account ON telegram_link_codes(account_id)`;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

/** 무작위 코드. 영어 단어 한 개짜리 일반 질문과 헷갈리지 않도록 숫자를 하나 이상 넣는다(아니면 다시 뽑는다). */
export function generateLinkCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < LINK_CODE_LENGTH; i++) code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
    if (/\d/.test(code)) return code;
  }
}

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(`telegram-link:${code}`).digest("hex");
}

/** 형식이 맞으면 대문자로 정규화한 코드, 아니면 null. 공백·하이픈은 무시한다. */
export function normalizeLinkCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export type LinkAttempt = { code: string | null };

/**
 * 메시지가 연결 시도인지 판별한다. 연결 시도가 아니면 null(일반 메시지 → 기존 허용 목록 경로).
 * - `/start <페이로드>`, `/start@봇이름 <페이로드>`, `/link <페이로드>` → 연결 시도. 형식이 틀리면 code=null.
 * - 코드 형식에 정확히 맞고 숫자가 들어 있는 한 단어 → 연결 시도.
 * - 페이로드 없는 `/start`, 그 밖의 글 → null.
 */
export function parseLinkAttempt(text: string): LinkAttempt | null {
  const trimmed = text.trim();
  const command = /^\/(?:start|link)(?:@[A-Za-z0-9_]{1,64})?(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (command) {
    const payload = command[1]?.trim() ?? "";
    if (!payload) return null;
    return { code: normalizeLinkCode(payload) };
  }
  const bare = normalizeLinkCode(trimmed);
  return bare && !/\s/.test(trimmed) && /\d/.test(bare) ? { code: bare } : null;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "23505";
}

export type IssuedLinkCode = { code: string; expiresAt: string };

/** 로그인 사용자의 계좌에 새 연결 코드를 발급한다. 계좌가 그 사용자 것이 아니면 null. */
export async function issueTelegramLinkCode(userId: string, accountId: string): Promise<IssuedLinkCode | null> {
  await ensureTelegramLinkSchema();
  // 이 계좌의 이전 미사용 코드와 이 사용자의 만료된 코드를 지운다
  await sql`
    DELETE FROM telegram_link_codes
    WHERE user_id = ${userId}
      AND ((account_id = ${accountId} AND used_at IS NULL) OR expires_at <= NOW())
  `;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateLinkCode();
    try {
      const rows = (await sql`
        INSERT INTO telegram_link_codes (user_id, account_id, code_hash, session_version, expires_at)
        SELECT pa.user_id, pa.id, ${hashLinkCode(code)}, u.session_version,
               NOW() + make_interval(mins => ${LINK_CODE_TTL_MINUTES})
        FROM portfolio_accounts pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.id = ${accountId} AND pa.user_id = ${userId}
        RETURNING expires_at
      `) as Record<string, unknown>[];
      const row = rows[0];
      if (!row) return null;
      return { code, expiresAt: new Date(row.expires_at as string | Date).toISOString() };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("연결 코드를 만들지 못했습니다.");
}

/**
 * 웹훅에서 받은 코드로 chat_id를 계좌에 연결한다. 성공하면 true.
 * 코드 소진과 계좌 갱신을 한 문장으로 처리해, 같은 코드를 두 번 쓰거나 동시에 써도 한 번만 성공한다.
 * 틀린 코드·만료·재사용·세션 폐기 후 코드는 모두 같은 false다(호출부가 이유를 구분해 알려주지 않게).
 */
export async function redeemTelegramLinkCode(code: string, chatId: string): Promise<boolean> {
  const normalized = normalizeLinkCode(code);
  if (!normalized || !CHAT_ID_PATTERN.test(chatId)) return false;
  await ensureTelegramLinkSchema();
  const rows = (await sql`
    WITH used AS (
      UPDATE telegram_link_codes c
      SET used_at = NOW()
      FROM users u
      WHERE c.code_hash = ${hashLinkCode(normalized)}
        AND c.used_at IS NULL
        AND c.expires_at > NOW()
        AND u.id = c.user_id
        AND u.session_version = c.session_version
      RETURNING c.user_id, c.account_id
    )
    UPDATE portfolio_accounts pa
    SET telegram_chat_id = ${chatId}, telegram_chat_verified_at = NOW()
    FROM used
    WHERE pa.id = used.account_id AND pa.user_id = used.user_id
    RETURNING pa.id
  `) as Record<string, unknown>[];
  return rows.length > 0;
}

export type TelegramLinkStatus = {
  /** 확인된 채팅이 연결돼 있는가 */
  linked: boolean;
  /** 확인된 chat_id 끝 4자리만 보여 준다 */
  chatIdMasked: string | null;
  verifiedAt: string | null;
  /** 이 변경 전에 직접 입력한 미확인 chat_id가 남아 있다 → 다시 연결해야 발송된다 */
  needsRelink: boolean;
};

export function maskChatId(chatId: string): string {
  return chatId.length <= 4 ? chatId : `…${chatId.slice(-4)}`;
}

/** 계좌 행의 chat_id·확인 시각으로 연결 상태를 만든다. 확인된 chat_id만 발송 대상이다. */
export function toTelegramLinkStatus(row: { telegram_chat_id?: unknown; telegram_chat_verified_at?: unknown }): TelegramLinkStatus & {
  verifiedChatId: string | null;
} {
  const chatId = typeof row.telegram_chat_id === "string" && row.telegram_chat_id ? row.telegram_chat_id : null;
  const verifiedAtRaw = row.telegram_chat_verified_at;
  const verifiedAt = verifiedAtRaw ? new Date(verifiedAtRaw as string | Date).toISOString() : null;
  const linked = Boolean(chatId && verifiedAt);
  return {
    linked,
    verifiedChatId: linked ? chatId : null,
    chatIdMasked: linked && chatId ? maskChatId(chatId) : null,
    verifiedAt: linked ? verifiedAt : null,
    needsRelink: Boolean(chatId && !verifiedAt),
  };
}

export async function getTelegramLinkStatus(userId: string, accountId: string): Promise<TelegramLinkStatus | null> {
  await ensureTelegramLinkSchema();
  const rows = (await sql`
    SELECT telegram_chat_id, telegram_chat_verified_at
    FROM portfolio_accounts
    WHERE id = ${accountId} AND user_id = ${userId}
  `) as Record<string, unknown>[];
  if (!rows[0]) return null;
  const status = toTelegramLinkStatus(rows[0]);
  return {
    linked: status.linked,
    chatIdMasked: status.chatIdMasked,
    verifiedAt: status.verifiedAt,
    needsRelink: status.needsRelink,
  };
}

/** 연결 해제 — 확인된 채팅·미확인 chat_id·미사용 코드를 모두 지운다. */
export async function unlinkTelegram(userId: string, accountId: string): Promise<boolean> {
  await ensureTelegramLinkSchema();
  await sql`DELETE FROM telegram_link_codes WHERE user_id = ${userId} AND account_id = ${accountId}`;
  const rows = (await sql`
    UPDATE portfolio_accounts
    SET telegram_chat_id = NULL, telegram_chat_verified_at = NULL
    WHERE id = ${accountId} AND user_id = ${userId}
    RETURNING id
  `) as Record<string, unknown>[];
  return rows.length > 0;
}
