// Cron 라우트 인증 — Vercel Cron이 보내는 `Authorization: Bearer <CRON_SECRET>` 헤더만 받는다.
// Vercel 문서(Cron Jobs > Securing cron jobs): CRON_SECRET 환경변수를 두면 Vercel이 호출할 때
// 그 값을 Bearer 접두어와 함께 Authorization 헤더로 보낸다. 쿼리 문자열(?secret=)은 받지 않는다
// — URL은 접근 로그·브라우저 기록·Referer에 남기 때문이다.
// 기본 거부: CRON_SECRET이 비어 있으면 어떤 요청도 통과시키지 않는다.
import { safeEqual } from "@/lib/telegram-bot-auth";

export function isCronAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  // Vercel이 보내는 값과 정확히 맞춰야 하므로 공백을 잘라내지 않는다. 공백뿐이면 미설정으로 본다.
  const secret = env.CRON_SECRET ?? "";
  if (!secret.trim()) return false;
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
