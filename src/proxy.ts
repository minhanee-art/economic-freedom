// 보호 경로(대시보드 + 외부 프록시 API) JWT 세션 검증 — Next 16 proxy 컨벤션
// 쿠키(웹)와 Authorization: Bearer(모바일 앱) 둘 다 받는다. 라우트 핸들러와 같은 getRequestSession을 쓴다.
import { type NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const session = await getRequestSession(request);
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
