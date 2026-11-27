import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getPensionSummary, getRetirementPlan } from "@/api/pension";
import { handleUnauthorized, loadSession } from "@/storage/session";
import type { PensionSummary, RetirementPlan } from "@/types";

export function useRetirementPlan() {
  const [plan, setPlan] = useState<RetirementPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 요약은 서버 배포 전(404)이거나 실패해도 기존 화면을 막지 않는다. 실패 여부만 따로 알린다.
  const [summary, setSummary] = useState<PensionSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    let sentToken: string | null = null;
    try {
      const session = await loadSession();
      sentToken = session?.token ?? null;
      if (!session) {
        setPlan(null);
        setSummary(null);
        router.replace("/login");
        return;
      }
      const [nextPlan, nextSummary] = await Promise.all([
        getRetirementPlan(session.token),
        getPensionSummary(session.token).then(
          (value) => ({ value, failed: false }),
          (err: unknown) => {
            if (err instanceof ApiError && err.status === 401) throw err;
            return { value: null, failed: true };
          }
        ),
      ]);
      setPlan(nextPlan);
      setSummary(nextSummary.value);
      setSummaryFailed(nextSummary.failed);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 이전 토큰의 지연된 401이면(토큰이 이미 교체됨) 새 세션을 유지하고 무시한다.
        if (!sentToken || !(await handleUnauthorized(sentToken))) return;
        setPlan(null);
        setSummary(null);
        router.replace("/login");
        return;
      }
      setPlan(null);
      setSummary(null);
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plan, summary, summaryFailed, isLoading, error, refresh };
}
