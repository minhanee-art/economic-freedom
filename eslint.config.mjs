import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { designRules } from "./eslint.design.config.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...designRules,
  {
    rules: {
      // Next 16.4의 eslint-config-next가 새로 켠 규칙입니다. 기존 동기 setState 이펙트 15곳이
      // 걸려 보안 업그레이드가 막히지 않도록 경고로 낮춥니다. 이펙트 재구성은 별도 작업입니다.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "worktrees/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
