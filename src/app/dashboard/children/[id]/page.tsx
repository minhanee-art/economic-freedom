// 자녀 상세 서버 컴포넌트 — 증여 기록 + 보유 종목 + 신고 가이드
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getChild, getChildGifts, getChildHoldings } from "@/lib/queries";
import { ChildDetailClient } from "./child-detail-client";

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const userId = session.userId;

  const child = await getChild(userId, id);
  if (!child) notFound();

  const [gifts, holdings] = await Promise.all([
    getChildGifts(userId, id),
    getChildHoldings(userId, id),
  ]);

  return <ChildDetailClient child={child} initialGifts={gifts} initialHoldings={holdings} />;
}
