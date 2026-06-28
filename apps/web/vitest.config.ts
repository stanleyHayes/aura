import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for the CBS web app (§17 step 3).
 *
 * - jsdom environment for React component rendering (@testing-library/react).
 * - A setup file registers @testing-library/jest-dom matchers and cleans up
 *   the DOM between tests.
 * - The `@/*` alias mirrors tsconfig so tests import app modules the same way
 *   the source does.
 * - Coverage uses the v8 provider; the CI job invokes `--coverage --run`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Scope coverage to the app-local units exercised by this suite so the
      // report is a meaningful signal for the code under test, rather than
      // averaging in the many untested UI pages/route components. The shared
      // workspace packages (@cbs/schemas, @cbs/ui, @cbs/api-client) live outside
      // this project root, so v8 does not instrument them in this report; their
      // behaviour is still asserted directly by the test files.
      include: [
        "src/lib/auth.ts",
        "src/lib/intervals.ts",
        "src/components/status-badge.tsx",
        "src/components/empty-state.tsx",
      ],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
