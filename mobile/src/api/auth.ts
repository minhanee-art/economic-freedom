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

export async function getPasswordStatus(token: string): Promise<boolean> {
  const body = await apiRequest<{ hasPassword?: boolean }>("/api/auth/password", {
    token,
    fallbackError: "비밀번호 상태를 불러오지 못했습니다.",
  });
  return Boolean(body.hasPassword);
}

/**
 * 비밀번호 설정·변경. PR #26 이후 서버는 다른 기기의 토큰을 폐기하고 이 요청용 새 토큰을 `token`으로 준다.
 * 현재 main 서버는 토큰 없이 { ok, hasPassword }만 주므로, 새 토큰이 없으면 null을 돌려준다(기존 토큰을 계속 쓴다).
 */
export async function changePassword(
  token: string,
  currentPassword: string | null,
  newPassword: string
): Promise<{ newToken: string | null }> {
  const body = await apiRequest<{ token?: unknown }>("/api/auth/password", {
    method: "POST",
    token,
    body: currentPassword === null ? { newPassword } : { currentPassword, newPassword },
    fallbackError: "비밀번호를 변경하지 못했습니다.",
  });
  return { newToken: typeof body.token === "string" && body.token ? body.token : null };
}
