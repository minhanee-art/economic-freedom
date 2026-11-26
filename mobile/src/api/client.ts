const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

const CONNECTION_ERROR = "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 웹 서비스의 절대 주소. 주소가 설정되지 않았으면 null. */
export function webUrl(path: string): string | null {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  token?: string;
  /** 계좌 범위 API에서 사용할 계좌 id — X-Portfolio-Account-Id 헤더로 보낸다. */
  accountId?: string;
  body?: unknown;
  fallbackError?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, accountId, body, fallbackError = "요청을 처리하지 못했습니다." } = options;
  if (!API_BASE_URL) {
    throw new ApiError(CONNECTION_ERROR, 0);
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (accountId) headers["X-Portfolio-Account-Id"] = accountId;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(CONNECTION_ERROR, 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(typeof data?.error === "string" ? data.error : fallbackError, response.status);
  }

  return data as T;
}

export function apiGet<T>(path: string, token?: string, accountId?: string): Promise<T> {
  return apiRequest<T>(path, { token, accountId, fallbackError: "데이터를 불러오지 못했습니다." });
}
