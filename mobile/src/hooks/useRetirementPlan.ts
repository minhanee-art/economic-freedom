import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getRetirementPlan } from "@/api/pension";
import { clearSession, loadSession } from "@/storage/session";
import type { RetirementPlan } from "@/types";

export function useRetirementPlan() {
  const [plan, setPlan] = useState<RetirementPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session) {
        setPlan(null);
        router.replace("/login");
        return;
      }
      setPlan(await getRetirementPlan(session.token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        setPlan(null);
        router.replace("/login");
        return;
      }
      setPlan(null);
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plan, isLoading, error, refresh };
}
