import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { CompareClient } from "./compare-client";

export default async function ComparePage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", userId)
    .order("target_pct", { ascending: false });

  return <CompareClient holdings={data ?? []} />;
}
