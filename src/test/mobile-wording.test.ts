// 모바일 앱(mobile/src) 화면 문구에 제작·내부 메모성 표현과 매수·매도 권유 표현이 들어오지 않도록 지키는 테스트.
// 주석(//, /* */, JSDoc 의 * 줄)은 검사하지 않는다 — 코드 설명에는 '서버가' 같은 말을 써도 된다.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const INTERNAL_MEMO = /서버가|참고 사이트|구성했습니다|미확인\)|국세×1\.1/;
const FORBIDDEN_ADVICE = /매수하세요|매도하세요|사세요|파세요|매수 기회|매도 고려|추천|유망|수익 보장/;

function codeOnly(line: string): string {
  if (/^\s*(\*|\/\*|\{\/\*)/.test(line)) return "";
  return line.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
}

test("모바일 화면 문구에 내부 메모·권유 표현이 없다", () => {
  const files = readdirSync("mobile/src", { recursive: true, encoding: "utf8" })
    .map((f) => `mobile/src/${f}`.replaceAll("\\", "/"))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  assert.ok(files.length > 20, "검사 대상 파일을 찾지 못했습니다.");

  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = codeOnly(line);
        if (INTERNAL_MEMO.test(code) || FORBIDDEN_ADVICE.test(code)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(hits, []);
});
