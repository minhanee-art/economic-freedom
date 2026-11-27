import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { getPensionSummary } from "@/api/pension";
import { handleUnauthorized, loadSession } from "@/storage/session";
import type { PensionSummary } from "@/types";

/**
 * 홈 첫 화면용: 서버의 연금 요약(가족 합산 세액공제 진행·은퇴 시점 현금흐름)만 읽는다. 앱에서 새로 계산하지 않는다.
 * 실패해도 홈의 다른 부분을 막지 않는다(failed 만 알린다). 401 은 다른 훅과 같이 로그인으로 보낸다.
 */
export function usePensionSummary() {
  const [summary, setSummary] = useState<PensionSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    let sentToken: string | null = null;
    try {
      const session = await loadSession();
      sentToken = session?.token ?? null;
      if (!session) return;
      const value = await getPensionSummary(session.token);
      if (current !== requestId.current) return;
      setSummary(value);
      setFailed(value === null);
    } catch (err) {
      if (current !== requestId.current) return;
      if (err instanceof ApiError && err.status === 401) {
        if (sentToken && (await handleUnauthorized(sentToken))) router.replace("/login");
        return;
      }
      setSummary(null);
      setFailed(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, failed, isLoading, refresh };
}
