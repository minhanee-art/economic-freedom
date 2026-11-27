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

async function expectText(value, timeout = 15000, exact = false) {
  await text(value, exact).waitFor({ state: "visible", timeout });
}

/** 주어진 글자를 포함한 가장 안쪽 행에서 버튼을 찾는다(문서 순서상 가장 안쪽 요소가 마지막). */
function rowButton(rowText, name) {
  return visible(page.locator("div"))
    .filter({ hasText: rowText })
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .last()
    .getByRole("button", { name, exact: true });
}

async function openTab(label) {
  const tab = visible(page.getByRole("tab", { name: label })).first();
  if (await tab.count()) await tab.click();
  else await visible(page.getByRole("link", { name: label })).first().click();
}

async function fillInputs(values) {
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
  return quiet(page.waitForResponse((res) => res.url().includes(pathPart) && res.request().method() === method, { timeout: 20000 }));
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
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await expectText("로그인하면 내 포트폴리오");
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
  await expectText("총 평가금액");
  const session = await storedSession();
  assert(session?.token, "세션이 저장되지 않았습니다");
  token = session.token;
  await shot("home-after-signup");
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
  ["자산", "평가금액, 손익, 비중"],
  ["배당", "예상 연 배당"],
  ["연금", "연금 설계"],
  ["설정", "계정과 앱 정보를 관리합니다"],
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
  const chip = button(/배우자 계좌/, false);
  await chip.waitFor({ state: "visible", timeout: 10000 });
  const summaryReq = quiet(page.waitForRequest(
    (req) => req.url().includes("/api/mobile/portfolio-summary") && req.headers()["x-portfolio-account-id"] === spouseAccountId,
    { timeout: 15000 }
  ));
  await chip.click();
  await summaryReq;
  await expectText("배우자 계좌"); // 홈 상단 계좌 이름
  assert((await chip.getAttribute("aria-selected")) === "true", "선택된 칩이 aria-selected 로 표시되지 않음");
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
  await button(/내 계좌/, false).click();
  await expectText("테스트배당ETF").catch(() => {});
});

await step("매수 기록 추가 → 목록 표시(내 계좌)", async (s) => {
  await openTab("자산");
  // 앞 단계가 중간에 실패해도 이 단계는 내 계좌에서 시작한다.
  const mine = button(/내 계좌/, false);
  if ((await mine.getAttribute("aria-selected")) !== "true") await mine.click();
  await expectText("테스트배당ETF");
  await button("매수 기록 추가").click();
  await expectText("이미 한 거래를 기록합니다");
  await expectText("기록할 계좌");
  await expectText("내 계좌 · 본인");
  await button(/테스트배당ETF/, false).click();
  await fillInputs(["3", "11000", today]); // 수량, 단가, 거래일
  const post = quiet(page.waitForRequest((req) => req.url().includes("/api/purchases") && req.method() === "POST", { timeout: 15000 }));
  await visible(page.getByRole("button", { name: "매수 기록 추가", exact: true })).last().click();
  const req = await post;
  s.notes.push(`POST 헤더 계좌=${req.headers()["x-portfolio-account-id"]}`);
  assert(req.headers()["x-portfolio-account-id"] === firstAccountId, "매수 기록 요청이 선택한 계좌 헤더를 쓰지 않음");
  await expectText("3주 매수 기록을 추가했습니다");
  await expectText("테스트배당ETF 3주 × ₩11,000");
  // 입력한 거래일이 그대로 돌아오는지(시간대 때문에 하루 밀리지 않는지) 함께 본다.
  await expectText(`${today} · ₩33,000`);
  await shot("purchase-added");
});

await step("매수 기록 삭제", async () => {
  const del = waitApi("/api/purchases/", "DELETE");
  await rowButton(`${today} · ₩33,000`, "삭제").click();
  const res = await del;
  assert(res.status() === 200, `삭제 응답 ${res.status()}`);
  await expectText("매수 기록을 삭제했습니다");
  // 보유 종목 등록 때 생긴 초기 매수 기록은 남고, 방금 추가한 기록만 사라져야 한다.
  await text(`${today} · ₩33,000`).waitFor({ state: "detached", timeout: 10000 });
  await expectText("테스트배당ETF 10주 × ₩10,000");
  await shot("purchase-deleted");
  await page.goBack();
});

await step("배당 기록 추가 → 목록 표시 → 삭제", async () => {
  await openTab("배당");
  await expectText("예상 연 배당");
  await button("배당 수령 기록 추가").click();
  await expectText("이미 받은 배당을 기록합니다");
  await button(/테스트배당ETF/, false).click();
  await fillInputs(["4321", today]);
  const post = waitApi("/api/dividends", "POST");
  await visible(page.getByRole("button", { name: "배당 수령 기록 추가", exact: true })).last().click();
  assert((await post).ok(), "배당 기록 저장 실패");
  await expectText("배당 수령");
  await expectText(`${today} · ₩4,321`);
  await shot("dividend-added");
  const del = waitApi("/api/dividends", "DELETE");
  await button("삭제").click();
  assert((await del).ok(), "배당 기록 삭제 실패");
  await expectText("아직 기록이 없습니다.");
  await shot("dividend-deleted");
  await page.goBack();
});

await step("연금 탭: 요약 표시와 입력 없음 안내", async () => {
  await openTab("연금");
  await expectText("가족 전체 계좌를 합산한 값입니다");
  await expectText("세액공제 납입");
  await expectText("연금저축·IRP·DC·ISA 계좌가 없어 계산하지 않았습니다");
  await expectText("은퇴 목표가 모두 입력되지 않아 계산하지 않았습니다");
  await expectText("입력이 필요한 항목");
  await expectText("웹에서 국민연금·퇴직연금·연금보험 예상액을 입력하면");
  await shot("retirement");
});

await step("비밀번호 변경 후에도 로그인 상태 유지", async (s) => {
  await openTab("설정");
  await expectText("연결됨");
  await button("비밀번호 변경").click();
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
  await expectText("연결됨");
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
