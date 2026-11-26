import type { AccountSummary } from "@/types";
import { apiGet } from "./client";

type AccountRow = { id: string; name: string; owner_type: string; account_type?: string };

/** GET /api/accounts — 로그인 사용자의 계좌 목록. 서버가 정한 순서를 그대로 쓴다. */
export async function getAccounts(token: string): Promise<AccountSummary[]> {
  const body = await apiGet<{ accounts?: AccountRow[] }>("/api/accounts", token);
  return (body.accounts ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    ownerType: item.owner_type,
    accountType: item.account_type,
  }));
}
