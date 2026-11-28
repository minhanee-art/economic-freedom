"use client";

// 설정 > 알림 — 텔레그램 연결, 뉴스 요약 받을 종목, 배당 일정. 세 가지 모두 텔레그램으로 보내는 알림의 설정이다.
// 다른 화면에서 바로 오는 앵커: #telegram, #news-watchlist, #dividend-calendar
import { failureMessage } from "@/components/dashboard/inline-error";
import { useState } from "react";
import { missingFields } from "@/lib/utils";
import { TelegramLinkSection } from "@/components/settings/telegram-link-section";
import { EmojiLine, InfoTip } from "@/components/ui/info-tip";
import type { SettingsTools } from "@/components/settings/settings-shared";

export interface WatchlistItem {
  id: string;
  name: string;
  code: string | null;
  market: "KR" | "US";
}

export interface CalendarItem {
  id: string;
  date: string;
  stock: string;
  type: string;
  note: string;
}

const typeLabel: Record<string, string> = {
  "ex-date": "배당락",
  "pay-date": "지급일",
  "meeting": "주총",
  "other": "기타",
};

interface Props {
  watchlist: WatchlistItem[];
  dividendCalendar: CalendarItem[];
  tools: SettingsTools;
}

export function AlertsTab({ watchlist: initialWatchlist, dividendCalendar: initialCalendar, tools }: Props) {
  const { flash, showError } = tools;

  // 배당 캘린더
  const [calendar, setCalendar] = useState<CalendarItem[]>(initialCalendar);
  const [calDate, setCalDate] = useState("");
  const [calStock, setCalStock] = useState("");
  const [calType, setCalType] = useState("ex-date");
  const [calNote, setCalNote] = useState("");
  const [isAddingCal, setIsAddingCal] = useState(false);

  const handleAddCalendar = async () => {
    const lack = missingFields([[Boolean(calDate), "날짜"], [Boolean(calStock), "종목"]]);
    if (lack.length) { showError({ message: `배당 일정의 ${lack.join("·")}을(를) 입력해 주세요.` }); return; }
    showError(null);
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
      showError({ message: failureMessage("추가", err) });
    } finally {
      setIsAddingCal(false);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    const res = await fetch(`/api/dividend-calendar/${id}`, { method: "DELETE" });
    if (!res.ok) { showError({ message: failureMessage("삭제", new Error(`서버 응답 ${res.status}`)) }); return; }
    setCalendar((prev) => prev.filter((c) => c.id !== id));
    flash("일정 삭제됨");
  };

  // 뉴스 요약 종목 watchlist
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [wlName, setWlName] = useState("");
  const [wlCode, setWlCode] = useState("");
  const [wlMarket, setWlMarket] = useState<"KR" | "US">("KR");
  const [isAddingWl, setIsAddingWl] = useState(false);

  const handleAddWatchlist = async () => {
    if (!wlName.trim()) { showError({ message: "뉴스 요약을 받을 종목명을 입력해 주세요." }); return; }
    showError(null);
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
      showError({ message: failureMessage("추가", err) });
    } finally {
      setIsAddingWl(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (!res.ok) { showError({ message: failureMessage("삭제", new Error(`서버 응답 ${res.status}`)) }); return; }
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    flash("종목 삭제됨");
  };

  const fieldClass =
    "h-11 border border-hairline bg-white transition-colors text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

  return (
    <div className="space-y-5">
      <div id="telegram" className="scroll-mt-24">
        <TelegramLinkSection />
      </div>

      {/* 뉴스 요약 받을 종목 */}
      <section id="news-watchlist" aria-labelledby="settings-watchlist" className="scroll-mt-24 border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="settings-watchlist" className="text-base font-bold tracking-tight">
            뉴스 요약 받을 종목 ({watchlist.length})
            <InfoTip label="뉴스 요약 종목 설명" align="start">매일 08:30(KST)에 이 종목들의 뉴스 요약을 텔레그램으로 보냅니다.</InfoTip>
          </h2>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              name="watchlistName"
              autoComplete="off"
              value={wlName}
              onChange={(e) => setWlName(e.target.value)}
              aria-label="뉴스 요약 받을 종목명"
              placeholder="종목명 (예: 삼성전자, SCHD ETF)…"
              className={`min-w-0 flex-1 basis-40 px-3 ${fieldClass}`}
            />
            <select
              name="watchlistMarket"
              value={wlMarket}
              onChange={(e) => setWlMarket(e.target.value as "KR" | "US")}
              aria-label="시장"
              className={`px-2 ${fieldClass}`}
            >
              <option value="KR">한국(KR)</option>
              <option value="US">미국(US)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              name="watchlistCode"
              autoComplete="off"
              spellCheck={false}
              value={wlCode}
              onChange={(e) => setWlCode(e.target.value)}
              aria-label={wlMarket === "KR" ? "종목코드" : "심볼"}
              onKeyDown={(e) => e.key === "Enter" && handleAddWatchlist()}
              placeholder={wlMarket === "KR" ? "종목코드 (예: 069500)…" : "심볼 (예: SCHD)…"}
              className={`min-w-0 flex-1 basis-40 px-3 ${fieldClass}`}
            />
            <button
              type="button"
              onClick={handleAddWatchlist}
              disabled={isAddingWl}
              className="h-11 px-4 text-sm font-semibold border border-hairline bg-surface text-ink hover:bg-canvas-soft disabled:opacity-50 transition-colors dark:border-zinc-700"
            >
              {isAddingWl ? "추가 중…" : "+ 추가"}
            </button>
          </div>
        </div>

        {/* 종목 리스트 */}
        {watchlist.length === 0 ? (
          <EmojiLine emoji="🔔" as="p" size="xs" tone="mute" align="center" className="my-2">뉴스 요약을 받을 종목을 추가해 주세요.</EmojiLine>
        ) : (
          <ul className="space-y-1.5">
            {watchlist.map((w) => (
              <li key={w.id} className="flex items-center gap-2 border border-hairline dark:border-zinc-800 bg-canvas-soft dark:bg-zinc-800/50 px-3 py-2">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-7 shrink-0">
                  {w.market === "US" ? "US" : "KR"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" title={w.name}>{w.name}</span>
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

      {/* 배당 일정 */}
      <section id="dividend-calendar" aria-labelledby="settings-calendar" className="scroll-mt-24 border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="settings-calendar" className="text-base font-bold tracking-tight">
            배당 일정 ({calendar.length})
            <InfoTip label="배당 일정 설명" align="start">매일 08:00(KST)에 다가오는 일정을 텔레그램으로 보냅니다.</InfoTip>
          </h2>
        </div>

        {/* 추가 폼 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              name="calendarDate"
              autoComplete="off"
              value={calDate}
              onChange={(e) => setCalDate(e.target.value)}
              aria-label="일정 날짜"
              className={`min-w-0 flex-1 basis-36 px-3 ${fieldClass}`}
            />
            <select
              name="calendarType"
              value={calType}
              onChange={(e) => setCalType(e.target.value)}
              aria-label="일정 종류"
              className={`px-2 ${fieldClass}`}
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
              name="calendarStock"
              autoComplete="off"
              value={calStock}
              onChange={(e) => setCalStock(e.target.value)}
              aria-label="일정 종목명"
              placeholder="종목명 (예: 삼성전자)…"
              className={`min-w-0 flex-1 basis-40 px-3 ${fieldClass}`}
            />
            <input
              type="text"
              name="calendarNote"
              autoComplete="off"
              value={calNote}
              onChange={(e) => setCalNote(e.target.value)}
              aria-label="일정 메모(선택)"
              onKeyDown={(e) => e.key === "Enter" && handleAddCalendar()}
              placeholder="메모 (예: 2024년 결산배당)…"
              className={`min-w-0 flex-1 basis-40 px-3 ${fieldClass}`}
            />
          </div>
          <button
            type="button"
            onClick={handleAddCalendar}
            disabled={isAddingCal}
            className="w-full h-11 text-sm font-semibold border border-hairline bg-surface text-ink hover:bg-canvas-soft disabled:opacity-50 transition-colors dark:border-zinc-700"
          >
            {isAddingCal ? "추가 중…" : "+ 추가"}
          </button>
        </div>

        {/* 일정 리스트 */}
        {calendar.length === 0 ? (
          <EmojiLine emoji="📅" as="p" size="xs" tone="mute" align="center" className="my-2">배당 일정을 추가해 주세요.</EmojiLine>
        ) : (
          <ul className="space-y-1.5">
            {calendar.map((c) => (
              <li key={c.id} className="flex items-center gap-2 border border-hairline dark:border-zinc-800 bg-canvas-soft dark:bg-zinc-800/50 px-3 py-2">
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-20 shrink-0">{c.date}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12 shrink-0">{typeLabel[c.type] ?? c.type}</span>
                {/* 종목명 아래에 메모 — 폰 폭에서 한 줄에 다 넣으면 종목명이 한 글자로 줄어든다 */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" title={c.stock}>{c.stock}</span>
                  {c.note && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400" title={c.note}>{c.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCalendar(c.id)}
                  aria-label={`${c.date} ${c.stock} 일정 삭제`}
                  className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-danger dark:text-zinc-400"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
