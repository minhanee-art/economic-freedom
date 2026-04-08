import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";
import type { Holding, CostBasis, Profile, Dividend } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [holdingsRes, costBasisRes, profileRes, dividendsRes] =
    await Promise.all([
      supabase
        .from("holdings")
        .select("*")
        .eq("user_id", user.id)
        .order("target_pct", { ascending: false }),
      supabase.from("cost_basis").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("dividends").select("amount").eq("user_id", user.id),
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
