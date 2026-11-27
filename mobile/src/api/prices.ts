import { apiRequest } from "./client";

/**
 * 시세 새로고침 — 웹 홈의 '시세 새로고침'(src/app/dashboard/dashboard-client.tsx handleRefresh)과 같은 순서로
 * 기존 API만 쓴다. 서버에 새 계산을 두지 않는다.
 *   1) POST /api/prices { codes }            → 종목코드별 현재가 조회(Bearer 허용, src/proxy.ts)
 *   2) PATCH /api/holdings { id, current_price } → 바뀐 종목만 현재가 저장(계좌 헤더·쿼리 함께)
 *   3) POST /api/settings/price-update       → 마지막 시세 갱신 시각 기록(웹 자동 새로고침 기준과 공유)
 *
 * 앱에서 종목명·코드만으로 추가한 종목은 현재가가 0이라, 첫 매수 기록 때 서버가 기록 단가를 현재가로 채운다
 * (src/app/api/purchases/route.ts). 이 새로고침이 그 임시값을 실제 시세로 바꾼다.
 */
export type PriceTarget = { id: string; code: string; currentPrice?: number };
export type PriceRefreshResult = { updated: number; unchanged: number; failed: string[]; prices: Record<string, number> };

const MAX_CODES = 30; // /api/prices 가 한 번에 받는 최대 개수

export async function refreshHoldingPrices(token: string, accountId: string, targets: PriceTarget[]): Promise<PriceRefreshResult> {
  const codes = [...new Set(targets.map((t) => t.code))].slice(0, MAX_CODES);
  if (codes.length === 0) return { updated: 0, unchanged: 0, failed: [], prices: {} };
  const { prices } = await apiRequest<{ prices?: Record<string, number>; errors?: string[] }>("/api/prices", {
    method: "POST",
    token,
    body: { codes },
    fallbackError: "시세를 불러오지 못했습니다.",
  });
  const found = prices ?? {};
  const failed = codes.filter((code) => !(found[code] > 0));
  const changed = targets.filter((t) => found[t.code] > 0 && found[t.code] !== t.currentPrice);
  await Promise.all(
    changed.map((t) =>
      apiRequest(`/api/holdings?accountId=${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        token,
        accountId,
        body: { id: t.id, current_price: found[t.code] },
        fallbackError: "현재가를 저장하지 못했습니다.",
      })
    )
  );
  if (codes.length > failed.length) {
    // 갱신 시각 기록은 실패해도 결과에 영향이 없다.
    await apiRequest("/api/settings/price-update", { method: "POST", token }).catch(() => undefined);
  }
  return { updated: changed.length, unchanged: codes.length - failed.length - changed.length, failed, prices: found };
}

/** 한 종목의 현재가만 조회해 저장한다. 조회·저장하지 못하면 null(오류를 던지지 않는다 — 종목 추가 직후의 보조 동작). */
export async function fetchAndSavePrice(token: string, accountId: string, target: PriceTarget): Promise<number | null> {
  try {
    const result = await refreshHoldingPrices(token, accountId, [target]);
    return result.prices[target.code] > 0 ? result.prices[target.code] : null;
  } catch {
    return null;
  }
}
