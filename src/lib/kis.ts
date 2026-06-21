// KIS (한국투자증권) Open API 헬퍼
const KIS_BASE = "https://openapi.koreainvestment.com:9443";

// 토큰은 약 24시간 유효하고 발급은 분당 1회로 제한된다(EGW00133).
// 매 호출 재발급을 막기 위해 워밍된 인스턴스 메모리에 캐시한다.
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getKisToken(appkey: string, appsecret: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.token;

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
  });
  if (!res.ok) {
    // 발급 실패(예: rate-limit) 시 아직 유효한 캐시가 있으면 재사용
    if (tokenCache && tokenCache.expiresAt > now) return tokenCache.token;
    throw new Error(`KIS 토큰 발급 실패: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const ttlMs = (data.expires_in ?? 86400) * 1000;
  tokenCache = { token: data.access_token, expiresAt: now + ttlMs - 60_000 };
  return tokenCache.token;
}

export async function getKisPrice(
  code: string,
  token: string,
  appkey: string,
  appsecret: string
): Promise<{ price: number; changeRate: number; volume: number } | null> {
  const url = new URL(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", code);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey,
      appsecret,
      tr_id: "FHKST01010100",
      custtype: "P",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json() as { output?: Record<string, string> };
  const o = data.output;
  if (!o) return null;
  return {
    price: parseInt(o.stck_prpr ?? "0"),
    changeRate: parseFloat(o.prdy_ctrt ?? "0"),
    volume: parseInt(o.acml_vol ?? "0"),
  };
}
