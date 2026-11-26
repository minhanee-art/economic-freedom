// 보호 경로(대시보드 + 외부 프록시 API) JWT 세션 검증 — Next 16 proxy 컨벤션
// 쿠키(웹)와 Authorization: Bearer(모바일 앱) 둘 다 받는다.
//
// - 페이지(/dashboard): 서명·만료만 보는 낙관적 검사. Proxy는 prefetch마다 실행되므로 DB를 조회하지 않는다.
//   폐기된 토큰(비밀번호 변경·계정 삭제 등)은 각 페이지의 getSession이 DB와 대조해 /login으로 보낸다.
// - API(/api/market/*, /api/prices): 핸들러가 자체 인증을 하지 않으므로 여기서 폐기 여부까지 확인한다.
import { type NextRequest, NextResponse } from "next/server";
import { getOptimisticRequestSession, getRequestSession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const session = isApi ? await getRequestSession(request) : await getOptimisticRequestSession(request);
  if (!session) {
    // API 라우트는 401 JSON, 페이지는 로그인으로 리다이렉트
    if (isApi) {
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
