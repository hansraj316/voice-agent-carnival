# Dependency PR Merge Policy

This policy keeps merge safety strict while treating flaky advisory automation as non-blocking.

## Required merge gates

A dependency PR can merge only when all required checks pass.

- Dependabot Updates
- CodeQL

Do **not** mark `Claude Code Review` as required.

## Advisory signal handling

If `Claude Code Review` fails but all required checks are green:

1. Merge is allowed.
2. Open a follow-up issue labeled `ci` and `automation`.
3. Link the follow-up issue in the merged PR comments.

## 5-minute maintainer decision flow

1. Confirm PR scope is dependency-only (versions, lockfile, generated metadata).
2. Confirm required checks are green.
3. If advisory Claude review failed, scan output for real high-risk findings.
4. Merge when no high-risk findings block release.
5. File follow-up issue for advisory workflow reliability if needed.

## Evidence to attach in issue #14

- Branch protection screenshot for `main` showing only required checks above.
- Link to one merged dependency PR where this policy was applied.
