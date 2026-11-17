import test, { before } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "test-only-secret-for-pension-manager";

let proxy: typeof import("@/proxy").proxy;
let signToken: typeof import("@/lib/session").signToken;
let NextRequest: typeof import("next/server").NextRequest;

before(async () => {
  const [proxyModule, sessionModule, server] = await Promise.all([
    import("@/proxy"),
    import("@/lib/session"),
    import("next/server"),
  ]);
  proxy = proxyModule.proxy;
  signToken = sessionModule.signToken;
  NextRequest = server.NextRequest;
});

function request(path: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new NextRequest(new URL(path, "https://pension.test"), { headers });
}

test("세션이 없으면 프록시 대상 API는 401 JSON을 돌려준다", async () => {
  for (const path of ["/api/prices", "/api/market/search", "/api/market/indices"]) {
    const response = await proxy(request(path) as never);
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
});

test("세션이 없으면 대시보드 페이지는 로그인으로 보낸다", async () => {
  const response = await proxy(request("/dashboard/holdings") as never);
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.pathname, "/login");
});

test("유효한 세션 쿠키가 있으면 통과시킨다", async () => {
  const token = await signToken("user-1");
  const response = await proxy(request("/api/prices", `pension-session=${token}`) as never);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("변조된 세션 쿠키는 통과시키지 않는다", async () => {
  const token = await signToken("user-1");
  const response = await proxy(request("/api/prices", `pension-session=${token}x`) as never);
  assert.equal(response.status, 401);
});

test("프록시 대상 경로가 의도한 목록과 일치한다", async () => {
  const { config } = await import("@/proxy");
  assert.deepEqual(config.matcher, ["/dashboard/:path*", "/api/market/:path*", "/api/prices"]);
});
