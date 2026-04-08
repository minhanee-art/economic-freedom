import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { PnLClient } from "./pnl-client";

export default async function PnLPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const [holdingsRes, costBasisRes, recordsRes, dividendsRes] =
    await Promise.all([
      supabase
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .order("target_pct", { ascending: false }),
      supabase.from("cost_basis").select("*").eq("user_id", userId),
      supabase
        .from("purchase_records")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: true }),
      supabase.from("dividends").select("amount").eq("user_id", userId),
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
