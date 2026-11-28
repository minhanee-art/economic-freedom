// 모바일 앱(Expo web 타깃) 종단 간 스모크 테스트 — Playwright(Chromium, 모바일 뷰포트).
//
// 직접 실행하기보다 저장소 루트의 scripts/mobile-e2e/run.sh 를 쓴다(DB·서버·Expo 를 띄우고 정리까지 한다).
// 이 파일만 따로 돌릴 때 필요한 환경변수:
//   E2E_APP_URL         Expo web 주소 (예: http://localhost:8461)
//   E2E_API_URL         앱이 쓰는 API 주소(EXPO_PUBLIC_API_BASE_URL 과 같게, 예: CORS 프록시 http://127.0.0.1:3462)
//   E2E_DIRECT_API_URL  Next 서버 직접 주소(CORS 확인·데이터 준비용, 예: http://127.0.0.1:3461)
//   E2E_OUT             스크린샷·결과 JSON 저장 경로 (기본: mobile/e2e/artifacts — .gitignore 처리됨)
//   PLAYWRIGHT_DIR      playwright 패키지가 설치된 디렉터리(node_modules 의 부모). 저장소에 넣지 않고 임시 설치해 쓴다.
//
// 결과: 단계별 통과/실패와 콘솔 오류·실패한 요청을 표준 출력과 $E2E_OUT/results.json 에 남긴다.
// 하나라도 실패하면 종료 코드 1.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = (process.env.E2E_APP_URL ?? "http://localhost:8461").replace(/\/+$/, "");
const API_URL = (process.env.E2E_API_URL ?? "http://127.0.0.1:3462").replace(/\/+$/, "");
const DIRECT_API_URL = (process.env.E2E_DIRECT_API_URL ?? "http://127.0.0.1:3461").replace(/\/+$/, "");
const OUT = process.env.E2E_OUT ?? path.join(here, "artifacts");
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? here, "noop.js"));
const { chromium, devices } = require("playwright");

// 운영 주소로는 어떤 요청도 보내지 않는다.
for (const url of [APP_URL, API_URL, DIRECT_API_URL]) {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`로컬 주소만 허용합니다: ${url}`);
}

mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `e2e-${stamp}@example.test`;
const PASSWORD = "E2e-pass-1234";
const NEW_PASSWORD = "E2e-pass-5678";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// ── 관찰 기록 ─────────────────────────────────────────
const results = [];
let current = null;
const apiLog = []; // { step, method, url, accountHeader, status }

function note(kind, detail) {
  if (current) current[kind].push(detail);
}

async function step(name, fn) {
  current = { name, status: "통과", error: null, consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], notes: [] };
  results.push(current);
  const started = Date.now();
  try {
    await fn(current);
  } catch (error) {
    current.status = "실패";
    current.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
    await shot(`FAIL-${results.length}`).catch(() => {});
  }
  current.ms = Date.now() - started;
  const mark = current.status === "통과" ? "✔" : "✘";
  console.log(`${mark} ${name}${current.error ? ` — ${current.error}` : ""}`);
  for (const kind of ["consoleErrors", "consoleWarnings", "pageErrors", "failedRequests", "notes"]) {
    for (const item of current[kind]) console.log(`    · ${kind}: ${item}`);
  }
}

let page;
let shotIndex = 0;
async function shot(label) {
  shotIndex += 1;
  const file = path.join(OUT, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  note("notes", `screenshot ${path.relative(process.cwd(), file)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── 화면 조작 도우미 ────────────────────────────────────
// 스택 화면은 웹에서도 이전 화면을 DOM 에 남겨 두므로 보이는 요소만 대상으로 한다.
const visible = (locator) => locator.filter({ visible: true });
const text = (value, exact = false) => visible(page.getByText(value, { exact })).first();
const button = (name, exact = true) => visible(page.getByRole("button", { name, exact })).first();
// 계좌 칩·기록 화면의 종목 선택은 라디오 묶음(accessibilityRole="radio")이다.
const radio = (name, exact = false) => visible(page.getByRole("radio", { name, exact })).first();

async function expectText(value, timeout = 30000, exact = false) {
  await text(value, exact).waitFor({ state: "visible", timeout });
}

async function openTab(label) {
  // 새로고침 직후에는 탭바가 아직 없을 수 있어 나타날 때까지 기다린 뒤 고른다(없는 채로 링크를 찾다 시간 초과되지 않게).
  await visible(page.getByRole("tab")).first().waitFor({ state: "visible", timeout: 60000 });
  const tab = visible(page.getByRole("tab", { name: label })).first();
  if (await tab.count()) await tab.click();
  else await visible(page.getByRole("link", { name: label })).first().click();
}

/** 조건 대기: 화면에 보이는 입력란이 n 개 이상이고 모두 수정 가능해질 때까지(고정 sleep 대신). */
async function waitInputsReady(n, timeout = 30000) {
  await page.waitForFunction(
    (count) => {
      const inputs = [...document.querySelectorAll("input")].filter((el) => el.offsetParent !== null);
      return inputs.length >= count && inputs.every((el) => !el.disabled && !el.readOnly);
    },
    n,
    { timeout }
  );
}

/** 조건 대기: 요소의 속성이 기대값이 될 때까지(클릭 직후 한 번 읽어 비교하면 부하가 높을 때 상태 반영 전일 수 있다). */
async function waitAttr(locator, name, expected, timeout = 15000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    // 다시 그려지며 요소가 바뀔 수 있으므로 매번 로케이터로 다시 읽는다(핸들 고정 X).
    const value = await locator.getAttribute(name, { timeout: 2000 }).catch(() => null);
    if (value === expected) return;
    if (Date.now() > deadline) throw new Error(`${name} 가 ${expected} 가 되지 않음(현재 ${value})`);
    await page.waitForTimeout(100);
  }
}

async function fillInputs(values) {
  await waitInputsReady(values.length);
  const inputs = visible(page.locator("input"));
  for (const [index, value] of values.entries()) {
    if (value === null) continue;
    await inputs.nth(index).fill(value);
  }
}

/** 화면이 보내는 다음 API 요청(경로 포함 일치)을 기다린다. */
// 단계가 먼저 실패하면 기다리던 약속이 나중에 거부되므로, 처리되지 않은 거부로 프로세스가 죽지 않게 한다.
function quiet(promise) {
  promise.catch(() => {});
  return promise;
}

function waitApi(pathPart, method = "GET") {
  return quiet(page.waitForResponse((res) => res.url().includes(pathPart) && res.request().method() === method, { timeout: 45000 }));
}

async function apiDirect(pathname, { method = "GET", token, accountId, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (accountId) headers["x-portfolio-account-id"] = accountId;
  const res = await fetch(`${DIRECT_API_URL}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/** 웹 폴백 저장소(localStorage)에서 세션을 읽는다 — 테스트 검증용. */
async function storedSession() {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("economic-freedom-session");
    return raw ? JSON.parse(raw) : null;
  });
}

// ── 실행 ──────────────────────────────────────────────
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"], locale: "ko-KR", timezoneId: "Asia/Seoul" });
page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") note("consoleErrors", msg.text().slice(0, 300));
  // 경고는 실패로 보지 않고, 같은 문구는 한 번만 남긴다.
  if (msg.type() === "warning" && !results.some((r) => r.consoleWarnings.includes(msg.text().slice(0, 300)))) {
    note("consoleWarnings", msg.text().slice(0, 300));
  }
});
page.on("pageerror", (error) => note("pageErrors", String(error.message).slice(0, 300)));
page.on("requestfailed", (req) => note("failedRequests", `${req.method()} ${req.url()} — ${req.failure()?.errorText}`));
page.on("response", (res) => {
  const req = res.request();
  if (!res.url().startsWith(API_URL) && !res.url().startsWith(DIRECT_API_URL)) return;
  const entry = {
    step: current?.name,
    method: req.method(),
    url: res.url().replace(API_URL, ""),
    accountHeader: req.headers()["x-portfolio-account-id"] ?? null,
    status: res.status(),
  };
  apiLog.push(entry);
  if (res.status() >= 400 && req.method() !== "OPTIONS") note("failedRequests", `${entry.method} ${entry.url} → HTTP ${entry.status}`);
});
// Alert.alert 의 웹 폴백(window.confirm)은 항상 확인으로 답한다. 메시지는 기록한다.
page.on("dialog", async (dialog) => {
  note("notes", `dialog(${dialog.type()}): ${dialog.message().slice(0, 120)}`);
  await dialog.accept();
});

let token = null;
let firstAccountId = null;
let spouseAccountId = null;

await step("앱 첫 화면(로그인 전) 렌더링", async () => {
  // 첫 요청은 Metro 가 번들을 처음 만드는 시간이 걸려 부하가 높으면 30초를 넘는다 → 로드 완료 대신 화면 문구를 조건으로 기다린다.
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 180000 });
  await expectText("로그인하면 내 포트폴리오", 120000);
  await shot("login");
});

await step("CORS: 앱 출처에서 Next 서버 직접 호출(웹 타깃 한정 확인)", async (s) => {
  const outcome = await page.evaluate(async (url) => {
    try {
      const res = await fetch(`${url}/api/accounts`, { headers: { Authorization: "Bearer x" } });
      return `응답 ${res.status}`;
    } catch (error) {
      return `차단: ${error}`;
    }
  }, DIRECT_API_URL);
  // 브라우저 콘솔의 CORS 오류는 예상된 것이므로 이 단계의 기록에서 분리한다.
  s.notes.push(`직접 호출 결과: ${outcome} (서버가 Access-Control-Allow-Origin 을 보내지 않음 → 웹 타깃은 프록시 필요, 네이티브는 영향 없음)`);
  s.consoleErrors.length = 0;
  s.failedRequests.length = 0;
  assert(outcome.startsWith("차단"), `예상과 달리 직접 호출이 통과했습니다: ${outcome}`);
});

await step("회원가입", async () => {
  await page.goto(`${APP_URL}/signup`, { waitUntil: "networkidle" });
  await expectText("이메일과 비밀번호로 계정을 만듭니다");
  await fillInputs([EMAIL, PASSWORD, PASSWORD]);
  const signup = waitApi("/api/mobile/auth/signup", "POST");
  await button("회원가입").click();
  const res = await signup;
  assert(res.status() === 201, `가입 응답 ${res.status()}`);
  // 새 계정은 종목 없이 시작한다 — 홈은 0원 요약 대신 빈 상태
  await expectText("아직 종목이 없습니다");
  const session = await storedSession();
  assert(session?.token, "세션이 저장되지 않았습니다");
  token = session.token;
  await shot("home-after-signup");
});

// ── 신규 계정(종목 없이 시작) ────────────────────────────
// 가입 직후 계정에는 종목이 없다. 앱에서 종목 2개를 추가하고 그중 하나를 매수 기록해, 0주 종목 접기까지 확인한다.
// 이후 단계가 API 로 10주짜리 종목을 시드하므로, 그 전에 확인한다.
const FRESH_HOLDINGS = [
  { name: "신규테스트주식ETF", code: "E2E101" },
  { name: "신규테스트채권ETF", code: "E2E102" },
];
let freshHoldingCount = 0;
let freshPickedName = "";

/** 기록 화면의 종목 선택 목록 상태: 0주 종목 버튼 수, 접기/보기 토글 문구, 보유 종목 버튼 이름. */
async function pickerState() {
  // 계좌 배너는 요약 응답이 도착한 뒤에 그려진다 — 종목 목록도 같은 응답이므로 이를 조건으로 기다린다(요약을 받기 전에는 종목 목록을 그리지 않는다).
  await expectText("기록할 계좌");
  // 계좌 바꾸기 안내는 배너의 ⓘ 말풍선으로 옮겼다 — 버튼(접근성 이름)이 그려졌는지로 배너 렌더를 확인한다.
  await visible(page.getByRole("button", { name: "계좌 바꾸기 안내", exact: true })).first().waitFor({ state: "visible", timeout: 30000 });
  return page.evaluate(() => {
    const shown = (el) => el.offsetParent !== null;
    const buttons = [...document.querySelectorAll('[role="button"], [role="radio"]')].filter(shown);
    const notHeld = buttons.filter((b) => b.textContent.includes("보유 0주"));
    const toggle = buttons.find((b) => /보유하지 않은 종목 \d+개 (보기|접기)/.test(b.textContent));
    return { notHeld: notHeld.map((b) => b.textContent), toggle: toggle ? toggle.textContent : null };
  });
}

await step("레이아웃: 탭바 다섯 라벨이 뷰포트·탭바 안에 온전히 들어옴(잘림 없음)", async (s) => {
  const boxes = await page.evaluate((labels) => {
    const shown = (el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed";
    const tabs = [...document.querySelectorAll('[role="tab"]')].filter(shown);
    return labels.map((label) => {
      const tab = tabs.find((t) => t.textContent.trim().endsWith(label) || t.textContent.includes(label));
      if (!tab) return { label, error: "탭 요소 없음" };
      // 라벨 글자만 가진 가장 안쪽 요소
      const walker = [...tab.querySelectorAll("*")].filter((el) => el.children.length === 0 && el.textContent.trim() === label);
      const el = walker.at(-1);
      if (!el) return { label, error: "라벨 요소 없음" };
      const r = el.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      const bar = (tab.closest('[role="tablist"]') ?? tab.parentElement).getBoundingClientRect();
      return {
        label,
        label_box: [r.left, r.top, r.right, r.bottom],
        tab_box: [t.left, t.top, t.right, t.bottom],
        bar_box: [bar.left, bar.top, bar.right, bar.bottom],
        viewport: [window.innerWidth, window.innerHeight],
        // 라벨 글자 높이만큼 실제로 그려지는지(요소 내부가 잘려 있으면 scrollHeight 가 더 크다)
        clipped_inside: el.scrollHeight > el.clientHeight + 1,
        font_size: parseFloat(getComputedStyle(el).fontSize),
      };
    });
  }, ["홈", "자산", "배당", "연금", "설정"]);
  const eps = 0.5;
  const problems = [];
  for (const b of boxes) {
    if (b.error) {
      problems.push(`${b.label}: ${b.error}`);
      continue;
    }
    const [l, t, r, bt] = b.label_box;
    const [w, h] = b.viewport;
    s.notes.push(`${b.label}: 글자 ${b.font_size}px, 라벨 ${b.label_box.map((n) => n.toFixed(1)).join(",")} / 탭 ${b.tab_box.map((n) => n.toFixed(1)).join(",")} / 뷰포트 ${w}x${h}`);
    if (l < -eps || r > w + eps || bt > h + eps) problems.push(`${b.label}: 라벨이 뷰포트를 벗어남`);
    if (t < b.bar_box[1] - eps || bt > b.bar_box[3] + eps) problems.push(`${b.label}: 라벨이 탭바 영역을 벗어남`);
    if (bt > b.tab_box[3] + eps) problems.push(`${b.label}: 라벨 아래가 탭 영역 밖으로 ${(bt - b.tab_box[3]).toFixed(1)}px 넘침(잘림)`);
    if (b.clipped_inside) problems.push(`${b.label}: 라벨 요소 안쪽이 잘림`);
    if (!(b.font_size >= 12)) problems.push(`${b.label}: 라벨 글자 ${b.font_size}px(12px 미만)`);
  }
  assert(problems.length === 0, problems.join("; "));
  await shot("tabbar-layout");
});

await step("신규 계정: 홈은 빈 상태(종목 0개, 가짜 손익·추세 표시 없음)", async (s) => {
  await openTab("홈");
  await expectText("아직 종목이 없습니다");
  const res = await apiDirect("/api/holdings", { token });
  assert(res.status === 200 && Array.isArray(res.data), `종목 조회 ${res.status}`);
  assert(res.data.length === 0, `새 계정인데 종목이 ${res.data.length}개 있음(가입 시 예시 종목이 만들어짐)`);
  for (const fake of ["+0.00%", "목표 대비 0%", "총 평가금액"]) {
    assert((await visible(page.getByText(fake)).count()) === 0, `빈 계정 홈에 '${fake}'가 보임`);
  }
  // 첫 사용 안내: 앱에서 할 수 있는 '종목 추가'(3단계 안내 안의 주 버튼)가 '웹에서 …' 버튼들보다 먼저 온다.
  await expectText("처음 시작하기");
  const order = await page.evaluate(() => {
    const names = [...document.querySelectorAll('[role="button"],[role="link"],button,a')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim());
    return { add: names.indexOf("종목 추가"), web: names.findIndex((n) => n.startsWith("웹에서")) };
  });
  assert(order.add >= 0 && (order.web < 0 || order.add < order.web), `빈 홈에서 '종목 추가'(${order.add})가 '웹에서 …'(${order.web})보다 뒤에 있음`);
  s.notes.push("종목 0개, 홈에 '처음 시작하기' 3단계 안내와 '종목 추가'가 웹 안내보다 먼저");
  await shot("fresh-home-empty");
});

/** 기록·종목 추가 화면(스택)에서 이전 탭 화면으로 돌아온다. 단계가 중간에 실패해도 다음 단계가 탭바에서 시작하도록 실패 시에도 호출한다. */
async function leaveRecordScreen() {
  const pathname = new URL(page.url()).pathname;
  if (pathname.includes("record-") || pathname.includes("add-holding")) await page.goBack().catch(() => {});
  await visible(page.getByRole("tab")).first().waitFor({ state: "visible", timeout: 30000 });
}

await step("신규 계정: 배당·매수 기록 화면의 종목 목록은 '종목 추가'로 가는 빈 상태", async (s) => {
  for (const [tabLabel, openLabel, marker] of [
    ["배당", "배당 수령 기록 추가", "이미 받은 배당을 기록합니다"],
    ["자산", null, "이미 한 거래를 기록합니다"],
  ]) {
    await leaveRecordScreen();
    await openTab(tabLabel);
    if (openLabel) {
      await button(openLabel).click();
    } else {
      // 종목이 없으면 자산 탭은 '매수 기록 추가' 대신 빈 상태의 '종목 추가'만 보인다 — 매수 기록 화면은 주소로 연다
      await expectText("아직 종목이 없습니다");
      assert((await visible(page.getByRole("button", { name: "매수 기록 추가", exact: true })).count()) === 0, "빈 계정 자산 탭에 '매수 기록 추가'가 보임");
      await page.goto(`${APP_URL}/record-purchase`, { waitUntil: "domcontentloaded" });
    }
    await expectText(marker);
    await expectText("기록할 계좌");
    await expectText("종목을 먼저 추가하면 여기서 골라 기록할 수 있습니다");
    assert((await visible(page.getByRole("button", { name: "종목 추가", exact: true })).count()) >= 1, `${tabLabel}: 빈 상태에 '종목 추가'가 없음`);
    // 고를 종목이 없으면 입력칸·저장 버튼은 숨긴다(빈 상태만).
    assert((await visible(page.getByRole("button", { name: "기록 저장", exact: true })).count()) === 0, `${tabLabel}: 종목이 없는데 '기록 저장'이 보임`);
    assert((await visible(page.locator("input")).count()) === 0, `${tabLabel}: 종목이 없는데 입력칸이 보임`);
    s.notes.push(`${tabLabel}: 종목 목록 빈 상태 확인`);
    await shot(`fresh-${tabLabel === "자산" ? "purchase" : "dividend"}-picker-empty`);
  }
  await leaveRecordScreen();
});

await step("신규 계정: 자산 탭 빈 상태 → 종목 추가 화면에서 검증 오류 후 종목 2개 추가(Bearer·계좌 헤더)", async (s) => {
  await openTab("자산");
  await expectText("아직 종목이 없습니다");
  await shot("fresh-holdings-empty");
  // 홈 탭의 빈 상태에도 '종목 추가'가 있고(탭 화면은 DOM 에 남는다) 그 버튼은 자산 탭 아래에 가려져 있다 — 자산 탭 것(문서 순서상 뒤)을 누른다.
  await visible(page.getByRole("button", { name: "종목 추가", exact: true })).last().click();
  await expectText("추가할 계좌");
  await expectText("가지고 있는 종목의 이름과 종목코드");
  await shot("add-holding");

  // 형식이 틀린 종목코드는 요청 전에 막는다
  await fillInputs(["테스트", "30-50"]);
  await visible(page.getByRole("button", { name: "종목 추가", exact: true })).last().click();
  await expectText("종목코드는 숫자와 영문 12자 이하로 입력해주세요.");
  await shot("add-holding-invalid");

  const accounts = await apiDirect("/api/accounts", { token });
  const mainId = accounts.data.accounts[0].id;
  for (const [index, h] of FRESH_HOLDINGS.entries()) {
    await fillInputs([h.name, h.code]);
    const post = quiet(page.waitForRequest((req) => req.url().includes("/api/holdings") && req.method() === "POST", { timeout: 15000 }));
    const done = waitApi("/api/holdings", "POST");
    await visible(page.getByRole("button", { name: "종목 추가", exact: true })).last().click();
    const req = await post;
    assert(req.headers()["authorization"]?.startsWith("Bearer "), "종목 추가 요청에 Bearer 토큰이 없음");
    assert(req.headers()["x-portfolio-account-id"] === mainId, `종목 추가 요청 계좌 헤더 ${req.headers()["x-portfolio-account-id"]} (기대 ${mainId})`);
    const res = await done;
    assert(res.status() === 201, `종목 추가 응답 ${res.status()}`);
    await expectText(`${h.name}(${h.code})을(를) 0주로 추가했습니다.`);
    if (index === 0) {
      // 같은 계좌에 같은 종목코드는 다시 넣지 않는다(앱 사전 확인 또는 서버 409 — 문구는 같다).
      // 새 입력을 시작하면 직전 성공 문구와 '이 종목의 매수 기록 추가' 버튼은 사라져 새 오류와 섞이지 않는다.
      await fillInputs(["중복", h.code]);
      await visible(page.getByRole("button", { name: "종목 추가", exact: true })).last().click();
      await expectText("이 계좌에 이미 있는 종목코드입니다.");
      assert((await visible(page.getByText("0주로 추가했습니다")).count()) === 0, "중복 오류와 직전 성공 문구가 함께 보임");
      assert(
        (await visible(page.getByRole("button", { name: "이 종목의 매수 기록 추가", exact: true })).count()) === 0,
        "중복 오류와 직전 '이 종목의 매수 기록 추가' 버튼이 함께 보임"
      );
      await shot("add-holding-duplicate");
    }
  }

  const list = await apiDirect("/api/holdings", { token, accountId: mainId });
  const codes = list.data.map((h) => h.code).sort();
  assert(JSON.stringify(codes) === JSON.stringify(FRESH_HOLDINGS.map((h) => h.code).sort()), `서버 종목 ${codes.join(",")}`);
  assert(list.data.every((h) => Number(h.shares) === 0), "앱에서 추가한 종목이 0주가 아님");
  freshHoldingCount = list.data.length;
  s.notes.push(`앱에서 종목 ${freshHoldingCount}개 추가(${codes.join(", ")}), 중복 코드 거절`);
  await shot("add-holding-done");
});

await step("신규 계정: '이 종목의 매수 기록 추가' → 방금 추가한 종목이 골라진 채 열리고 저장 성공", async (s) => {
  const last = FRESH_HOLDINGS.at(-1);
  await visible(page.getByRole("button", { name: "이 종목의 매수 기록 추가", exact: true })).first().click();
  await expectText("이미 한 거래를 기록합니다");
  await pickerState();
  const picked = visible(page.getByRole("radio", { name: new RegExp(last.name) })).first();
  await waitAttr(picked, "aria-selected", "true");
  freshPickedName = last.name;
  s.notes.push(`미리 골라진 종목: ${freshPickedName}`);
  await shot("fresh-purchase-preselected");
  await fillInputs(["2", "5000", today]);
  const post = waitApi("/api/purchases", "POST");
  await button("기록 저장").click();
  const res = await post;
  assert(res.ok(), `매수 기록 저장 실패: HTTP ${res.status()}`);
  await expectText("2주 매수 기록을 추가했습니다");
  // 현재가를 모르던 종목은 기록 단가로 현재가가 채워져 평가금액이 0원(-100%)으로 보이지 않는다
  const list = await apiDirect("/api/holdings", { token });
  const bought = list.data.find((h) => h.code === last.code);
  assert(Number(bought?.shares) === 2 && Number(bought?.current_price) === 5000, `매수 후 종목 ${JSON.stringify(bought)}`);
  await shot("fresh-purchase-saved");
});

await step("신규 계정: 다시 열면 그 종목만 보이고 '보유하지 않은 종목 N개 보기'가 접힘 → 펼침/접기 동작", async (s) => {
  const rest = freshHoldingCount - 1;
  await leaveRecordScreen();
  await openTab("홈");
  await expectText("총 평가금액"); // 매수 기록 뒤 홈이 빈 상태에서 계좌 요약으로 바뀜
  for (const [tabLabel, openLabel, marker] of [
    ["자산", "매수 기록 추가", "이미 한 거래를 기록합니다"],
    ["배당", "배당 수령 기록 추가", "이미 받은 배당을 기록합니다"],
  ]) {
    await openTab(tabLabel);
    await button(openLabel).click();
    await expectText(marker);
    await visible(page.getByRole("button", { name: /보유하지 않은 종목 \d+개/ })).first().waitFor({ state: "visible", timeout: 30000 });
    const collapsed = await pickerState();
    s.notes.push(`${tabLabel}: 접힌 상태 0주 ${collapsed.notHeld.length}개, 토글=${collapsed.toggle}`);
    assert(collapsed.notHeld.length === 0, `${tabLabel}: 접힌 상태인데 0주 종목 ${collapsed.notHeld.length}개가 보임`);
    assert(collapsed.toggle === `보유하지 않은 종목 ${rest}개 보기`, `${tabLabel}: 토글 문구 '${collapsed.toggle}'`);
    assert((await visible(page.getByRole("radio", { name: new RegExp(freshPickedName) })).count()) >= 1, `${tabLabel}: 매수한 종목이 목록에 없음`);
    await button(`보유하지 않은 종목 ${rest}개 보기`).click();
    await button(`보유하지 않은 종목 ${rest}개 접기`).waitFor({ state: "visible", timeout: 15000 });
    const expanded = await pickerState();
    assert(expanded.notHeld.length === rest, `${tabLabel}: 펼친 뒤 0주 종목 ${expanded.notHeld.length}개(기대 ${rest})`);
    await shot(`fresh-${tabLabel === "자산" ? "purchase" : "dividend"}-picker-expanded`);
    await button(`보유하지 않은 종목 ${rest}개 접기`).click();
    await button(`보유하지 않은 종목 ${rest}개 보기`).waitFor({ state: "visible", timeout: 15000 });
    await leaveRecordScreen();
  }
});

await step("데이터 준비(API): 배우자 계좌 추가, 계좌별 보유 종목 등록", async (s) => {
  assert(token, "로그인 토큰 없음");
  const accounts = await apiDirect("/api/accounts", { token });
  firstAccountId = accounts.data.accounts[0].id;
  const created = await apiDirect("/api/accounts", { method: "POST", token, body: { name: "배우자 계좌", ownerType: "spouse" } });
  assert(created.status === 201, `계좌 추가 ${created.status} ${JSON.stringify(created.data)}`);
  spouseAccountId = created.data.account.id;
  const h1 = await apiDirect("/api/holdings", {
    method: "POST",
    token,
    accountId: firstAccountId,
    body: { code: "E2E001", name: "테스트배당ETF", category: "배당", current_price: 12000, shares: 10, avg_price: 10000, target_pct: 50 },
  });
  const h2 = await apiDirect("/api/holdings", {
    method: "POST",
    token,
    accountId: spouseAccountId,
    body: { code: "E2E002", name: "배우자성장ETF", category: "성장", current_price: 20000, shares: 5, avg_price: 18000, target_pct: 50 },
  });
  assert(h1.status === 201 && h2.status === 201, `보유 종목 등록 ${h1.status}/${h2.status} ${JSON.stringify(h1.data ?? h2.data)}`);
  s.notes.push(`계좌: 내 계좌=${firstAccountId}, 배우자 계좌=${spouseAccountId}`);
});

await step("로그인(새로 띄운 화면에서 이메일·비밀번호)", async () => {
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
  await fillInputs([EMAIL, PASSWORD]);
  const login = waitApi("/api/mobile/auth/login", "POST");
  await button("로그인").click();
  assert((await login).status() === 200, "로그인 응답이 200 이 아님");
  await expectText("총 평가금액");
  token = (await storedSession())?.token;
  assert(token, "로그인 후 세션이 저장되지 않았습니다");
});

for (const [label, marker] of [
  ["홈", "총 평가금액"],
  ["자산", /^종목 \d+개$/], // 화면 제목 '자산'은 탭 이름과 같아 표지로 쓰지 않는다
  ["배당", "예상 연 배당"],
  ["연금", "연금 설계"],
  ["설정", "약관 및 안내"],
]) {
  await step(`탭 렌더링: ${label}`, async () => {
    await openTab(label);
    await expectText(marker);
    await visible(page.getByText("데이터를 불러오지 못했습니다")).first().waitFor({ state: "detached", timeout: 1500 }).catch(() => {
      throw new Error("오류 카드가 표시됨");
    });
    await shot(`tab-${label}`);
  });
}

await step("계좌 전환: 배우자 계좌 선택 → 요청 헤더 반영, 다른 탭·새로고침 후에도 유지", async (s) => {
  await openTab("홈");
  await expectText("총 평가금액");
  const chip = radio(/배우자 계좌/);
  await chip.waitFor({ state: "visible", timeout: 10000 });
  const summaryReq = quiet(page.waitForRequest(
    (req) => req.url().includes("/api/mobile/portfolio-summary") && req.headers()["x-portfolio-account-id"] === spouseAccountId,
    { timeout: 15000 }
  ));
  await chip.click();
  await summaryReq;
  await expectText("배우자 계좌"); // 홈 상단 계좌 이름
  await waitAttr(chip, "aria-selected", "true").catch(() => {
    throw new Error("선택된 칩이 aria-selected 로 표시되지 않음");
  });
  await openTab("자산");
  await expectText("배우자성장ETF");
  assert((await text("테스트배당ETF").count()) === 0, "자산 탭에 다른 계좌 종목이 보임");
  await page.reload({ waitUntil: "networkidle" });
  await expectText("배우자성장ETF");
  const after = apiLog.filter((e) => e.step === s.name && e.url.includes("/api/mobile/portfolio-summary"));
  const wrong = after.filter((e) => e.accountHeader !== spouseAccountId);
  s.notes.push(`portfolio-summary 요청 ${after.length}건 중 배우자 계좌 헤더 아님 ${wrong.length}건(전환 직전 요청 포함)`);
  assert(after.at(-1)?.accountHeader === spouseAccountId, "새로고침 후 요청이 배우자 계좌 헤더를 쓰지 않음");
  await shot("account-switched-holdings");
  // 이후 기록 단계는 첫 계좌에서 진행한다.
  await openTab("홈");
  await radio(/내 계좌/).click();
  await expectText("테스트배당ETF").catch(() => {});
});

await step("매수 기록 추가 → 목록 표시(내 계좌)", async (s) => {
  await openTab("자산");
  // 앞 단계가 중간에 실패해도 이 단계는 내 계좌에서 시작한다.
  const mine = radio(/내 계좌/);
  if ((await mine.getAttribute("aria-selected")) !== "true") await mine.click();
  await expectText("테스트배당ETF");
  await button("매수 기록 추가").click();
  await expectText("이미 한 거래를 기록합니다");
  await expectText("기록할 계좌");
  await expectText("내 계좌 · 본인");
  await radio(/테스트배당ETF/).click();
  await fillInputs(["3", "11000", today]); // 수량, 단가, 거래일
  const post = quiet(page.waitForRequest((req) => req.url().includes("/api/purchases") && req.method() === "POST", { timeout: 15000 }));
  await button("기록 저장").click();
  const req = await post;
  s.notes.push(`POST 헤더 계좌=${req.headers()["x-portfolio-account-id"]}`);
  assert(req.headers()["x-portfolio-account-id"] === firstAccountId, "매수 기록 요청이 선택한 계좌 헤더를 쓰지 않음");
  await expectText("3주 매수 기록을 추가했습니다");
  await expectText("테스트배당ETF 3주 × 11,000원");
  // 입력한 거래일이 그대로 돌아오는지(시간대 때문에 하루 밀리지 않는지) 함께 본다.
  await expectText(`${today} · 33,000원`);
  await shot("purchase-added");
});

await step("매수 기록 삭제", async () => {
  const del = waitApi("/api/purchases/", "DELETE");
  // 목록의 삭제 버튼은 대상을 이름에 담는다("2026-11-27 33,000원 매수 기록 삭제") — 날짜·금액으로 이 기록만 고른다.
  await button(`${today} 33,000원 매수 기록 삭제`).click();
  const res = await del;
  assert(res.status() === 200, `삭제 응답 ${res.status()}`);
  await expectText("매수 기록을 삭제했습니다");
  // 보유 종목 등록 때 생긴 초기 매수 기록은 남고, 방금 추가한 기록만 사라져야 한다.
  await text(`${today} · 33,000원`).waitFor({ state: "detached", timeout: 10000 });
  await expectText("테스트배당ETF 10주 × 10,000원");
  await shot("purchase-deleted");
  await page.goBack();
});

await step("배당 기록 추가 → 목록 표시 → 삭제", async () => {
  await openTab("배당");
  await expectText("예상 연 배당");
  await button("배당 수령 기록 추가").click();
  await expectText("이미 받은 배당을 기록합니다");
  await radio(/테스트배당ETF/).click();
  await fillInputs(["4321", today]);
  const post = waitApi("/api/dividends", "POST");
  await button("기록 저장").click();
  assert((await post).ok(), "배당 기록 저장 실패");
  await expectText("배당 수령");
  await expectText(`${today} · 4,321원`);
  await shot("dividend-added");
  const del = waitApi("/api/dividends", "DELETE");
  await visible(page.getByRole("button", { name: new RegExp(`^${today} .* 배당 기록 삭제$`) })).first().click();
  assert((await del).ok(), "배당 기록 삭제 실패");
  await expectText("아직 기록이 없습니다.");
  await shot("dividend-deleted");
  await page.goBack();
});

await step("연금 탭: 요약 표시와 입력 없음 안내", async () => {
  await openTab("연금");
  await expectText(/명의 계좌 \d+개를 합산한 값입니다/);
  await expectText("세액공제 납입");
  await expectText("연금저축·IRP·DC·ISA 계좌가 없어 계산하지 않았습니다");
  await expectText("은퇴 목표가 모두 입력되지 않아 계산하지 않았습니다");
  await expectText("입력이 필요한 항목");
  await expectText("국민연금·퇴직연금·연금보험 예상액은 웹에서 입력합니다");
  await shot("retirement");
});

await step("연금 탭: 명의자별 세액공제 블록과 '제외된 계좌' 안내(서버 요약 API 와 대조)", async (s) => {
  // 연금 유형 계좌: 본인 연금저축, 배우자 IRP, 자녀 연금저축(자녀 명의는 세액공제에서 제외되는 대상).
  const make = async (name, ownerType, accountType) => {
    const res = await apiDirect("/api/accounts", { method: "POST", token, body: { name, ownerType, accountType } });
    assert(res.status === 201, `${name} 계좌 추가 ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.account.id;
  };
  const selfId = await make("본인 연금저축 E2E", "self", "pension_savings");
  const spouseId = await make("배우자 IRP E2E", "spouse", "irp");
  const childId = await make("자녀 연금저축 E2E", "child", "pension_savings");
  // 연도는 서버 요약이 쓰는 올해(서버 시각 기준)에 맞춘다: 계좌를 만든 뒤 요약 연도를 읽어 납입을 넣는다.
  const before = await apiDirect("/api/pension/summary", { token });
  assert(before.status === 200, `요약 API ${before.status}`);
  const year = before.data.year;
  for (const [accountId, amount] of [[selfId, 3_000_000], [spouseId, 2_000_000], [childId, 1_000_000]]) {
    const put = await apiDirect("/api/pension/contributions", { method: "PUT", token, body: { accountId, year, amount } });
    assert(put.status === 200, `납입 기록 ${put.status} ${JSON.stringify(put.data)}`);
  }
  const res = await apiDirect("/api/pension/summary", { token });
  const summary = res.data;
  const credit = summary.taxCredit;
  assert(credit, `세액공제 값이 없음(사유 ${summary.taxCreditUnavailableReason})`);
  const owners = credit.byOwner.map((o) => o.ownerType);
  assert(owners.includes("self") && owners.includes("spouse"), `서버 요약의 명의자: ${owners.join(",")}`);
  assert(credit.excludedAccounts.some((e) => e.id === childId), "서버 요약에 자녀 계좌가 제외 목록에 없음");

  // 앱 목록 표기(DESIGN.md Money: 전체 표기 "162,890,500원")
  const krw = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;
  const limit = summary.rules.taxCredit.combinedLimit;
  await page.reload({ waitUntil: "domcontentloaded" });
  await openTab("연금");
  await expectText(/명의 계좌 \d+개를 합산한 값입니다/);
  await expectText("연금계좌 납입액");
  const ownerLabel = { self: "본인", spouse: "배우자" };
  for (const owner of credit.byOwner) {
    const label = ownerLabel[owner.ownerType];
    const block = visible(page.locator("div"))
      .filter({ has: page.getByText(label, { exact: true }) })
      .filter({ hasText: "연금계좌 납입액" })
      .last();
    await block.waitFor({ state: "visible", timeout: 30000 });
    const body = (await block.innerText()).replace(/\s+/g, " ");
    const expected = [krw(owner.progress.pensionPaid), `${krw(owner.progress.creditableTotal)} / ${krw(limit)}`, krw(owner.progress.estimatedCredit)];
    for (const want of expected) assert(body.includes(want), `${label} 블록에 '${want}' 없음: ${body.slice(0, 200)}`);
    s.notes.push(`${label}: 납입 ${krw(owner.progress.pensionPaid)}, 한도 ${krw(limit)}, 예상 공제액 ${krw(owner.progress.estimatedCredit)} (화면=서버 일치)`);
  }
  await expectText(krw(credit.progress.estimatedCredit));
  await expectText(`자녀·기타 명의 계좌 ${credit.excludedAccounts.length}개`, 30000);
  for (const ex of credit.excludedAccounts) {
    await expectText(`${ex.name} (자녀 명의`);
    await expectText(`납입 ${krw(ex.paid)}`);
  }
  await shot("retirement-owner-credit");
});

await step("비밀번호 변경 후에도 로그인 상태 유지", async (s) => {
  await openTab("설정");
  await button("로그아웃", false).waitFor({ state: "visible", timeout: 30000 });
  await button("비밀번호 변경").click();
  await waitInputsReady(3); // 폼이 열리고 입력란이 활성화될 때까지 조건 대기
  await fillInputs([PASSWORD, NEW_PASSWORD, NEW_PASSWORD]);
  const before = (await storedSession())?.token;
  const change = waitApi("/api/auth/password", "POST");
  await visible(page.getByRole("button", { name: "비밀번호 변경", exact: true })).last().click();
  assert((await change).ok(), "비밀번호 변경 응답 실패");
  await expectText("비밀번호를 변경했습니다.");
  const after = (await storedSession())?.token;
  s.notes.push(after && after !== before ? "새 토큰으로 세션 교체됨" : "토큰이 교체되지 않음(서버가 새 토큰을 주지 않음)");
  const oldTokenCheck = await apiDirect("/api/accounts", { token: before });
  s.notes.push(`이전 토큰으로 /api/accounts → HTTP ${oldTokenCheck.status}`);
  await page.reload({ waitUntil: "networkidle" });
  await openTab("홈");
  await expectText("총 평가금액");
  await openTab("설정");
  await button("로그아웃", false).waitFor({ state: "visible", timeout: 30000 });
  token = after;
  await shot("password-changed");
});

await step("로그아웃", async () => {
  await openTab("설정");
  await button("로그아웃", false).click();
  await expectText("로그인하면 내 포트폴리오");
  assert((await storedSession()) === null, "로그아웃 후에도 세션이 남아 있음");
});

await step("새 비밀번호로 다시 로그인", async () => {
  await fillInputs([EMAIL, NEW_PASSWORD]);
  const login = waitApi("/api/mobile/auth/login", "POST");
  await button("로그인").click();
  assert((await login).status() === 200, "새 비밀번호 로그인 실패");
  await expectText("총 평가금액");
});

await step("계정 삭제", async () => {
  await openTab("설정");
  await visible(page.getByRole("link", { name: "계정 삭제", exact: true })).first().click();
  await expectText("계정을 삭제하면 저장된 모든 데이터가");
  await visible(page.locator("input")).first().waitFor();
  await page.waitForFunction(() => {
    const input = [...document.querySelectorAll("input")].find((el) => el.offsetParent !== null);
    return input && !input.disabled && !input.readOnly;
  });
  await fillInputs([NEW_PASSWORD]);
  const del = waitApi("/api/me", "DELETE");
  await button("계정 영구 삭제").click();
  assert((await del).ok(), "계정 삭제 응답 실패");
  await expectText("로그인하면 내 포트폴리오");
  const relogin = await apiDirect("/api/mobile/auth/login", { method: "POST", body: { email: EMAIL, password: NEW_PASSWORD } });
  assert(relogin.status === 401, `삭제한 계정으로 로그인 응답 ${relogin.status}`);
  await shot("account-deleted");
});

await browser.close();

writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ email: EMAIL, results, apiLog }, null, 2));
const failed = results.filter((r) => r.status !== "통과");
console.log(`\n${results.length - failed.length}/${results.length} 단계 통과. 결과: ${path.join(OUT, "results.json")}`);
process.exit(failed.length ? 1 : 0);
