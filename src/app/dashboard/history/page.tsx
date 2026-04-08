import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { HistoryClient } from "./history-client";

export default async function HistoryPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const { data, count } = await supabase
    .from("purchase_records")
    .select("*, purchase_items(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(0, 19);

  return (
    <HistoryClient
      initialRecords={data ?? []}
      totalCount={count ?? 0}
      userId={userId}
    />
  );
}
