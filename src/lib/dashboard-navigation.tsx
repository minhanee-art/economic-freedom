import type { ReactNode } from "react";

export type DashboardNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
  bottom: boolean;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

const iconClassName = "h-5 w-5";

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "홈",
    shortLabel: "홈",
    description: "올해 세액공제·은퇴 현금흐름과 자산 요약",
    bottom: true,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.8 11.2 3a1.15 1.15 0 0 1 1.6 0L21 10.8M5.2 9.5v9.1c0 .77.63 1.4 1.4 1.4h3.15v-4.25c0-.69.56-1.25 1.25-1.25h2c.69 0 1.25.56 1.25 1.25V20h3.15c.77 0 1.4-.63 1.4-1.4V9.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/buy",
    label: "적립 배분 계산",
    shortLabel: "배분",
    description: "설정한 목표 비중에 따른 월 적립금 배분 계산",
    bottom: false,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/dashboard/pnl",
    label: "자산·손익",
    shortLabel: "자산",
    description: "수익률과 투자 흐름 확인",
    bottom: true,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 15l3-3 2.4 2.4L18 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 8h3v3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/children",
    label: "자녀 계좌",
    shortLabel: "자녀",
    description: "자녀별 지원금과 증여 한도 관리",
    bottom: false,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 20a5.1 5.1 0 0 1 10.2 0M13.8 18.6a4.1 4.1 0 0 1 6.7 1.4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/retirement",
    label: "연금 설계",
    shortLabel: "연금",
    description: "세액공제 진행률과 은퇴 현금흐름",
    bottom: true,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M6 20v-6m4 6V10m4 10v-8m4 8V6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5 10 6l4 2.5L19 4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "설정",
    shortLabel: "설정",
    description: "계정·월 적립금·알림·화면 설정",
    bottom: true,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.2 13.7c.07-.55.07-1.1 0-1.65l1.7-1.32-1.9-3.28-2 .8a7 7 0 0 0-1.42-.83L14.3 5.3h-4.6l-.28 2.12c-.5.22-.97.5-1.42.83l-2-.8-1.9 3.28 1.7 1.32c-.07.55-.07 1.1 0 1.65l-1.7 1.32 1.9 3.28 2-.8c.44.33.92.61 1.42.83l.28 2.12h4.6l.28-2.12c.5-.22.98-.5 1.42-.83l2 .8 1.9-3.28-1.7-1.32Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/market",
    label: "시장 현황",
    shortLabel: "시장",
    description: "관심 종목과 시장 흐름",
    bottom: false,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 16 5-5 4 4 7-8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h4v4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/compare",
    label: "ETF 비교",
    shortLabel: "비교",
    description: "종목별 수수료·성과 비교",
    bottom: false,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h13M4 7h.01M7 12h13M4 12h.01M7 17h13M4 17h.01" />
      </svg>
    ),
  },
  {
    href: "/dashboard/dividend",
    label: "배당 기록",
    shortLabel: "배당",
    description: "받은 배당 기록과 월별 합계",
    bottom: true,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M8.8 16.2c.7.75 1.9 1.2 3.2 1.2 1.8 0 3.2-.86 3.2-2.2 0-1.2-.9-1.8-3.3-2.35-2.25-.52-3.05-1.22-3.05-2.35 0-1.3 1.25-2.2 3.05-2.2 1.24 0 2.24.36 3 1.08" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/history",
    label: "매수 기록",
    shortLabel: "기록",
    description: "매수 기록과 엑셀 가져오기",
    bottom: false,
    icon: (
      <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2M20 12a8 8 0 1 1-2.35-5.65" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 5v4h-4" />
      </svg>
    ),
  },
];


/** 상단 내비(데스크톱). items 가 하나면 드롭다운 없이 바로 가는 링크로 그린다. */
export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    label: "홈",
    items: dashboardNavItems.filter((item) => item.href === "/dashboard"),
  },
  {
    label: "연금 설계",
    items: dashboardNavItems.filter((item) => item.href === "/dashboard/retirement"),
  },
  {
    label: "자산",
    items: dashboardNavItems.filter((item) =>
      ["/dashboard/pnl", "/dashboard/dividend"].includes(item.href)
    ),
  },
  {
    label: "기록",
    items: dashboardNavItems.filter((item) =>
      ["/dashboard/history", "/dashboard/buy"].includes(item.href)
    ),
  },
  {
    label: "시장 도구",
    items: dashboardNavItems.filter((item) =>
      ["/dashboard/market", "/dashboard/compare"].includes(item.href)
    ),
  },
  {
    label: "가족·설정",
    items: dashboardNavItems.filter((item) =>
      ["/dashboard/children", "/dashboard/settings"].includes(item.href)
    ),
  },
];

/** 하단 탭 순서(앱과 같은 구성: 홈/자산/배당/연금/설정) */
const BOTTOM_ORDER = ["/dashboard", "/dashboard/pnl", "/dashboard/dividend", "/dashboard/retirement", "/dashboard/settings"];
export const bottomNavItems = BOTTOM_ORDER.map((href) => dashboardNavItems.find((item) => item.href === href)!).filter(Boolean);

export function isNavItemActive(item: Pick<DashboardNavItem, "href">, pathname: string): boolean {
  return item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
