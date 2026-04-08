export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-36" />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-48" />
        <div className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-48" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-20" />
        ))}
      </div>
    </div>
  );
}
