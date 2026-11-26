import type { AuthSession } from "@/types";
import { apiRequest } from "./client";

type AuthResponse = { ok: boolean; token: string; user: AuthSession["user"] };

function toSession(body: AuthResponse): AuthSession {
  return { token: body.token, user: body.user };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthSession> {
  const body = await apiRequest<AuthResponse>("/api/mobile/auth/login", {
    method: "POST",
    body: { email, password },
    fallbackError: "로그인하지 못했습니다.",
  });
  return toSession(body);
}

export async function signupWithEmail(email: string, password: string): Promise<AuthSession> {
  const body = await apiRequest<AuthResponse>("/api/mobile/auth/signup", {
    method: "POST",
    body: { email, password },
    fallbackError: "회원가입하지 못했습니다.",
  });
  return toSession(body);
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  await apiRequest<unknown>("/api/me", {
    method: "DELETE",
    token,
    body: { password },
    fallbackError: "계정을 삭제하지 못했습니다.",
  });
}
