import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/supabase/auth";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const [profileRes, holdingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .order("target_pct", { ascending: false }),
  ]);

  return (
    <SettingsClient
      profile={profileRes.data}
      holdings={holdingsRes.data ?? []}
      userId={userId}
    />
  );
}
