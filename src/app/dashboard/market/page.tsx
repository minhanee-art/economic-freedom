// 시장 정보 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { MarketClient } from "./market-client";

export const metadata: Metadata = { title: "시장 현황 · 가족연금계획" };

export default async function MarketPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <MarketClient />;
}
