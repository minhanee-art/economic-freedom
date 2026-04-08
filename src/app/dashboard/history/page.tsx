import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "./history-client";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, count } = await supabase
    .from("purchase_records")
    .select("*, purchase_items(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .range(0, 19);

  return (
    <HistoryClient
      initialRecords={data ?? []}
      totalCount={count ?? 0}
      userId={user.id}
    />
  );
}
