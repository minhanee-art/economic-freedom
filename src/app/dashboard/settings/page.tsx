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
    // 계정 탭의 '로그인 방식'(Google / 이메일·비밀번호)을 보여 주기 위해서만 읽는다
    sql`SELECT (google_id IS NOT NULL) AS has_google, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = ${userId}`.catch(() => []),
  ]);
  const login = (loginRows as { has_google?: boolean; has_password?: boolean }[])[0];

  return (
    <SettingsClient
      profile={profile}
      holdings={holdings}
      watchlist={watchlist}
      dividendCalendar={dividendCalendar}
      userId={userId}
      hasGoogle={Boolean(login?.has_google)}
      hasPassword={login ? Boolean(login.has_password) : true}
    />
  );
}
