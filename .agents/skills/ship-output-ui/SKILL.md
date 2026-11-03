---
name: ship-output-ui
description: Use when finishing a change, running checks, committing, pushing, opening a PR, deploying to Vercel, or rolling back in the Marketing Output UI repo. Enforces npm test/typecheck/build, credential-free tests, ask-before-push/deploy/live-publish, and honest reporting about what local tests do not prove.
---

# Ship the Marketing Output UI

Covers the git/Vercel release path for this repo. Read `docs/development/git-workflow.md` and `AGENTS.md` before using it.

## When to use

- A change is ready for review or commit.
- You need to push, open a PR, deploy, or roll back.
- You are unsure whether local tests are enough to claim success.

## Non-negotiable rules

1. **Ask first.** Get explicit approval before pushing, opening a PR, merging, deploying, or performing any live Instagram publication test. Finishing a task is not permission to ship.
2. **Stay on a focused branch.** Develop on `codex/<task>`; `main` is the reviewed production release. Run `git status` first and preserve unrelated changes.
3. **Run all checks before claiming a pass:**
   ```sh
   npm test
   npm run typecheck
   npm run build
   git diff --check
   ```
4. **Tests never touch live services.** `tests/setup.ts` points `MARKETING_AUTOMATION_DIR` at a nonexistent path, sets fake Airtable credentials, and makes unstubbed `fetch` throw. Never add a test that loads `.env`, real Airtable/Meta/Zoho credentials, or uploads data.
5. **Local tests are not live evidence.** Passing Vitest does not prove a Vercel Cron invocation, a Neon connection in production, an Instagram publication, or a successful Zoho upload. Say exactly what was and was not verified.
6. **No secrets in the repo or logs.** Never commit `.env*` (except examples), tokens, authorization headers, or raw provider errors.
7. **Rollback is `git revert`, not force-push.** Do not force-push `main`, reset shared history, or amend pushed commits. Code rollback does not undo Instagram posts, Airtable writes, or Zoho uploads — handle those separately with authorization.
8. **Document the change.** Update the relevant doc and add a session entry in `docs/daily-logs/YYYY-MM-DD.md` following `docs/templates/session-log-template.md`. Update `docs/operations/implementation-progress.md` when the stabilization status changes.

## Pre-ship checklist

- [ ] Scope matches the request; no unrelated UI, calendar, gallery, modal, or scheduler-debug layout changes.
- [ ] Provider calls live in server services; shared media rules live in `lib/output-media.ts`.
- [ ] Behavior change has provider-isolated regression coverage.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` pass.
- [ ] Diff reviewed for credentials, generated files, and accidental changes.
- [ ] Docs updated; continuation record is precise about unfinished work.
- [ ] Approval obtained for the next external action.

## Commit

Stage explicit paths after reading `git status`. Use a descriptive conventional-style message, for example:

```sh
git add app/api/schedules/runner/route.ts tests/durable-scheduling.test.ts
git commit -m "fix: refresh Airtable media before scheduled publish"
```

Local commits are checkpoints, not remote backups. Do not describe an unpushed commit as backed up.

## Push and PR

Ask first. A push can create a Vercel Preview and will use that environment's env vars and Neon database.

The PR should state:

1. The problem and root cause.
2. The resulting behavior.
3. Verification evidence (which commands, which tests).
4. Environment requirements (env vars, Preview vs Production databases).
5. Rollback plan.
6. What remains unverified (live publish, Cron, production DB).

## Vercel

- `main` is the production branch. Verify this in the Vercel project; it is an intended setting, not a verified remote configuration.
- `vercel.json` runs `/api/schedules/runner` every minute. Cron is active in Production; do not enable it casually in Preview.
- Preview and Production may use **separate Neon databases** even with the same env var names. Run `init-db` and `backfill-queue` per environment.
- Vercel deployment rollback and `git revert` are separate actions. Check that the next deploy cannot reintroduce the reverted defect.
- There is no `.github` CI workflow in this repo yet; branch protection and required checks are still implementation tasks. Do not claim CI passed when only local checks ran.
- Package manager is npm (`npm ci`). `package-lock.json` and `pnpm-lock.yaml` both exist for Vercel compatibility; keep them in sync when dependencies change.

## Emergency stop

For an automation incident, set `AUTOMATION_KILL_SWITCH=true` in Vercel and redeploy. This pauses the runner without cancelling scheduled rows. See the `scheduler-queue` skill for diagnostics.

## Red flags

- Pushing "to save work" without approval.
- Reporting "deployed" after a local build.
- Claiming a live publish from a unit test.
- Committing a screenshot or doc containing a token or secret.
- Force-pushing or resetting `main`.
- Changing calendar/gallery/modal layout when only behavior was requested.
