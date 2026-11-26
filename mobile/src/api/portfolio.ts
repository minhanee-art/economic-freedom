import { apiGet } from "./client";
import type { PortfolioSummary } from "@/types";

/**
 * 계좌를 지정하면 X-Portfolio-Account-Id 헤더와 ?accountId= 쿼리에 같은 값을 함께 보낸다.
 * (헤더는 PR #26 이후 서버에서, 쿼리는 현재 main 서버에서 읽는다. 둘이 다르면 서버가 400을 돌려주므로 항상 같은 값을 쓴다.)
 */
export function getMobilePortfolioSummary(token: string, accountId?: string): Promise<PortfolioSummary> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return apiGet<PortfolioSummary>(`/api/mobile/portfolio-summary${query}`, token, accountId);
}
