import { createClient } from "@/lib/supabase/server";
import { BuyClient } from "./buy-client";
import type { Holding, CostBasis } from "@/types";

export default async function BuyPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [holdingsRes, costBasisRes, profileRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("target_pct", { ascending: false }),
    supabase.from("cost_basis").select("*").eq("user_id", user.id),
    supabase.from("profiles").select("monthly_budget").eq("id", user.id).single(),
  ]);

  return (
    <BuyClient
      initialHoldings={holdingsRes.data ?? []}
      initialCostBases={costBasisRes.data ?? []}
      defaultBudget={profileRes.data?.monthly_budget ?? 300000}
      userId={user.id}
    />
  );
}
