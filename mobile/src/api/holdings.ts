import { apiRequest } from "./client";

/** 종목코드 규칙 — 서버(POST·PATCH /api/holdings)와 같다. */
export const HOLDING_CODE_PATTERN = /^[0-9A-Za-z]{1,12}$/;
export const HOLDING_NAME_MAX = 100;

export type HoldingInput = { name: string; code: string };

/** 입력을 다듬고 검증한다. 문제가 있으면 사용자에게 보일 문구를, 없으면 다듬은 값을 돌려준다. */
export function normalizeHoldingInput(input: HoldingInput): { ok: true; value: HoldingInput } | { ok: false; error: string } {
  const name = input.name.trim();
  const code = input.code.replace(/\s+/g, "");
  if (!name) return { ok: false, error: "종목명을 입력해주세요." };
  if (name.length > HOLDING_NAME_MAX) return { ok: false, error: `종목명은 ${HOLDING_NAME_MAX}자 이하로 입력해주세요.` };
  if (!code) return { ok: false, error: "종목코드를 입력해주세요." };
  if (!HOLDING_CODE_PATTERN.test(code)) return { ok: false, error: "종목코드는 숫자와 영문 12자 이하로 입력해주세요." };
  return { ok: true, value: { name, code } };
}

/**
 * 현재 계좌에 종목을 0주로 추가한다(POST /api/holdings, Bearer). 분류는 서버가 종목명으로 추론한다.
 * 계좌는 헤더와 ?accountId= 쿼리에 같은 값으로 함께 보낸다(api/records.ts 와 같은 이유).
 */
export async function createHolding(token: string, accountId: string, input: HoldingInput): Promise<{ id: string }> {
  const data = await apiRequest<{ id?: string; holding?: { id?: string } }>(
    `/api/holdings?accountId=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      token,
      accountId,
      fallbackError: "종목을 추가하지 못했습니다.",
      body: { code: input.code, name: input.name },
    }
  );
  return { id: String(data.holding?.id ?? data.id ?? "") };
}
