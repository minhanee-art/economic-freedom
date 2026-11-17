// 테스트 파일을 명시적으로 모아 실행한다.
// node --test 기본 탐색은 .tsx를 포함하지 않으므로 glob으로 직접 넘긴다.
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";

const files = globSync(["src/**/*.test.ts", "src/**/*.test.tsx"], {
  exclude: (path) => path.includes("node_modules"),
}).sort();

if (files.length === 0) {
  console.error("테스트 파일을 찾지 못했습니다.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--experimental-test-module-mocks",
    ...files,
  ],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
