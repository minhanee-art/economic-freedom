// 텔레그램 채팅 연결(소유 확인) API — 계좌 단위.
// GET    → 현재 계좌의 연결 상태(확인된 chat_id 끝 4자리, 확인 시각, 다시 연결 필요 여부)
// POST   → 일회용 연결 코드 발급(10분, 1회용). 사용자별 10분 10회 제한.
// DELETE → 연결 해제(확인된 채팅·미사용 코드 삭제)
// 계좌는 다른 계좌 범위 API와 같이 X-Portfolio-Account-Id / ?accountId= / 계좌 선택 쿠키로 고른다.
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";
import { authRateLimit } from "@/lib/rate-limit";
import { getBotUsername } from "@/lib/telegram-bot-username";
import {
  LINK_CODE_TTL_MINUTES,
  getTelegramLinkStatus,
  issueTelegramLinkCode,
  unlinkTelegram,
} from "@/lib/telegram-link";

export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "계좌를 찾을 수 없습니다." };

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const status = await getTelegramLinkStatus(session.userId, selected.accountId);
  if (!status) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ accountName: selected.account.name, ...status, botUsername: getBotUsername() });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;

  if (!(await authRateLimit(`telegram-link:issue:${session.userId}`))) {
    return NextResponse.json(
      { error: "연결 코드를 너무 자주 발급했습니다. 10분 뒤 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const issued = await issueTelegramLinkCode(session.userId, selected.accountId);
  if (!issued) return NextResponse.json(NOT_FOUND, { status: 404 });

  const username = getBotUsername();
  return NextResponse.json(
    {
      code: issued.code,
      expiresAt: issued.expiresAt,
      ttlMinutes: LINK_CODE_TTL_MINUTES,
      botUsername: username,
      deepLink: username ? `https://t.me/${username}?start=${issued.code}` : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const ok = await unlinkTelegram(session.userId, selected.accountId);
  if (!ok) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ ok: true });
}
