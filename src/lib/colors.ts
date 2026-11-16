/** 자산군별 색상 */
export const CATEGORY_COLORS: Record<string, string> = {
  주식: "#533afd",
  리츠: "#F97316",
  원자재: "#EAB308",
  채권: "#22C55E",
};

/** 비교 화면 시리즈(종목) 색상 — 순서대로 배정 */
export const SERIES_COLORS = ["#533afd", "#F97316", "#22C55E", "#EF4444", "#EAB308"];

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "#94A3B8";
}
