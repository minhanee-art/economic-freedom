"use client";

import { useState, useMemo } from "react";
import { formatFullKRW, formatKRW, cn } from "@/lib/utils";
import { DividendBarChart } from "@/components/charts/dividend-bar-chart";

interface HoldingOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface DividendRow {
  id: string;
  holding_id: string;
  amount: number;
  date: string;
  memo: string | null;
  created_at: string;
  holdings: { name: string; code: string } | null;
}

interface Props {
  holdings: HoldingOption[];
  initialDividends: DividendRow[];
  userId: string;
}

export function DividendClient({ holdings, initialDividends, userId }: Props) {
  const [dividends, setDividends] = useState(initialDividends);
  const [holdingId, setHoldingId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // 요약 계산
  const totalAmount = dividends.reduce((s, d) => s + d.amount, 0);
  const thisYear = new Date().getFullYear();
  const yearAmount = dividends
    .filter((d) => d.date.startsWith(String(thisYear)))
    .reduce((s, d) => s + d.amount, 0);

  // 월별 차트 데이터
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    dividends.forEach((d) => {
      const month = d.date.slice(0, 7); // YYYY-MM
      map.set(month, (map.get(month) ?? 0) + d.amount);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: month.slice(2), // YY-MM
        amount,
      }));
  }, [dividends]);

  const handleAdd = async () => {
    if (!holdingId || !amount) return;
    setIsAdding(true);

    try {
      const res = await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId,
          amount: parseInt(amount.replace(/[^0-9]/g, "")),
          date,
          memo: memo || null,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      const data = await res.json();

      setDividends([data, ...dividends]);
      setHoldingId("");
      setAmount("");
      setMemo("");
    } catch (err) {
      alert(`추가 실패: ${(err as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 배당 기록을 삭제하시겠습니까?")) return;

    try {
      const res = await fetch("/api/dividends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      setDividends(dividends.filter((d) => d.id !== id));
    } catch (err) {
      alert(`삭제 실패: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div
        className="rounded-xl px-5 py-5 text-white"
        style={{
          background: "linear-gradient(135deg, #1a1f36 0%, #2d3250 100%)",
        }}
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">총 누적 배당</p>
            <p className="text-lg font-bold">{formatKRW(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">{thisYear}년 배당</p>
            <p className="text-lg font-bold">{formatKRW(yearAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">배당 횟수</p>
            <p className="text-lg font-bold">{dividends.length}회</p>
          </div>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">배당금 추가</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">종목</label>
            <select
              value={holdingId}
              onChange={(e) => setHoldingId(e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">종목 선택</option>
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              배당금액 (원)
            </label>
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
            <label className="block text-xs text-zinc-500 mb-1">
              메모 (선택)
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 분기배당"
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={!holdingId || !amount || isAdding}
          className="w-full h-10 rounded-lg bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "배당금 추가"}
        </button>
      </div>

      {/* 월별 차트 */}
      {monthlyData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold mb-3">월별 배당금</h3>
          <DividendBarChart data={monthlyData} />
        </div>
      )}

      {/* 배당 내역 리스트 */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          배당 내역 ({dividends.length})
        </h3>
        {dividends.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">
            아직 배당 기록이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {dividends.map((d) => (
              <div
                key={d.id}
                className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {d.holdings?.name ?? "알 수 없음"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {d.date}
                    {d.memo && ` · ${d.memo}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mx-3">
                  {formatFullKRW(d.amount)}
                </p>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
