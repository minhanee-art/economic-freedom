"use client";

// 설정 화면 — 구역 탭(계정 / 투자 / 알림 / 화면 / 데이터 삭제)과 탭끼리 함께 쓰는 저장 알림·오류·확인 대화상자.
// 탭 상태는 URL 의 ?tab= 이 기준이다(새로고침·딥링크·뒤로 가기). 탭 내용은 src/components/settings/*-tab.tsx.
import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { InlineError } from "@/components/dashboard/inline-error";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { Profile, Holding } from "@/types";
import {
  SETTINGS_TABS,
  SettingsTabList,
  parseSettingsTab,
  settingsPanelId,
  settingsTabId,
  type SettingsTabId,
} from "@/components/settings/settings-tabs";
import type { SettingsError, SettingsTools } from "@/components/settings/settings-shared";
import { AccountTab } from "@/components/settings/account-tab";
import { InvestTab } from "@/components/settings/invest-tab";
import { AlertsTab, type CalendarItem, type WatchlistItem } from "@/components/settings/alerts-tab";
import { DisplayTab } from "@/components/settings/display-tab";
import { DataTab } from "@/components/settings/data-tab";

interface Props {
  profile: Profile | null;
  holdings: Holding[];
  watchlist: WatchlistItem[];
  dividendCalendar: CalendarItem[];
  userId: string;
  /** Google 계정이 연결돼 있다(이메일은 Google 계정에서 온다) */
  hasGoogle?: boolean;
  /** 비밀번호가 있다(이메일·비밀번호로 로그인할 수 있다) */
  hasPassword?: boolean;
}

export function SettingsClient({ profile, holdings, watchlist, dividendCalendar, hasGoogle = false, hasPassword = true }: Props) {
  const searchParams = useSearchParams();
  const urlTab = parseSettingsTab(searchParams?.get("tab"));
  const [tab, setTab] = useState<SettingsTabId>(urlTab);
  // 뒤로 가기·앞으로 가기·다른 화면의 링크로 ?tab= 이 바뀌면 따라간다(렌더 중 맞추기 — effect 안 setState 를 피한다)
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    setTab(urlTab);
  }

  const selectTab = useCallback((next: SettingsTabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === next && !url.hash) return;
    url.searchParams.set("tab", next);
    url.hash = "";
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }, []);

  // 딥링크 앵커(예: ?tab=alerts#dividend-calendar): 화면이 loading.tsx 뒤에 스트리밍돼 브라우저 기본 해시 스크롤이 빗나가므로
  // 그려진 뒤 직접 옮긴다. 늦게 그려지는 칸(텔레그램·비밀번호)이 자리를 민 뒤 한 번 더 맞춘다.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const go = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    go();
    const timer = setTimeout(go, 600);
    return () => clearTimeout(timer);
  }, [tab]);

  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState<SettingsError | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setSaveStatus(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSaveStatus(""), 2000);
  }, []);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const tools = useMemo<SettingsTools>(() => ({ flash, showError: setError, confirm }), [flash, confirm]);

  const panels: Record<SettingsTabId, ReactNode> = {
    account: (
      <AccountTab
        email={profile?.email ?? ""}
        initialDisplayName={profile?.display_name ?? ""}
        hasGoogle={hasGoogle}
        hasPassword={hasPassword}
        tools={tools}
      />
    ),
    invest: <InvestTab initialMonthlyBudget={profile?.monthly_budget ?? 0} holdings={holdings} tools={tools} />,
    alerts: <AlertsTab watchlist={watchlist} dividendCalendar={dividendCalendar} tools={tools} />,
    display: <DisplayTab />,
    data: <DataTab tools={tools} />,
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight text-ink">설정</h1>
      <SettingsTabList value={tab} onChange={selectTab} />
      {error && <InlineError message={error.message} onRetry={error.retry} onDismiss={() => setError(null)} />}
      {/* 저장 상태 알림 — 자리는 항상 두고(aria-live) 글자가 있을 때만 보인다 */}
      <div role="status" aria-live="polite" data-testid="settings-toast" className={saveStatus ? "fixed top-4 right-4 z-50 bg-brand text-white px-4 py-2 text-sm font-medium shadow-float animate-fade-in" : "sr-only"}>
        {saveStatus}
      </div>

      {/* 모든 탭을 그려 두고 고른 탭만 보인다 — 탭을 오가도 입력 중인 값·불러온 상태가 남는다 */}
      {SETTINGS_TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={settingsPanelId(t.id)}
          aria-labelledby={settingsTabId(t.id)}
          hidden={tab !== t.id}
          data-testid={`settings-panel-${t.id}`}
        >
          {panels[t.id]}
        </div>
      ))}

      {dialog}
    </div>
  );
}
