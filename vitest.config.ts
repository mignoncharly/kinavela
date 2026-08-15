import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // .mjs is included so the CLI scripts in scripts/ can be tested here
    // rather than through a hand-rolled --self-test flag. tsconfig only
    // includes .ts/.tsx, so this does not affect typecheck.
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}"],
    coverage: { reporter: ["text", "json", "html"] },
  },
  resolve: {
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
});
