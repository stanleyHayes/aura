// Next.js ESLint preset builder (§17). `eslint-config-next` already bundles the
// `typescript-eslint`, `react`, `react-hooks` and `jsx-a11y` plugins + rules,
// so this preset must NOT re-add any of them (ESLint errors on a redefined
// plugin). The consuming app passes its own `eslint-config-next` so it resolves
// from the app's node_modules (Next ships its own plugin versions).

/**
 * @param {object} deps
 * @param {unknown} deps.next  the default export of `eslint-config-next`
 * @returns {import("eslint").Linter.Config[]}
 */
export function createNextConfig({ next } = {}) {
  /** @type {import("eslint").Linter.Config[]} */
  const config = [
    {
      ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/*.gen.ts"],
    },
  ];
  if (next) {
    config.push(...(Array.isArray(next) ? next : [next]));
  }
  config.push({
    rules: {
      // §0.3: no `any` smuggling.
      "@typescript-eslint/no-explicit-any": "error",
      // §12.2 accessibility — strengthen one a11y rule beyond Next's default.
      "jsx-a11y/anchor-is-valid": "warn",
    },
  });
  return config;
}

export default createNextConfig;
