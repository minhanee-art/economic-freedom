"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChildRow, ChildGiftRow } from "@/lib/queries";
import { GiftProgressCard } from "@/components/gift/gift-progress-card";
import { getAge } from "@/lib/gift-tax";

interface Props {
  initialChildren: ChildRow[];
  gifts: ChildGiftRow[];
}

export function ChildrenClient({ initialChildren, gifts }: Props) {
  const [children, setChildren] = useState(initialChildren);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const giftsByChild = (childId: string) => gifts.filter((g) => g.child_id === childId);

  const handleAdd = async () => {
    if (!name.trim() || !birthDate) return;
    setIsAdding(true);
    setError("");
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), birthDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setChildren([...children, data]);
      setName("");
      setBirthDate("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 자녀 프로필과 증여 기록·보유 종목을 모두 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/children/${id}`, { method: "DELETE" });
    if (res.ok) setChildren(children.filter((c) => c.id !== id));
    else alert("삭제 실패");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">자녀 계좌 관리</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          자녀별 증여 기록·보유 종목을 관리하고 증여세 공제한도를 추적하세요.
        </p>
      </div>

      {/* 자녀 추가 */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">자녀 추가</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민준"
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">생년월일</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !birthDate || isAdding}
          className="w-full h-10 rounded-lg bg-indigo-500 text-white text-sm font-medium transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? "추가 중..." : "자녀 추가"}
        </button>
      </div>

      {/* 자녀 목록 */}
      {children.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">등록된 자녀가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {children.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <Link href={`/dashboard/children/${c.id}`} className="flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-zinc-400">만 {getAge(c.birth_date)}세 · {c.birth_date}</p>
                </Link>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors shrink-0 ml-3"
                  aria-label="삭제"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
              <div className="px-4 pb-4">
                <GiftProgressCard birthDate={c.birth_date} gifts={giftsByChild(c.id)} />
              </div>
              <Link
                href={`/dashboard/children/${c.id}`}
                className="block px-4 py-2.5 text-center text-xs font-medium text-indigo-500 border-t border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                증여 기록 · 보유 종목 · 신고 가이드 보기 →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
