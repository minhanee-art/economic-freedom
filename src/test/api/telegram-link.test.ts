// 텔레그램 채팅 소유 확인(연결 코드) API 테스트.
// 웹 발급(/api/telegram-link) → 봇 웹훅(/api/telegram-bot)으로 코드 사용 → 리포트 발송(/api/portfolio-returns) 흐름을
// 메모리 가짜 DB로 확인한다. 실제 텔레그램·OpenAI는 호출하지 않는다.
// SQL 자체(만료·1회용·세션 버전)의 실제 Postgres 동작은 src/test/telegram-link.db.test.ts에서 따로 확인한다.
import test, { afterEach, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { authRequest, createFakeSql, readJson } from "@/test/api-helpers";

// ── 가짜 DB 상태 ─────────────────────────────────────
type Account = { id: string; user_id: string; name: string; telegram_chat_id: string | null; verified_at: number | null };
type Code = {
  user_id: string;
  account_id: string;
  code_hash: string;
  session_version: number;
  expires_at: number;
  used_at: number | null;
};

const state = {
  now: Date.parse("2026-11-27T00:00:00Z"),
  users: new Map<string, number>(),
  accounts: new Map<string, Account>(),
  codes: [] as Code[],
};

function resetState() {
  state.now = Date.parse("2026-11-27T00:00:00Z");
  state.users = new Map([
    ["user-1", 0],
    ["user-2", 0],
  ]);
  state.accounts = new Map([
    ["acc-1", { id: "acc-1", user_id: "user-1", name: "내 계좌", telegram_chat_id: null, verified_at: null }],
    ["acc-1b", { id: "acc-1b", user_id: "user-1", name: "배우자 계좌", telegram_chat_id: null, verified_at: null }],
    ["acc-2", { id: "acc-2", user_id: "user-2", name: "남의 계좌", telegram_chat_id: null, verified_at: null }],
  ]);
  state.codes = [];
}

function handler(query: string, values: unknown[]): unknown {
  if (/^(ALTER|CREATE|DROP)/.test(query)) return [];

  if (query.startsWith("DELETE FROM telegram_link_codes WHERE user_id = ? AND ((account_id = ?")) {
    const [userId, accountId] = values as string[];
    state.codes = state.codes.filter(
      (c) => !(c.user_id === userId && ((c.account_id === accountId && c.used_at === null) || c.expires_at <= state.now))
    );
    return [];
  }
  if (query.startsWith("INSERT INTO telegram_link_codes")) {
    const [hash, ttlMinutes, accountId, userId] = values as [string, number, string, string];
    const account = state.accounts.get(accountId);
    if (!account || account.user_id !== userId) return [];
    if (state.codes.some((c) => c.code_hash === hash)) throw Object.assign(new Error("dup"), { code: "23505" });
    const expires = state.now + ttlMinutes * 60_000;
    state.codes.push({
      user_id: userId,
      account_id: accountId,
      code_hash: hash,
      session_version: state.users.get(userId)!,
      expires_at: expires,
      used_at: null,
    });
    return [{ expires_at: new Date(expires).toISOString() }];
  }
  if (query.startsWith("WITH used AS ( UPDATE telegram_link_codes")) {
    const [hash, chatId] = values as string[];
    const code = state.codes.find(
      (c) =>
        c.code_hash === hash &&
        c.used_at === null &&
        c.expires_at > state.now &&
        state.users.get(c.user_id) === c.session_version
    );
    if (!code) return [];
    code.used_at = state.now;
    const account = state.accounts.get(code.account_id);
    if (!account || account.user_id !== code.user_id) return [];
    account.telegram_chat_id = chatId;
    account.verified_at = state.now;
    return [{ id: account.id }];
  }
  if (query.startsWith("SELECT telegram_chat_id, telegram_chat_verified_at FROM portfolio_accounts")) {
    const [accountId, userId] = values as string[];
    const account = state.accounts.get(accountId);
    if (!account || account.user_id !== userId) return [];
    return [toRow(account)];
  }
  if (query.startsWith("DELETE FROM telegram_link_codes WHERE user_id = ? AND account_id = ?")) {
    const [userId, accountId] = values as string[];
    state.codes = state.codes.filter((c) => !(c.user_id === userId && c.account_id === accountId));
    return [];
  }
  if (query.startsWith("UPDATE portfolio_accounts SET telegram_chat_id = NULL, telegram_chat_verified_at = NULL")) {
    const [accountId, userId] = values as string[];
    const account = state.accounts.get(accountId);
    if (!account || account.user_id !== userId) return [];
    account.telegram_chat_id = null;
    account.verified_at = null;
    return [{ id: accountId }];
  }
  // 수익률 요약(getPortfolioReturnSummary)
  if (query.startsWith("SELECT id, name, telegram_chat_id, telegram_chat_verified_at FROM portfolio_accounts")) {
    const [accountId, userId] = values as string[];
    const account = state.accounts.get(accountId);
    if (!account || account.user_id !== userId) return [];
    return [{ id: account.id, name: account.name, ...toRow(account) }];
  }
  if (query.includes("AS total_value")) return [{ total_value: 1_000_000, total_cost: 900_000 }];
  return [];
}

function toRow(account: Account) {
  return {
    telegram_chat_id: account.telegram_chat_id,
    telegram_chat_verified_at: account.verified_at === null ? null : new Date(account.verified_at).toISOString(),
  };
}

const db = createFakeSql(handler);
mock.module("@/lib/db", { namedExports: { sql: db.sql } });

const session = { userId: "user-1" as string | null };
mock.module("@/lib/session", {
  namedExports: {
    getRequestSession: async () => (session.userId ? { userId: session.userId, source: "cookie" as const } : null),
  },
});

mock.module("@/lib/portfolio-accounts", {
  namedExports: {
    ACCOUNT_COOKIE: "pension-account",
    getPortfolioAccounts: async (userId: string) =>
      [...state.accounts.values()]
        .filter((a) => a.user_id === userId)
        .map((a) => ({ id: a.id, name: a.name, ownerType: "self", accountType: "general" })),
  },
});

// 레이트리밋 — 실제 모듈과 같은 한도(10분 10회)를 메모리로 흉내 내고 테스트마다 비운다.
// (실제 rate-limit 모듈 자체는 src/test/rate-limit.test.ts에서 확인한다)
const rateHits = new Map<string, number>();
const rateKeys: string[] = [];
mock.module("@/lib/rate-limit", {
  namedExports: {
    authRateLimit: async (key: string) => {
      rateKeys.push(key);
      const hits = (rateHits.get(key) ?? 0) + 1;
      rateHits.set(key, hits);
      return hits <= 10;
    },
    clientIp: () => "127.0.0.1",
  },
});

const sent: { text: string; chatId?: string }[] = [];
mock.module("@/lib/telegram", {
  namedExports: {
    sendTelegramMessage: async (text: string, opts: { chatId?: string } = {}) => {
      sent.push({ text, chatId: opts.chatId });
    },
  },
});

// ── 라우트 ───────────────────────────────────────────
let bot: typeof import("@/app/api/telegram-bot/route");
let link: typeof import("@/app/api/telegram-link/route");
let returns: typeof import("@/app/api/portfolio-returns/route");
// mock.module 등록 뒤에 불러와야 가짜 DB를 쓴다(정적 import는 mock보다 먼저 평가된다)
let LINK_SUCCESS_REPLY: string;
let LINK_FAILURE_REPLY: string;
let hashLinkCode: (code: string) => string;

const SECRET = "webhook-test-secret";
const OPERATOR_CHAT = "111111111";
const openaiCalls: string[] = [];
const realFetch = globalThis.fetch;
const realNow = Date.now;
const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "OPENAI_API_KEY",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_BOT_USERNAME",
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

before(async () => {
  bot = await import("@/app/api/telegram-bot/route");
  link = await import("@/app/api/telegram-link/route");
  returns = await import("@/app/api/portfolio-returns/route");
  ({ LINK_SUCCESS_REPLY, LINK_FAILURE_REPLY, hashLinkCode } = await import("@/lib/telegram-link"));
});

// 채팅마다 레이트리밋 버킷이 따로라 테스트끼리 섞이지 않도록 새 chat_id를 쓴다
let chatSeq = 500_000_000;
const newChat = () => String(chatSeq++);

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  process.env.OPENAI_API_KEY = "openai-key";
  process.env.TELEGRAM_CHAT_ID = OPERATOR_CHAT;
  process.env.TELEGRAM_ALLOWED_CHAT_IDS = "";
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.TELEGRAM_BOT_USERNAME = "family_pension_bot";
  resetState();
  db.calls.length = 0;
  sent.length = 0;
  openaiCalls.length = 0;
  rateHits.clear();
  rateKeys.length = 0;
  session.userId = "user-1";
  Date.now = () => state.now;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://api.openai.com/")) {
      openaiCalls.push(url);
      return Response.json({ choices: [{ message: { content: "답변" } }] });
    }
    throw new Error(`테스트에서 허용하지 않은 외부 호출: ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function webhook(chatId: string, text: string, secret: string | null = SECRET): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-telegram-bot-api-secret-token"] = secret;
  return new NextRequest("https://pension.test/api/telegram-bot", {
    method: "POST",
    headers,
    body: JSON.stringify({ update_id: 1, message: { chat: { id: Number(chatId) }, text } }),
  });
}

async function issue(userId = "user-1", accountId?: string): Promise<string> {
  session.userId = userId;
  const response = await link.POST(
    authRequest("POST", { headers: accountId ? { "x-portfolio-account-id": accountId } : {} })
  );
  assert.equal(response.status, 200);
  const data = await readJson<{ code: string; deepLink: string | null }>(response);
  return data.code;
}

async function sendReport(userId = "user-1", body?: unknown) {
  session.userId = userId;
  return returns.POST(authRequest("POST", { body }));
}

function redeemQueries() {
  return db.find("WITH used AS");
}

// ── 발급 ─────────────────────────────────────────────

test("발급: 코드는 10자리이고 DB에는 해시만 저장된다", async () => {
  session.userId = "user-1";
  const response = await link.POST(authRequest("POST"));
  const data = await readJson<{ code: string; expiresAt: string; deepLink: string }>(response);
  assert.match(data.code, /^[A-HJKMNP-Z2-9]{10}$/);
  assert.equal(data.deepLink, `https://t.me/family_pension_bot?start=${data.code}`);
  assert.equal(Date.parse(data.expiresAt) - state.now, 10 * 60_000);
  assert.equal(state.codes.length, 1);
  assert.equal(state.codes[0].code_hash, hashLinkCode(data.code));
  const stored = JSON.stringify(db.calls.map((c) => c.values));
  assert.ok(!stored.includes(data.code), "평문 코드가 SQL 값으로 나가면 안 된다");
});

test("발급: 로그인하지 않으면 401, 남의 계좌를 지정하면 404이고 코드가 생기지 않는다", async () => {
  session.userId = null;
  assert.equal((await link.POST(authRequest("POST"))).status, 401);
  session.userId = "user-1";
  const response = await link.POST(authRequest("POST", { headers: { "x-portfolio-account-id": "acc-2" } }));
  assert.equal(response.status, 404);
  assert.equal(state.codes.length, 0);
});

test("발급: 같은 계좌에 새로 발급하면 이전 코드는 쓸 수 없다", async () => {
  const first = await issue();
  const second = await issue();
  const chat = newChat();
  await bot.POST(webhook(chat, `/start ${first}`));
  assert.equal(sent.at(-1)?.text, LINK_FAILURE_REPLY);
  await bot.POST(webhook(chat, `/start ${second}`));
  assert.equal(sent.at(-1)?.text, LINK_SUCCESS_REPLY);
});

test("발급: 사용자별 10분 10회를 넘으면 429", async () => {
  session.userId = "user-2";
  for (let i = 0; i < 10; i++) {
    assert.equal((await link.POST(authRequest("POST"))).status, 200);
  }
  assert.equal((await link.POST(authRequest("POST"))).status, 429);
  assert.ok(rateKeys.every((key) => key === "telegram-link:issue:user-2"));
});

// ── 웹훅에서 코드 사용 ───────────────────────────────

test("허용 목록 밖 채팅도 올바른 코드로 연결되고, 그 chat_id가 확인됨으로 저장된다", async () => {
  const code = await issue();
  const chat = newChat();
  const response = await bot.POST(webhook(chat, `/start ${code}`));
  assert.equal(response.status, 200);
  assert.deepEqual(sent, [{ text: LINK_SUCCESS_REPLY, chatId: chat }]);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, chat);
  assert.ok(state.accounts.get("acc-1")!.verified_at);
  assert.equal(openaiCalls.length, 0);

  session.userId = "user-1";
  const status = await readJson<{ linked: boolean; chatIdMasked: string }>(await link.GET(authRequest("GET")));
  assert.equal(status.linked, true);
  assert.equal(status.chatIdMasked, `…${chat.slice(-4)}`);
});

test("코드는 소문자·`/start@봇이름`·`/link`·코드만 보내도 인정한다", async () => {
  const forms = [
    (c: string) => `/start ${c.toLowerCase()}`,
    (c: string) => `/start@family_pension_bot ${c}`,
    (c: string) => `/link ${c}`,
    (c: string) => c,
  ];
  for (const form of forms) {
    resetState();
    const code = await issue();
    sent.length = 0;
    await bot.POST(webhook(newChat(), form(code)));
    assert.equal(sent.at(-1)?.text, LINK_SUCCESS_REPLY, form("CODE"));
  }
});

test("재사용: 이미 쓴 코드는 다른 채팅에서 다시 써도 실패하고 기존 연결이 바뀌지 않는다", async () => {
  const code = await issue();
  const owner = newChat();
  const attacker = newChat();
  await bot.POST(webhook(owner, `/start ${code}`));
  await bot.POST(webhook(attacker, `/start ${code}`));
  assert.equal(sent.at(-1)?.text, LINK_FAILURE_REPLY);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, owner);
});

test("만료: 10분이 지난 코드는 실패한다", async () => {
  const code = await issue();
  state.now += 10 * 60_000 + 1;
  await bot.POST(webhook(newChat(), `/start ${code}`));
  assert.equal(sent.at(-1)?.text, LINK_FAILURE_REPLY);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
});

test("세션 폐기(비밀번호 변경·Google 첫 연결 등) 전에 발급한 코드는 실패한다", async () => {
  const code = await issue();
  state.users.set("user-1", 1);
  await bot.POST(webhook(newChat(), `/start ${code}`));
  assert.equal(sent.at(-1)?.text, LINK_FAILURE_REPLY);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
});

test("다른 사용자 코드: 코드를 발급한 사용자의 계좌에만 연결되고 내 계좌는 그대로다", async () => {
  const othersCode = await issue("user-2");
  const chat = newChat();
  await bot.POST(webhook(chat, `/start ${othersCode}`));
  assert.equal(state.accounts.get("acc-2")!.telegram_chat_id, chat);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
  assert.equal(state.accounts.get("acc-1b")!.telegram_chat_id, null);
  // user-1은 그 채팅으로 리포트를 보낼 수 없다
  const response = await sendReport("user-1");
  assert.equal(response.status, 409);
  assert.ok(!sent.some((m) => m.text.includes("수익률 리포트")));
});

test("틀린 코드·형식이 틀린 페이로드는 같은 문구로 답한다(이유를 구분해 알려주지 않음)", async () => {
  await issue();
  const chat = newChat();
  for (const text of ["/start ABCDEFGH23", "/start 0000000000", "/start hello world", "/start x"]) {
    await bot.POST(webhook(chat, text));
  }
  assert.equal(sent.length, 4);
  assert.ok(sent.every((m) => m.text === LINK_FAILURE_REPLY && m.chatId === chat));
  // 형식이 틀린 페이로드는 DB까지 가지 않는다
  assert.equal(redeemQueries().length, 1);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
});

test("무차별 대입: 한 채팅에서 10분에 10번을 넘으면 맞는 코드라도 처리·답장하지 않는다", async () => {
  const code = await issue();
  const chat = newChat();
  for (let i = 0; i < 10; i++) {
    await bot.POST(webhook(chat, `/start ABCDEFGH${String(i).padStart(2, "2").replace(/[01]/g, "3")}`));
  }
  assert.equal(sent.length, 10);
  assert.ok(rateKeys.includes(`telegram-link:chat:${chat}`));
  const before = redeemQueries().length;
  await bot.POST(webhook(chat, `/start ${code}`));
  assert.equal(sent.length, 10, "한도를 넘으면 답장하지 않는다");
  assert.equal(redeemQueries().length, before, "한도를 넘으면 DB 조회도 하지 않는다");
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
  // 다른 채팅은 영향받지 않는다
  await bot.POST(webhook(newChat(), `/start ${code}`));
  assert.equal(sent.at(-1)?.text, LINK_SUCCESS_REPLY);
});

test("연결 코드 메시지도 웹훅 시크릿이 없거나 틀리면 처리하지 않는다", async () => {
  const code = await issue();
  db.calls.length = 0;
  assert.equal((await bot.POST(webhook(newChat(), `/start ${code}`, null))).status, 401);
  assert.equal((await bot.POST(webhook(newChat(), `/start ${code}`, "wrong"))).status, 401);
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  assert.equal((await bot.POST(webhook(newChat(), `/start ${code}`, SECRET))).status, 503);
  assert.equal(db.calls.length, 0);
  assert.equal(sent.length, 0);
  assert.equal(state.codes[0].used_at, null);
});

test("허용 목록 채팅이 보낸 연결 코드도 OpenAI로 보내지 않는다", async () => {
  const code = await issue();
  await bot.POST(webhook(OPERATOR_CHAT, `/start ${code}`));
  await bot.POST(webhook(OPERATOR_CHAT, code));
  assert.equal(openaiCalls.length, 0);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, OPERATOR_CHAT);
});

test("OPENAI_API_KEY가 없어도 연결 코드는 처리된다", async () => {
  delete process.env.OPENAI_API_KEY;
  const code = await issue();
  await bot.POST(webhook(newChat(), `/start ${code}`));
  assert.equal(sent.at(-1)?.text, LINK_SUCCESS_REPLY);
});

test("허용 목록 밖 채팅의 일반 메시지·코드 없는 /start는 여전히 무시한다(DB·OpenAI·답장 없음)", async () => {
  for (const text of ["배당락일이 뭐야?", "/start", "/start   ", "MARKETCAPS", "/help ABCDEFGH23"]) {
    db.calls.length = 0;
    const response = await bot.POST(webhook(newChat(), text));
    assert.equal(response.status, 200);
    assert.equal(db.calls.length, 0, text);
  }
  assert.equal(openaiCalls.length, 0);
  assert.equal(sent.length, 0);
});

test("허용 목록 채팅의 일반 질문은 기존대로 OpenAI 답변 경로로 간다", async () => {
  await bot.POST(webhook(OPERATOR_CHAT, "배당락일이 뭐야?"));
  assert.equal(openaiCalls.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(redeemQueries().length, 0);
});

// ── 리포트 발송 ──────────────────────────────────────

test("미확인 chat_id(예전에 직접 입력한 값)로는 리포트를 보내지 않는다", async () => {
  state.accounts.get("acc-1")!.telegram_chat_id = "987654321";
  const response = await sendReport("user-1");
  assert.equal(response.status, 409);
  const data = await readJson<{ code: string }>(response);
  assert.equal(data.code, "telegram_needs_relink");
  assert.equal(sent.length, 0);

  session.userId = "user-1";
  const status = await readJson<{ linked: boolean; needsRelink: boolean }>(await link.GET(authRequest("GET")));
  assert.deepEqual([status.linked, status.needsRelink], [false, true]);
});

test("연결이 없으면 409, 요청 본문의 telegramChatId로는 보내지도 저장하지도 않는다", async () => {
  const response = await sendReport("user-1", { telegramChatId: "987654321" });
  assert.equal(response.status, 409);
  assert.equal(sent.length, 0);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
});

test("확인된 채팅으로만 보내고, 본문이 다른 chat_id를 보내도 무시한다", async () => {
  const code = await issue();
  const chat = newChat();
  await bot.POST(webhook(chat, `/start ${code}`));
  sent.length = 0;
  const response = await sendReport("user-1", { telegramChatId: "987654321" });
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, chat);
  assert.match(sent[0].text, /내 계좌 수익률 리포트/);
  const data = await readJson<{ summary: { telegramChatIdMasked: string } }>(response);
  assert.equal(data.summary.telegramChatIdMasked, `…${chat.slice(-4)}`);
});

test("chat_id 직접 저장(PATCH)은 더 이상 없다", () => {
  assert.equal((returns as Record<string, unknown>).PATCH, undefined);
});

test("연결 해제하면 리포트를 보낼 수 없고 남은 코드도 지워진다", async () => {
  const code = await issue();
  await bot.POST(webhook(newChat(), `/start ${code}`));
  await issue();
  session.userId = "user-1";
  assert.equal((await link.DELETE(authRequest("DELETE"))).status, 200);
  assert.equal(state.accounts.get("acc-1")!.telegram_chat_id, null);
  assert.equal(state.codes.filter((c) => c.account_id === "acc-1").length, 0);
  sent.length = 0;
  assert.equal((await sendReport("user-1")).status, 409);
  assert.equal(sent.length, 0);
});
