import type { Holding } from "@/types";

/**
 * 보유 수량이 0(이하)인 종목 — 전량 매도 등으로 남은 행 — 을 뺀다.
 * 서버 응답은 그대로 두고 화면에서만 거른다. 수량을 모르는 종목(shares 없음)은 남긴다.
 */
export function isHeld(holding: Holding): boolean {
  return holding.shares == null || !(holding.shares <= 0);
}

export function heldHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter(isHeld);
}
