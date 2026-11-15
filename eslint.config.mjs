import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { designRules } from "./eslint.design.config.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...designRules,
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
