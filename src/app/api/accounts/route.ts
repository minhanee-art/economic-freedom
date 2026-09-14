// 가족/명의별 포트폴리오 계좌 API
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  ACCOUNT_COOKIE,
  createPortfolioAccount,
  getActivePortfolioAccountId,
  getPortfolioAccounts,
} from "@/lib/portfolio-accounts";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const [accounts, activeAccountId] = await Promise.all([
    getPortfolioAccounts(session.userId),
    getActivePortfolioAccountId(session.userId),
  ]);

  return NextResponse.json({ accounts, activeAccountId });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const ownerType = ["self", "spouse", "child", "other"].includes(body.ownerType)
    ? body.ownerType
    : "other";

  try {
    const account = await createPortfolioAccount(session.userId, name, ownerType);
    const response = NextResponse.json({ account }, { status: 201 });
    response.cookies.set(ACCOUNT_COOKIE, account.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { accountId } = await request.json().catch(() => ({}));
  const accounts = await getPortfolioAccounts(session.userId);
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return NextResponse.json({ error: "계좌를 찾을 수 없습니다." }, { status: 404 });

  const response = NextResponse.json({ ok: true, activeAccountId: account.id });
  response.cookies.set(ACCOUNT_COOKIE, account.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
