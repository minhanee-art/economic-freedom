"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { bottomNavItems, dashboardNavItems } from "@/lib/dashboard-navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setDisplayName(d.displayName ?? null))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-full flex-col pb-24 md:pb-0">
      <header className="bg-dark-header text-white shadow-sm shadow-indigo-950/20">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="font-bold text-lg">
            Pension Manager
          </Link>
          <div className="flex items-center gap-3">
            {displayName && (
              <span className="text-sm text-zinc-300 hidden sm:block">{displayName}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <nav className="hidden md:block bg-dark-header border-t border-white/10">
        <div className="mx-auto flex max-w-[1120px] gap-1 overflow-x-auto px-6">
          {dashboardNavItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-indigo-500 text-white"
                    : "border-transparent text-zinc-400 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 bg-[var(--color-canvas-soft)] dark:bg-zinc-950">
        <div className="mx-auto max-w-[1120px] px-4 py-5 sm:px-6 md:py-7">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/80 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        <div className="mx-auto grid h-20 max-w-[560px] grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)]">
          {bottomNavItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[11px] font-semibold transition-all active:scale-95",
                  isActive
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <span className={cn("rounded-xl p-1", isActive && "bg-white shadow-card dark:bg-zinc-900")}>{item.icon}</span>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
