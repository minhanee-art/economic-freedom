// 스토어(Play) 휴대전화 스크린샷 촬영 — docs/store/screenshots.md '3. 권장 구성' 8장을 재현한다.
//
// 직접 실행하기보다 저장소 루트에서:
//   E2E_SCRIPT=screenshots.mjs E2E_SCREENSHOT_DIR=<출력 폴더> ./scripts/mobile-e2e/run.sh
// (일회용 Postgres·더미 환경변수의 Next 서버·CORS 프록시·Expo web 을 띄우고 이 스크립트를 실행한 뒤 모두 정리한다.)
//
// 하는 일: 로컬 환경에 예시 계정(user@example.com)으로 가입 → API 로 예시 데이터 입력 → 8개 화면을 1080×1920 PNG 로 촬영(raw/)
//         → 상단 캡션을 얹은 스토어용 이미지 8장 합성(captioned/).
// 환경변수: E2E_APP_URL, E2E_API_URL, E2E_DIRECT_API_URL, PLAYWRIGHT_DIR (run.sh 가 채운다)
//           E2E_SCREENSHOT_DIR  출력 폴더(raw/, captioned/ 를 만든다). 기본: $E2E_OUT/screenshots
// 운영 주소로는 요청하지 않는다(localhost 만 허용). 모든 데이터는 예시이며 실제 개인정보를 쓰지 않는다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = (process.env.E2E_APP_URL ?? "http://localhost:8461").replace(/\/+$/, "");
const API_URL = (process.env.E2E_API_URL ?? "http://127.0.0.1:3462").replace(/\/+$/, "");
const DIRECT_API_URL = (process.env.E2E_DIRECT_API_URL ?? "http://127.0.0.1:3461").replace(/\/+$/, "");
const OUT_BASE = process.env.E2E_SCREENSHOT_DIR ?? path.join(process.env.E2E_OUT ?? path.join(here, "artifacts"), "screenshots");
const RAW_DIR = path.join(OUT_BASE, "raw");
const CAPTIONED_DIR = path.join(OUT_BASE, "captioned");
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? here, "noop.js"));
const { chromium, devices } = require("playwright");

for (const url of [APP_URL, API_URL, DIRECT_API_URL]) {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`로컬 주소만 허용합니다: ${url}`);
}
mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(CAPTIONED_DIR, { recursive: true });

const EMAIL = "user@example.com";
const PASSWORD = "Sample-pass-1234";

// 규격: 1080×1920. CSS 뷰포트 432×768 × deviceScaleFactor 2.5 = 1080×1920 (Pixel 급 폰의 가로 비율 9:16).
const VIEWPORT = { width: 432, height: 768 };
const SCALE = 2.5;

// docs/store/screenshots.md 표의 '상단 캡션(안)' 그대로.
const SHOTS = [
  { file: "phone-01-home", caption: "내가 입력한 연금·배당 자산을 한눈에" },
  { file: "phone-02-holdings", caption: "종목별 평가금액과 비중 확인" },
  { file: "phone-03-dividends", caption: "받은 배당과 예정 일정을 월별로" },
  { file: "phone-04-pension", caption: "가족 연금 계획을 한 화면에서" },
  { file: "phone-05-record-purchase", caption: "이미 한 거래를 직접 기록 (주문은 실행되지 않아요)" },
  { file: "phone-06-purchase-list", caption: "잘못 넣은 기록은 한 건씩 삭제" },
  { file: "phone-07-record-dividend", caption: "받은 배당도 앱에서 바로 기록" },
  { file: "phone-08-settings", caption: "내 데이터는 앱 안에서 직접 삭제" },
];

// ── 날짜(KST) ─────────────────────────────────────────
const kstDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
};
const today = kstDate(0);

// ── 도우미 ────────────────────────────────────────────
let page;
const visible = (locator) => locator.filter({ visible: true });
const text = (value, exact = false) => visible(page.getByText(value, { exact })).first();
const button = (name, exact = true) => visible(page.getByRole("button", { name, exact })).first();
const expectText = (value, timeout = 30000, exact = false) => text(value, exact).waitFor({ state: "visible", timeout });
const quiet = (promise) => {
  promise.catch(() => {});
  return promise;
};
const waitApi = (pathPart, method = "GET") =>
  quiet(page.waitForResponse((res) => res.url().includes(pathPart) && res.request().method() === method, { timeout: 45000 }));

async function apiDirect(pathname, { method = "GET", token, accountId, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (accountId) headers["x-portfolio-account-id"] = accountId;
  const res = await fetch(`${DIRECT_API_URL}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
async function must(label, promise, ok = [200, 201]) {
  const res = await promise;
  if (!ok.includes(res.status)) throw new Error(`${label} 실패: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

async function openTab(label) {
  await visible(page.getByRole("tab")).first().waitFor({ state: "visible", timeout: 60000 });
  await visible(page.getByRole("tab", { name: label })).first().click();
}
async function waitInputsReady(n) {
  await page.waitForFunction(
    (count) => {
      const inputs = [...document.querySelectorAll("input")].filter((el) => el.offsetParent !== null);
      return inputs.length >= count && inputs.every((el) => !el.disabled && !el.readOnly);
    },
    n,
    { timeout: 30000 }
  );
}
async function fillInputs(values) {
  await waitInputsReady(values.length);
  const inputs = visible(page.locator("input"));
  for (const [i, v] of values.entries()) await inputs.nth(i).fill(v);
}

/** 로딩 표시(스피너)가 없고 오류 카드가 없으며 글꼴이 준비될 때까지 기다린다(고정 sleep 없음). */
async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelectorAll('[role="progressbar"]:not([aria-valuenow])').length === 0, null, { timeout: 30000 });
  await visible(page.getByText("데이터를 불러오지 못했습니다")).first().waitFor({ state: "detached", timeout: 1000 }).catch(() => {
    throw new Error("오류 카드가 표시됨");
  });
  // 두 프레임 기다려 마지막 렌더가 끝난 상태로 찍는다.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 보이는 스크롤 영역을 맨 위로 되돌린다. */
async function scrollTop() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("*")) if (el.scrollTop > 0) el.scrollTop = 0;
  });
}
/** 주어진 글자를 가진 요소가 화면 위쪽(상단 여백 offset px)에 오도록 스크롤한다. */
async function scrollToText(value, offset = 12) {
  const handle = await text(value).elementHandle();
  await handle.evaluate((el, off) => {
    el.scrollIntoView({ block: "start" });
    let node = el.parentElement;
    while (node) {
      if (node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY !== "visible") {
        node.scrollTop -= off;
        break;
      }
      node = node.parentElement;
    }
  }, offset);
}

/** 입력란 포커스 테두리가 찍히지 않도록 포커스를 뺀다. */
async function blur() {
  await page.evaluate(() => document.activeElement?.blur?.());
}
/**
 * 주어진 글자 요소의 아래쪽이 화면 맨 아래(탭바·여백 bottomGap px 위)에 오도록 필요한 만큼만 스크롤한다.
 * 이미 들어와 있으면 스크롤하지 않는다. 반환: 스크롤한 CSS px.
 */
async function scrollIntoBottom(value, bottomGap = 16) {
  const handle = await text(value).elementHandle();
  return handle.evaluate((el, gap) => {
    const bottom = el.getBoundingClientRect().bottom;
    const tabBar = document.querySelector('[role="tablist"]');
    const limit = (tabBar && tabBar.offsetParent !== null ? tabBar.getBoundingClientRect().top : window.innerHeight) - gap;
    const delta = bottom - limit;
    if (delta <= 0) return 0;
    let node = el.parentElement;
    while (node) {
      if (node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY !== "visible") {
        node.scrollTop += delta;
        return delta;
      }
      node = node.parentElement;
    }
    return 0;
  }, bottomGap);
}

function pngSize(file) {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function shot(index) {
  await settle();
  // 화면 글자 검사: 예전 앱 이름·깨진 숫자가 찍히지 않게 한다.
  const body = await page.evaluate(() => document.body.innerText);
  for (const bad of ["경제적 자유", "NaN", "undefined", "Infinity"]) {
    if (body.includes(bad)) throw new Error(`${index}번 화면에 '${bad}' 가 보임`);
  }
  const file = path.join(RAW_DIR, `${SHOTS[index - 1].file}.png`);
  await page.screenshot({ path: file }); // 전체 페이지가 아니라 뷰포트 한 화면
  const { width, height } = pngSize(file);
  if (width !== 1080 || height !== 1920) throw new Error(`${file} 크기가 ${width}×${height} (기대 1080×1920)`);
  console.log(`✔ ${index}/8 ${path.basename(file)}`);
}

// ── 브라우저 ──────────────────────────────────────────
const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent: devices["Pixel 7"].userAgent,
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
page = await context.newPage();
page.on("dialog", (dialog) => dialog.accept());
const consoleProblems = [];
page.on("pageerror", (error) => consoleProblems.push(String(error.message).slice(0, 200)));

// 1. 가입(예시 계정)
await page.goto(`${APP_URL}/signup`, { waitUntil: "domcontentloaded", timeout: 180000 });
await expectText("이메일과 비밀번호로 계정을 만듭니다", 120000);
await fillInputs([EMAIL, PASSWORD, PASSWORD]);
const signup = waitApi("/api/mobile/auth/signup", "POST");
await button("회원가입").click();
if ((await signup).status() !== 201) throw new Error("가입 실패");
// 새 계정은 종목 없이 시작한다(홈 빈 상태). 예시 종목은 아래에서 API 로 넣는다.
await expectText("아직 종목이 없습니다");
const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem("economic-freedom-session") ?? "null"));
const token = session?.token;
if (!token) throw new Error("세션 토큰 없음");

// 2. 예시 데이터(API) ───────────────────────────────────
const api = (pathname, opts = {}) => apiDirect(pathname, { token, ...opts });

const accountsRes = await must("계좌 조회", api("/api/accounts"));
const mainId = accountsRes.accounts[0].id;
const makeAccount = async (name, ownerType, accountType) =>
  (await must(`${name} 추가`, api("/api/accounts", { method: "POST", body: { name, ownerType, accountType } }))).account.id;
const spouseId = await makeAccount("배우자 계좌", "spouse", "general");
const pensionSelfId = await makeAccount("내 연금저축", "self", "pension_savings");
const pensionSpouseId = await makeAccount("배우자 IRP", "spouse", "irp");

// 내 계좌: 예시 종목 5개를 0주로 만들고 아래 매수 기록으로 수량을 채운다. 시세는 current_price 를 직접 넣는다(외부 호출 없음).
// (예전에는 가입 때 자동 생성되던 기본 종목에서 골랐다 — 새 계정은 이제 빈 상태로 시작한다.)
const EXAMPLE_HOLDINGS = [
  { code: "305050", name: "ACE 코스피", category: "주식", sub_category: "국장", current_price: 57490, target_pct: 13 },
  { code: "161510", name: "PLUS 고배당주", category: "주식", sub_category: "배당", current_price: 25120, target_pct: 10 },
  { code: "458730", name: "TIGER 미국배당다우존스", category: "주식", sub_category: "배당", current_price: 14635, target_pct: 10 },
  { code: "316300", name: "ACE 싱가포르리츠", category: "리츠", sub_category: "리츠", current_price: 14245, target_pct: 5 },
  { code: "319640", name: "TIGER 골드선물(H)", category: "원자재", sub_category: "금", current_price: 27810, target_pct: 7 },
];
for (const body of EXAMPLE_HOLDINGS) await must("예시 종목", api("/api/holdings", { method: "POST", accountId: mainId, body }));
const created = await must("종목 조회", api("/api/holdings", { accountId: mainId }));
const byCode = new Map(created.map((h) => [h.code, h]));
for (const { code } of EXAMPLE_HOLDINGS) if (!byCode.has(code)) throw new Error(`예시 종목 ${code} 없음`);

// 매수 기록(과거 날짜). 일부 종목은 평균 매입가가 현재가보다 높아 평가손실이 난다.
const days = (n) => kstDate(-n);
const PURCHASES = [
  [210, [["305050", 600, 51200]]],
  [180, [["161510", 1200, 26300]]],
  [150, [["458730", 2000, 14050]]],
  [120, [["316300", 1500, 15800]]],
  [95, [["305050", 200, 55800]]],
  [75, [["319640", 400, 29200]]],
  [60, [["161510", 300, 25900]]],
  [40, [["458730", 500, 14400]]],
  [10, [["305050", 100, 57000], ["458730", 300, 14600]]],
];
for (const [ago, items] of PURCHASES) {
  await must("매수 기록", api("/api/purchases", {
    method: "POST",
    accountId: mainId,
    body: { date: days(ago), items: items.map(([code, quantity, price]) => ({ holdingId: byCode.get(code).id, quantity, price, cost: quantity * price })) },
  }));
}

// 배당 수령 기록: 최근 12개월 중 지급 달만(촬영일 이후 날짜는 서버가 거부).
const PAY = { "458730": { every: 1, amount: 210_000 }, "161510": { months: [3, 6, 9, 12], amount: 560_000 }, "316300": { months: [2, 5, 8, 11], amount: 380_000 } };
const nowKst = new Date(`${today}T00:00:00+09:00`);
for (let back = 0; back < 12; back += 1) {
  const d = new Date(nowKst.getFullYear(), nowKst.getMonth() - back, 15);
  const date = new Intl.DateTimeFormat("en-CA").format(d);
  if (date > today) continue;
  for (const [code, rule] of Object.entries(PAY)) {
    if (rule.months && !rule.months.includes(d.getMonth() + 1)) continue;
    await must("배당 기록", api("/api/dividends", { method: "POST", accountId: mainId, body: { holdingId: byCode.get(code).id, amount: rule.amount, date } }));
  }
}

// 촬영일 이후의 배당 일정
const CALENDAR = [
  [9, "TIGER 미국배당다우존스", "분배금"],
  [24, "PLUS 고배당주", "분배금"],
  [38, "ACE 싱가포르리츠", "분배금"],
  [52, "TIGER 미국배당다우존스", "분배금"],
  [66, "ACE 코스피", "분배금"],
];
for (const [ahead, stock, type] of CALENDAR) {
  await must("배당 일정", api("/api/dividend-calendar", { method: "POST", accountId: mainId, body: { date: kstDate(ahead), stock, type } }));
}

// 배우자 계좌: 종목 2개
await must("배우자 종목", api("/api/holdings", { method: "POST", accountId: spouseId, body: { code: "360750", name: "TIGER 미국S&P500", category: "주식", current_price: 21430, shares: 300, avg_price: 20100, target_pct: 60 } }));
await must("배우자 종목", api("/api/holdings", { method: "POST", accountId: spouseId, body: { code: "305080", name: "TIGER 미국채10년선물", category: "채권", current_price: 13580, shares: 400, avg_price: 14100, target_pct: 40 } }));

// 배우자 계좌 배당 수령 기록(분기별 소액)
const spouseHoldings = await must("배우자 종목 조회", api("/api/holdings", { accountId: spouseId }));
const spouseEquity = spouseHoldings.find((h) => h.code === "360750");
for (const back of [1, 4, 7]) {
  const d = new Date(nowKst.getFullYear(), nowKst.getMonth() - back, 20);
  const date = new Intl.DateTimeFormat("en-CA").format(d);
  if (date <= today) await must("배우자 배당", api("/api/dividends", { method: "POST", accountId: spouseId, body: { holdingId: spouseEquity.id, amount: 45_000 + back * 500, date } }));
}

// 연금 계좌에도 예시 종목을 넣어 은퇴 시점 '개인연금' 예상이 채워지게 한다(시세는 current_price 직접 입력).
await must("연금저축 종목", api("/api/holdings", { method: "POST", accountId: pensionSelfId, body: { code: "360750", name: "TIGER 미국S&P500", category: "주식", current_price: 21430, shares: 1800, avg_price: 19800, target_pct: 100 } }));
await must("IRP 종목", api("/api/holdings", { method: "POST", accountId: pensionSpouseId, body: { code: "305080", name: "TIGER 미국채10년선물", category: "채권", current_price: 13580, shares: 1500, avg_price: 14000, target_pct: 100 } }));

// 연금: 본인·배우자 연금 계좌의 올해 납입(서버가 쓰는 연도에 맞춘다), 은퇴 목표(+총급여 구간), 연금 소득원
const year = (await must("요약", api("/api/pension/summary"))).year;
await must("납입", api("/api/pension/contributions", { method: "PUT", body: { accountId: pensionSelfId, year, amount: 4_200_000 } }));
await must("납입", api("/api/pension/contributions", { method: "PUT", body: { accountId: pensionSpouseId, year, amount: 3_000_000 } }));
await must("은퇴 목표", api("/api/pension/goal", {
  method: "PATCH",
  body: { targetMonthly: 2_500_000, retirementAge: 65, birthYear: 1978, spouseBirthYear: 1980, expectedReturnPct: 4, salaryBracket: "low", spouseSalaryBracket: "high" },
}));
for (const source of [
  { member: "self", sourceType: "national_pension", monthlyAmount: 1_100_000, startAge: 65 },
  { member: "self", sourceType: "retirement_pension", monthlyAmount: 450_000, startAge: 60 },
  { member: "spouse", sourceType: "national_pension", monthlyAmount: 650_000, startAge: 65 },
]) {
  await must("연금 소득원", api("/api/pension/income-sources", { method: "POST", body: source }));
}
// 연금 계좌에 보유 종목은 넣지 않는다(납입액만 사용).
console.log(`예시 데이터 준비 완료: 계좌 4개, 올해(${year}) 납입 기록, 매수 ${PURCHASES.length}건`);

// 3. 촬영 ──────────────────────────────────────────────
await page.reload({ waitUntil: "domcontentloaded" });
await expectText("총 평가금액", 60000);

// 1 홈
await openTab("홈");
await expectText("총 평가금액");
await expectText("남은 공제 한도");
await expectText("내 연금저축"); // 계좌 칩
await scrollTop();
await shot(1);

// 2 자산
await openTab("자산");
await expectText("TIGER 미국배당다우존스");
await expectText(/^종목 \d+개$/);
await scrollTop();
await shot(2);

// 3 배당
await openTab("배당");
await expectText("예상 연 배당");
await expectText("예정 일정");
await expectText(kstDate(9));
await scrollTop();
await scrollToText("예상 연 배당", 28);
await shot(3);

// 4 연금
await openTab("연금");
await expectText("연금 설계");
await expectText("명의자별 계산");
await expectText("은퇴 시점 예상 월 현금흐름");
await scrollTop();
await scrollToText(`${year}년 세액공제 납입`, 16);
await shot(4);

/** 계좌 칩을 눌러 계좌를 바꾼다(선택 상태가 반영될 때까지 조건 대기). */
async function selectAccountChip(name) {
  const chip = visible(page.getByRole("radio", { name: new RegExp(name) })).first();
  await chip.waitFor({ state: "visible", timeout: 30000 });
  await chip.click();
  await page.waitForFunction(
    (label) => [...document.querySelectorAll('[role="radio"]')].some((el) => el.offsetParent !== null && el.textContent.includes(label) && el.getAttribute("aria-selected") === "true"),
    name,
    { timeout: 30000 }
  );
}

// 5 매수 기록 추가 (입력 후 기록 금액이 보이는 상태) — 종목이 적은 배우자 계좌로 찍어 안내문·입력·기록 금액이 한 화면에 들어오게 한다
await openTab("자산");
await expectText(/^종목 \d+개$/);
await selectAccountChip("배우자 계좌");
await expectText("TIGER 미국S&P500");
await button("매수 기록 추가").click();
await expectText("이미 한 거래를 기록합니다");
await expectText("기록할 계좌");
await expectText("배우자 계좌 · 배우자");
await visible(page.getByRole("radio", { name: /TIGER 미국S&P500/ })).first().click();
await fillInputs(["100", "21500", today]);
await expectText("기록 금액 2,150,000원");
await blur();
await scrollTop();
await shot(5);
await page.goBack();

// 6 매수 기록 목록과 삭제 버튼 — 기록이 많은 내 계좌. (웹 타깃의 삭제 확인은 브라우저 confirm 이라 화면에 찍히지 않는다 → 삭제 버튼이 보이는 목록 상태)
await openTab("자산");
await selectAccountChip("내 계좌");
await expectText("TIGER 미국배당다우존스");
await button("매수 기록 추가").click();
await expectText("이미 한 거래를 기록합니다");
await expectText("내 계좌 · 본인");
await expectText("최근 매수 기록");
await expectText("TIGER 미국배당다우존스 300주");
await scrollToText("최근 매수 기록", 8);
await shot(6);
await page.goBack();

// 7 배당 수령 기록 (배우자 계좌)
await openTab("배당");
await expectText("예상 연 배당");
await selectAccountChip("배우자 계좌");
await button("배당 수령 기록 추가").click();
await expectText("이미 받은 배당을 기록합니다");
await expectText("배우자 계좌 · 배우자");
await visible(page.getByRole("radio", { name: /TIGER 미국S&P500/ })).first().click();
await fillInputs(["48000", today]);
await expectText("최근 배당 수령 기록");
await expectText(/\d원$/);
await blur();
await scrollTop();
await shot(7);
await page.goBack();
await selectAccountChip("내 계좌");

// 8 설정
await openTab("설정");
await expectText(EMAIL);
// 비밀번호 카드는 설정 여부를 서버에 물은 뒤에 버튼을 그린다 — 로딩 문구가 아니라 실제 버튼이 보인 뒤에 찍는다.
await visible(page.getByRole("button", { name: /^비밀번호 (변경|설정)$/ })).first().waitFor({ state: "visible", timeout: 30000 });
await expectText("계정 삭제 안내");
await scrollTop();
await shot(8);

// 4. 캡션 합성 ──────────────────────────────────────────
// 배경·글자색은 mobile/src/styles/theme.ts 의 색을 따른다.
const themeSource = readFileSync(path.join(here, "..", "src", "styles", "theme.ts"), "utf8");
const color = (name) => {
  const m = themeSource.match(new RegExp(`${name}:\\s*"(#[0-9a-fA-F]{6})"`));
  if (!m) throw new Error(`theme.ts 에서 ${name} 색을 찾지 못함`);
  return m[1];
};
const BG = color("brandDark");
const BAND_TEXT = color("surface");
const FRAME = color("ink");

const compose = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, locale: "ko-KR" });
const composePage = await compose.newPage();
const BAND = 330; // 캡션 띠 높이
const IMG_H = 1920 - BAND - 70; // 화면 이미지 높이(아래 여백 70)
const IMG_W = Math.round((IMG_H * 1080) / 1920);
for (const [i, item] of SHOTS.entries()) {
  const raw = readFileSync(path.join(RAW_DIR, `${item.file}.png`)).toString("base64");
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
    html,body{margin:0;width:1080px;height:1920px;background:${BG};overflow:hidden;font-family:"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
    .band{height:${BAND}px;display:flex;align-items:center;justify-content:center;padding:0 80px;box-sizing:border-box;text-align:center;
      color:${BAND_TEXT};font-size:62px;font-weight:700;line-height:1.3;letter-spacing:-1px;word-break:keep-all}
    .shot{display:block;margin:0 auto;width:${IMG_W}px;height:${IMG_H}px;border-radius:44px;border:6px solid ${FRAME};box-sizing:border-box;object-fit:cover;object-position:top}
  </style><div class="band"><span>${item.caption}</span></div><img class="shot" src="data:image/png;base64,${raw}"></html>`;
  await composePage.setContent(html, { waitUntil: "load" });
  await composePage.evaluate(() => document.fonts.ready);
  const file = path.join(CAPTIONED_DIR, `${item.file}-captioned.png`);
  await composePage.screenshot({ path: file });
  const { width, height } = pngSize(file);
  if (width !== 1080 || height !== 1920) throw new Error(`${file} 크기가 ${width}×${height}`);
  console.log(`✔ 캡션 합성 ${i + 1}/8 ${path.basename(file)}`);
}

await browser.close();
writeFileSync(path.join(OUT_BASE, "capture-info.json"), JSON.stringify({ email: EMAIL, date: today, year, viewport: VIEWPORT, scale: SCALE, shots: SHOTS, consoleProblems }, null, 2));
console.log(`\n완료: ${RAW_DIR} (원본 8장), ${CAPTIONED_DIR} (캡션 8장)`);
if (consoleProblems.length) console.log(`페이지 오류 ${consoleProblems.length}건: ${consoleProblems.join(" | ")}`);
