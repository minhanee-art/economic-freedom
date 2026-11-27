// 테스트 전용 CORS 프록시: Expo web(브라우저)에서 Next API 로 가는 교차 출처 요청을 허용한다.
// 네이티브 앱의 fetch 는 CORS 를 적용하지 않으므로 이 프록시는 웹 타깃 스모크 테스트에서만 필요하다.
// 서버(src/)의 동작은 바꾸지 않고 응답에 Access-Control-* 헤더만 덧붙인다.
//   node cors-proxy.mjs <listenPort> <targetOrigin> <allowedOrigin>
import http from "node:http";

const [listenPort, target, allowedOrigin] = process.argv.slice(2);
if (!listenPort || !target || !allowedOrigin) {
  console.error("usage: node cors-proxy.mjs <listenPort> <targetOrigin> <allowedOrigin>");
  process.exit(2);
}
const targetUrl = new URL(target);

const corsHeaders = {
  "access-control-allow-origin": allowedOrigin,
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, X-Portfolio-Account-Id",
  "access-control-max-age": "600",
  vary: "Origin",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }
    const upstream = http.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: targetUrl.host },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 502, { ...upRes.headers, ...corsHeaders });
        upRes.pipe(res);
      }
    );
    upstream.on("error", (error) => {
      res.writeHead(502, { "content-type": "application/json", ...corsHeaders });
      res.end(JSON.stringify({ error: `proxy: ${error.message}` }));
    });
    req.pipe(upstream);
  })
  .listen(Number(listenPort), "127.0.0.1", () => {
    console.log(`[cors-proxy] 127.0.0.1:${listenPort} → ${target} (allow ${allowedOrigin})`);
  });
