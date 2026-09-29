import type { AuthSession } from "@/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

export async function loginWithEmail(email: string, password: string): Promise<AuthSession> {
  if (!API_BASE_URL) {
    throw new Error("앱 설정에 API 주소가 없습니다. EXPO_PUBLIC_API_BASE_URL을 설정해주세요.");
  }

  const response = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "로그인 실패");
  }

  return { token: body.token, user: body.user } as AuthSession;
}
