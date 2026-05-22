// 시장 페이지 — 주요 지수, 거래량 TOP10, ETF 뉴스
"use client";

import { useEffect, useState } from "react";
import { formatKRW, cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { IndexData } from "@/app/api/market/indices/route";

interface VolumeETF {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

export function MarketClient() {
  const [etfs, setEtfs] = useState<VolumeETF[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loadingETF, setLoadingETF] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [newsQuery, setNewsQuery] = useState("연금");

  useEffect(() => {
    fetchIndices();
    fetchVolume();
    fetchNews("연금");
  }, []);

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

  const fetchVolume = async () => {
    setLoadingETF(true);
    try {
      const res = await fetch("/api/market/volume");
      const data = await res.json();
      setEtfs(data.etfs ?? []);
    } catch {
      // ignore
    }
    setLoadingETF(false);
  };

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

  // 차트 데이터 — 이름 12자 제한, 가독성 확보
  const chartData = etfs.slice(0, 10).map((e) => ({
    name: e.name.length > 12 ? e.name.slice(0, 12) + "…" : e.name,
    volume: e.volume,
    changePct: e.changePct,
  }));

  return (
    <div className="space-y-5">
      {/* 주요 지수 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">주요 지수</h2>
          <button
            onClick={fetchIndices}
            className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
          >
            새로고침
          </button>
        </div>

        {loadingIndices ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-16" />
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
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
                >
                  <p className="text-xs text-zinc-400 mb-1">{idx.name}</p>
                  <p className="text-base font-bold tabular-nums">
                    {idx.value === "--" ? "--" : Number(idx.value.replace(/,/g, "")).toLocaleString()}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-zinc-400"
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

      {/* 거래량 TOP 10 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">거래량 TOP 10</h2>
          <button
            onClick={fetchVolume}
            className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
          >
            새로고침
          </button>
        </div>

        {loadingETF ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-16" />
            ))}
          </div>
        ) : (
          <>
            {chartData.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-3">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      barSize={14}
                      margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#71717a" }}
                        tickFormatter={(v) =>
                          v >= 100000000
                            ? `${(v / 100000000).toFixed(0)}억`
                            : v >= 1000000
                            ? `${(v / 1000000).toFixed(0)}백만`
                            : `${(v / 10000).toFixed(0)}만`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 11, fill: "#71717a" }}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v).toLocaleString()}주`, "거래량"]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e4e4e7",
                          background: "#fff",
                          color: "#171717",
                        }}
                      />
                      <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.changePct >= 0 ? "#6366F1" : "#EF4444"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {etfs.map((etf) => (
                <div
                  key={etf.code}
                  className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
                >
                  <span className="w-6 text-sm font-bold text-zinc-400">
                    {etf.rank}
                  </span>
                  <div className="flex-1 min-w-0 ml-2">
                    <p className="text-sm font-semibold truncate">{etf.name}</p>
                    <p className="text-xs text-zinc-400">
                      {etf.code} · 거래량 {etf.volume.toLocaleString()}주
                    </p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-semibold">
                      ₩{etf.price.toLocaleString()}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        etf.changePct > 0
                          ? "text-red-500"
                          : etf.changePct < 0
                            ? "text-blue-500"
                            : "text-zinc-400"
                      )}
                    >
                      {etf.changePct > 0 ? "▲" : etf.changePct < 0 ? "▼" : ""}
                      {Math.abs(etf.changePct).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ETF 뉴스 */}
      <section>
        <h2 className="text-lg font-bold mb-3">ETF 뉴스</h2>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {["연금", "배당ETF", "코스피", "미국ETF", "금ETF", "채권"].map(
            (keyword) => (
              <button
                key={keyword}
                onClick={() => fetchNews(keyword)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  newsQuery === keyword
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
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
              <div key={i} className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-16" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">
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
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                <p className="text-xs text-zinc-400 mt-1">
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
