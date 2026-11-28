"use client";

// 설정 > 투자 설정 — 월 적립금(따로 저장), 목표 비중 합계, 종목 관리(현재가·목표 비중 자동 저장, 추가·삭제).
import { failureMessage } from "@/components/dashboard/inline-error";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { cn, formatAmountInput, missingFields, parseAmountInput } from "@/lib/utils";
import { getCategoryColor } from "@/lib/colors";
import { CATEGORIES } from "@/lib/constants";
import type { Holding } from "@/types";
import { SaveButton, SaveMessage, type SaveState } from "@/components/settings/save-status";
import { panelClass, type SettingsTools } from "@/components/settings/settings-shared";

type HoldingGroupBy = "none" | "category" | "sub_category";

interface Props {
  initialMonthlyBudget: number;
  holdings: Holding[];
  tools: SettingsTools;
}

export function InvestTab({ initialMonthlyBudget, holdings: initialHoldings, tools }: Props) {
  const { flash, showError, confirm } = tools;
  const [holdings, setHoldings] = useState(initialHoldings);
  const [budgetInput, setBudgetInput] = useState(initialMonthlyBudget ? formatAmountInput(initialMonthlyBudget) : "");
  const [budgetState, setBudgetState] = useState<SaveState>({ kind: "idle" });

  // 새 종목 추가
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("주식");
  const [newSubCategory, setNewSubCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [holdingGroupBy, setHoldingGroupBy] = useState<HoldingGroupBy>("none");
  const totalTargetPct = holdings.reduce((s, h) => s + Number(h.target_pct), 0);

  // 서버가 다시 그려 종목이 바뀌면(데이터 삭제 뒤 새로고침) 따라간다(렌더 중 맞추기)
  const [seenHoldings, setSeenHoldings] = useState(initialHoldings);
  if (initialHoldings !== seenHoldings) {
    setSeenHoldings(initialHoldings);
    setHoldings(initialHoldings);
  }

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

  // 월 적립금만 보낸다 — API 는 보낸 값만 바꾸므로 표시 이름은 그대로 남는다.
  const saveBudget = async (event?: FormEvent) => {
    event?.preventDefault();
    const monthlyBudget = Number(parseAmountInput(budgetInput)) || 0;
    setBudgetState({ kind: "saving" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget }),
      });
      if (!res.ok) throw new Error();
      setBudgetState({ kind: "done", message: monthlyBudget ? "월 적립금을 저장했습니다." : "월 적립금을 비웠습니다(미설정)." });
      flash("월 적립금 저장됨");
    } catch {
      setBudgetState({ kind: "error", message: "월 적립금을 저장하지 못했습니다. 잠시 후 다시 눌러 주세요." });
    }
  };

  // 종목 필드 debounce 저장
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const updateHolding = useCallback(
    (id: string, field: string, value: number) => {
      // 로컬 즉시 반영
      setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));

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
    [flash]
  );

  // 종목 추가
  const handleAddHolding = async () => {
    const lack = missingFields([[Boolean(newCode), "종목코드"], [Boolean(newName), "종목명"], [Boolean(newSubCategory), "세부 분류"]]);
    if (lack.length) { showError({ message: `${lack.join("·")}을(를) 입력해 주세요.` }); return; }
    showError(null);
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
      showError({ message: failureMessage("추가", err) });
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
    if (!res.ok) { showError({ message: failureMessage(`${h.name}을(를) 삭제`, new Error(`서버 응답 ${res.status}`)) }); } else {
      setHoldings(holdings.filter((h) => h.id !== id));
      flash("종목 삭제됨");
    }
  };

  return (
    <div className="space-y-5">
      {/* 월 적립금 — 따로 저장 */}
      <section aria-labelledby="settings-monthly-budget" className={panelClass}>
        {/* 제목이 곧 입력칸 라벨이다. 단위 "원"은 칸 안 오른쪽에 있다 */}
        <h2 id="settings-monthly-budget" className="text-base font-bold tracking-tight text-ink">
          <label htmlFor="settings-field-2">월 적립금</label>
        </h2>
        <form onSubmit={saveBudget} className="space-y-2">
          <p id="settings-monthly-budget-help" className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            매달 넣을 금액입니다. 홈 요약과 &lsquo;적립 배분 계산&rsquo;이 이 금액을 목표 비중대로 나눠 보여 줍니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-48">
              <input
                id="settings-field-2"
                name="monthlyBudget"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={budgetInput}
                onChange={(e) => setBudgetInput(formatAmountInput(e.target.value))}
                aria-describedby="settings-monthly-budget-help"
                placeholder="예: 500,000…"
                className="w-full h-11 border border-hairline bg-white pl-3 pr-9 text-sm text-right tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:border-brand dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500 dark:text-zinc-400">원</span>
            </div>
            <SaveButton state={budgetState} label="월 적립금 저장" testId="settings-save-budget" />
          </div>
          <SaveMessage state={budgetState} />
        </form>
      </section>

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
      <section aria-labelledby="settings-holdings" className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 id="settings-holdings" className="text-base font-bold tracking-tight">
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
                  type="button"
                  aria-pressed={holdingGroupBy === opt.value}
                  onClick={() => setHoldingGroupBy(opt.value)}
                  className={cn(
                    "px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    holdingGroupBy === opt.value
                      ? "bg-brand text-white"
                      : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={showAdd}
              onClick={() => setShowAdd(!showAdd)}
              className="border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-indigo-50 dark:hover:bg-zinc-800 shadow-card transition-colors dark:text-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
                  name="code"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="예: 069500…"
                  className="w-full h-9 border border-hairline bg-white transition-colors px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label htmlFor="settings-field-4" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">종목명</label>
                <input id="settings-field-4"
                  name="name"
                  type="text"
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: KODEX 200…"
                  className="w-full h-9 border border-hairline bg-white transition-colors px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label htmlFor="settings-field-5" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">자산군</label>
                <select id="settings-field-5"
                  name="category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-9 border border-hairline bg-white transition-colors px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
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
                  name="subCategory"
                  type="text"
                  autoComplete="off"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  placeholder="예: 국장, 배당…"
                  className="w-full h-9 border border-hairline bg-white transition-colors px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="settings-field-7" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">현재가 (원)</label>
                <input id="settings-field-7"
                  name="currentPrice"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={newPrice}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setNewPrice(v ? parseInt(v).toLocaleString() : "");
                  }}
                  placeholder="0"
                  className="w-full h-9 border border-hairline bg-white transition-colors px-3 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddHolding}
              disabled={isAdding}
              className="w-full h-11 text-sm font-semibold border border-hairline bg-surface text-ink hover:bg-canvas-soft disabled:opacity-50 transition-colors dark:border-zinc-700"
            >
              {isAdding ? "추가 중…" : "종목 추가"}
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
              name={`holding-${h.id}-price`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={h.current_price.toLocaleString()}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                onUpdate(h.id, "current_price", v);
              }}
              className="w-full h-8 border border-hairline bg-canvas-soft px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label htmlFor={`holding-${h.id}-target`} className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">목표 비중 (%)</label>
            <input id={`holding-${h.id}-target`}
              name={`holding-${h.id}-target`}
              type="number"
              step="0.5"
              min="0"
              max="100"
              autoComplete="off"
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
