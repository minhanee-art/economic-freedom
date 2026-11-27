// 시장 정보 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings } from "@/lib/queries";
import { MarketClient } from "./market-client";

export const metadata: Metadata = { title: "시장 현황 · 가족연금계획" };

export default async function MarketPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // 시장 현황은 주요 지수와 '내 보유 종목 시세'만 보여 준다(순위 목록 없음)
  const holdings = await getHoldings(session.userId).catch(() => []);
  return (
    <MarketClient
      holdings={holdings.map((h) => ({ id: h.id, code: h.code, name: h.name, shares: h.shares, currentPrice: Number(h.current_price) }))}
    />
  );
}
