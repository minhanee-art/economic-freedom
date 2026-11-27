"use client";

// recharts 는 무거워서 차트가 있는 화면의 첫 번들에서 뺀다(next/dynamic, 클라이언트 전용).
// 불러오는 동안은 차트와 같은 높이의 자리 표시를 그려 레이아웃이 밀리지 않게 한다.
import dynamic from "next/dynamic";

function ChartPlaceholder({ height }: { height: string }) {
  return <div aria-hidden="true" className={`${height} w-full animate-pulse bg-canvas-soft`} />;
}

export const LazyAllocationBarChart = dynamic(
  () => import("./allocation-bar-chart").then((m) => m.AllocationBarChart),
  { ssr: false, loading: () => <ChartPlaceholder height="h-50" /> }
);

export const LazyCategoryPieChart = dynamic(
  () => import("./category-pie-chart").then((m) => m.CategoryPieChart),
  { ssr: false, loading: () => <ChartPlaceholder height="h-40" /> }
);

export const LazyPnLAreaChart = dynamic(
  () => import("./pnl-area-chart").then((m) => m.PnLAreaChart),
  { ssr: false, loading: () => <ChartPlaceholder height="h-55" /> }
);

export const LazyDividendBarChart = dynamic(
  () => import("./dividend-bar-chart").then((m) => m.DividendBarChart),
  { ssr: false, loading: () => <ChartPlaceholder height="h-50" /> }
);
