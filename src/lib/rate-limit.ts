// 인증 엔드포인트 무차별 대입(brute-force) 방어 레이트리밋.
// UPSTASH_REDIS_REST_URL/TOKEN이 설정되면 분산 슬라이딩 윈도우(여러 인스턴스 공유),
// 미설정 시 인스턴스 메모리 폴백(콜드스타트/인스턴스마다 리셋 — 베이스라인 방어).
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_ATTEMPTS = 10;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const upstash =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, "10 m"),
        prefix: "rl:auth",
        analytics: false,
      })
    : null;

// ── 인메모리 폴백 ──────────────────────────────
const memory = new Map<string, number[]>();
function memoryAllow(id: string): boolean {
  const now = Date.now();
  const hits = (memory.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_ATTEMPTS) {
    memory.set(id, hits);
    return false;
  }
  hits.push(now);
  memory.set(id, hits);
  // 메모리 누수 방지 — 키가 많아지면 만료된 항목 정리
  if (memory.size > 5000) {
    for (const [k, v] of memory) {
      if (v.every((t) => now - t >= WINDOW_MS)) memory.delete(k);
    }
  }
  return true;
}

/** identifier(예: `login:${ip}:${email}`)가 허용 한도 내인지. true=허용, false=초과. */
export async function authRateLimit(identifier: string): Promise<boolean> {
  if (upstash) {
    const { success } = await upstash.limit(identifier);
    return success;
  }
  return memoryAllow(identifier);
}

/** 요청에서 클라이언트 IP 추출 (Vercel은 x-forwarded-for 사용). */
export function clientIp(request: Request): string {
  // Vercel은 x-vercel-forwarded-for를 플랫폼이 직접 설정(클라이언트 위조 불가) → 우선 신뢰
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
