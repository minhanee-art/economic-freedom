import { createClient } from "@/lib/supabase/server";
import { PnLClient } from "./pnl-client";
import type { Holding, CostBasis, PurchaseRecord } from "@/types";

export default async function PnLPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [holdingsRes, costBasisRes, recordsRes, dividendsRes] =
    await Promise.all([
      supabase
        .from("holdings")
        .select("*")
        .eq("user_id", user.id)
        .order("target_pct", { ascending: false }),
      supabase.from("cost_basis").select("*").eq("user_id", user.id),
      supabase
        .from("purchase_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
      supabase.from("dividends").select("amount").eq("user_id", user.id),
    ]);

  const totalDividend = (dividendsRes.data ?? []).reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  );

  return (
    <PnLClient
      holdings={holdingsRes.data ?? []}
      costBases={costBasisRes.data ?? []}
      purchaseRecords={recordsRes.data ?? []}
      totalDividend={totalDividend}
    />
  );
}
