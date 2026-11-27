import * as SecureStore from "./secure-store";
import type { AuthSession } from "@/types";
import { clearSelectedAccountId } from "./account";

const SESSION_KEY = "economic-freedom-session";

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await clearSession();
    return null;
  }
}

/**
 * 401을 받은 요청이 보낸 토큰(sentToken)이 지금 저장된 토큰과 같을 때만 세션을 지운다.
 * 비밀번호 변경 등으로 토큰이 이미 교체됐다면 늦게 도착한 이전 토큰의 401이므로 새 세션을 유지한다.
 * 반환값: 세션이 없거나 지웠으면 true(로그인 화면으로 보낼 것), 새 세션이 살아 있으면 false(무시할 것).
 */
export async function handleUnauthorized(sentToken: string): Promise<boolean> {
  const stored = await loadSession();
  if (stored && stored.token !== sentToken) return false;
  await clearSession();
  return true;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await clearSelectedAccountId();
}
