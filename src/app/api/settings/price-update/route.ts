// 가격 업데이트 시각 기록 API
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  await sql`UPDATE profiles SET last_price_update = NOW() WHERE id = ${session.userId}`;
  return NextResponse.json({ ok: true });
}
