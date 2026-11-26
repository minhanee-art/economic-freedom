// 요청 단위 활성 계좌 선택 — 계좌 범위 API 공통.
// 우선순위: X-Portfolio-Account-Id 헤더 / ?accountId= 쿼리(명시) → 계좌 선택 쿠키(웹) → 첫 계좌.
// Bearer 클라이언트(모바일 앱)는 쿠키가 없으므로 헤더나 쿼리로 계좌를 지정한다.
// 명시한 계좌는 반드시 로그인 사용자 소유여야 하며, 아니면 다른 계좌로 조용히 바꾸지 않고 404로 거절한다
// (클라이언트가 B 계좌에 쓴다고 믿는 요청이 A 계좌에 반영되는 일을 막는다).
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, getPortfolioAccounts, type PortfolioAccount } from "@/lib/portfolio-accounts";

export const ACCOUNT_HEADER = "x-portfolio-account-id";
export const ACCOUNT_QUERY_PARAM = "accountId";

export type AccountSelection =
  | { ok: true; accountId: string; account: PortfolioAccount; accounts: PortfolioAccount[] }
  | { ok: false; response: NextResponse };

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
}

/** 요청이 명시한 계좌 id. 헤더와 쿼리가 서로 다르면 "conflict". */
export function readRequestedAccountId(request: Request): string | null | "conflict" {
  const fromHeader = request.headers.get(ACCOUNT_HEADER)?.trim() || null;
  const fromQuery = new URL(request.url).searchParams.get(ACCOUNT_QUERY_PARAM)?.trim() || null;
  if (fromHeader && fromQuery && fromHeader !== fromQuery) return "conflict";
  return fromHeader ?? fromQuery;
}

export async function selectRequestAccount(request: Request, userId: string): Promise<AccountSelection> {
  const requested = readRequestedAccountId(request);
  if (requested === "conflict") {
    return {
      ok: false,
      response: NextResponse.json({ error: "계좌 지정이 헤더와 쿼리에서 서로 다릅니다." }, { status: 400 }),
    };
  }

  // 소유권 검증 — 로그인 사용자의 계좌 목록 안에서만 고른다
  const accounts = await getPortfolioAccounts(userId);
  if (requested) {
    const account = accounts.find((item) => item.id === requested);
    if (!account) {
      return { ok: false, response: NextResponse.json({ error: "계좌를 찾을 수 없습니다." }, { status: 404 }) };
    }
    return { ok: true, accountId: account.id, account, accounts };
  }

  const cookieAccountId = readCookie(request, ACCOUNT_COOKIE);
  const account = accounts.find((item) => item.id === cookieAccountId) ?? accounts[0];
  if (!account) {
    return { ok: false, response: NextResponse.json({ error: "포트폴리오 계좌가 없습니다." }, { status: 404 }) };
  }
  return { ok: true, accountId: account.id, account, accounts };
}
