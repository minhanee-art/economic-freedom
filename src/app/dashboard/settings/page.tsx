// 설정 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { sql } from "@/lib/db";
import { getProfile, getHoldings, getWatchlist, getDividendCalendar } from "@/lib/queries";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "설정 · 가족연금계획" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [profile, holdings, watchlist, dividendCalendar, loginRows] = await Promise.all([
    getProfile(userId),
    getHoldings(userId),
    getWatchlist(userId),
    getDividendCalendar(userId),
    // 이메일 칸 설명을 계정 종류(Google 연결 / 이메일·비밀번호)에 맞게 쓰기 위해서만 읽는다
    sql`SELECT (google_id IS NOT NULL) AS has_google FROM users WHERE id = ${userId}`.catch(() => []),
  ]);
  const hasGoogle = Boolean((loginRows as { has_google?: boolean }[])[0]?.has_google);

  return (
    <SettingsClient
      profile={profile}
      holdings={holdings}
      watchlist={watchlist}
      dividendCalendar={dividendCalendar}
      userId={userId}
      hasGoogle={hasGoogle}
    />
  );
}
