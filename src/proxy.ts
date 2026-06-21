// 보호 경로(대시보드 + 외부 프록시 API) JWT 세션 검증 — Next 16 proxy 컨벤션
import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    // API 라우트는 401 JSON, 페이지는 로그인으로 리다이렉트
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/market/:path*", "/api/prices"],
};
