"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bottomNavItems,
  dashboardNavGroups,
  dashboardNavItems,
  type DashboardNavItem,
} from "@/lib/dashboard-navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [activeNavGroup, setActiveNavGroup] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setDisplayName(d.displayName ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prefetchAll = () => dashboardNavItems.forEach((item) => router.prefetch(item.href));
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchAll, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = globalThis.setTimeout(prefetchAll, 350);
    return () => globalThis.clearTimeout(timeoutId);
  }, [router]);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setIsNavigating(false);
      setActiveNavGroup(null);
      setIsSearchOpen(false);
    }, 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, [pathname]);

  const prefetchRoute = (href: string) => {
    router.prefetch(href);
  };

  const handleRouteIntent = (href: string) => {
    prefetchRoute(href);
    setIsSearchOpen(false);
    setActiveNavGroup(null);
    if (href !== pathname) setIsNavigating(true);
  };

  const handleAuthButton = async () => {
    if (!displayName) {
      router.push("/login");
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isItemActive = (item: DashboardNavItem) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

  const normalizedQuery = menuQuery.trim().toLowerCase();
  const filteredMenuItems = useMemo(() => {
    if (!normalizedQuery) return dashboardNavItems;
    return dashboardNavItems.filter((item) =>
      [item.label, item.shortLabel, item.description, item.href]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  return (
    <div className="dashboard-sharp flex min-h-full flex-col pb-24 md:pb-0">
      {isNavigating && (
        <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-indigo-500 shadow-[0_0_12px_rgba(83,58,253,0.45)]" />
      )}
      <header className="sticky top-0 z-40 bg-dark-header text-white shadow-sm shadow-indigo-950/20">
        <div className="relative mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/dashboard" prefetch onClick={() => handleRouteIntent("/dashboard")} onMouseEnter={() => prefetchRoute("/dashboard")} className="shrink-0 text-lg font-bold tracking-tight">
            Pension Manager
          </Link>

          <nav
            className="ml-2 hidden flex-1 items-center gap-1 lg:flex"
            aria-label="대메뉴"
            onMouseLeave={() => setActiveNavGroup(null)}
          >
            {dashboardNavGroups.map((group) => {
              const isGroupActive = group.items.some(isItemActive);
              const isDropdownOpen = activeNavGroup === group.label;

              return (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => setActiveNavGroup(group.label)}
                >
                  <button
                    type="button"
                    onFocus={() => setActiveNavGroup(group.label)}
                    className={cn(
                      "inline-flex h-10 items-center gap-1 border border-transparent px-3 text-sm font-semibold transition-colors",
                      isGroupActive
                        ? "border-white/15 bg-white/10 text-white"
                        : "text-zinc-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {group.label}
                    <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  <div
                    className={cn(
                      "absolute left-0 top-full z-50 w-72 border border-zinc-200 bg-white p-2 text-ink shadow-float transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
                      isDropdownOpen
                        ? "visible translate-y-1 opacity-100"
                        : "invisible translate-y-2 opacity-0"
                    )}
                  >
                    <div className="px-3 py-2">
                      <p className="text-sm font-bold">{group.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          onClick={() => handleRouteIntent(item.href)}
                          onMouseEnter={() => prefetchRoute(item.href)}
                          onFocus={() => prefetchRoute(item.href)}
                          className={cn(
                            "flex items-center gap-3 border border-transparent px-3 py-2.5 transition-colors",
                            isItemActive(item)
                              ? "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300"
                              : "hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-100 text-indigo-500 dark:border-zinc-700 dark:bg-zinc-800">
                            {item.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{item.label}</span>
                            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{item.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSearchOpen((open) => !open)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 border border-white/10 px-3 text-sm font-semibold transition-colors",
                  isSearchOpen
                    ? "bg-white text-dark-header"
                    : "bg-white/10 text-white hover:bg-white/15"
                )}
                aria-expanded={isSearchOpen}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                </svg>
                <span className="hidden sm:inline">메뉴 검색</span>
              </button>

              {isSearchOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] border border-zinc-200 bg-white p-3 text-ink shadow-float dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  <label className="sr-only" htmlFor="dashboard-menu-search">메뉴 검색</label>
                  <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                    </svg>
                    <input
                      id="dashboard-menu-search"
                      value={menuQuery}
                      onChange={(event) => setMenuQuery(event.target.value)}
                      placeholder="예: 배당, 기록, ETF"
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <div className="mt-3 max-h-[55dvh] space-y-1 overflow-y-auto">
                    {filteredMenuItems.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-zinc-500">검색 결과가 없습니다.</p>
                    ) : (
                      filteredMenuItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          onMouseEnter={() => prefetchRoute(item.href)}
                          onFocus={() => prefetchRoute(item.href)}
                          onClick={() => handleRouteIntent(item.href)}
                          className={cn(
                            "flex items-center gap-3 border border-transparent px-3 py-2.5 transition-colors active:scale-[0.99]",
                            isItemActive(item)
                              ? "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300"
                              : "hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-100 text-indigo-500 dark:border-zinc-700 dark:bg-zinc-800">
                            {item.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold">{item.label}</span>
                            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{item.description}</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {displayName && (
              <span className="text-sm text-zinc-300 hidden sm:block">{displayName}</span>
            )}
            <button
              onClick={handleAuthButton}
              className="border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {displayName ? "로그아웃" : "로그인"}
            </button>
          </div>
        </div>
      </header>

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
                prefetch
                onClick={() => handleRouteIntent(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                onMouseEnter={() => prefetchRoute(item.href)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 border border-transparent px-1.5 py-2 text-[11px] font-semibold transition-all active:scale-95",
                  isActive
                    ? "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-zinc-400 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <span className={cn("border border-transparent p-1", isActive && "border-zinc-200 bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900")}>{item.icon}</span>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
