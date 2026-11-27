// 은퇴 목표 API (profiles에 저장) — 보낸 항목만 바꾼다
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { getRetirementGoal, patchRetirementGoal, type RetirementGoalRow } from "@/lib/pension-data";
import { parseRetirementGoalBody } from "@/lib/pension-validation";

const EMPTY_GOAL: RetirementGoalRow = {
  targetMonthly: null,
  retirementAge: null,
  birthYear: null,
  spouseBirthYear: null,
  expectedReturnPct: null,
  salaryBracket: null,
  spouseSalaryBracket: null,
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

  // 보낸 항목만 한 UPDATE로 바꾼다 — 읽고 병합해 전체를 쓰면 동시에 다른 항목을 고친 요청을 옛 값으로 되돌린다
  const saved = await patchRetirementGoal(session.userId, parsed.value);
  if (!saved) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ goal: saved });
}
