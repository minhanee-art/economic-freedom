// 배당 캘린더 CRUD API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await sql`
    SELECT id, date::text, stock, type, note
    FROM dividend_calendar WHERE user_id = ${session.userId} ORDER BY date ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, stock, type, note } = await request.json() as {
    date: string; stock: string; type: string; note?: string;
  };
  if (!date || !stock || !type) {
    return NextResponse.json({ error: "date, stock, type 필수" }, { status: 400 });
  }
  const [row] = await sql`
    INSERT INTO dividend_calendar (user_id, date, stock, type, note)
    VALUES (${session.userId}, ${date}, ${stock}, ${type}, ${note ?? ""})
    RETURNING id, date::text, stock, type, note
  `;
  return NextResponse.json(row);
}
