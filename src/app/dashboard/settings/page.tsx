// 설정 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile, getHoldings, getWatchlist, getDividendCalendar } from "@/lib/queries";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [profile, holdings, watchlist, dividendCalendar] = await Promise.all([
    getProfile(userId),
    getHoldings(userId),
    getWatchlist(userId),
    getDividendCalendar(userId),
  ]);

  return (
    <SettingsClient
      profile={profile}
      holdings={holdings}
      watchlist={watchlist}
      dividendCalendar={dividendCalendar}
      userId={userId}
    />
  );
}
