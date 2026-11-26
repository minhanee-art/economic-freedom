// 은퇴 목표 API (profiles에 저장) — 보낸 항목만 바꾼다
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { getRetirementGoal, saveRetirementGoal, type RetirementGoalRow } from "@/lib/pension-data";
import { parseRetirementGoalBody } from "@/lib/pension-validation";

const EMPTY_GOAL: RetirementGoalRow = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: null,
};

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  return NextResponse.json({ goal: (await getRetirementGoal(session.userId)) ?? EMPTY_GOAL });
}

export async function PATCH(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const parsed = parseRetirementGoalBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const current = (await getRetirementGoal(session.userId)) ?? EMPTY_GOAL;
  const next: RetirementGoalRow = { ...current, ...parsed.value };
  const saved = await saveRetirementGoal(session.userId, next);
  if (!saved) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ goal: next });
}
