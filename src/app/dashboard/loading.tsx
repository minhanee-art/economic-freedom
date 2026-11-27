export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* 요약 헤더 스켈레톤 */}
      <div
        className="border border-hairline bg-surface px-6 py-6 shadow-card dark:border-zinc-800"
      >
        <div className="mb-5 flex items-start justify-between animate-pulse">
          <div className="space-y-2.5">
            <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-8 w-44 bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="h-7 w-24 bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* 차트 카드 스켈레톤 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="border border-hairline bg-white p-5 shadow-card dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="h-4 w-28 bg-zinc-100 animate-pulse dark:bg-zinc-800" />
            <div className="mt-4 h-40 bg-zinc-100 animate-pulse dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* 종목 리스트 스켈레톤 */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex overflow-hidden border border-hairline bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex-1 space-y-2 px-4 py-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800" />
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="ml-auto h-4 w-20 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="ml-auto h-3 w-24 bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-14 bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-5 w-20 bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
