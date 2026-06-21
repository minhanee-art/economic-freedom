// 매일 08:00 KST 7일 이내 배당 일정 체크 → 텔레그램 전송 (일정 없으면 조용히 종료)
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

async function resolveUserId(): Promise<string | null> {
  const directId = process.env.REPORT_USER_ID;
  if (directId) return directId;
  const email = process.env.REPORT_USER_EMAIL;
  if (!email) return null;
  const [row] = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (row?.id as string) ?? null;
}

const EVENT_EMOJI: Record<string, string> = {
  "ex-date": "⚠️",
  "pay-date": "💰",
  "meeting": "🏛️",
};

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const qs = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "REPORT_USER_ID 또는 REPORT_USER_EMAIL 필요" }, { status: 400 });
  }

  const calendar = await sql`
    SELECT date::text, stock, type, note
    FROM dividend_calendar
    WHERE user_id = ${userId}
    ORDER BY date ASC
  `;

  const now = new Date();
  const upcoming: { text: string; diffDays: number }[] = [];

  for (const ev of calendar) {
    const evDate = new Date(`${ev.date}T00:00:00+09:00`);
    const diffDays = Math.ceil((evDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) {
      const emoji = EVENT_EMOJI[ev.type as string] ?? "📋";
      const dday = diffDays === 0 ? "오늘!" : diffDays === 1 ? "내일" : `${diffDays}일 후`;
      upcoming.push({
        text: `${emoji} [${dday}] ${ev.stock}\n   ${ev.note} (${ev.date})`,
        diffDays,
      });
    }
  }

  if (upcoming.length === 0) {
    return NextResponse.json({ success: true, skipped: true, reason: "no upcoming events" });
  }

  upcoming.sort((a, b) => a.diffDays - b.diffDays);

  const todayStr = now.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  let msg = `📅 이번 주 배당 일정\n${todayStr}\n━━━━━━━━━━━━━━━━\n\n`;
  for (const u of upcoming) msg += `${u.text}\n\n`;
  msg += "💡 배당락일 전일까지 매수해야 배당 수령!";

  await sendTelegramMessage(msg);
  return NextResponse.json({ success: true, eventCount: upcoming.length });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
