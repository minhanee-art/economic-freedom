// 포트폴리오 비교 서버 컴포넌트
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHoldings } from "@/lib/queries";
import { CompareClient } from "./compare-client";
import type { Holding } from "@/types";

export const metadata: Metadata = { title: "ETF 비교 · 가족연금계획" };

export default async function ComparePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const holdings = await getHoldings(userId);

  return <CompareClient holdings={holdings as unknown as Holding[]} />;
}
