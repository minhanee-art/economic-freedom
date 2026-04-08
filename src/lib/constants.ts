export const APP_NAME = "Pension Manager";
export const MAX_WIDTH = "max-w-[860px]";

export const CATEGORIES = ["주식", "리츠", "원자재", "채권"] as const;

export const SUB_CATEGORIES = [
  "국장", "배당", "인도", "신기술", "테슬라",
  "리츠", "금", "원유", "은", "채권",
] as const;

// 기본 종목 (DB 트리거와 동일)
export const DEFAULT_HOLDINGS = [
  { code: "305050", name: "ACE 코스피",            category: "주식",   sub_category: "국장",   current_price: 57490, target_pct: 13.0 },
  { code: "354500", name: "ACE 코스닥150",          category: "주식",   sub_category: "국장",   current_price: 17830, target_pct: 10.0 },
  { code: "161510", name: "PLUS 고배당주",          category: "주식",   sub_category: "배당",   current_price: 25120, target_pct: 10.0 },
  { code: "458730", name: "TIGER 미국배당다우존스",  category: "주식",   sub_category: "배당",   current_price: 14635, target_pct: 10.0 },
  { code: "453810", name: "KODEX 인도Nifty50",      category: "주식",   sub_category: "인도",   current_price: 12560, target_pct: 5.0 },
  { code: "497570", name: "TIGER 필라델피아반도체",  category: "주식",   sub_category: "신기술", current_price: 17040, target_pct: 5.0 },
  { code: "316300", name: "ACE 싱가포르리츠",       category: "리츠",   sub_category: "리츠",   current_price: 14245, target_pct: 5.0 },
  { code: "319640", name: "TIGER 골드선물(H)",      category: "원자재", sub_category: "금",     current_price: 27810, target_pct: 7.0 },
  { code: "261220", name: "KODEX WTI원유선물(H)",   category: "원자재", sub_category: "원유",   current_price: 27850, target_pct: 5.0 },
  { code: "305080", name: "TIGER 미국채10년선물",   category: "채권",   sub_category: "채권",   current_price: 13580, target_pct: 5.0 },
  { code: "237350", name: "KODEX 코스피100",        category: "주식",   sub_category: "국장",   current_price: 65500, target_pct: 0.0 },
  { code: "457480", name: "ACE 테슬라밸류체인",     category: "주식",   sub_category: "테슬라", current_price: 20305, target_pct: 0.0 },
  { code: "182480", name: "TIGER 미국MSCI리츠",     category: "리츠",   sub_category: "리츠",   current_price: 12890, target_pct: 0.0 },
  { code: "144600", name: "KODEX 은선물(H)",        category: "원자재", sub_category: "은",     current_price: 11960, target_pct: 0.0 },
  { code: "153130", name: "KODEX 단기채권",         category: "채권",   sub_category: "채권",   current_price: 113390, target_pct: 0.0 },
] as const;
