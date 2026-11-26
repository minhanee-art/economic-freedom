// 계좌 API 응답용 — 클라이언트가 쓰는 필드만 내린다 (user_id·telegram_chat_id 등 제외).
import type { PortfolioAccount } from "@/lib/portfolio-accounts";

export type PublicAccount = Pick<PortfolioAccount, "id" | "name" | "owner_type" | "account_type" | "display_order">;

export function toPublicAccount(account: PortfolioAccount): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    owner_type: account.owner_type,
    account_type: account.account_type,
    display_order: account.display_order,
  };
}
