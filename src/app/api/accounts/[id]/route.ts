// 포트폴리오 계좌 수정 API — 이름·명의·세제 유형
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";
import { updatePortfolioAccount } from "@/lib/portfolio-accounts";
import { isAccountType, type AccountType } from "@/lib/account-types";

const OWNER_TYPES = ["self", "spouse", "child", "other"] as const;
type OwnerType = (typeof OWNER_TYPES)[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const changes: { name?: string; ownerType?: OwnerType; accountType?: AccountType } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "계좌 이름이 필요합니다." }, { status: 400 });
    }
    changes.name = body.name;
  }
  if (body.ownerType !== undefined) {
    if (!(OWNER_TYPES as readonly unknown[]).includes(body.ownerType)) {
      return NextResponse.json({ error: "명의 구분이 올바르지 않습니다." }, { status: 400 });
    }
    changes.ownerType = body.ownerType as OwnerType;
  }
  if (body.accountType !== undefined) {
    if (!isAccountType(body.accountType)) {
      return NextResponse.json({ error: "계좌 유형이 올바르지 않습니다." }, { status: 400 });
    }
    changes.accountType = body.accountType;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  try {
    const account = await updatePortfolioAccount(session.userId, id, changes);
    if (!account) return NextResponse.json({ error: "계좌를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ account });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
