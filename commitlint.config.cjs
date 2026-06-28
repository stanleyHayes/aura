// Conventional Commits enforcement (§17 step 1). Used by lefthook's commit-msg
// hook and may be wired into CI to lint PR titles.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allowed types — keep aligned with the changelog tooling.
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
  },
};
