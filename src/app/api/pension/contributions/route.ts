// 계좌별 연간 납입 기록 API
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { deleteContribution, getContributions, upsertContribution } from "@/lib/pension-data";
import { parseContributionBody, parseYear } from "@/lib/pension-validation";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const yearParam = new URL(request.url).searchParams.get("year");
  const year = yearParam === null ? new Date().getFullYear() : parseYear(yearParam);
  if (year === null) return NextResponse.json({ error: "연도가 올바르지 않습니다." }, { status: 400 });
  return NextResponse.json({ year, contributions: await getContributions(session.userId, year) });
}

/** 계좌·연도별 납입액 저장 (있으면 덮어씀) */
export async function PUT(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const parsed = parseContributionBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { accountId, year, amount, memo } = parsed.value;
  const row = await upsertContribution(session.userId, accountId, year, amount, memo);
  if (!row) return NextResponse.json({ error: "계좌를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ contribution: row });
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const year = parseYear(body?.year);
  if (!accountId || year === null) {
    return NextResponse.json({ error: "계좌와 연도가 필요합니다." }, { status: 400 });
  }
  const deleted = await deleteContribution(session.userId, accountId, year);
  if (!deleted) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
