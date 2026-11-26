// 사용자에게 보이는 문구에 매수·매도 권유 표현이 다시 들어오지 않도록 지키는 테스트.
// 앱은 사용자가 입력한 보유 내역을 기록·계산하는 도구이며 투자 자문이 아니다.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const FORBIDDEN =
  /매수하세요|매도하세요|사세요|파세요|매수 기회|매도 고려|추천|유망|수익 보장|우선 매수|매수 검토|매도 검토|매수 고려|매수 자제|매수 계획/;

// 부정문·금지 지시로만 쓰인 문장(문장 단위로 최소한만 허용한다).
const ALLOWED_SENTENCES = [
  "매매 권유를 하지 않고, '추천', '매수 기회', '매도 시점' 같은 표현을 쓰지 않는다", // AI 프롬프트의 금지 지시
  "매수·매도 권유, 투자 자문, 중개, 수익 보장 기능을 제공하지 않습니다", // 개인정보처리방침의 부정문
];

function stripComments(line: string): string {
  return line.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
}

test("사용자 문구에 매수·매도 권유 표현이 없다", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => `src/${f}`.replaceAll("\\", "/"))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f: string) => !/\.test\.tsx?$/.test(f) && !f.startsWith("src/test/"));
  assert.ok(files.length > 50, "검사 대상 파일을 찾지 못했습니다.");

  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = stripComments(line);
        if (FORBIDDEN.test(code) && !ALLOWED_SENTENCES.some((a) => code.includes(a))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(hits, []);
});
