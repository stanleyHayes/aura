// Flat ESLint config (§17) — extends the shared base from @cbs/config.
import base from "@cbs/config/eslint/base.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    ignores: ["dist/**", "node_modules/**", "**/*.gen.ts"],
  },
];
