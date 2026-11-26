// 연금 수령 예상 항목 수정/삭제 API
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { deleteIncomeSource, updateIncomeSource } from "@/lib/pension-data";
import { parseIncomeSourceBody } from "@/lib/pension-validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;
  const parsed = parseIncomeSourceBody(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const source = await updateIncomeSource(session.userId, id, parsed.value);
  if (!source) return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ source });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteIncomeSource(session.userId, id);
  if (!deleted) return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
