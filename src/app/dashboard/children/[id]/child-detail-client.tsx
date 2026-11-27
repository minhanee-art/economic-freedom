"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChildRow, ChildGiftRow, ChildHoldingRow } from "@/lib/queries";
import { GiftProgressCard } from "@/components/gift/gift-progress-card";
import { GiftTaxGuide } from "@/components/gift/gift-tax-guide";
import { presentValueOfInstallments } from "@/lib/gift-tax";
import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { failureMessage } from "@/components/dashboard/inline-error";
import { formatKRW, formatKRWFull, formatSignedKRW, pnlTextClass, cn } from "@/lib/utils";

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

function parseMoney(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildInstallmentRows(startDate: string, monthlyAmount: number, months: number) {
  if (!startDate || monthlyAmount <= 0 || months <= 0) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const rows = new Map<number, { year: number; installmentYear: number; count: number; principal: number; pv: number }>();

  for (let i = 0; i < months; i++) {
    const paymentDate = addMonths(start, i);
    const year = paymentDate.getFullYear();
    const existing = rows.get(year) ?? {
      year,
      installmentYear: year - start.getFullYear() + 1,
      count: 0,
      principal: 0,
      pv: 0,
    };

    existing.count += 1;
    existing.principal += monthlyAmount;
    existing.pv += monthlyAmount / Math.pow(1 + 0.03 / 12, i + 1);
    rows.set(year, existing);
  }

  return Array.from(rows.values()).map((row) => ({ ...row, pv: Math.round(row.pv) }));
}

export function ChildDetailClient({ child, initialGifts, initialHoldings }: Props) {
  const [tab, setTab] = useState<Tab>("gifts");
  const [gifts, setGifts] = useState(initialGifts);
  const [holdings, setHoldings] = useState(initialHoldings);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/children" className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-indigo-500">
          ← 자녀 목록
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-ink">{child.name}</h1>
      </div>

      <GiftProgressCard birthDate={child.birth_date} gifts={gifts} />

      {/* 탭 */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1">
        {([
          ["gifts", "입금/증여 기록"],
          ["holdings", "보유 종목"],
          ["guide", "신고 가이드"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 h-9 text-sm font-medium transition-colors",
              tab === key
                ? "bg-white dark:bg-zinc-900 text-indigo-500 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "gifts" && <GiftsTab childId={child.id} childName={child.name} gifts={gifts} setGifts={setGifts} />}
      {tab === "holdings" && <HoldingsTab childId={child.id} holdings={holdings} setHoldings={setHoldings} />}
      {tab === "guide" && <GiftTaxGuide />}
    </div>
  );
}

function GiftsTab({
  childId,
  childName,
  gifts,
  setGifts,
}: {
  childId: string;
  childName: string;
  gifts: ChildGiftRow[];
  setGifts: (g: ChildGiftRow[]) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [giftType, setGiftType] = useState<ChildMoneyType>("lump");
  const [memo, setMemo] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirmDialog();

  // 분할(정기금) 계산 보조 — 월 납입액 × 개월수를 3% 할인율로 현재가치 환산 (참고용)
  const [installMonthly, setInstallMonthly] = useState("");
  const [installMonths, setInstallMonths] = useState("");
  const pv =
    installMonthly && installMonths
      ? presentValueOfInstallments(parseMoney(installMonthly), Number(installMonths))
      : 0;
  const monthlyInstallmentAmount = parseMoney(installMonthly);
  const installmentMonthCount = Number(installMonths) || 0;
  const installmentRows = buildInstallmentRows(date, monthlyInstallmentAmount, installmentMonthCount);
  const installmentPrincipal = monthlyInstallmentAmount * installmentMonthCount;
  const installmentLastDate = date && installmentMonthCount > 0
    ? toDateInputValue(addMonths(new Date(`${date}T00:00:00`), installmentMonthCount - 1))
    : "";
  const paymentDay = date ? new Date(`${date}T00:00:00`).getDate() : 1;

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
    if (!res.ok) {
      setError(failureMessage("신고 여부를 변경", new Error(`서버 응답 ${res.status}`)));
      return;
    }
    setError("");
    const data = await res.json();
    setGifts(gifts.map((x) => (x.id === g.id ? data : x)));
  };

  const handleDelete = async (id: string) => {
    const target = gifts.find((g) => g.id === id);
    const ok = await confirm({
      title: "이 증여 기록을 삭제하시겠습니까?",
      body: target ? `${target.date} · ${formatKRWFull(Number(target.amount))}` : undefined,
      confirmLabel: "기록 삭제",
    });
    if (!ok) return;
    const res = await fetch(`/api/children/${childId}/gifts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setError("");
      setGifts(gifts.filter((g) => g.id !== id));
    } else setError(failureMessage("증여 기록을 삭제", new Error(`서버 응답 ${res.status}`)));
  };

  return (
    <div className="space-y-4">
      {dialog}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold">입금/증여 기록 추가</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          정부·지자체에서 자녀 계좌로 직접 지급되는 돈은 “정부지원금”으로 기록하면 증여 한도 계산과 신고 관리에서 제외됩니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setGiftType("lump")}
            className={cn(
              "flex-1 h-9 text-xs font-medium border transition-colors",
              giftType === "lump"
                ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
            )}
          >
            일괄 증여
          </button>
          <button
            onClick={() => setGiftType("installment")}
            className={cn(
              "flex-1 h-9 text-xs font-medium border transition-colors",
              giftType === "installment"
                ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
            )}
          >
            분할(정기금) 증여
          </button>
          <button
            onClick={() => setGiftType("government_support")}
            className={cn(
              "flex-1 h-9 text-xs font-medium border transition-colors",
              giftType === "government_support"
                ? "border-brand bg-canvas-soft text-success"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
            )}
          >
            정부지원금
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="child-detail-1" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">날짜</label>
            <input id="child-detail-1"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label htmlFor="child-detail-2" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">금액 (원)</label>
            <input id="child-detail-2"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setAmount(v ? parseInt(v).toLocaleString() : "");
              }}
              placeholder="0"
              className="w-full h-10 border border-zinc-200 bg-white px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
        <div>
          <label htmlFor="child-detail-3" className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">메모 (선택)</label>
          <input id="child-detail-3"
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
            className="w-full h-10 border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        {giftType === "government_support" && (
          <div className="bg-canvas-soft p-3 text-xs text-success">
            국가·지자체 지원금, 아동수당, 부모급여처럼 지급 주체가 부모가 아니고 자녀 계좌로 직접 들어온 돈은
            증여로 보지 않는 별도 입금으로 관리합니다. 단, 부모가 받은 돈을 다시 자녀에게 넘기는 구조라면
            사실관계에 따라 증여 이슈가 생길 수 있으니 증빙을 함께 보관하세요.
          </div>
        )}

        {giftType === "installment" && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-3">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              유기정기금 계약서·평가명세서 미리보기 (참고용 — 실제 신고는 홈택스 자동계산으로 확인)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="월 납입액(원)"
                type="text"
                inputMode="numeric"
                value={installMonthly}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setInstallMonthly(v ? parseInt(v).toLocaleString() : "");
                }}
                placeholder="월 납입액(원)"
                className="h-9 border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input aria-label="개월 수"
                type="text"
                inputMode="numeric"
                value={installMonths}
                onChange={(e) => setInstallMonths(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="개월 수"
                className="h-9 border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            {pv > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">정기금 시작일</p>
                    <p className="text-xs font-semibold">{date}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">정기금 마지막일</p>
                    <p className="text-xs font-semibold">{installmentLastDate}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">지급 시기</p>
                    <p className="text-xs font-semibold">매월 {paymentDay}일</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">할인율</p>
                    <p className="text-xs font-semibold">연 3%</p>
                  </div>
                </div>

                <div className="border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-3 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  <b>{childName}</b>에게 매월 <b>{formatKRWFull(monthlyInstallmentAmount)}</b>씩 {installmentMonthCount}개월 지급하는 계약입니다.
                  원금 합계는 <b>{formatKRWFull(installmentPrincipal)}</b>, 연 3% 할인율 추정 평가액은 <b>{formatKRWFull(pv)}</b>입니다.
                </div>

                <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">표가 넓으면 좌우로 밀어 보세요</p>

                <div tabIndex={0} role="region" aria-label="정기금 연도별 표" className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  <table className="w-full text-xs">

                  <caption className="sr-only">유기정기금 연도별 원금과 추정 평가액</caption>
                    <thead className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th scope="col" className="text-left font-medium px-2 py-1.5">년도</th>
                        <th scope="col" className="text-right font-medium px-2 py-1.5">불입년도</th>
                        <th scope="col" className="text-right font-medium px-2 py-1.5">횟수</th>
                        <th scope="col" className="text-right font-medium px-2 py-1.5">불입원금</th>
                        <th scope="col" className="text-right font-medium px-2 py-1.5">할인평가액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installmentRows.map((row) => (
                        <tr key={row.year} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                          <td className="px-2 py-1.5">{row.year}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.installmentYear}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.count}개월</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKRWFull(row.principal)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKRWFull(row.pv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  증여계약서와 유기정기금 평가명세서에 옮겨 적을 값입니다. 할인평가액은 참고용 추정치이니 신고 전 홈택스 자동계산 결과와 맞는지 확인하세요.
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-xs leading-relaxed text-danger">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!date || !amount || isAdding}
          className="w-full h-10 bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "입금 기록 추가"}
        </button>
      </div>

      {gifts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">아직 입금/증여 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {gifts.map((g) => (
            <div
              key={g.id}
              className="flex items-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 text-xs font-medium",
                      g.gift_type === "government_support"
                        ? "bg-canvas-soft text-success"
                        : g.gift_type === "installment"
                        ? "bg-caution-soft text-caution"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {GIFT_TYPE_LABEL[g.gift_type] ?? g.gift_type}
                  </span>
                  {NON_GIFT_TYPES.has(g.gift_type) && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-canvas-soft text-ink">
                      비증여
                    </span>
                  )}
                  {g.reported && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-canvas-soft text-success">
                      신고완료
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {g.date}
                  {g.memo && ` · ${g.memo}`}
                </p>
              </div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mx-3">
                {formatKRWFull(g.amount)}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {NON_GIFT_TYPES.has(g.gift_type) ? (
                  <span className="text-xs px-2 py-1 border border-hairline text-success">
                    신고제외
                  </span>
                ) : (
                  <button
                    onClick={() => toggleReported(g)}
                    className={cn(
                      "text-xs px-2 py-1 border transition-colors",
                      g.reported
                        ? "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                        : "border-indigo-200 dark:border-indigo-800 text-indigo-500"
                    )}
                  >
                    {g.reported ? "신고취소" : "신고완료"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(g.id)}
                  aria-label={`${g.date} 입금·증여 기록 삭제`}
                  className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
  const { confirm, dialog } = useConfirmDialog();

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
    const target = holdings.find((h) => h.id === id);
    const ok = await confirm({
      title: `${target?.name ?? "이 종목"}을(를) 삭제하시겠습니까?`,
      body: "이 자녀 계좌의 보유 종목에서 빠집니다.",
      confirmLabel: "종목 삭제",
    });
    if (!ok) return;
    const res = await fetch(`/api/children/${childId}/holdings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setError("");
      setHoldings(holdings.filter((h) => h.id !== id));
    } else setError(failureMessage(`${target?.name ?? "종목"}을(를) 삭제`, new Error(`서버 응답 ${res.status}`)));
  };

  return (
    <div className="space-y-4">
      {dialog}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold">보유 종목 추가</h2>
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="종목코드"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="종목코드"
            className="h-10 border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input aria-label="종목명"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="종목명"
            className="h-10 border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input aria-label="보유 수량"
            type="text"
            inputMode="numeric"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="보유 수량"
            className="h-10 border border-zinc-200 bg-white px-3 text-sm text-right dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input aria-label="평균 매수가"
            type="text"
            inputMode="numeric"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder="평균 매수가"
            className="h-10 border border-zinc-200 bg-white px-3 text-sm text-right dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input aria-label="현재가"
            type="text"
            inputMode="numeric"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="현재가"
            className="h-10 border border-zinc-200 bg-white px-3 text-sm text-right col-span-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        {error && <p role="alert" className="text-xs leading-relaxed text-danger">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!code.trim() || !name.trim() || isAdding}
          className="w-full h-10 bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "종목 추가"}
        </button>
      </div>

      {holdings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">등록된 보유 종목이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => {
            const currentValue = h.shares * h.current_price;
            const costValue = h.shares * h.avg_price;
            const pnl = currentValue - costValue;
            return (
              <div
                key={h.id}
                className="flex items-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{h.code} · {h.shares}주</p>
                </div>
                <div className="text-right mx-3">
                  <p className="text-sm font-semibold">{formatKRW(currentValue)}</p>
                  {costValue > 0 && (
                    <p className={cn("text-xs tabular-nums", pnlTextClass(pnl))}>
                      {formatSignedKRW(pnl)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  aria-label={`${h.name} 종목 삭제`}
                  className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
