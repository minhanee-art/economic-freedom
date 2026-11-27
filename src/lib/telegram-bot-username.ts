// 봇 사용자명(@ 제외). TELEGRAM_BOT_USERNAME이 있고 형식이 맞을 때만 값이 나오며, 아니면 null.
// 연결 API(딥링크)와 안내 페이지(봇 링크)가 같은 규칙을 쓰도록 한곳에 둔다.
export function getBotUsername(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
  return /^[A-Za-z0-9_]{5,32}$/.test(raw) ? raw : null;
}
