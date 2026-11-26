// 사용자에게 보이는 문구에 매수·매도 권유 표현이 다시 들어오지 않도록 지키는 테스트.
// 앱은 사용자가 입력한 보유 내역을 기록·계산하는 도구이며 투자 자문이 아니다.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const FORBIDDEN =
  /매수하세요|매도하세요|사세요|파세요|매수 기회|매도 고려|추천|유망|수익 보장|우선 매수|매수 검토|매도 검토|매수 고려|매수 자제|매수 계획/;

// 다른 열린 PR(#32)이 고치는 파일 — 머지 후 이 목록에서 제거한다.
const PENDING_OTHER_PR = [
  "src/app/api/cron/",
  "src/app/api/telegram-bot/route.ts",
  "src/app/privacy/page.tsx", // 부정문("추천… 제공하지 않습니다")으로만 쓴다
  "src/lib/ai-text.ts",
];

function stripComments(line: string): string {
  return line.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
}

test("사용자 문구에 매수·매도 권유 표현이 없다", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => `src/${f}`.replaceAll("\\", "/"))
    .filter((f) => /\.tsx?$/.test(f))
    .filter(
    (f: string) => !/\.test\.tsx?$/.test(f) && !f.startsWith("src/test/") && !PENDING_OTHER_PR.some((p) => f.startsWith(p))
  );
  assert.ok(files.length > 50, "검사 대상 파일을 찾지 못했습니다.");

  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (FORBIDDEN.test(stripComments(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(hits, []);
});
