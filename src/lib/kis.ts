// KIS (한국투자증권) Open API 헬퍼
const KIS_BASE = "https://openapi.koreainvestment.com:9443";

export async function getKisToken(appkey: string, appsecret: string): Promise<string> {
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey, appsecret }),
  });
  if (!res.ok) throw new Error(`KIS 토큰 발급 실패: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
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
