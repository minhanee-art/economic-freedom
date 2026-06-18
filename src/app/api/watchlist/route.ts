// 감정분석 대상 종목 watchlist CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const rows = await sql`
    SELECT id, name, market, created_at::text
    FROM watchlist WHERE user_id = ${session.userId} ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { name, market } = await request.json() as { name: string; market: string };
  if (!name?.trim()) return NextResponse.json({ error: "종목명 필요" }, { status: 400 });
  const m = market === "US" ? "US" : "KR";
  const [row] = await sql`
    INSERT INTO watchlist (user_id, name, market)
    VALUES (${session.userId}, ${name.trim()}, ${m})
    RETURNING id, name, market, created_at::text
  `;
  return NextResponse.json(row, { status: 201 });
}
