// 텔레그램 봇 웹훅 인증·인가.
// 기본 거부(fail closed): 웹훅 시크릿이나 허용 chat_id 목록이 비어 있으면 아무 요청도 처리하지 않는다.
import { timingSafeEqual } from "node:crypto";

/** 길이가 달라도 예외 없이 상수 시간에 가깝게 비교한다 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * 봇과 대화할 수 있는 chat_id 목록.
 * TELEGRAM_ALLOWED_CHAT_IDS(쉼표 구분)와 운영자 채팅 TELEGRAM_CHAT_ID를 합친다.
 * 이용자가 대시보드에 입력한 portfolio_accounts.telegram_chat_id는 포함하지 않는다
 * — 누구나 아무 숫자나 입력할 수 있으므로 소유 증명이 되지 않는다.
 */
export function getAllowedChatIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = [env.TELEGRAM_ALLOWED_CHAT_IDS ?? "", env.TELEGRAM_CHAT_ID ?? ""].join(",");
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^-?\d{1,20}$/.test(id));
  return new Set(ids);
}

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: "secret-not-configured" | "bad-secret" };

/** Telegram이 setWebhook 때 받은 secret_token을 X-Telegram-Bot-Api-Secret-Token 헤더로 돌려보낸다 */
export function verifyWebhookSecret(
  headerValue: string | null,
  env: NodeJS.ProcessEnv = process.env
): WebhookAuthResult {
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return { ok: false, reason: "secret-not-configured" };
  if (!headerValue || !safeEqual(headerValue, secret)) return { ok: false, reason: "bad-secret" };
  return { ok: true };
}

/** 허용 목록이 비어 있으면 모든 채팅을 거부한다 */
export function isChatAllowed(chatId: number | string, env: NodeJS.ProcessEnv = process.env): boolean {
  const allowed = getAllowedChatIds(env);
  if (allowed.size === 0) return false;
  return allowed.has(String(chatId));
}
