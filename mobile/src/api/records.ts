import type { DividendRecord, PurchaseRecord } from "@/types";
import { ApiError, apiRequest } from "./client";

/**
 * 거래 기록 API. 계좌를 헤더(X-Portfolio-Account-Id)와 ?accountId= 쿼리에 같은 값으로 함께 보낸다.
 * 서버가 계좌 지정을 읽지 못하면 기록이 첫 계좌에 쌓일 수 있으므로, 쓰기에서도 두 경로를 모두 쓴다.
 * (둘이 다르면 서버가 400을 돌려주고, 소유하지 않은 계좌면 404를 돌려준다.)
 */
function scoped(path: string, accountId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}accountId=${encodeURIComponent(accountId)}`;
}

type PurchaseRow = {
  id: string;
  date: string;
  total_spent: number | string;
  purchase_items: Array<{
    code: string;
    name: string;
    quantity: number | string;
    price_at_purchase: number | string;
    cost: number | string;
  }> | null;
};

type DividendRow = {
  id: string;
  holding_id: string;
  holding_name: string | null;
  holding_code: string | null;
  amount: number | string;
  date: string;
  memo: string | null;
};

export type PurchaseInput = {
  date: string;
  holdingId: string;
  code: string;
  name: string;
  quantity: number;
  price: number;
};

export async function createPurchase(token: string, accountId: string, input: PurchaseInput): Promise<void> {
  await apiRequest(scoped("/api/purchases", accountId), {
    method: "POST",
    token,
    accountId,
    fallbackError: "매수 기록을 저장하지 못했습니다.",
    body: {
      date: input.date,
      items: [
        {
          holdingId: input.holdingId,
          code: input.code,
          name: input.name,
          quantity: input.quantity,
          price: input.price,
          cost: input.quantity * input.price,
        },
      ],
    },
  });
}

export async function listPurchases(token: string, accountId: string, limit = 10): Promise<PurchaseRecord[]> {
  const data = await apiRequest<{ records?: PurchaseRow[] }>(scoped(`/api/purchases?limit=${limit}`, accountId), {
    token,
    accountId,
    fallbackError: "매수 기록을 불러오지 못했습니다.",
  });
  return (data.records ?? []).map((row) => ({
    id: row.id,
    date: String(row.date).slice(0, 10),
    totalSpent: Number(row.total_spent),
    items: (row.purchase_items ?? []).map((item) => ({
      code: item.code,
      name: item.name,
      quantity: Number(item.quantity),
      price: Number(item.price_at_purchase),
      cost: Number(item.cost),
    })),
  }));
}

export type DividendInput = { holdingId: string; amount: number; date: string; memo?: string };

export async function createDividend(token: string, accountId: string, input: DividendInput): Promise<void> {
  await apiRequest(scoped("/api/dividends", accountId), {
    method: "POST",
    token,
    accountId,
    fallbackError: "배당 수령 기록을 저장하지 못했습니다.",
    body: { holdingId: input.holdingId, amount: input.amount, date: input.date, memo: input.memo || null },
  });
}

export async function listDividends(token: string, accountId: string): Promise<DividendRecord[]> {
  const rows = await apiRequest<DividendRow[]>(scoped("/api/dividends", accountId), {
    token,
    accountId,
    fallbackError: "배당 수령 기록을 불러오지 못했습니다.",
  });
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    holdingId: row.holding_id,
    holdingName: row.holding_name,
    holdingCode: row.holding_code,
    amount: Number(row.amount),
    date: String(row.date).slice(0, 10),
    memo: row.memo,
  }));
}

export async function deleteDividend(token: string, accountId: string, id: string): Promise<void> {
  await apiRequest(scoped("/api/dividends", accountId), {
    method: "DELETE",
    token,
    accountId,
    fallbackError: "배당 수령 기록을 삭제하지 못했습니다.",
    body: { id },
  });
}

/** 삭제하려는 매수 기록이 서버에 없음(404). 계좌 없음(404)과 구분하기 위한 별도 오류. */
export class PurchaseNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseNotFoundError";
  }
}

/** 정확히 되돌릴 수 없어 서버가 거절함(409). message는 서버 문구 그대로다. */
export class PurchaseDeleteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseDeleteConflictError";
  }
}

const PURCHASE_NOT_FOUND_MESSAGE = "매수 기록을 찾을 수 없습니다.";

export async function deletePurchase(token: string, accountId: string, id: string): Promise<void> {
  try {
    await apiRequest(scoped(`/api/purchases/${encodeURIComponent(id)}`, accountId), {
      method: "DELETE",
      token,
      accountId,
      fallbackError: "매수 기록을 삭제하지 못했습니다.",
    });
  } catch (err) {
    // 서버는 계좌 없음("계좌를 찾을 수 없습니다.")과 기록 없음 모두 404로 답한다. 문구로 구분한다.
    if (err instanceof ApiError && err.status === 404 && err.message === PURCHASE_NOT_FOUND_MESSAGE) {
      throw new PurchaseNotFoundError(err.message);
    }
    if (err instanceof ApiError && err.status === 409) {
      throw new PurchaseDeleteConflictError(err.message);
    }
    throw err;
  }
}
