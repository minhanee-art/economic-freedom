import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { BuyClient } from "./buy-client";

export default async function BuyPlanPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const [holdingsRes, costBasisRes, profileRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .order("target_pct", { ascending: false }),
    supabase.from("cost_basis").select("*").eq("user_id", userId),
    supabase.from("profiles").select("monthly_budget").eq("id", userId).single(),
  ]);

  return (
    <BuyClient
      initialHoldings={holdingsRes.data ?? []}
      initialCostBases={costBasisRes.data ?? []}
      defaultBudget={profileRes.data?.monthly_budget ?? 300000}
      userId={userId}
    />
  );
}
