# Repository and Documentation Organization Design

**Status:** Proposed for review

**Date:** 2026-09-14

**Scope owner:** HomeCartel Marketing
**Companion design:** `2026-09-14-automation-stabilization-design.md`

## 1. Purpose

Make the repository easy for human developers and AI agents to understand, modify, test, deploy, and roll back without changing the current user interface or mixing unrelated work.

## 2. Core organization rules

- Keep only recognized project entry documents and framework/tool instruction files at the repository root.
- Put detailed documentation under `docs/`, organized by reader intent.
- Maintain one authoritative document per topic; link to it instead of copying sections.
- Preserve historical material under `docs/archive/` and label it as historical.
- Use lowercase kebab-case for detailed documentation filenames.
- Keep recognized root filenames uppercase: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `SECURITY.md`.
- Never store credentials, access tokens, passwords, private headers, or real secret examples in Markdown.
- Update documentation in the same pull request as the behavior it describes.
- Do not move application code during the documentation-only workstream.

## 3. Target repository documentation tree

```text
Marketing Output UI/
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── SECURITY.md
│
├── .github/
│   └── pull_request_template.md
│
└── docs/
    ├── README.md
    ├── getting-started/
    │   └── local-development.md
    ├── architecture/
    │   ├── system-overview.md
    │   ├── content-output-flow.md
    │   └── scheduling-flow.md
    ├── integrations/
    │   ├── airtable.md
    │   ├── meta-instagram.md
    │   └── zoho-workdrive.md
    ├── operations/
    │   ├── scheduler-runbook.md
    │   ├── output-troubleshooting.md
    │   └── incident-response.md
    ├── deployment/
    │   ├── environments.md
    │   ├── vercel.md
    │   └── release-and-rollback.md
    ├── testing/
    │   ├── output-test-matrix.md
    │   ├── scheduler-debug.md
    │   └── regression-checklist.md
    ├── reference/
    │   ├── environment-variables.md
    │   ├── airtable-fields.md
    │   ├── output-mappings.md
    │   ├── content-types.md
    │   └── status-lifecycle.md
    ├── development/
    │   ├── git-workflow.md
    │   └── definition-of-done.md
    ├── decisions/
    │   ├── 0001-vercel-native-cron.md
    │   └── 0002-automation-locking.md
    ├── superpowers/
    │   ├── specs/
    │   └── plans/
    └── archive/
        ├── scheduler-repair-2026-09.md
        └── cron-job-org-migration.md
```

## 4. Root files and ownership

### `README.md`

The project front door. It contains the product purpose, architecture summary, prerequisites, minimal local quickstart, common commands, safety warning for live publishing, and links into `docs/`. It does not duplicate complete deployment or integration guides.

### `AGENTS.md`

Mandatory project instructions for AI coding agents. Preserve the Next.js-managed block exactly. Add HomeCartel rules outside the managed block covering Git safety, required installed-framework documentation, UI preservation, secrets, testing, deployment, and documentation updates.

Proposed project-specific rules:

```md
## HomeCartel project rules

- Read the relevant installed Next.js guide before changing Next.js code.
- Inspect `git status` before editing and preserve unrelated user changes.
- Never commit or push directly to `main`.
- Use one focused `codex/<task-name>` branch per task.
- Do not push a branch, open a pull request, merge, deploy, or publish live content unless the user explicitly requests it.
- Preserve the current UI unless a visual change is explicitly approved.
- Never commit credentials, `.env.local`, logs, generated output, or real secret examples.
- Protect all APIs that mutate Airtable, Zoho, scheduler state, or Instagram.
- Add a failing test before each behavior fix and run proportional verification before completion.
- Run typecheck, lint, tests, build, secret scan, and Markdown link checks before requesting merge.
- Update relevant documentation in the same change as behavior or configuration.
- Deploy feature branches only as Vercel Preview; Production deploys only from reviewed `main`.
- Use `git revert` or Vercel rollback; never rewrite `main` history.
```

`AGENTS.md` remains concise. Detailed explanations belong in `CONTRIBUTING.md` and `docs/development/git-workflow.md`.

### `CLAUDE.md`

Keep `@AGENTS.md` so Claude receives the same canonical instructions. Add Claude-only rules only when they cannot be expressed in `AGENTS.md`.

### `CONTRIBUTING.md`

Explains the branch, test, review, commit, documentation, and deployment workflow for both humans and AI agents.

### `SECURITY.md`

Defines secret handling, rotation, incident reporting, prohibited logging, environment separation, and response steps after accidental exposure. It never contains real credential values.

## 5. Existing Markdown disposition

| Current file | Intended destination | Treatment |
|---|---|---|
| `AGENTS.md` | Root | Preserve generated block; append project rules after approval |
| `CLAUDE.md` | Root | Keep canonical `@AGENTS.md` reference |
| `VERCEL_DEPLOYMENT_GUIDE.md` | `docs/deployment/vercel.md` | Rewrite for Vercel Pro native Cron and Preview/Production separation |
| `CLOUDFLARE_TUNNEL_GUIDE.md` | `docs/deployment/cloudflare-tunnel.md` or archive | Keep only if local tunnel sharing remains supported |
| `ZOHO_WORKDRIVE_SETUP_GUIDE.md` | `docs/integrations/zoho-workdrive.md` | Sanitize and update |
| `SCHEDULER_FIX_PLAN.md` | `docs/archive/scheduler-repair-2026-09.md` | Mark historical; do not present old findings as current state |
| `Claude outputs/SCHEDULER_FIX_PLAN.md` | Removed after verification | Exact duplicate of canonical historical plan |
| Deleted Catalyst guide | `docs/archive/` or restored deployment guide | Decide based on whether Catalyst remains supported |

Deleting the exact duplicate happens only after confirming hashes and preserving the canonical copy in Git history.

## 6. Git workflow

### 6.1 Branch model

```text
main
├── codex/protect-scheduler-debug
├── codex/output-fetch-pagination
├── codex/unify-publishing
├── codex/vercel-native-cron
└── codex/documentation-cleanup
```

- `main` is always production-ready.
- Each branch addresses one reviewable concern.
- A branch is pushed to GitHub for backup, traceability, and a Vercel Preview only when the user authorizes the push.
- A pull request records intent, risks, tests, screenshots when UI-related, and rollback steps.
- Prefer squash merging so one focused pull request becomes one revertible commit on `main`.
- Delete the remote feature branch after the merge succeeds.
- Never force-push or rebase shared `main` history.

### 6.2 Required sequence

```text
Inspect repository status
    -> create codex/<task> branch
    -> add failing test or documentation check
    -> make focused change
    -> run local verification
    -> review diff for secrets/unrelated edits
    -> ask before push
    -> push feature branch
    -> inspect Vercel Preview and CI
    -> obtain approval
    -> merge to main
    -> verify Production
    -> monitor
```

### 6.3 Commit convention

Use concise conventional messages:

```text
docs: organize deployment guides
test: cover Airtable pagination
fix: fetch all Airtable output pages
refactor: centralize Instagram publishing
security: protect scheduler debug actions
chore: configure Vercel native cron
```

Do not mix documentation cleanup and runtime behavior changes unless the documentation directly explains that behavior change.

### 6.4 Pull-request checklist

- Scope and reason are clear.
- Current UI screenshots are attached when UI files changed.
- No unrelated diff is present.
- No credentials or private data are present.
- Typecheck, lint, tests, build, secret scan, and Markdown links pass.
- Preview uses non-production credentials and cannot publish live unexpectedly.
- Data/schema migrations are documented.
- Rollback procedure is specific.
- Relevant documentation is updated.

## 7. Vercel deployment environments

- Non-`main` branches create Preview deployments.
- Preview credentials are separate and scheduler execution is disabled by default.
- `main` is the Production branch.
- Vercel native Cron runs only in Production.
- Production merges require successful checks and explicit approval.
- A rollback restores service first; the Git history is then corrected with a revert or follow-up fix.

The Git workflow guide documents both Git revert and Vercel Instant Rollback, including the fact that runtime data changes in Airtable, Zoho, or Instagram are not automatically reversed by a code rollback.

## 8. Code organization direction

Documentation cleanup does not move code. Code restructuring follows the companion automation plan and preserves the current UI.

Target boundaries:

```text
features/                  # focused UI behavior grouped by feature
server/                    # server-only provider and automation services
app/api/                   # thin authorized route handlers
components/ui/             # reusable presentational primitives only
docs/                      # canonical developer and operations knowledge
```

Only move files when imports, tests, and behavior can be updated and verified in the same focused pull request.

## 9. Package and generated-file hygiene

- Select one package manager. The current Dockerfile and scripts favor npm, so npm is the recommended canonical choice.
- Remove the unused lockfile only after a clean install and build prove the choice.
- Keep `.next/`, logs, `.env*.local`, `.vercel/`, and `*.tsbuildinfo` ignored.
- Do not commit temporary screenshots, downloaded media, debug dumps, or generated build output.
- Decide whether Catalyst deployment remains supported before deleting `Dockerfile`, `catalyst.json`, or related documentation.

## 10. Documentation quality gates

- Every relative Markdown link resolves.
- Every documented command is run from the stated directory and verified.
- Environment examples use placeholders only.
- Current docs contain no stale cron-job.org instructions after migration.
- Historical docs are clearly labeled and do not appear in the active docs index.
- Each operational procedure includes prerequisites, safe steps, success signals, failure signals, and rollback.
- Each architecture document names its source of truth and module owners.
- No topic has two canonical documents.

## 11. Implementation workstreams

1. Create root README, CONTRIBUTING, SECURITY, docs index, and Git workflow.
2. Append approved HomeCartel rules to `AGENTS.md` without touching the generated block.
3. Move and sanitize deployment/integration guides; update all links.
4. Consolidate and archive scheduler repair history.
5. Write architecture, reference, test, and operations documentation alongside automation work.
6. Add GitHub pull-request template and CI documentation gates.
7. Validate the final tree, commands, links, and absence of secrets.

## 12. Completion criteria

- The repository root contains only necessary project entry/configuration files.
- `README.md` gives a new developer a working quickstart and routes them to canonical docs.
- `AGENTS.md` contains enforceable project rules outside the preserved Next.js block.
- `CLAUDE.md` points to the canonical agent rules.
- The two implementation plans reference these approved designs.
- Git workflow and rollback are documented and reflected in AI rules.
- Existing docs are moved, sanitized, linked, and deduplicated.
- No runtime code or current UI behavior changes during the documentation-only pull request.
- Markdown link and secret scans pass.

## 13. Actions requiring explicit user approval

AI agents may inspect, edit, test, create local `codex/` branches, and create focused local commits when requested. They must obtain explicit user approval before:

- Pushing a branch to GitHub
- Opening or updating a pull request
- Merging into `main`
- Deploying or promoting to Production
- Rotating or transmitting credentials
- Changing cloud permissions or billing
- Publishing live Instagram content
- Deleting cloud data or remote branches
