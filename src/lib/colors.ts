/** 자산군별 색상 */
export const CATEGORY_COLORS: Record<string, string> = {
  주식: "#6366F1",
  리츠: "#F97316",
  원자재: "#EAB308",
  채권: "#22C55E",
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "#94A3B8";
}
