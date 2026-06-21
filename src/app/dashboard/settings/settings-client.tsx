"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatFullKRW, cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
import { CATEGORIES } from "@/lib/constants";
import type { Profile, Holding } from "@/types";
import { useTheme, type Theme } from "@/lib/theme";
import { useMemo } from "react";

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
}

export function SettingsClient({ profile, holdings: initialHoldings, watchlist: initialWatchlist, dividendCalendar: initialCalendar, userId }: Props) {
  const router = useRouter();
  const [holdings, setHoldings] = useState(initialHoldings);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [monthlyBudget, setMonthlyBudget] = useState(
    profile?.monthly_budget ?? 300000
  );
  const [budgetInput, setBudgetInput] = useState(
    (profile?.monthly_budget ?? 300000).toLocaleString()
  );
  const [saveStatus, setSaveStatus] = useState("");
  const [dangerModal, setDangerModal] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      alert("저장 실패");
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
      alert(`추가 실패: ${(err as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  // 종목 삭제
  const handleDeleteHolding = async (id: string) => {
    const h = holdings.find((h) => h.id === id);
    if (!h || h.shares > 0) return;
    if (!confirm(`"${h.name}"을(를) 삭제하시겠습니까?`)) return;

    const res = await fetch("/api/holdings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { alert("삭제 실패"); } else {
      setHoldings(holdings.filter((h) => h.id !== id));
      flash("종목 삭제됨");
    }
  };

  // 위험 구역 액션
  const handleDangerAction = async () => {
    if (!dangerModal) return;
    setIsDeleting(true);

    try {
      if (dangerModal === "purchases") {
        const res = await fetch("/api/danger/purchases", { method: "DELETE" });
        if (!res.ok) throw new Error("삭제 실패");
        flash("매수 기록 전체 삭제됨");
        router.refresh();
      } else if (dangerModal === "dividends") {
        const res = await fetch("/api/danger/dividends", { method: "DELETE" });
        if (!res.ok) throw new Error("삭제 실패");
        flash("배당 기록 전체 삭제됨");
      } else if (dangerModal === "reset") {
        const res = await fetch("/api/settings", { method: "DELETE" });
        if (!res.ok) throw new Error("초기화 실패");
        flash("종목 초기화 완료");
        router.refresh();
      } else if (dangerModal === "account") {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
      }
    } catch (err) {
      alert(`실패: ${(err as Error).message}`);
    } finally {
      setIsDeleting(false);
      setDangerModal(null);
    }
  };

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(""), 2000);
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
      alert(`추가 실패: ${(err as Error).message}`);
    } finally {
      setIsAddingCal(false);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    const res = await fetch(`/api/dividend-calendar/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("삭제 실패"); return; }
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
      alert(`추가 실패: ${(err as Error).message}`);
    } finally {
      setIsAddingWl(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("삭제 실패"); return; }
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    flash("종목 삭제됨");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      {/* 저장 상태 토스트 */}
      {saveStatus && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-medium shadow-lg animate-fade-in">
          {saveStatus}
        </div>
      )}

      {/* 프로필 */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
        <h3 className="text-sm font-semibold">프로필</h3>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">이메일 <span className="text-zinc-400">(Google 계정, 변경 불가)</span></label>
          <input
            type="text"
            value={profile?.email ?? ""}
            readOnly
            className="w-full h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-400 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">표시 이름</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="이름 입력"
            className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            월 투자금액 (원)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={budgetInput}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(v) || 0;
              setBudgetInput(num > 0 ? num.toLocaleString() : "");
              setMonthlyBudget(num);
            }}
            className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          onClick={saveProfile}
          className="w-full h-10 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
        >
          프로필 저장
        </button>
      </section>

      {/* 목표 비중 합계 */}
      <div
        className={cn(
          "rounded-xl px-4 py-3 text-sm font-medium",
          isTarget100
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
            : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
        )}
      >
        목표 비중 합계: {totalTargetPct.toFixed(1)}%
        {isTarget100 ? " (정상)" : " (100%가 아닙니다)"}
      </div>

      {/* 종목 관리 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">
            종목 관리 ({holdings.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
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
                    "px-2.5 py-1.5 transition-colors",
                    holdingGroupBy === opt.value
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
            >
              {showAdd ? "닫기" : "+ 새 종목"}
            </button>
          </div>
        </div>

        {/* 새 종목 추가 폼 */}
        {showAdd && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  종목코드
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="예: 069500"
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  종목명
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: KODEX 200"
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  대분류
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  소분류
                </label>
                <input
                  type="text"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  placeholder="예: 국장, 배당"
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">
                  현재가 (원)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPrice}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setNewPrice(v ? parseInt(v).toLocaleString() : "");
                  }}
                  placeholder="0"
                  className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <button
              onClick={handleAddHolding}
              disabled={!newCode || !newName || !newSubCategory || isAdding}
              className="w-full h-9 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
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
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: getCategoryColor(group.categoryKey) }}
                  />
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  <span className="text-xs font-semibold text-zinc-500 tabular-nums">
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
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">📡 감정분석 종목 ({watchlist.length})</h3>
          <span className="text-[11px] text-zinc-400">매일 08:30 KST 텔레그램 전송</span>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={wlName}
              onChange={(e) => setWlName(e.target.value)}
              placeholder="종목명 (예: 삼성전자, SCHD ETF)"
              className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={wlMarket}
              onChange={(e) => setWlMarket(e.target.value as "KR" | "US")}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="KR">🇰🇷 KR</option>
              <option value="US">🇺🇸 US</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={wlCode}
              onChange={(e) => setWlCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWatchlist()}
              placeholder={wlMarket === "KR" ? "종목코드 (예: 069500)" : "심볼 (예: SCHD)"}
              className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={handleAddWatchlist}
              disabled={!wlName.trim() || isAddingWl}
              className="h-9 px-4 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {isAddingWl ? "..." : "+ 추가"}
            </button>
          </div>
        </div>

        {/* 종목 리스트 */}
        {watchlist.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-2">감정분석할 종목을 추가해 주세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {watchlist.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                <span className="text-[11px] font-semibold text-zinc-400 w-7 shrink-0">
                  {w.market === "US" ? "🇺🇸" : "🇰🇷"}
                </span>
                <span className="flex-1 text-sm">{w.name}</span>
                {w.code && (
                  <span className="text-[11px] text-zinc-400 font-mono">{w.code}</span>
                )}
                <button
                  onClick={() => handleDeleteWatchlist(w.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors text-xs"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 배당 캘린더 */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">📅 배당 캘린더 ({calendar.length})</h3>
          <span className="text-[11px] text-zinc-400">매일 08:00 KST 텔레그램 전송</span>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={calDate}
              onChange={(e) => setCalDate(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={calType}
              onChange={(e) => setCalType(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="ex-date">⚠️ 배당락일</option>
              <option value="pay-date">💰 배당지급일</option>
              <option value="meeting">🏛️ 주주총회</option>
              <option value="other">📋 기타</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={calStock}
              onChange={(e) => setCalStock(e.target.value)}
              placeholder="종목명 (예: 삼성전자)"
              className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              type="text"
              value={calNote}
              onChange={(e) => setCalNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCalendar()}
              placeholder="메모 (예: 2024년 결산배당)"
              className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <button
            onClick={handleAddCalendar}
            disabled={!calDate || !calStock || isAddingCal}
            className="w-full h-9 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {isAddingCal ? "..." : "+ 추가"}
          </button>
        </div>

        {/* 일정 리스트 */}
        {calendar.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-2">배당 일정을 추가해 주세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {calendar.map((c) => {
              const typeLabel: Record<string, string> = {
                "ex-date": "⚠️ 배당락",
                "pay-date": "💰 지급일",
                "meeting": "🏛️ 주총",
                "other": "📋 기타",
              };
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                  <span className="text-[11px] font-mono text-zinc-400 w-20 shrink-0">{c.date}</span>
                  <span className="text-[11px] text-zinc-400 w-16 shrink-0">{typeLabel[c.type] ?? c.type}</span>
                  <span className="flex-1 text-sm truncate">{c.stock}</span>
                  {c.note && <span className="text-[11px] text-zinc-400 truncate max-w-[100px]">{c.note}</span>}
                  <button
                    onClick={() => handleDeleteCalendar(c.id)}
                    className="text-zinc-300 hover:text-red-500 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 테마 설정 */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">테마</h3>
        <div className="flex gap-2">
          {(
            [
              { value: "light", label: "라이트", icon: "☀️" },
              { value: "dark", label: "다크", icon: "🌙" },
              { value: "system", label: "시스템", icon: "💻" },
            ] as { value: Theme; label: string; icon: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors",
                theme === opt.value
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 위험 구역 */}
      <section className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
          위험 구역
        </h3>
        <div className="space-y-2">
          <DangerButton
            label="종목 초기화 (기본 15종목)"
            desc="모든 종목을 삭제하고 기본 15개 종목으로 복원합니다"
            onClick={() => setDangerModal("reset")}
          />
          <DangerButton
            label="매수 기록 전체 삭제"
            desc="모든 매수 기록과 보유수량이 초기화됩니다"
            onClick={() => setDangerModal("purchases")}
          />
          <DangerButton
            label="배당 기록 전체 삭제"
            desc="모든 배당금 기록이 삭제됩니다"
            onClick={() => setDangerModal("dividends")}
          />
          <DangerButton
            label="로그아웃"
            desc="현재 세션에서 로그아웃합니다"
            onClick={handleLogout}
          />
        </div>
      </section>

      {/* 위험 확인 모달 */}
      {dangerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-600">정말 삭제하시겠습니까?</h3>
            <p className="text-sm text-zinc-500">
              {dangerModal === "reset" &&
                "현재 종목을 모두 삭제하고 기본 15개 종목으로 복원합니다. 매수 기록과 원가 데이터도 초기화됩니다."}
              {dangerModal === "purchases" &&
                "모든 매수 기록, 보유수량, 원가 데이터가 초기화됩니다. 이 작업은 되돌릴 수 없습니다."}
              {dangerModal === "dividends" &&
                "모든 배당금 수령 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다."}
              {dangerModal === "account" &&
                "계정이 로그아웃되며, 완전한 삭제는 Supabase 대시보드에서 진행해주세요."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDangerModal(null)}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDangerAction}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "처리 중..." : "삭제 확정"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div
        className="w-1.5 shrink-0"
        style={{ background: getCategoryColor(h.category) }}
      />
      <div className="flex-1 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{h.name}</p>
            <p className="text-xs text-zinc-400">
              {h.code} · {h.category}/{h.sub_category} · {h.shares}주 보유
            </p>
          </div>
          {h.shares === 0 && (
            <button
              onClick={() => onDelete(h.id)}
              className="text-zinc-300 hover:text-red-500 transition-colors"
            >
              <svg
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
            <label className="block text-[11px] text-zinc-400 mb-0.5">
              현재가 (원)
            </label>
            <input
              type="text"
              inputMode="numeric"
              defaultValue={h.current_price.toLocaleString()}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                onUpdate(h.id, "current_price", v);
              }}
              className="w-full h-8 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-0.5">
              목표비중 (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={h.target_pct}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                onUpdate(h.id, "target_pct", v);
              }}
              className="w-full h-8 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
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
      className="w-full flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900 px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
    >
      <div>
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {label}
        </p>
        <p className="text-xs text-zinc-400">{desc}</p>
      </div>
      <svg
        className="w-4 h-4 text-red-400 shrink-0"
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
