import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    // next.config.ts builds production into .next-production; without this,
    // `npm run lint` fails on generated output after any production build.
    ".next-production/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
