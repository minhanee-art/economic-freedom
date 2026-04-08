import { createClient } from "./server";

/** 서버 컴포넌트에서 user id를 빠르게 가져오기 (middleware에서 이미 인증 확인됨) */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
