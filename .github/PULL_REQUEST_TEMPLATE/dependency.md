## Dependency PR Checklist

- [ ] Dependency-only change scope (versions/lockfile/metadata)
- [ ] Required checks passed (`Dependabot Updates`, `CodeQL`)
- [ ] Any failed advisory `Claude Code Review` result reviewed
- [ ] Follow-up issue created if advisory automation failed

## Merge Decision

- **Required checks green:** merge allowed
- **Advisory Claude failure only:** merge allowed + create follow-up issue
- **Required check failure:** do not merge

## Evidence

- Required checks run URL:
- Follow-up issue URL (if advisory failed):
