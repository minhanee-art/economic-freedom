"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type FocusEvent } from "react";
import { cn } from "@/lib/utils";
import {
  bottomNavItems,
  dashboardNavGroups,
  dashboardNavItems,
  isNavItemActive,
  type DashboardNavGroup,
} from "@/lib/dashboard-navigation";
import { DISPLAY_NAME_EVENT } from "@/components/settings/settings-shared";

type PortfolioAccount = {
  id: string;
  name: string;
  owner_type: "self" | "spouse" | "child" | "other";
};

const OWNER_OPTIONS: { value: PortfolioAccount["owner_type"]; label: string }[] = [
  { value: "self", label: "본인" },
  { value: "spouse", label: "배우자" },
  { value: "child", label: "자녀" },
  { value: "other", label: "기타" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-dark-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  // null = 아직 불러오는 중(자리만 잡아 두어 헤더가 밀리지 않게 한다)
  const [accounts, setAccounts] = useState<PortfolioAccount[] | null>(null);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [isAccountSaving, setIsAccountSaving] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountOwner, setNewAccountOwner] = useState<PortfolioAccount["owner_type"]>("self");
  const [accountError, setAccountError] = useState("");

  const emailRef = useRef<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const addAccountRef = useRef<HTMLDivElement>(null);
  const addAccountButtonRef = useRef<HTMLButtonElement>(null);
  const formId = useId();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setIsAuthenticated(Boolean(d.authenticated));
        setDisplayName(d.displayName ?? d.email ?? null);
        emailRef.current = d.email ?? null;
      })
      .catch(() => setIsAuthenticated(false));
    // 설정 > 계정에서 표시 이름을 저장하면 새로고침 없이 헤더 이름도 바꾼다
    const onNameSaved = (event: Event) => {
      const name = (event as CustomEvent<string | null>).detail;
      setDisplayName(name || emailRef.current);
    };
    window.addEventListener(DISPLAY_NAME_EVENT, onNameSaved);
    return () => window.removeEventListener(DISPLAY_NAME_EVENT, onNameSaved);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setAccounts(data?.accounts ?? []);
        setActiveAccountId(data?.activeAccountId ?? data?.accounts?.[0]?.id ?? "");
      })
      .catch(() => setAccounts([]));
  }, [isAuthenticated]);

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
      setOpenGroup(null);
      setIsMobileMenuOpen(false);
    }, 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, [pathname]);

  // 바깥을 누르면 열린 드롭다운·메뉴·계좌 추가 폼을 닫는다
  useEffect(() => {
    if (!openGroup && !isMobileMenuOpen && !isAddingAccount) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (openGroup && navRef.current && !navRef.current.contains(target)) setOpenGroup(null);
      if (
        isMobileMenuOpen &&
        !mobileMenuRef.current?.contains(target) &&
        !mobileMenuButtonRef.current?.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
      if (
        isAddingAccount &&
        !addAccountRef.current?.contains(target) &&
        !addAccountButtonRef.current?.contains(target)
      ) {
        setIsAddingAccount(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openGroup, isMobileMenuOpen, isAddingAccount]);

  const prefetchRoute = (href: string) => {
    router.prefetch(href);
  };

  const handleRouteIntent = (href: string) => {
    prefetchRoute(href);
    setOpenGroup(null);
    setIsMobileMenuOpen(false);
    if (href !== pathname) setIsNavigating(true);
  };

  const handleAuthButton = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const switchAccount = async (accountId: string) => {
    if (!accountId || accountId === activeAccountId) return;
    setIsAccountSaving(true);
    setAccountError("");
    try {
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error();
      setActiveAccountId(accountId);
      router.refresh();
    } catch {
      setAccountError("계좌를 바꾸지 못했습니다. 잠시 뒤 다시 선택해 주세요.");
    } finally {
      setIsAccountSaving(false);
    }
  };

  const closeAddAccount = () => {
    setIsAddingAccount(false);
    setNewAccountName("");
    setNewAccountOwner("self");
    setAccountError("");
    addAccountButtonRef.current?.focus();
  };

  const addAccount = async (event: FormEvent) => {
    event.preventDefault();
    const name = newAccountName.trim();
    if (!name) {
      setAccountError("계좌 이름을 입력해 주세요. 예: 아빠, 아내 IRP, 첫째");
      return;
    }
    setIsAccountSaving(true);
    setAccountError("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerType: newAccountOwner }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.account) throw new Error(data?.error ?? "");
      setAccounts((current) => [...(current ?? []), data.account]);
      setActiveAccountId(data.account.id);
      setIsAddingAccount(false);
      setNewAccountName("");
      setNewAccountOwner("self");
      router.refresh();
    } catch (err) {
      const reason = (err as Error).message;
      setAccountError(`계좌를 추가하지 못했습니다${reason ? `: ${reason}` : ""}. 이름을 확인하고 다시 저장해 주세요.`);
    } finally {
      setIsAccountSaving(false);
    }
  };

  const closeGroupOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenGroup(null);
  };

  const closeOnEscape = (event: KeyboardEvent, close: () => void, focusTarget?: HTMLElement | null) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
    focusTarget?.focus();
  };

  const renderGroup = (group: DashboardNavGroup) => {
    const isGroupActive = group.items.some((item) => isNavItemActive(item, pathname));

    if (group.items.length === 1) {
      const item = group.items[0];
      const active = isNavItemActive(item, pathname);
      return (
        <Link
          key={group.label}
          href={item.href}
          prefetch
          aria-current={active ? "page" : undefined}
          onClick={() => handleRouteIntent(item.href)}
          onMouseEnter={() => prefetchRoute(item.href)}
          className={cn(
            "inline-flex h-10 items-center whitespace-nowrap border border-transparent px-3 text-sm font-semibold transition-colors",
            focusRing,
            active ? "border-white/15 bg-white/10 text-white" : "text-zinc-200 hover:bg-white/10 hover:text-white"
          )}
        >
          {group.label}
        </Link>
      );
    }

    const isOpen = openGroup === group.label;
    const panelId = `nav-panel-${group.items[0].href.replace(/\W+/g, "-")}`;
    return (
      <div
        key={group.label}
        className="relative"
        onBlur={closeGroupOnBlur}
        onKeyDown={(event) =>
          closeOnEscape(event, () => setOpenGroup(null), event.currentTarget.querySelector("button"))
        }
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpenGroup(isOpen ? null : group.label)}
          className={cn(
            "inline-flex h-10 items-center gap-1 whitespace-nowrap border border-transparent px-3 text-sm font-semibold transition-colors",
            focusRing,
            isGroupActive || isOpen
              ? "border-white/15 bg-white/10 text-white"
              : "text-zinc-200 hover:bg-white/10 hover:text-white"
          )}
        >
          {group.label}
          <svg aria-hidden="true" className={cn("h-3.5 w-3.5 opacity-70 transition-transform", isOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div
          id={panelId}
          hidden={!isOpen}
          className="absolute left-0 top-full z-50 mt-1 w-64 border border-hairline bg-surface p-1.5 text-ink shadow-float dark:border-zinc-800"
        >
          <ul>
            {group.items.map((item) => {
              const active = isNavItemActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    onClick={() => handleRouteIntent(item.href)}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                        : "hover:bg-canvas-soft"
                    )}
                  >
                    <span className="shrink-0 text-brand dark:text-indigo-300">{item.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{item.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col pb-bottom-nav lg:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-70 focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-float focus:outline-none focus:ring-2 focus:ring-brand"
      >
        본문 바로가기
      </a>
      {isNavigating && (
        <div aria-hidden="true" className="fixed inset-x-0 top-0 z-60 h-1 bg-indigo-500" />
      )}
      <header className="sticky top-0 z-40 bg-dark-header text-white shadow-sm">
        <div className="relative mx-auto flex h-16 max-w-280 items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link
            href="/dashboard"
            prefetch
            onClick={() => handleRouteIntent("/dashboard")}
            onMouseEnter={() => prefetchRoute("/dashboard")}
            className={cn("inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-base font-bold tracking-tight sm:text-lg", focusRing)}
          >
            가족연금계획
          </Link>

          <nav ref={navRef} className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex" aria-label="대메뉴">
            {dashboardNavGroups.map(renderGroup)}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {/* 계좌 선택: 불러오는 동안에도 같은 크기의 자리를 잡아 헤더가 밀리지 않게 한다 */}
            <div className="relative flex h-11 w-34 shrink-0 items-center gap-2 min-[375px]:w-40 sm:w-48">
              {accounts === null ? (
                <span aria-hidden="true" className="h-11 flex-1 animate-pulse bg-white/10" />
              ) : accounts.length > 0 ? (
                <>
                  <select
                    value={activeAccountId}
                    onChange={(event) => switchAccount(event.target.value)}
                    disabled={isAccountSaving}
                    className={cn(
                      "h-11 min-w-0 flex-1 truncate border border-white/10 bg-white/10 px-1.5 text-base font-semibold text-white disabled:opacity-60 sm:px-2 [&_option]:bg-zinc-900",
                      focusRing
                    )}
                    aria-label="관리 계좌 선택"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                  <button
                    ref={addAccountButtonRef}
                    type="button"
                    onClick={() => (isAddingAccount ? closeAddAccount() : setIsAddingAccount(true))}
                    disabled={isAccountSaving}
                    aria-expanded={isAddingAccount}
                    aria-controls={`${formId}-add-account`}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/10 disabled:opacity-60",
                      focusRing
                    )}
                    aria-label="계좌 추가"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </>
              ) : null}

              {isAddingAccount && (
                <div
                  ref={addAccountRef}
                  id={`${formId}-add-account`}
                  onKeyDown={(event) => closeOnEscape(event, closeAddAccount)}
                  className="fixed inset-x-3 top-18 z-50 w-auto border border-hairline sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-popover bg-surface p-4 text-ink shadow-float dark:border-zinc-800"
                >
                  <form onSubmit={addAccount} className="space-y-3" aria-label="계좌 추가">
                    <div>
                      <label htmlFor={`${formId}-name`} className="mb-1 block text-xs font-medium text-ink-mute">
                        계좌 이름
                      </label>
                      <input
                        id={`${formId}-name`}
                        autoFocus
                        value={newAccountName}
                        onChange={(event) => setNewAccountName(event.target.value)}
                        placeholder="예: 아빠, 아내 IRP, 첫째"
                        maxLength={40}
                        className="h-11 w-full border border-hairline bg-surface px-3 text-base text-ink placeholder:text-ink-mute focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${formId}-owner`} className="mb-1 block text-xs font-medium text-ink-mute">
                        명의
                      </label>
                      <select
                        id={`${formId}-owner`}
                        value={newAccountOwner}
                        onChange={(event) => setNewAccountOwner(event.target.value as PortfolioAccount["owner_type"])}
                        className="h-11 w-full border border-hairline bg-surface px-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700"
                      >
                        {OWNER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    {accountError && (
                      <p role="alert" className="border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                        {accountError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeAddAccount}
                        className="h-11 flex-1 border border-hairline bg-surface text-sm font-semibold text-ink hover:bg-canvas-soft dark:border-zinc-700"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={isAccountSaving}
                        className="h-11 flex-1 bg-brand text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
                      >
                        {isAccountSaving ? "저장 중" : "계좌 추가"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {isAuthenticated && displayName && (
              <span className="hidden max-w-48 truncate text-sm text-zinc-200 xl:block" title={displayName}>
                {displayName}
              </span>
            )}
            <button
              type="button"
              onClick={handleAuthButton}
              className={cn(
                "hidden h-11 shrink-0 whitespace-nowrap border border-white/10 px-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex sm:items-center",
                focusRing
              )}
            >
              {isAuthenticated ? "로그아웃" : "로그인"}
            </button>
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                // 메뉴가 열린 채 초점이 이 버튼에 있어도 Esc 로 닫힌다
                if (event.key === "Escape" && isMobileMenuOpen) {
                  event.preventDefault();
                  setIsMobileMenuOpen(false);
                }
              }}
              aria-expanded={isMobileMenuOpen}
              aria-controls="dashboard-mobile-menu"
              className={cn(
                "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 border border-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 lg:hidden",
                focusRing
              )}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              {/* 폰 폭에서는 아이콘만 보여 계좌 선택 칸에 자리를 준다(이름은 그대로 '메뉴') */}
              <span className="sr-only sm:not-sr-only">메뉴</span>
            </button>
          </div>
        </div>

        {accountError && !isAddingAccount && (
          <p role="alert" className="border-t border-white/10 bg-danger-fill px-4 py-2 text-center text-xs font-semibold text-white">
            {accountError}
          </p>
        )}

        <div
          ref={mobileMenuRef}
          id="dashboard-mobile-menu"
          hidden={!isMobileMenuOpen}
          onKeyDown={(event) => closeOnEscape(event, () => setIsMobileMenuOpen(false), mobileMenuButtonRef.current)}
          className="max-h-below-header overflow-y-auto border-t border-white/10 bg-surface text-ink shadow-float lg:hidden"
        >
          <nav aria-label="전체 메뉴" className="mx-auto max-w-280 px-3 py-3 sm:px-6">
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {dashboardNavGroups.map((group) => (
                <li key={group.label} className="border-b border-hairline py-2 last:border-b-0 dark:border-zinc-800 sm:[&:nth-last-child(2)]:border-b-0">
                  {group.items.length > 1 && (
                    <p className="px-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{group.label}</p>
                  )}
                  <ul>
                    {group.items.map((item) => {
                      const active = isNavItemActive(item, pathname);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            prefetch
                            aria-current={active ? "page" : undefined}
                            onClick={() => handleRouteIntent(item.href)}
                            className={cn(
                              "flex min-h-11 items-center gap-3 px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                              active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "hover:bg-canvas-soft"
                            )}
                          >
                            <span className="shrink-0 text-brand dark:text-indigo-300">{item.icon}</span>
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-hairline pt-3 dark:border-zinc-800 sm:hidden">
              <span className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">{displayName}</span>
              <button
                type="button"
                onClick={handleAuthButton}
                className="h-11 shrink-0 border border-hairline px-4 text-sm font-semibold text-ink hover:bg-canvas-soft dark:border-zinc-700"
              >
                {isAuthenticated ? "로그아웃" : "로그인"}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="min-h-dvh flex-1 bg-canvas-soft focus:outline-none dark:bg-zinc-950">
        <div className="mx-auto max-w-280 px-4 py-5 sm:px-6 md:py-7">
          {children}
        </div>
      </main>

      <footer className="border-t border-hairline bg-surface px-4 py-4 dark:border-zinc-800 sm:px-6">
        <p className="mx-auto max-w-280 text-xs leading-relaxed text-ink-mute">
          가족연금계획은 사용자가 입력한 기록을 계산해 보여주는 도구이며 투자 자문이나 매매 권유를 하지 않습니다. 세금·수익 계산은 참고용입니다.
        </p>
      </footer>

      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface pb-safe shadow-bar dark:border-zinc-800 lg:hidden"
      >
        <ul className="mx-auto grid h-20 max-w-140 grid-cols-5 items-center px-2">
          {bottomNavItems.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleRouteIntent(item.href)}
                  onTouchStart={() => prefetchRoute(item.href)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    isActive
                      ? "text-brand dark:text-indigo-300"
                      : "text-zinc-500 hover:text-ink dark:text-zinc-400"
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.shortLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
