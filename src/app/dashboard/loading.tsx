export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* 요약 헤더 스켈레톤 */}
      <div
        className="rounded-2xl px-6 py-6 shadow-float"
        style={{
          background:
            "linear-gradient(135deg, #1c1e54 0%, #2e2b8c 55%, #533afd 100%)",
        }}
      >
        <div className="mb-5 flex items-start justify-between animate-pulse">
          <div className="space-y-2.5">
            <div className="h-3 w-20 rounded-full bg-white/20" />
            <div className="h-8 w-44 rounded-lg bg-white/25" />
          </div>
          <div className="h-7 w-24 rounded-full bg-white/15" />
        </div>
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-12 rounded-full bg-white/20" />
              <div className="h-4 w-16 rounded bg-white/25" />
            </div>
          ))}
        </div>
      </div>

      {/* 차트 카드 스켈레톤 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-hairline bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="h-4 w-28 rounded bg-zinc-100 animate-pulse dark:bg-zinc-800" />
            <div className="mt-4 h-40 rounded-xl bg-zinc-100 animate-pulse dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* 종목 리스트 스켈레톤 */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex overflow-hidden rounded-xl border border-hairline bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="w-1.5 shrink-0 bg-indigo-200" />
            <div className="flex-1 space-y-2 px-4 py-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="ml-auto h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="ml-auto h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-5 w-16 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-5 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
