/** 자산군별 색상 — 흰 바탕 3:1 이상(그래픽 대비), 손익 색(빨강·파랑)과 겹치지 않게 고른다 */
export const CATEGORY_COLORS: Record<string, string> = {
  주식: "#533afd",
  리츠: "#c2410c",
  원자재: "#a16207",
  채권: "#0f766e",
};

/** 비교 화면 시리즈(종목) 색상 — 순서대로 배정. 흰 글자 4.9:1 이상(칩 배경으로도 씀) */
export const SERIES_COLORS = ["#533afd", "#c2410c", "#0f766e", "#a16207", "#be185d"];

/** 차트의 목표·보조 계열(점선) */
export const CHART_MUTED = "#7c8696";

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CHART_MUTED;
}
