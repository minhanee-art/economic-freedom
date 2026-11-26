// 연금 설계 요약 API (모바일용) — 웹 /dashboard/retirement 와 같은 계산 함수를 서버에서 실행한다.
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { getAccountSnapshots, getContributions, getIncomeSources, getRetirementGoal } from "@/lib/pension-data";
import { buildPensionSummary } from "@/lib/pension-summary";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  // 웹 화면과 같이 서버 시각의 올해를 기준으로 한다
  const year = new Date().getFullYear();
  const userId = session.userId;
  const [accounts, contributions, sources, goal] = await Promise.all([
    getAccountSnapshots(userId),
    getContributions(userId, year),
    getIncomeSources(userId),
    getRetirementGoal(userId),
  ]);

  return NextResponse.json(
    buildPensionSummary({ year, asOf: new Date().toISOString(), accounts, contributions, sources, goal }),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
