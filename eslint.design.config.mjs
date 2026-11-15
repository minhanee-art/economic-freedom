import { plugin as shadcn } from "@shadcn/lint";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Reuse the rules without replacing the framework's existing parsers.
export const designRules = [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "src/**/{backend,api,native,mobile,generated,__generated__}/**",
      "src/**/*.{generated,gen}.{js,jsx,ts,tsx}",
    ],
    plugins: { shadcn },
    rules: {
      "shadcn/no-raw-colors": "warn",
      "shadcn/no-arbitrary-values": "warn",
      "shadcn/no-inline-styles": "warn",
      "shadcn/no-restyle": ["warn", { allow: ["layout"] }],
    },
  },
  {
    // Shared login/signup component implementation, not its consumers.
    files: ["src/components/ui/auth-form.tsx"],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
    },
  },
];

const designConfig = [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    // Resolve existing React Hooks disable comments without enabling its rules.
    plugins: { "react-hooks": reactHooks },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...designRules,
];

export default designConfig;
