# GitHub workflow and backtracking

Use `main` for reviewed production releases. Develop on a focused `codex/<task>` branch and preserve unrelated local changes.

1. Inspect `git status`, the current branch, and the relevant plan.
2. Make a focused change with regression coverage where behavior changes.
3. Run `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`.
4. Review the diff for scope, generated files, credentials, and accidental UI changes.
5. Stage explicit files and create a descriptive local commit, such as `fix: preserve scheduled timestamps on Airtable writes`.
6. Obtain approval before pushing the feature branch or opening a pull request. A push may create a Vercel Preview.
7. In the PR, explain the problem, resulting behavior, verification evidence, environment requirements, and rollback.
8. Merge only after required checks and explicit approval. Verify the resulting production deployment and runtime behavior.

Local commits provide checkpoints; GitHub only contains commits that have actually been pushed. Do not describe a local commit as backed up remotely.

## Backtracking a release

Use `git log --oneline` to find commits and `git show <commit>` to inspect them. Use `git diff <older>..<newer>` to compare changes. Record the deployed commit with release notes so production can be matched to source.

For shared production history, use `git revert <commit>` on a new branch and review the revert through a PR. Avoid force-pushing or resetting shared `main`. Vercel deployment rollback and Git revert are separate actions; verify that the next deployment cannot accidentally restore the reverted defect.

Code rollback does not undo Instagram publications, Airtable writes, or Zoho uploads. Record affected record/publication IDs and handle external cleanup separately with authorization.

## Remote settings still to verify

Require PRs and successful checks on `main`, disable force pushes, and confirm that Vercel's production branch is `main`. These are intended settings, not verified remote configuration. CI automation and branch protection remain implementation tasks.
