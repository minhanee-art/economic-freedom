// 감정분석 대상 종목 watchlist CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getActivePortfolioAccountId } from "@/lib/portfolio-accounts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const rows = await sql`
    SELECT id, name, code, market, created_at::text
    FROM watchlist WHERE user_id = ${session.userId} AND account_id = ${accountId} ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const accountId = await getActivePortfolioAccountId(session.userId);
  const { name, code, market } = await request.json() as { name: string; code?: string; market: string };
  if (!name?.trim()) return NextResponse.json({ error: "종목명 필요" }, { status: 400 });
  const m = market === "US" ? "US" : "KR";
  const c = code?.trim() || null;
  const [row] = await sql`
    INSERT INTO watchlist (user_id, account_id, name, code, market)
    VALUES (${session.userId}, ${accountId}, ${name.trim()}, ${c}, ${m})
    ON CONFLICT (user_id, account_id, name) DO NOTHING
    RETURNING id, name, code, market, created_at::text
  `;
  if (!row) return NextResponse.json({ error: "현재 계좌에 이미 등록된 종목입니다." }, { status: 409 });
  return NextResponse.json(row, { status: 201 });
}
