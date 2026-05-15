// 시장 정보 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { MarketClient } from "./market-client";

export default async function MarketPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <MarketClient />;
}
