import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, holdingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("target_pct", { ascending: false }),
  ]);

  return (
    <SettingsClient
      profile={profileRes.data}
      holdings={holdingsRes.data ?? []}
      userId={user.id}
    />
  );
}
