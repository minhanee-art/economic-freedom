"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatKRWFull, formatKRW } from "@/lib/utils";
import type { PurchaseRecord, PurchaseItem, Holding } from "@/types";
import { NoHoldingsState, noHoldingsSecondaryClass } from "@/components/portfolio/no-holdings-state";
import { ImportClient } from "./import-client";
import { useConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { InlineError, failureMessage } from "@/components/dashboard/inline-error";

interface RecordWithItems extends PurchaseRecord {
  purchase_items: PurchaseItem[] | null;
}

interface Props {
  initialRecords: RecordWithItems[];
  totalCount: number;
  userId: string;
  holdings: Holding[];
}

const PAGE_SIZE = 20;

export function HistoryClient({ initialRecords, totalCount, userId, holdings }: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  const router = useRouter();
  const hasMore = records.length < totalCount;

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  // 누적 통계
  const totalSpent = records.reduce((s, r) => s + r.total_spent, 0);
  const totalRecords = totalCount;
  const monthlyAvg =
    totalRecords > 0 ? Math.round(totalSpent / totalRecords) : 0;

  const loadMore = async () => {
    setIsLoadingMore(true);
    setError(null);
    try {
      const offset = records.length;
      const res = await fetch(`/api/purchases?offset=${offset}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const { records: more } = await res.json();
      if (Array.isArray(more) && more.length) setRecords([...records, ...more]);
    } catch {
      setError({ message: failureMessage("기록을 더 불러오지", new Error("")), retry: loadMore });
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 매수 기록 한 건 삭제 — 서버가 보유 수량·원가를 함께 되돌린다
  const deleteRecord = async (record: RecordWithItems) => {
    const summary = (record.purchase_items ?? []).map((item) => `${item.name} ${item.quantity.toLocaleString()}주`).join(", ");
    const ok = await confirm({
      title: `${record.date} 매수 기록을 삭제할까요?`,
      body: `${summary}\n\n보유 수량과 원가에서도 이 매수분이 빠집니다.`,
      confirmLabel: "기록 삭제",
    });
    if (!ok) return;
    setDeletingId(record.id);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${record.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "삭제 실패");
      }
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      router.refresh();
    } catch (err) {
      setError({ message: failureMessage(`${record.date} 매수 기록을 삭제`, err), retry: () => deleteRecord(record) });
    } finally {
      setDeletingId(null);
    }
  };

  // 종목도 기록도 없는 계좌 — 0원 통계 대신 빈 상태. CSV 가져오기는 종목을 함께 만들 수 있어 그대로 둔다
  if (holdings.length === 0 && records.length === 0) {
    return (
      <div className="space-y-5">
        <NoHoldingsState pageTitle="매수 기록" description="매수 기록은 추가한 종목에 남깁니다. 종목을 추가하면서 이미 산 수량과 단가를 넣거나, 증권사 거래내역 CSV를 가져오면 기록이 여기에 쌓입니다.">
          <button type="button" onClick={() => setShowImport(true)} className={noHoldingsSecondaryClass}>
            증권사 거래내역 가져오기 (CSV)
          </button>
        </NoHoldingsState>
        {showImport && <ImportClient holdings={holdings} userId={userId} onClose={() => setShowImport(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight text-ink">매수 기록</h1>
      {dialog}
      {error && <InlineError message={error.message} onRetry={error.retry} onDismiss={() => setError(null)} />}
      {/* 누적 통계 */}
      <div
        className="border border-hairline bg-surface px-6 py-6 shadow-card dark:border-zinc-800"
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-ink-mute mb-1">
              총 투입금액
            </p>
            <p className="text-base font-semibold tabular-nums tracking-tight text-ink sm:text-xl">
              {formatKRW(totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-mute mb-1">
              매수 횟수
            </p>
            <p className="text-base font-semibold tabular-nums tracking-tight text-ink sm:text-xl">
              {totalRecords}회
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-mute mb-1">
              회당 평균
            </p>
            <p className="text-base font-semibold tabular-nums tracking-tight text-ink sm:text-xl">
              {formatKRW(monthlyAvg)}
            </p>
          </div>
        </div>
      </div>

      {/* 가져오기 버튼 */}
      <button
        onClick={() => setShowImport(true)}
        className="w-full h-11 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-indigo-600 dark:text-indigo-300 shadow-card hover:shadow-float hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        증권사 거래내역 가져오기 (CSV)
      </button>

      {/* 가져오기 모달 */}
      {showImport && (
        <ImportClient
          holdings={holdings}
          userId={userId}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* 기록 리스트 */}
      {records.length === 0 ? (
        <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-card py-12 text-center">
          <p className="text-sm text-ink-mute dark:text-zinc-400">
            아직 매수 기록이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              isDeleting={deletingId === record.id}
              onDelete={() => deleteRecord(record)}
            />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full h-11 border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-ink-mute dark:text-zinc-400 shadow-card hover:shadow-float hover:bg-canvas-soft dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? "불러오는 중..." : "더 보기"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RecordCard({
  record,
  isDeleting,
  onDelete,
}: {
  record: RecordWithItems;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const items = record.purchase_items ?? [];

  return (
    <div className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-card transition-shadow hover:shadow-float">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-canvas-soft dark:bg-zinc-800/50 border-b border-hairline dark:border-zinc-800">
        <span className="text-sm font-semibold text-ink dark:text-zinc-100 tabular-nums">{record.date}</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center bg-indigo-50 dark:bg-indigo-900/30 px-3 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 tabular-nums">
            {formatKRWFull(record.total_spent)}
          </span>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={`${record.date} 매수 기록 삭제`}
            className="-my-2 -mr-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-danger transition-colors disabled:opacity-50"
          >
            {isDeleting ? "삭제 중" : "삭제"}
          </button>
        </div>
      </div>

      {/* 종목별 상세 */}
      <div className="divide-y divide-hairline dark:divide-zinc-800">
        {items.map((item) => (
          <div key={item.id} className="flex items-center px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-ink dark:text-zinc-100" title={item.name}>{item.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{item.code}</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-sm font-semibold tabular-nums text-ink dark:text-zinc-100">{item.quantity.toLocaleString()}주</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {formatKRWFull(item.price_at_purchase)} × {item.quantity.toLocaleString()}주 ={" "}
                {formatKRWFull(item.cost)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
