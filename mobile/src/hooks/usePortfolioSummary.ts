import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAccounts } from "@/api/accounts";
import { ApiError } from "@/api/client";
import { getMobilePortfolioSummary } from "@/api/portfolio";
import {
  clearSelectedAccountId,
  loadSelectedAccountId,
  notifyAccountSelection,
  saveSelectedAccountId,
  subscribeAccountSelection,
} from "@/storage/account";
import { handleUnauthorized, loadSession } from "@/storage/session";
import type { AccountSummary, AuthSession, PortfolioSummary } from "@/types";

type PortfolioState = {
  /** 서버에서 받은 실제 데이터만 담는다. 불러오지 못했으면 null. */
  summary: PortfolioSummary | null;
  session: AuthSession | null;
  accounts: AccountSummary[];
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** 계좌를 고르고 기기에 저장한다. 모든 탭이 같은 선택을 따른다. */
  selectAccount: (accountId: string) => Promise<void>;
};

export function usePortfolioSummary(): PortfolioState {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 계좌를 빠르게 바꿀 때 늦게 도착한 이전 응답이 화면을 덮어쓰지 않게 한다.
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError(null);
    let sentToken: string | null = null;
    try {
      const storedSession = await loadSession();
      sentToken = storedSession?.token ?? null;
      if (current !== requestId.current) return;
      setSession(storedSession);
      if (!storedSession) {
        setSummary(null);
        setAccounts([]);
        router.replace("/login");
        return;
      }

      const accountList = await getAccounts(storedSession.token);
      if (current !== requestId.current) return;
      setAccounts(accountList);
      if (accountList.length === 0) {
        setSummary(null);
        setSelectedAccountId(null);
        setError("포트폴리오 계좌가 없습니다.");
        return;
      }

      const savedId = await loadSelectedAccountId(storedSession.user.id);
      // 저장된 계좌가 더 이상 목록에 없으면(삭제되었거나 다른 사용자 것) 선택을 지우고 첫 계좌로 돌아간다.
      let accountId = accountList.find((item) => item.id === savedId)?.id;
      if (!accountId) {
        if (savedId) await clearSelectedAccountId();
        accountId = accountList[0].id;
      }

      let data: PortfolioSummary;
      try {
        data = await getMobilePortfolioSummary(storedSession.token, accountId);
      } catch (err) {
        // 서버가 이 계좌를 소유하지 않는다고 답하면(404) 저장된 선택을 지우고 첫 계좌로 한 번 더 시도한다.
        if (err instanceof ApiError && err.status === 404 && accountId !== accountList[0].id) {
          await clearSelectedAccountId();
          accountId = accountList[0].id;
          data = await getMobilePortfolioSummary(storedSession.token, accountId);
        } else {
          throw err;
        }
      }
      if (current !== requestId.current) return;
      setSelectedAccountId(accountId);
      setSummary(data);
    } catch (err) {
      if (current !== requestId.current) return;
      if (err instanceof ApiError && err.status === 401) {
        // 만료되었거나 폐기된 토큰: 같은 토큰일 때만 세션을 지우고 다시 로그인하게 한다.
        if (!sentToken || !(await handleUnauthorized(sentToken))) return;
        setSession(null);
        setSummary(null);
        setAccounts([]);
        router.replace("/login");
        return;
      }
      setSummary(null);
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 다른 탭에서 계좌를 바꾸면 이 탭도 같은 계좌로 다시 불러온다.
  useEffect(() => subscribeAccountSelection(() => void refresh()), [refresh]);

  const selectAccount = useCallback(
    async (accountId: string) => {
      if (!session || accountId === selectedAccountId) return;
      await saveSelectedAccountId(session.user.id, accountId);
      notifyAccountSelection();
    },
    [session, selectedAccountId]
  );

  return { summary, session, accounts, selectedAccountId, isLoading, error, refresh, selectAccount };
}
