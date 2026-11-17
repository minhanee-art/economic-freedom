import test from "node:test";
import assert from "node:assert/strict";

import {
  inferHoldingClassification,
  normalizePortfolioCategory,
} from "@/lib/holding-classification";

test("inferHoldingClassification: 기본 종목명을 분류한다", () => {
  const cases: [string, string, string][] = [
    ["ACE 코스피", "주식", "국장"],
    ["ACE 코스닥150", "주식", "국장"],
    ["PLUS 고배당주", "주식", "배당"],
    ["TIGER 미국배당다우존스", "주식", "배당"],
    ["KODEX 인도Nifty50", "주식", "인도"],
    ["TIGER 필라델피아반도체", "주식", "신기술"],
    ["ACE 테슬라밸류체인", "주식", "테슬라"],
    ["ACE 싱가포르리츠", "리츠", "리츠"],
    ["TIGER 미국MSCI리츠", "리츠", "리츠"],
    ["TIGER 골드선물(H)", "원자재", "금"],
    ["KODEX 은선물(H)", "원자재", "은"],
    ["KODEX WTI원유선물(H)", "원자재", "원유"],
    ["TIGER 미국채10년선물", "채권", "채권"],
  ];
  for (const [name, category, subCategory] of cases) {
    assert.deepEqual(
      inferHoldingClassification(name),
      { category, subCategory },
      `${name} → ${category}/${subCategory}`
    );
  }
});

test("inferHoldingClassification: 대소문자와 공백을 무시한다", () => {
  assert.equal(inferHoldingClassification("tiger gold 선물").subCategory, "금");
  assert.equal(inferHoldingClassification("  KODEX  미국채10년선물  ").category, "채권");
});

test("inferHoldingClassification: 시장 구분을 힌트로 쓴다", () => {
  assert.deepEqual(inferHoldingClassification("알 수 없는 종목", "국장"), {
    category: "주식",
    subCategory: "국장",
  });
  assert.deepEqual(inferHoldingClassification("알 수 없는 종목"), {
    category: "주식",
    subCategory: "기타",
  });
});

test("inferHoldingClassification: 자산군 키워드가 주식 키워드보다 우선한다", () => {
  assert.equal(inferHoldingClassification("미국 리츠 배당").category, "리츠");
  assert.equal(inferHoldingClassification("미국채 배당").category, "채권");
});

test("normalizePortfolioCategory: 목록에 없는 값은 주식으로 처리한다", () => {
  assert.equal(normalizePortfolioCategory("주식"), "주식");
  assert.equal(normalizePortfolioCategory("리츠"), "리츠");
  assert.equal(normalizePortfolioCategory("원자재"), "원자재");
  assert.equal(normalizePortfolioCategory("채권"), "채권");
  assert.equal(normalizePortfolioCategory("코인"), "주식");
  assert.equal(normalizePortfolioCategory(""), "주식");
});
