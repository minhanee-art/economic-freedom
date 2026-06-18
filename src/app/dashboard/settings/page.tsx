// 설정 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile, getHoldings, getWatchlist, getDividendCalendar } from "@/lib/queries";
import { SettingsClient } from "./settings-client";
import type { Holding } from "@/types";

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
      profile={profile as any}
      holdings={holdings as unknown as Holding[]}
      watchlist={watchlist as unknown as { id: string; name: string; code: string | null; market: "KR" | "US" }[]}
      dividendCalendar={dividendCalendar as unknown as { id: string; date: string; stock: string; type: string; note: string }[]}
      userId={userId}
    />
  );
}
