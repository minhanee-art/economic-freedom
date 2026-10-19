// Neon 서버리스 PostgreSQL 클라이언트
// 빌드 시점(모듈 평가)에는 연결 문자열이 없을 수 있으므로 지연 생성한다.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL 환경 변수가 없습니다. Vercel 프로젝트 환경 변수를 확인하세요."
      );
    }
    client = neon(connectionString);
  }
  return client;
}

export const sql = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const value = Reflect.get(getClient() as object, prop);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
