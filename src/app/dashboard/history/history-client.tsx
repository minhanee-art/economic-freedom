"use client";

import { useState } from "react";
import { formatFullKRW, formatKRW } from "@/lib/utils";
import type { PurchaseRecord, PurchaseItem, Holding } from "@/types";
import { ImportClient } from "./import-client";

interface RecordWithItems extends PurchaseRecord {
  purchase_items: PurchaseItem[];
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
  const hasMore = records.length < totalCount;

  // 누적 통계
  const totalSpent = records.reduce((s, r) => s + r.total_spent, 0);
  const totalRecords = totalCount;
  const monthlyAvg =
    totalRecords > 0 ? Math.round(totalSpent / totalRecords) : 0;

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const offset = records.length;
      const res = await fetch(`/api/purchases?offset=${offset}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const { records: more } = await res.json();
      if (Array.isArray(more) && more.length) setRecords([...records, ...more]);
    } catch {
      alert("기록을 더 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 누적 통계 */}
      <div
        className="rounded-xl px-5 py-5 text-white"
        style={{
          background: "linear-gradient(135deg, #1a1f36 0%, #2d3250 100%)",
        }}
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">총 투입금액</p>
            <p className="text-lg font-bold">{formatKRW(totalSpent)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">매수 횟수</p>
            <p className="text-lg font-bold">{totalRecords}회</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">회당 평균</p>
            <p className="text-lg font-bold">{formatKRW(monthlyAvg)}</p>
          </div>
        </div>
      </div>

      {/* 가져오기 버튼 */}
      <button
        onClick={() => setShowImport(true)}
        className="w-full h-10 rounded-xl border border-indigo-200 dark:border-indigo-800 text-sm font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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
        <p className="text-sm text-zinc-400 py-8 text-center">
          아직 매수 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? "불러오는 중..." : "더 보기"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RecordCard({ record }: { record: RecordWithItems }) {
  const items = record.purchase_items ?? [];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold">{record.date}</span>
        <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {formatFullKRW(record.total_spent)}
        </span>
      </div>

      {/* 종목별 상세 */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <div key={item.id} className="flex items-center px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-zinc-400">{item.code}</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-sm font-semibold">{item.quantity}주</p>
              <p className="text-xs text-zinc-400">
                ₩{item.price_at_purchase.toLocaleString()} × {item.quantity} ={" "}
                {formatFullKRW(item.cost)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
