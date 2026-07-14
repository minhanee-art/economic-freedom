// 자녀 계좌 관리 서버 컴포넌트
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getChildren, getChildGifts } from "@/lib/queries";
import { ChildrenClient } from "./children-client";

export default async function ChildrenPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [children, gifts] = await Promise.all([
    getChildren(userId),
    getChildGifts(userId),
  ]);

  return <ChildrenClient initialChildren={children} gifts={gifts} />;
}
