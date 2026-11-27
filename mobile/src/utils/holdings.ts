import type { Holding } from "@/types";

/**
 * 보유 수량이 0(이하)인 종목 — 추가만 하고 아직 매수 기록이 없는 종목이나 전량 매도한 행 — 을 가른다.
 * 서버 응답은 그대로 두고 화면에서만 나눈다. 수량을 모르는 종목(shares 없음)은 보유 중으로 본다.
 */
export function isHeld(holding: Holding): boolean {
  return holding.shares == null || !(holding.shares <= 0);
}

/** 보유 중(수량 > 0)인 종목만. 홈의 '보유 종목 N개'처럼 0주를 빼고 세는 곳에 쓴다. */
export function heldHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter(isHeld);
}

/**
 * 기록 입력의 종목 선택 목록용 분류. 0주 종목도 매수(재매수)·배당 기록 대상이므로 빼지 않고 따로 모은다.
 * - held: 기본으로 보이는 보유 중 종목
 * - notHeld: 펼쳤을 때만 보이는 0주 종목
 * - startExpanded: 보유 중 종목이 하나도 없으면(신규 가입자 등) 처음부터 펼친다
 */
export function splitHoldingsForPicker(holdings: Holding[]): { held: Holding[]; notHeld: Holding[]; startExpanded: boolean } {
  const held: Holding[] = [];
  const notHeld: Holding[] = [];
  for (const holding of holdings) (isHeld(holding) ? held : notHeld).push(holding);
  return { held, notHeld, startExpanded: held.length === 0 };
}

/** 접힌 상태에서 보일 0주 종목: 이미 선택된 0주 종목은 접혀 있어도 남긴다. */
export function visibleNotHeld(notHeld: Holding[], expanded: boolean, selectedId: string | null): Holding[] {
  return expanded ? notHeld : notHeld.filter((holding) => holding.id === selectedId);
}
