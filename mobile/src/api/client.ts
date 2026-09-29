const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "API 요청 실패");
  }

  return body as T;
}
