// 감정분석 대상 종목 watchlist CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getRequestSession } from "@/lib/session";
import { selectRequestAccount } from "@/lib/account-selection";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
  const rows = await sql`
    SELECT id, name, code, market, created_at::text
    FROM watchlist WHERE user_id = ${session.userId} AND account_id = ${accountId} ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const selected = await selectRequestAccount(request, session.userId);
  if (!selected.ok) return selected.response;
  const accountId = selected.accountId;
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
