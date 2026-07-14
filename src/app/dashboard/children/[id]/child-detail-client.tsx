"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChildRow, ChildGiftRow, ChildHoldingRow } from "@/lib/queries";
import { GiftProgressCard } from "@/components/gift/gift-progress-card";
import { GiftTaxGuide } from "@/components/gift/gift-tax-guide";
import { presentValueOfInstallments } from "@/lib/gift-tax";
import { formatKRW, formatFullKRW, cn } from "@/lib/utils";

interface Props {
  child: ChildRow;
  initialGifts: ChildGiftRow[];
  initialHoldings: ChildHoldingRow[];
}

type Tab = "gifts" | "holdings" | "guide";
type ChildMoneyType = "lump" | "installment" | "government_support";

const GIFT_TYPE_LABEL: Record<string, string> = {
  lump: "일괄 증여",
  installment: "분할(정기금) 증여",
  government_support: "정부지원금",
};

const NON_GIFT_TYPES = new Set(["government_support"]);

export function ChildDetailClient({ child, initialGifts, initialHoldings }: Props) {
  const [tab, setTab] = useState<Tab>("gifts");
  const [gifts, setGifts] = useState(initialGifts);
  const [holdings, setHoldings] = useState(initialHoldings);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/children" className="text-xs text-zinc-400 hover:text-indigo-500">
          ← 자녀 목록
        </Link>
        <h2 className="text-lg font-bold mt-1">{child.name}</h2>
      </div>

      <GiftProgressCard birthDate={child.birth_date} gifts={gifts} />

      {/* 탭 */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
        {([
          ["gifts", "입금/증여 기록"],
          ["holdings", "보유 종목"],
          ["guide", "신고 가이드"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 h-9 rounded-md text-sm font-medium transition-colors",
              tab === key
                ? "bg-white dark:bg-zinc-900 text-indigo-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "gifts" && <GiftsTab childId={child.id} gifts={gifts} setGifts={setGifts} />}
      {tab === "holdings" && <HoldingsTab childId={child.id} holdings={holdings} setHoldings={setHoldings} />}
      {tab === "guide" && <GiftTaxGuide />}
    </div>
  );
}

function GiftsTab({
  childId,
  gifts,
  setGifts,
}: {
  childId: string;
  gifts: ChildGiftRow[];
  setGifts: (g: ChildGiftRow[]) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [giftType, setGiftType] = useState<ChildMoneyType>("lump");
  const [memo, setMemo] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  // 분할(정기금) 계산 보조 — 월 납입액 × 개월수를 3% 할인율로 현재가치 환산 (참고용)
  const [installMonthly, setInstallMonthly] = useState("");
  const [installMonths, setInstallMonths] = useState("");
  const pv =
    installMonthly && installMonths
      ? presentValueOfInstallments(Number(installMonthly.replace(/[^0-9]/g, "")), Number(installMonths))
      : 0;

  const handleAdd = async () => {
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!date || !amt) return;
    setIsAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/children/${childId}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, amount: amt, giftType, memo: memo || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setGifts([data, ...gifts]);
      setAmount("");
      setMemo("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleReported = async (g: ChildGiftRow) => {
    const res = await fetch(`/api/children/${childId}/gifts/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reported: !g.reported,
        reportDate: !g.reported ? new Date().toISOString().split("T")[0] : null,
      }),
    });
    if (!res.ok) return alert("변경 실패");
    const data = await res.json();
    setGifts(gifts.map((x) => (x.id === g.id ? data : x)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 증여 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/children/${childId}/gifts/${id}`, { method: "DELETE" });
    if (res.ok) setGifts(gifts.filter((g) => g.id !== id));
    else alert("삭제 실패");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">입금/증여 기록 추가</h3>
        <p className="text-xs text-zinc-400">
          정부·지자체에서 자녀 계좌로 직접 지급되는 돈은 “정부지원금”으로 기록하면 증여 한도 계산과 신고 관리에서 제외됩니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setGiftType("lump")}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium border transition-colors",
              giftType === "lump"
                ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
            )}
          >
            일괄 증여
          </button>
          <button
            onClick={() => setGiftType("installment")}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium border transition-colors",
              giftType === "installment"
                ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
            )}
          >
            분할(정기금) 증여
          </button>
          <button
            onClick={() => setGiftType("government_support")}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium border transition-colors",
              giftType === "government_support"
                ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
            )}
          >
            정부지원금
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">금액 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setAmount(v ? parseInt(v).toLocaleString() : "");
              }}
              placeholder="0"
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">메모 (선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={
              giftType === "installment"
                ? "예: 월 20만원 × 10년 정기금 계약"
                : giftType === "government_support"
                  ? "예: 아동수당, 부모급여, 지자체 지원금"
                  : "예: 세뱃돈, 입학축하금"
            }
            className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        {giftType === "government_support" && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            국가·지자체 지원금, 아동수당, 부모급여처럼 지급 주체가 부모가 아니고 자녀 계좌로 직접 들어온 돈은
            증여로 보지 않는 별도 입금으로 관리합니다. 단, 부모가 받은 돈을 다시 자녀에게 넘기는 구조라면
            사실관계에 따라 증여 이슈가 생길 수 있으니 증빙을 함께 보관하세요.
          </div>
        )}

        {giftType === "installment" && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-2">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              유기정기금 현재가치 계산기 (참고용 — 실제 신고는 홈택스 자동계산으로 확인)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={installMonthly}
                onChange={(e) => setInstallMonthly(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="월 납입액(원)"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="text"
                inputMode="numeric"
                value={installMonths}
                onChange={(e) => setInstallMonths(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="개월 수"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            {pv > 0 && (
              <p className="text-xs text-zinc-500">
                현재가치(참고): <span className="font-semibold text-indigo-500">{formatFullKRW(pv)}</span>
                {" "}(연 3% 할인율 적용 추정치)
              </p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!date || !amount || isAdding}
          className="w-full h-10 rounded-lg bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "입금 기록 추가"}
        </button>
      </div>

      {gifts.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">아직 입금/증여 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {gifts.map((g) => (
            <div
              key={g.id}
              className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      g.gift_type === "government_support"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : g.gift_type === "installment"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {GIFT_TYPE_LABEL[g.gift_type] ?? g.gift_type}
                  </span>
                  {NON_GIFT_TYPES.has(g.gift_type) && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                      비증여
                    </span>
                  )}
                  {g.reported && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      신고완료
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {g.date}
                  {g.memo && ` · ${g.memo}`}
                </p>
              </div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mx-3">
                {formatFullKRW(g.amount)}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {NON_GIFT_TYPES.has(g.gift_type) ? (
                  <span className="text-[11px] px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                    신고제외
                  </span>
                ) : (
                  <button
                    onClick={() => toggleReported(g)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md border transition-colors",
                      g.reported
                        ? "border-zinc-200 dark:border-zinc-700 text-zinc-400"
                        : "border-indigo-200 dark:border-indigo-800 text-indigo-500"
                    )}
                  >
                    {g.reported ? "신고취소" : "신고완료"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(g.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors"
                  aria-label="삭제"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingsTab({
  childId,
  holdings,
  setHoldings,
}: {
  childId: string;
  holdings: ChildHoldingRow[];
  setHoldings: (h: ChildHoldingRow[]) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!code.trim() || !name.trim()) return;
    setIsAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/children/${childId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          shares: Number(shares.replace(/[^0-9]/g, "")) || 0,
          avgPrice: Number(avgPrice.replace(/[^0-9]/g, "")) || 0,
          currentPrice: Number(currentPrice.replace(/[^0-9]/g, "")) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setHoldings([...holdings.filter((h) => h.code !== data.code), data]);
      setCode("");
      setName("");
      setShares("");
      setAvgPrice("");
      setCurrentPrice("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 종목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/children/${childId}/holdings/${id}`, { method: "DELETE" });
    if (res.ok) setHoldings(holdings.filter((h) => h.id !== id));
    else alert("삭제 실패");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">보유 종목 추가</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="종목코드"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="종목명"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            inputMode="numeric"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="보유 수량"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            inputMode="numeric"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder="평균 매수가"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            inputMode="numeric"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="현재가"
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-right col-span-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!code.trim() || !name.trim() || isAdding}
          className="w-full h-10 rounded-lg bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "종목 추가"}
        </button>
      </div>

      {holdings.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">등록된 보유 종목이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => {
            const currentValue = h.shares * h.current_price;
            const costValue = h.shares * h.avg_price;
            const pnl = currentValue - costValue;
            return (
              <div
                key={h.id}
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-zinc-400">{h.code} · {h.shares}주</p>
                </div>
                <div className="text-right mx-3">
                  <p className="text-sm font-semibold">{formatKRW(currentValue)}</p>
                  {costValue > 0 && (
                    <p className={cn("text-xs", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {pnl >= 0 ? "+" : ""}{formatKRW(pnl)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                  aria-label="삭제"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
