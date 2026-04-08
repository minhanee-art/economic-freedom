import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { DashboardClient } from "./dashboard-client";
import type { Holding, CostBasis, Profile } from "@/types";

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const [holdingsRes, costBasisRes, profileRes, dividendsRes] =
    await Promise.all([
      supabase
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .order("target_pct", { ascending: false }),
      supabase.from("cost_basis").select("*").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("dividends").select("amount").eq("user_id", userId),
    ]);

  const holdings: Holding[] = holdingsRes.data ?? [];
  const costBases: CostBasis[] = costBasisRes.data ?? [];
  const profile: Profile | null = profileRes.data;
  const totalDividend =
    (dividendsRes.data ?? []).reduce(
      (sum: number, d: { amount: number }) => sum + d.amount,
      0
    );

  return (
    <DashboardClient
      initialHoldings={holdings}
      initialCostBases={costBases}
      monthlyBudget={profile?.monthly_budget ?? 300000}
      totalDividend={totalDividend}
      lastPriceUpdate={profile?.last_price_update ?? null}
    />
  );
}
