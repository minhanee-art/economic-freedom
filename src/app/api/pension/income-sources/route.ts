// 공적·퇴직연금·연금보험 수동 입력 API (국민연금공단·통합연금포털 조회값을 사용자가 옮겨 적는다)
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { createIncomeSource, getIncomeSources } from "@/lib/pension-data";
import { parseIncomeSourceBody } from "@/lib/pension-validation";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  return NextResponse.json({ sources: await getIncomeSources(session.userId) });
}

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const parsed = parseIncomeSourceBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const source = await createIncomeSource(session.userId, parsed.value);
  return NextResponse.json({ source }, { status: 201 });
}
