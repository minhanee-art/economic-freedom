import { getUserId } from "@/lib/supabase/auth";
import { MarketClient } from "./market-client";

export default async function MarketPage() {
  const userId = await getUserId();
  if (!userId) return null;

  return <MarketClient />;
}
