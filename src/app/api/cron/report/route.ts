// 텔레그램 리포트 디스패처 — 매일 09:00(KST) Vercel Cron이 호출 (vercel.json 참고)
//  · 매월 1일  → 월간 리포트
//  · 매주 월요일 → 주간 리포트(손익 상위 3종목)
//  · 매월 5일  → 투자 알림
// 수동 테스트: Authorization: Bearer <CRON_SECRET> 헤더 + ?type=monthly|weekly|reminder|all
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<도메인>/api/cron/report?type=all"
import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  resolveUserId,
  loadPortfolio,
  sendReport,
  dueReports,
  REPORT_TYPES,
  type ReportType,
} from "@/lib/reports";

// DB를 읽으므로 항상 동적 실행 (캐시 금지)
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "대상 유저 미지정 (REPORT_USER_ID 또는 REPORT_USER_EMAIL 설정 필요)" },
      { status: 400 }
    );
  }

  // 발송 대상 종류 결정 — ?type 지정 시 강제, 없으면 오늘 날짜(KST) 기준
  const typeParam = request.nextUrl.searchParams.get("type");
  let types: ReportType[];
  if (typeParam === "all") {
    types = REPORT_TYPES;
  } else if (typeParam) {
    if (!REPORT_TYPES.includes(typeParam as ReportType)) {
      return NextResponse.json(
        { error: `잘못된 type: ${typeParam} (monthly|weekly|reminder|all)` },
        { status: 400 }
      );
    }
    types = [typeParam as ReportType];
  } else {
    types = dueReports();
  }

  if (types.length === 0) {
    return NextResponse.json({ success: true, sent: [], note: "오늘 발송할 리포트 없음" });
  }

  const data = await loadPortfolio(userId);
  // 타입별로 격리 — 한 리포트 전송 실패가 나머지를 막지 않도록
  const sent: ReportType[] = [];
  const failed: { type: ReportType; error: string }[] = [];
  for (const t of types) {
    try {
      await sendReport(t, data);
      sent.push(t);
    } catch (err) {
      failed.push({ type: t, error: (err as Error).message });
    }
  }

  return NextResponse.json({ success: failed.length === 0, sentTo: userId, sent, failed });
}

// Vercel Cron은 GET으로 호출. 수동 트리거도 GET.
export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
