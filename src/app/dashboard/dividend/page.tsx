import { createClient } from "@/lib/supabase/server";
import { DividendClient } from "./dividend-client";

export default async function DividendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [holdingsRes, dividendsRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("id, code, name, category")
      .eq("user_id", user.id)
      .gt("shares", 0)
      .order("name"),
    supabase
      .from("dividends")
      .select("*, holdings(name, code)")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
  ]);

  return (
    <DividendClient
      holdings={holdingsRes.data ?? []}
      initialDividends={dividendsRes.data ?? []}
      userId={user.id}
    />
  );
}
