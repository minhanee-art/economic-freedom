"use client";

import { useEffect, useState } from "react";
import { formatKRW, formatFullKRW, cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
  const [loadingETF, setLoadingETF] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsQuery, setNewsQuery] = useState("연금");

  useEffect(() => {
    fetchVolume();
    fetchNews("연금");
  }, []);

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

  // 차트 데이터
  const chartData = etfs.slice(0, 10).map((e) => ({
    name: e.name.length > 8 ? e.name.slice(0, 8) + "…" : e.name,
    volume: e.volume,
    changePct: e.changePct,
  }));

  return (
    <div className="space-y-5">
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
            {/* 거래량 바 차트 */}
            {chartData.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-3">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" barSize={14}>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          v >= 1000000
                            ? `${(v / 1000000).toFixed(0)}백만`
                            : `${(v / 1000).toFixed(0)}천`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(v) => `${Number(v).toLocaleString()}주`}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
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

            {/* 리스트 */}
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

        {/* 뉴스 키워드 탭 */}
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
