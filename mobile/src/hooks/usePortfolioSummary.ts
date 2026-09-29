import { useCallback, useEffect, useState } from "react";
import { getMobilePortfolioSummary } from "@/api/portfolio";
import { mockPortfolio } from "@/constants/mockPortfolio";
import { loadSession } from "@/storage/session";
import type { AuthSession, PortfolioSummary } from "@/types";

type PortfolioState = {
  summary: PortfolioSummary;
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  isDemo: boolean;
  refresh: () => Promise<void>;
};

export function usePortfolioSummary(): PortfolioState {
  const [summary, setSummary] = useState<PortfolioSummary>(mockPortfolio);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedSession = await loadSession();
      setSession(storedSession);
      if (!storedSession) {
        setSummary(mockPortfolio);
        setIsDemo(true);
        return;
      }
      const nextSummary = await getMobilePortfolioSummary(storedSession.token);
      setSummary(nextSummary);
      setIsDemo(false);
    } catch (err) {
      setError((err as Error).message);
      setSummary(mockPortfolio);
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, session, isLoading, error, isDemo, refresh };
}
