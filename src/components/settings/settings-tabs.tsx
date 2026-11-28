"use client";

// 설정 구역 탭 — 계정 / 투자 / 알림 / 화면 / 데이터 삭제.
// 선택한 탭은 URL 쿼리(?tab=)와 맞춘다: 새로고침·딥링크(예: /dashboard/settings?tab=alerts#dividend-calendar)·뒤로 가기가 된다.
// WAI-ARIA 탭 패턴: role=tablist/tab/tabpanel, 선택한 탭만 Tab 키로 들어가고 ←/→·Home/End 로 옮긴다(옮기면 바로 선택).
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { id: "account", label: "계정", title: "계정" },
  { id: "invest", label: "투자", title: "투자 설정" },
  { id: "alerts", label: "알림", title: "알림" },
  { id: "display", label: "화면", title: "화면" },
  { id: "data", label: "데이터 삭제", title: "데이터 삭제" },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = "account";

/** 쿼리 값 → 탭 id. 모르는 값·빈 값은 기본 탭(계정). */
export function parseSettingsTab(value: string | string[] | null | undefined): SettingsTabId {
  const raw = Array.isArray(value) ? value[0] : value;
  return SETTINGS_TABS.some((t) => t.id === raw) ? (raw as SettingsTabId) : DEFAULT_SETTINGS_TAB;
}

/** 탭의 주소. 기본 탭도 ?tab=account 로 적어 주소만 보고 어느 탭인지 알 수 있게 한다. */
export function settingsTabHref(tab: SettingsTabId, hash?: string): string {
  return `/dashboard/settings?tab=${tab}${hash ? `#${hash}` : ""}`;
}

export const settingsTabId = (tab: SettingsTabId) => `settings-tab-${tab}`;
export const settingsPanelId = (tab: SettingsTabId) => `settings-panel-${tab}`;

export function SettingsTabList({ value, onChange }: { value: SettingsTabId; onChange: (tab: SettingsTabId) => void }) {
  const refs = useRef<Partial<Record<SettingsTabId, HTMLButtonElement | null>>>({});

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = SETTINGS_TABS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const tab = SETTINGS_TABS[next].id;
    onChange(tab);
    refs.current[tab]?.focus();
  };

  return (
    // 좁은 화면에서 넘치면 탭 줄만 가로로 밀린다(페이지 전체가 가로로 밀리지 않게)
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="설정 구역" className="flex min-w-max border-b border-hairline dark:border-zinc-800">
        {SETTINGS_TABS.map((tab, index) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={settingsTabId(tab.id)}
              aria-selected={selected}
              aria-controls={settingsPanelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                "-mb-px h-11 grow whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:flex-none sm:px-4",
                selected
                  ? "border-brand text-brand dark:text-indigo-300"
                  : "border-transparent text-zinc-600 hover:text-ink dark:text-zinc-400"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
