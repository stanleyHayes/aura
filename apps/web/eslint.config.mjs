import { createNextConfig } from "@cbs/config/eslint/next.js";
import next from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...createNextConfig({ next }),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];
