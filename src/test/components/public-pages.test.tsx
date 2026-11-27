// 공개 페이지(랜딩·정책·404)의 문구와 구성이 다시 템플릿·제작 메모로 돌아가지 않도록 지키는 테스트.
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import Home from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import AccountDeletionPage from "@/app/account-deletion/page";
import NotFound from "@/app/not-found";

const html = (component: () => React.ReactElement) => renderToStaticMarkup(createElement(component));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

test("랜딩: 제작 지시문·조사 오류·내부 사정 문구가 없다", () => {
  const body = text(html(Home));
  for (const phrase of ["참고 사이트", "우리 페이지", "우리 서비스", "가족연금계획를", "Play Store", "출시 준비", "한곳에서", "실행 중"]) {
    assert.ok(!body.includes(phrase), phrase);
  }
});

test("랜딩: 기록 도구 고지가 첫 화면 영역에 있고 첫 CTA는 가입이다", () => {
  const markup = html(Home);
  const firstSection = markup.slice(markup.indexOf("<main"), markup.indexOf("</section>"));
  assert.match(text(firstSection), /주문을 실행하지 않습니다/);
  assert.match(text(firstSection), /투자 자문이나 중개를 하지 않으며/);
  const signup = firstSection.indexOf('href="/signup"');
  const login = firstSection.indexOf('href="/login"');
  assert.ok(signup > 0 && login > signup, "본문 첫 CTA는 가입, 보조가 로그인");
});

test("랜딩: 제품 화면 예시는 '예시'로 표기하고 가짜 대시보드 수치가 없다", () => {
  const markup = html(Home);
  assert.equal((markup.match(/>예시</g) ?? []).length, 2);
  assert.match(text(markup), /은퇴 목표와 예상 월 현금흐름/);
  assert.match(text(markup), /연금계좌 세액공제 진행률/);
  for (const fake of ["128,400,000", "+7.8%", "620,000원"]) assert.ok(!markup.includes(fake), fake);
});

test("랜딩: 제목은 단어 중간에서 끊기지 않게 하고 둥근 모서리·블러를 쓰지 않는다", () => {
  const markup = html(Home);
  const headings = markup.match(/<h[12][^>]*>/g) ?? [];
  assert.ok(headings.length >= 4);
  for (const h of headings) assert.match(h, /break-keep/);
  assert.doesNotMatch(markup, /rounded-|backdrop-blur|bg-gradient/);
});

test("개인정보처리방침: 시행일과 8개 절이 그대로이고 줄표로 항목을 잇지 않는다", () => {
  const markup = html(PrivacyPage);
  const body = text(markup);
  assert.match(body, /시행일: 2026년 11월 27일/);
  for (const title of ["1. 수집하는 정보", "2. 이용 목적", "3. 처리 위탁 및 외부 전송", "4. 보관 및 삭제", "5. 이용자 권리", "6. 아동 및 민감정보", "7. 보안", "8. 문의"]) {
    assert.ok(body.includes(title), title);
  }
  assert.ok(body.includes("매수·매도 권유, 투자 자문, 중개, 수익 보장 기능을 제공하지 않습니다"));
  assert.ok(body.includes("jsDelivr"));
  assert.equal((body.match(/—/g) ?? []).length, 0);
  assert.doesNotMatch(markup, /rounded-|bg-indigo-600/);
  assert.match(markup, /href="\/account-deletion"/);
});

test("계정 삭제 안내: 카드·CTA 카드 없이 본문으로 읽힌다", () => {
  const markup = html(AccountDeletionPage);
  assert.match(text(markup), /최종 업데이트: 2026년 11월 27일/);
  assert.doesNotMatch(markup, /rounded-|bg-indigo-600|shadow-card/);
  assert.equal((markup.match(/<h1/g) ?? []).length, 1);
  assert.match(markup, /href="\/privacy"/);
});

test("404: 한글 안내와 이동 링크가 있다", () => {
  const markup = html(NotFound);
  assert.match(text(markup), /페이지를 찾을 수 없습니다/);
  assert.match(markup, /href="\/dashboard"/);
  assert.match(markup, /href="\/"/);
});
