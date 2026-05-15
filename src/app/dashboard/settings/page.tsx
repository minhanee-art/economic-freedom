// 설정 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile, getHoldings } from "@/lib/queries";
import { SettingsClient } from "./settings-client";
import type { Holding } from "@/types";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [profile, holdings] = await Promise.all([
    getProfile(userId),
    getHoldings(userId),
  ]);

  return (
    <SettingsClient
      profile={profile as any}
      holdings={holdings as unknown as Holding[]}
      userId={userId}
    />
  );
}
