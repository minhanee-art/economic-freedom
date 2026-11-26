import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMobilePortfolioSummary } from "@/api/portfolio";
import { clearSession, loadSession } from "@/storage/session";
import type { AuthSession, PortfolioSummary } from "@/types";

type PortfolioState = {
  /** 서버에서 받은 실제 데이터만 담는다. 불러오지 못했으면 null. */
  summary: PortfolioSummary | null;
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function usePortfolioSummary(): PortfolioState {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedSession = await loadSession();
      setSession(storedSession);
      if (!storedSession) {
        setSummary(null);
        router.replace("/login");
        return;
      }
      setSummary(await getMobilePortfolioSummary(storedSession.token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 만료되었거나 폐기된 토큰: 세션을 지우고 다시 로그인하게 한다.
        await clearSession();
        setSession(null);
        setSummary(null);
        router.replace("/login");
        return;
      }
      setSummary(null);
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, session, isLoading, error, refresh };
}
