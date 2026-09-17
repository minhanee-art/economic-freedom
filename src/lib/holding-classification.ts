import { CATEGORIES } from "@/lib/constants";

export type PortfolioCategory = (typeof CATEGORIES)[number];

export type HoldingClassification = {
  category: PortfolioCategory;
  subCategory: string;
};

export function inferHoldingClassification(
  name: string,
  marketCategory = ""
): HoldingClassification {
  const text = `${name} ${marketCategory}`.replace(/\s/g, "").toLocaleUpperCase("ko-KR");

  if (matchesAny(text, ["리츠", "REIT", "부동산"])) {
    return { category: "리츠", subCategory: "리츠" };
  }

  if (matchesAny(text, ["채권", "국채", "회사채", "통안채", "미국채", "TREASURY", "BOND", "채"] )) {
    return { category: "채권", subCategory: "채권" };
  }

  if (matchesAny(text, ["골드", "금선물", "금현물", "GOLD"])) {
    return { category: "원자재", subCategory: "금" };
  }

  if (matchesAny(text, ["은선물", "은현물", "SILVER"])) {
    return { category: "원자재", subCategory: "은" };
  }

  if (matchesAny(text, ["원유", "WTI", "OIL", "CRUDE"])) {
    return { category: "원자재", subCategory: "원유" };
  }

  if (matchesAny(text, ["원자재", "구리", "농산물", "COMMODITY", "COPPER"])) {
    return { category: "원자재", subCategory: "원자재" };
  }

  return { category: "주식", subCategory: inferStockSubCategory(text, marketCategory) };
}

export function normalizePortfolioCategory(value: string): PortfolioCategory {
  return (CATEGORIES as readonly string[]).includes(value) ? value as PortfolioCategory : "주식";
}

function inferStockSubCategory(text: string, marketCategory: string): string {
  if (matchesAny(text, ["배당", "DIVIDEND", "다우존스"])) return "배당";
  if (matchesAny(text, ["인도", "INDIA", "NIFTY"])) return "인도";
  if (matchesAny(text, ["테슬라", "TESLA", "TSLA"])) return "테슬라";
  if (matchesAny(text, ["반도체", "필라델피아", "SEMICONDUCTOR", "SOX"])) return "신기술";
  if (matchesAny(text, ["나스닥", "NASDAQ", "S&P", "SP500", "미국", "US"])) return "미국";
  if (matchesAny(text, ["코스피", "코스닥", "KOSPI", "KOSDAQ"])) return "국장";
  return marketCategory.trim() || "기타";
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLocaleUpperCase("ko-KR")));
}
