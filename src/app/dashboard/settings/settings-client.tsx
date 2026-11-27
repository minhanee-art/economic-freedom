"use client";

import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { InlineError, failureMessage } from "@/components/dashboard/inline-error";
import { useEffect, useState, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
import { CATEGORIES } from "@/lib/constants";
import type { Profile, Holding } from "@/types";
import { useTheme, type Theme } from "@/lib/theme";
import { useMemo } from "react";
import { PasswordSection } from "@/components/settings/password-section";
import { AccountDeleteSection } from "@/components/settings/account-delete-section";
import { TelegramLinkSection } from "@/components/settings/telegram-link-section";

type HoldingGroupBy = "none" | "category" | "sub_category";

interface WatchlistItem {
  id: string;
  name: string;
  code: string | null;
  market: "KR" | "US";
}

interface CalendarItem {
  id: string;
  date: string;
  stock: string;
  type: string;
  note: string;
}

interface Props {
  profile: Profile | null;
  holdings: Holding[];
  watchlist: WatchlistItem[];
  dividendCalendar: CalendarItem[];
  userId: string;
  /** Google 계정이 연결돼 있다(이메일은 Google 계정에서 온다) */
  hasGoogle?: boolean;
}

export function SettingsClient({ profile, holdings: initialHoldings, watchlist: initialWatchlist, dividendCalendar: initialCalendar, hasGoogle = false }: Props) {
  const router = useRouter();
  const [holdings, setHoldings] = useState(initialHoldings);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [monthlyBudget, setMonthlyBudget] = useState(
    profile?.monthly_budget ?? 0
  );
  const [budgetInput, setBudgetInput] = useState(
    profile?.monthly_budget ? profile.monthly_budget.toLocaleString() : ""
  );
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const { confirm, dialog } = useConfirmDialog();

  // 새 종목 추가
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("주식");
  const [newSubCategory, setNewSubCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { theme, setTheme } = useTheme();
  const [holdingGroupBy, setHoldingGroupBy] = useState<HoldingGroupBy>("none");
  const totalTargetPct = holdings.reduce((s, h) => s + Number(h.target_pct), 0);

  useEffect(() => {
    setHoldings(initialHoldings);
    setSaveStatus("");
  }, [initialHoldings]);

  const holdingGroups = useMemo(() => {
    if (holdingGroupBy === "none") {
      return [{ label: "", categoryKey: "", totalPct: 0, items: holdings }];
    }
    const key = holdingGroupBy === "category" ? "category" : "sub_category";
    const map = new Map<string, Holding[]>();
    for (const h of holdings) {
      const k = String(h[key] || "기타");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      categoryKey: holdingGroupBy === "category" ? label : (items[0]?.category ?? ""),
      totalPct: items.reduce((s, h) => s + Number(h.target_pct), 0),
      items,
    }));
  }, [holdings, holdingGroupBy]);
  const isTarget100 = Math.abs(totalTargetPct - 100) < 0.01;

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(""), 2000);
  };

  // 프로필 저장
  const saveProfile = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget, displayName: displayName.trim() || null }),
      });
      if (!res.ok) throw new Error();
      flash("프로필 저장됨");
    } catch {
      setError({ message: failureMessage("프로필을 저장", new Error("")), retry: saveProfile });
    }
  };

  // 종목 필드 debounce 저장
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const updateHolding = useCallback(
    (id: string, field: string, value: number) => {
      // 로컬 즉시 반영
      setHoldings((prev) =>
        prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))
      );

      // debounce DB 저장
      const key = `${id}-${field}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(async () => {
          try {
            const res = await fetch("/api/holdings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, [field]: value }),
            });
            if (!res.ok) throw new Error();
            flash("자동 저장됨");
          } catch {
            flash("자동 저장 실패");
          } finally {
            debounceTimers.current.delete(key);
          }
        }, 500)
      );
    },
    []
  );

  // 종목 추가
  const handleAddHolding = async () => {
    if (!newCode || !newName || !newSubCategory) return;
    setIsAdding(true);

    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode, name: newName, category: newCategory,
          sub_category: newSubCategory,
          current_price: parseInt(newPrice.replace(/[^0-9]/g, "")) || 0,
          target_pct: 0,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      const data = await res.json();
      setHoldings([...holdings, data]);
      setNewCode("");
      setNewName("");
      setNewSubCategory("");
      setNewPrice("");
      setShowAdd(false);
      flash("종목 추가됨");
    } catch (err) {
      setError({ message: failureMessage("추가", err) });
    } finally {
      setIsAdding(false);
    }
  };

  // 종목 삭제
  const handleDeleteHolding = async (id: string) => {
    const h = holdings.find((h) => h.id === id);
    if (!h || h.shares > 0) return;
    const ok = await confirm({ title: `"${h.name}"을(를) 삭제하시겠습니까?`, confirmLabel: "종목 삭제" });
    if (!ok) return;

    const res = await fetch("/api/holdings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { setError({ message: failureMessage(`${h.name}을(를) 삭제`, new Error(`서버 응답 ${res.status}`)) }); } else {
      setHoldings(holdings.filter((h) => h.id !== id));
      flash("종목 삭제됨");
    }
  };

  // 데이터 삭제 — 확인 문구는 무엇이 지워지는지 그대로 알린다
  const DANGER_TEXT: Record<"reset" | "purchases" | "dividends", string> = {
    reset: "현재 계좌의 보유 종목을 모두 삭제합니다. 이 종목들의 매수·매도·배당 기록과 원가 데이터도 함께 지워집니다. 이 작업은 되돌릴 수 없습니다.",
    purchases: "모든 매수 기록, 보유수량, 원가 데이터가 초기화됩니다. 이 작업은 되돌릴 수 없습니다.",
    dividends: "모든 배당금 수령 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
  };
  const DANGER_TITLE: Record<"reset" | "purchases" | "dividends", { title: string; confirmLabel: string }> = {
    reset: { title: "현재 계좌의 보유 종목을 모두 삭제할까요?", confirmLabel: "보유 종목 모두 삭제" },
    purchases: { title: "매수 기록을 모두 삭제할까요?", confirmLabel: "매수 기록 모두 삭제" },
    dividends: { title: "배당 기록을 모두 삭제할까요?", confirmLabel: "배당 기록 모두 삭제" },
  };
  const handleDangerAction = async (kind: "reset" | "purchases" | "dividends") => {
    const ok = await confirm({ ...DANGER_TITLE[kind], body: DANGER_TEXT[kind] });
    if (!ok) return;
    setError(null);
    try {
      if (kind === "purchases") {
        const res = await fetch("/api/danger/purchases", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("매수 기록 전체 삭제됨");
        router.refresh();
      } else if (kind === "dividends") {
        const res = await fetch("/api/danger/dividends", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("배당 기록 전체 삭제됨");
      } else {
        const res = await fetch("/api/settings", { method: "DELETE" });
        if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
        flash("보유 종목 전체 삭제됨");
        router.refresh();
      }
    } catch (err) {
      setError({ message: failureMessage("삭제", err), retry: () => handleDangerAction(kind) });
    }
  };



  // 배당 캘린더
  const [calendar, setCalendar] = useState<CalendarItem[]>(initialCalendar);
  const [calDate, setCalDate] = useState("");
  const [calStock, setCalStock] = useState("");
  const [calType, setCalType] = useState("ex-date");
  const [calNote, setCalNote] = useState("");
  const [isAddingCal, setIsAddingCal] = useState(false);

  const handleAddCalendar = async () => {
    if (!calDate || !calStock) return;
    setIsAddingCal(true);
    try {
      const res = await fetch("/api/dividend-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: calDate, stock: calStock, type: calType, note: calNote }),
      });
      if (!res.ok) throw new Error("추가 실패");
      const item = await res.json() as CalendarItem;
      setCalendar((prev) => [...prev, item].sort((a, b) => a.date.localeCompare(b.date)));
      setCalDate("");
      setCalStock("");
      setCalNote("");
      flash("일정 추가됨");
    } catch (err) {
      setError({ message: failureMessage("추가", err) });
    } finally {
      setIsAddingCal(false);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    const res = await fetch(`/api/dividend-calendar/${id}`, { method: "DELETE" });
    if (!res.ok) { setError({ message: failureMessage("삭제", new Error(`서버 응답 ${res.status}`)) }); return; }
    setCalendar((prev) => prev.filter((c) => c.id !== id));
    flash("일정 삭제됨");
  };

  // 감정분석 종목 watchlist
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [wlName, setWlName] = useState("");
  const [wlCode, setWlCode] = useState("");
  const [wlMarket, setWlMarket] = useState<"KR" | "US">("KR");
  const [isAddingWl, setIsAddingWl] = useState(false);

  const handleAddWatchlist = async () => {
    if (!wlName.trim()) return;
    setIsAddingWl(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wlName.trim(), code: wlCode.trim() || undefined, market: wlMarket }),
      });
      if (!res.ok) throw new Error("추가 실패");
      const item = await res.json() as WatchlistItem;
      setWatchlist((prev) => [...prev, item]);
      setWlName("");
      setWlCode("");
      flash("종목 추가됨");
    } catch (err) {
      setError({ message: failureMessage("추가", err) });
    } finally {
      setIsAddingWl(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (!res.ok) { setError({ message: failureMessage("삭제", new Error(`서버 응답 ${res.status}`)) }); return; }
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    flash("종목 삭제됨");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-ink">설정</h1>
      {error && <InlineError message={error.message} onRetry={error.retry} onDismiss={() => setError(null)} />}
      {/* 저장 상태 토스트 */}
      {saveStatus && (
        <div className="fixed top-4 right-4 z-50 bg-brand text-white px-4 py-2 text-sm font-medium shadow-float animate-fade-in">
          {saveStatus}
        </div>
      )}

      {/* 프로필 */}
      <section className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-4">
        <h2 className="text-sm font-semibold">프로필</h2>

        <div>
          <label htmlFor="settings-email" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">이메일 <span className="text-zinc-500 dark:text-zinc-400">({hasGoogle ? "Google 계정 이메일, 변경 불가" : "로그인 아이디, 변경 불가"})</span></label>
          <input
            id="settings-email"
            type="text"
            value={profile?.email ?? ""}
            readOnly
            className="w-full h-10 border border-hairline bg-canvas-soft px-3 text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label htmlFor="settings-field-1" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">표시 이름</label>
          <input id="settings-field-1"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="이름 입력"
            className="w-full h-10 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label htmlFor="settings-field-2" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">월 투자금액 (원)</label>
          <input id="settings-field-2"
            type="text"
            inputMode="numeric"
            value={budgetInput}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(v) || 0;
              setBudgetInput(num > 0 ? num.toLocaleString() : "");
              setMonthlyBudget(num);
            }}
            className="w-full h-10 border border-hairline bg-white transition px-3 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          onClick={saveProfile}
          className="w-full h-10 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-card transition-colors"
        >
          프로필 저장
        </button>
      </section>

      <PasswordSection />
      <TelegramLinkSection />
      {/* 목표 비중 합계 */}
      <div
        className={cn(
          "px-4 py-3 text-sm font-medium tabular-nums shadow-card",
          isTarget100
            ? "bg-surface text-success border border-hairline dark:border-zinc-800"
            : "bg-caution-soft text-caution border border-caution/30"
        )}
      >
        목표 비중 합계: {totalTargetPct.toFixed(1)}%
        {isTarget100 ? " (정상)" : " (100%가 아닙니다)"}
      </div>

      {/* 종목 관리 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">
            종목 관리 ({holdings.length})
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-hairline dark:border-zinc-700 overflow-hidden text-xs bg-white dark:bg-zinc-900 shadow-card">
              {(
                [
                  { value: "none", label: "전체" },
                  { value: "category", label: "자산군" },
                  { value: "sub_category", label: "세부테마" },
                ] as { value: HoldingGroupBy; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHoldingGroupBy(opt.value)}
                  className={cn(
                    "px-3 py-1.5 transition-colors",
                    holdingGroupBy === opt.value
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 shadow-card transition-colors"
            >
              {showAdd ? "닫기" : "+ 새 종목"}
            </button>
          </div>
        </div>

        {/* 새 종목 추가 폼 */}
        {showAdd && (
          <div className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-5 space-y-3 shadow-card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-field-3" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">종목코드</label>
                <input id="settings-field-3"
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="예: 069500"
                  className="w-full h-9 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label htmlFor="settings-field-4" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">종목명</label>
                <input id="settings-field-4"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: KODEX 200"
                  className="w-full h-9 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label htmlFor="settings-field-5" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">자산군</label>
                <select id="settings-field-5"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-9 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="settings-field-6" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">소분류</label>
                <input id="settings-field-6"
                  type="text"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  placeholder="예: 국장, 배당"
                  className="w-full h-9 border border-hairline bg-white transition px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="settings-field-7" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">현재가 (원)</label>
                <input id="settings-field-7"
                  type="text"
                  inputMode="numeric"
                  value={newPrice}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setNewPrice(v ? parseInt(v).toLocaleString() : "");
                  }}
                  placeholder="0"
                  className="w-full h-9 border border-hairline bg-white transition px-3 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <button
              onClick={handleAddHolding}
              disabled={!newCode || !newName || !newSubCategory || isAdding}
              className="w-full h-9 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-card transition-colors"
            >
              {isAdding ? "추가 중..." : "종목 추가"}
            </button>
          </div>
        )}

        {/* 종목 카드 리스트 — 그룹핑 */}
        <div className="space-y-4">
          {holdingGroups.map((group) => (
            <div key={group.label || "_all"}>
              {group.label && (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="dot-bg w-2.5 h-2.5 shrink-0"
                    style={{ "--dot-bg": getCategoryColor(group.categoryKey) } as CSSProperties}
                  />
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {group.totalPct.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {group.items.map((h) => (
                  <HoldingSettingCard
                    key={h.id}
                    holding={h}
                    onUpdate={updateHolding}
                    onDelete={handleDeleteHolding}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 감정분석 종목 watchlist */}
      <section className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">뉴스 요약 받을 종목 ({watchlist.length})</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">매일 08:30 KST 텔레그램 전송</span>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={wlName}
              onChange={(e) => setWlName(e.target.value)}
              aria-label="뉴스 요약 받을 종목명"
              placeholder="종목명 (예: 삼성전자, SCHD ETF)"
              className="min-w-0 flex-1 basis-40 h-11 border border-hairline bg-white transition px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={wlMarket}
              onChange={(e) => setWlMarket(e.target.value as "KR" | "US")}
              aria-label="시장"
              className="h-11 border border-hairline bg-white transition px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="KR">한국(KR)</option>
              <option value="US">미국(US)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={wlCode}
              onChange={(e) => setWlCode(e.target.value)}
              aria-label={wlMarket === "KR" ? "종목코드" : "심볼"}
              onKeyDown={(e) => e.key === "Enter" && handleAddWatchlist()}
              placeholder={wlMarket === "KR" ? "종목코드 (예: 069500)" : "심볼 (예: SCHD)"}
              className="min-w-0 flex-1 basis-40 h-11 border border-hairline bg-white transition px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={handleAddWatchlist}
              disabled={!wlName.trim() || isAddingWl}
              className="h-9 px-4 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-card transition-colors"
            >
              {isAddingWl ? "..." : "+ 추가"}
            </button>
          </div>
        </div>

        {/* 종목 리스트 */}
        {watchlist.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">뉴스 요약을 받을 종목을 추가해 주세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {watchlist.map((w) => (
              <li key={w.id} className="flex items-center gap-2 border border-hairline dark:border-zinc-800 bg-canvas-soft dark:bg-zinc-800/50 px-3 py-2">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-7 shrink-0">
                  {w.market === "US" ? "US" : "KR"}
                </span>
                <span className="flex-1 text-sm">{w.name}</span>
                {w.code && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{w.code}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteWatchlist(w.id)}
                  aria-label={`${w.name} 뉴스 요약 종목 삭제`}
                  className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 배당 캘린더 */}
      <section className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">배당 일정 ({calendar.length})</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">매일 08:00 KST 텔레그램 전송</span>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={calDate}
              onChange={(e) => setCalDate(e.target.value)}
              aria-label="일정 날짜"
              className="min-w-0 flex-1 basis-36 h-11 border border-hairline bg-white transition px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={calType}
              onChange={(e) => setCalType(e.target.value)}
              aria-label="일정 종류"
              className="h-11 border border-hairline bg-white transition px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="ex-date">배당락일</option>
              <option value="pay-date">배당지급일</option>
              <option value="meeting">주주총회</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={calStock}
              onChange={(e) => setCalStock(e.target.value)}
              aria-label="일정 종목명"
              placeholder="종목명 (예: 삼성전자)"
              className="min-w-0 flex-1 basis-40 h-11 border border-hairline bg-white transition px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              type="text"
              value={calNote}
              onChange={(e) => setCalNote(e.target.value)}
              aria-label="일정 메모(선택)"
              onKeyDown={(e) => e.key === "Enter" && handleAddCalendar()}
              placeholder="메모 (예: 2024년 결산배당)"
              className="min-w-0 flex-1 basis-40 h-11 border border-hairline bg-white transition px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <button
            onClick={handleAddCalendar}
            disabled={!calDate || !calStock || isAddingCal}
            className="w-full h-9 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-card transition-colors"
          >
            {isAddingCal ? "..." : "+ 추가"}
          </button>
        </div>

        {/* 일정 리스트 */}
        {calendar.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">배당 일정을 추가해 주세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {calendar.map((c) => {
              const typeLabel: Record<string, string> = {
                "ex-date": "배당락",
                "pay-date": "지급일",
                "meeting": "주총",
                "other": "기타",
              };
              return (
                <li key={c.id} className="flex items-center gap-2 border border-hairline dark:border-zinc-800 bg-canvas-soft dark:bg-zinc-800/50 px-3 py-2">
                  <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-20 shrink-0">{c.date}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-16 shrink-0">{typeLabel[c.type] ?? c.type}</span>
                  <span className="flex-1 text-sm truncate" title={c.stock}>{c.stock}</span>
                  {c.note && <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-25">{c.note}</span>}
                  <button
                    type="button"
                    onClick={() => handleDeleteCalendar(c.id)}
                    aria-label={`${c.date} ${c.stock} 일정 삭제`}
                    className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 테마 설정 */}
      <section className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <h2 className="text-sm font-semibold">테마</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "light", label: "라이트" },
              { value: "dark", label: "다크" },
              { value: "system", label: "시스템" },
            ] as { value: Theme; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              className={cn(
                "flex-1 h-11 border text-sm font-medium transition-colors",
                theme === opt.value
                  ? "bg-brand text-white border-brand"
                  : "border-hairline dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 로그인 세션 — 데이터 삭제와 분리 */}
      <section aria-labelledby="settings-session" className="border border-hairline bg-surface p-5 shadow-card dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="settings-session" className="text-sm font-semibold text-ink">로그인</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">이 기기에서 로그아웃합니다. 기록은 그대로 남습니다.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="h-11 border border-hairline px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas-soft dark:border-zinc-700"
          >
            로그아웃
          </button>
        </div>
      </section>

      {/* 데이터 삭제 — 되돌릴 수 없는 작업만 모은다 */}
      <section aria-labelledby="settings-data-delete" className="border border-danger-line bg-surface p-5 space-y-3 shadow-card">
        <div>
          <h2 id="settings-data-delete" className="flex items-center gap-2 text-sm font-semibold text-danger">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            데이터 삭제
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">아래 작업은 되돌릴 수 없습니다. 누르면 무엇이 지워지는지 한 번 더 확인합니다.</p>
        </div>
        <div className="space-y-2">
          <DangerButton
            label="보유 종목 전체 삭제"
            desc="현재 계좌의 종목을 모두 지워 빈 상태로 만듭니다"
            onClick={() => handleDangerAction("reset")}
          />
          <DangerButton
            label="매수 기록 전체 삭제"
            desc="모든 매수 기록과 보유수량이 초기화됩니다"
            onClick={() => handleDangerAction("purchases")}
          />
          <DangerButton
            label="배당 기록 전체 삭제"
            desc="모든 배당금 기록이 삭제됩니다"
            onClick={() => handleDangerAction("dividends")}
          />
        </div>
      </section>

      {dialog}

      <AccountDeleteSection />
    </div>
  );
}

function HoldingSettingCard({
  holding: h,
  onUpdate,
  onDelete,
}: {
  holding: Holding;
  onUpdate: (id: string, field: string, value: number) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-card transition-shadow hover:shadow-float">
      <div className="flex-1 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold"><span aria-hidden="true" className="dot-bg mr-1.5 inline-block h-2 w-2 shrink-0 align-middle" style={{"--dot-bg": getCategoryColor(h.category) } as CSSProperties} />{h.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {h.code} · {h.category}/{h.sub_category} · {Number(h.shares).toLocaleString()}주 보유
            </p>
          </div>
          {h.shares === 0 && (
            <button
              type="button"
              onClick={() => onDelete(h.id)}
              aria-label={`${h.name} 종목 삭제`}
              className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
            >
              <svg aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`holding-${h.id}-price`} className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">현재가 (원)</label>
            <input id={`holding-${h.id}-price`}
              type="text"
              inputMode="numeric"
              defaultValue={h.current_price.toLocaleString()}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                onUpdate(h.id, "current_price", v);
              }}
              className="w-full h-8 border border-hairline bg-canvas-soft px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label htmlFor={`holding-${h.id}-target`} className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">목표비중 (%)</label>
            <input id={`holding-${h.id}-target`}
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={h.target_pct}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                onUpdate(h.id, "target_pct", v);
              }}
              className="w-full h-8 border border-hairline bg-canvas-soft px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DangerButton({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="w-full min-h-14 flex items-center justify-between border border-danger-line bg-surface px-4 py-3 text-left transition-colors hover:bg-danger-soft"
    >
      <div>
        <p className="text-sm font-medium text-danger">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      <svg
        aria-hidden="true"
        className="w-4 h-4 text-danger shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 4.5l7.5 7.5-7.5 7.5"
        />
      </svg>
    </button>
  );
}
