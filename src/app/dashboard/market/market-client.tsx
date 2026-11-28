// 시장 페이지 — 주요 지수, 내 보유 종목 시세, ETF 관련 뉴스(외부 기사)
// 순위·인기·TOP 같은 목록은 두지 않는다(종목 추천처럼 읽히지 않게).
"use client";

import { useCallback, useEffect, useState } from "react";
import { cn, formatKRWFull } from "@/lib/utils";
import { EmojiLine, InfoTip } from "@/components/ui/info-tip";
import type { IndexData } from "@/app/api/market/indices/route";

export interface MarketHolding {
  id: string;
  code: string;
  name: string;
  shares: number;
  /** 마지막으로 저장된 현재가 */
  currentPrice: number;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

export function MarketClient({ holdings }: { holdings: MarketHolding[] }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [newsQuery, setNewsQuery] = useState("연금");
  // 새로 조회한 시세(화면 표시용, 저장하지 않는다 — 저장은 홈의 '시세 새로고침')
  const [livePrices, setLivePrices] = useState<Record<string, number> | null>(null);
  const [priceStatus, setPriceStatus] = useState<{ kind: "idle" | "loading" | "done" | "error"; text?: string }>({ kind: "idle" });

  const myHoldings = holdings.filter((h) => h.code && (h.shares > 0 || h.currentPrice > 0));

  const fetchIndices = async () => {
    setLoadingIndices(true);
    try {
      const res = await fetch("/api/market/indices");
      const data = await res.json();
      setIndices(data.indices ?? []);
    } catch {
      // ignore
    }
    setLoadingIndices(false);
  };

  const fetchMyPrices = useCallback(async () => {
    const codes = myHoldings.map((h) => h.code);
    if (codes.length === 0) return;
    setPriceStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
      const data = (await res.json()) as { prices: Record<string, number>; errors: string[] };
      setLivePrices(data.prices ?? {});
      const failed = data.errors?.length ?? 0;
      setPriceStatus({ kind: "done", text: `${Object.keys(data.prices ?? {}).length}개 종목 시세를 조회했습니다${failed ? ` (${failed}개는 조회하지 못해 저장된 값을 보여 줍니다)` : ""}.` });
    } catch (err) {
      setPriceStatus({ kind: "error", text: `시세를 조회하지 못했습니다: ${(err as Error).message}. 잠시 뒤 다시 시도해 주세요.` });
    }
  }, [myHoldings]);

  const fetchNews = async (query: string) => {
    setLoadingNews(true);
    setNewsQuery(query);
    try {
      const res = await fetch(`/api/market/news?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setNews(data.news ?? []);
    } catch {
      // ignore
    }
    setLoadingNews(false);
  };

  useEffect(() => {
    // 마운트 시 시장 데이터 페치 (외부 API 동기화)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIndices();
    fetchNews("연금");
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight text-ink">시장 현황</h1>
      {/* 주요 지수 */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold tracking-tight text-ink">주요 지수</h2>
          <button
            type="button"
            onClick={fetchIndices}
            className="inline-flex min-h-10 items-center border border-hairline bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas-soft dark:border-zinc-700"
          >
            지수 새로고침
          </button>
        </div>

        {loadingIndices ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-zinc-200/70 dark:bg-zinc-800 h-16" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {indices.map((idx) => {
              const isUp = idx.changePct > 0;
              const isDown = idx.changePct < 0;
              return (
                <div
                  key={idx.id}
                  className="border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 shadow-card transition-shadow hover:shadow-float"
                >
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{idx.name}</p>
                  <p className="text-base font-bold tabular-nums text-ink">
                    {idx.value === "--" ? "--" : Number(idx.value.replace(/,/g, "")).toLocaleString()}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isUp ? "text-gain" : isDown ? "text-loss" : "text-ink-mute"
                    )}
                  >
                    {isUp ? "▲" : isDown ? "▼" : ""}
                    {idx.changePct !== 0 ? Math.abs(idx.changePct).toFixed(2) + "%" : "--"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 내 보유 종목 시세 */}
      <section aria-labelledby="my-prices-title">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 id="my-prices-title" className="text-base font-bold tracking-tight text-ink">
            내 보유 종목 시세
            <InfoTip label="보유 종목 시세 설명" align="start">
              &lsquo;지금 시세 조회&rsquo;로 가져온 값은 이 화면에만 보이고 저장하지 않습니다. 저장은 홈의 &lsquo;시세 새로고침&rsquo;에서 합니다.
            </InfoTip>
          </h2>
          {myHoldings.length > 0 && (
            <button
              type="button"
              onClick={fetchMyPrices}
              disabled={priceStatus.kind === "loading"}
              className="inline-flex min-h-10 items-center border border-hairline bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas-soft disabled:opacity-60 dark:border-zinc-700"
            >
              {priceStatus.kind === "loading" ? "조회 중" : "지금 시세 조회"}
            </button>
          )}
        </div>
        {priceStatus.kind === "error" && (
          <p role="alert" className="mb-2 border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">{priceStatus.text}</p>
        )}
        {priceStatus.kind === "done" && (
          <p role="status" className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{priceStatus.text} 조회한 값은 이 화면에만 보이며 저장하지 않습니다.</p>
        )}
        {myHoldings.length === 0 ? (
          <div className="space-y-2 border border-hairline bg-surface px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <EmojiLine as="p" emoji="🏦">이 계좌에 종목코드가 있는 종목이 없습니다.</EmojiLine>
            <EmojiLine as="p" emoji="➕">홈의 &lsquo;보유 종목과 목표 비중&rsquo;에서 종목을 추가하면 시세를 볼 수 있습니다.</EmojiLine>
          </div>
        ) : (
          <ul className="divide-y divide-hairline border border-hairline bg-surface dark:divide-zinc-800 dark:border-zinc-800">
            {myHoldings.map((h) => {
              const live = livePrices?.[h.code];
              const price = live ?? h.currentPrice;
              return (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink" title={h.name}>{h.name}</p>
                    <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {h.code} · {h.shares.toLocaleString("ko-KR")}주 보유
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">{price > 0 ? formatKRWFull(price) : "-"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{live !== undefined ? "방금 조회" : "저장된 시세"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ETF 뉴스 */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-ink">ETF 관련 뉴스</h2>
        <p className="mb-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          외부 언론 기사 링크이며 투자 권유가 아닙니다.
          <InfoTip label="뉴스 출처 설명" align="start">
            검색어로 찾은 외부 기사입니다. 이 서비스의 의견이 아닙니다.
          </InfoTip>
        </p>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {["연금", "배당ETF", "코스피", "미국ETF", "금ETF", "채권"].map(
            (keyword) => (
              <button
                key={keyword}
                onClick={() => fetchNews(keyword)}
                className={cn(
                  "inline-flex min-h-10 items-center px-3.5 text-xs font-medium whitespace-nowrap transition-colors",
                  newsQuery === keyword
                    ? "border border-brand bg-brand text-white"
                    : "bg-white border border-hairline text-zinc-600 hover:border-indigo-200 hover:text-indigo-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                {keyword}
              </button>
            )
          )}
        </div>

        {loadingNews ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-200/70 dark:bg-zinc-800 h-16" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
            뉴스를 찾을 수 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {news.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 shadow-card transition-shadow hover:shadow-float"
              >
                <p className="text-sm font-medium line-clamp-2 text-ink">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {item.source}
                  {item.date && ` · ${item.date}`}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
