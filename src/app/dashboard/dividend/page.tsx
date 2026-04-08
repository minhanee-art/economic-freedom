import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { DividendClient } from "./dividend-client";

export default async function DividendPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const [holdingsRes, dividendsRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("id, code, name, category")
      .eq("user_id", userId)
      .gt("shares", 0)
      .order("name"),
    supabase
      .from("dividends")
      .select("*, holdings(name, code)")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
  ]);

  return (
    <DividendClient
      holdings={holdingsRes.data ?? []}
      initialDividends={dividendsRes.data ?? []}
      userId={userId}
    />
  );
}
