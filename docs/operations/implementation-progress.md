# Stabilization progress — 2026-09-14

The overall automation goal is active. This record distinguishes implemented fixes from outstanding design requirements.

## Implemented locally

- Added npm test/typecheck commands, Vitest configuration, provider-isolated test setup, and 32 regression tests.
- Output reads include subsequent Airtable pages, deduplicate table targets and records, detect malformed/repeated pagination, and return safe partial-failure diagnostics.
- Complete output-provider failure returns an error rather than a successful empty gallery.
- Schedule reads also follow pagination and expose malformed/provider failures.
- Airtable read requests are paced per base within one server instance; this is not distributed rate limiting.
- Schedule writes validate dates and PHT times. Rejected timestamps cannot silently become status-only updates.
- Cancellation clears the supported legacy date column; unauthorized writes do not retry alternate schemas.
- Output PATCH uses the shared validated writer and reports failed persistence.
- Gallery requests abort/ignore stale category responses; refresh resets pagination; partial warnings retain successful cards.
- Gallery and scheduler share final-media extraction. Moodboard and Day & Night slide order is explicit; input drafts and non-video Reel attachments are excluded.
- Removed duplicated media extraction and schedule-writing code while preserving route paths and output fields.
- Fixed UI modal mutation handlers (`content-preview-modal.tsx`, `scheduled-posts-modal.tsx`) to eliminate duplicate Airtable writes across scheduling, cancellation, and Post Now flows.
- Ensured non-OK responses from Airtable / Schedules API strictly block success toasts and prevent local state mutations.
- Updated `/api/meta-post` to return `statusSyncWarning` when Meta succeeds but Airtable status update fails, alerting the operator while preventing duplicate writes.
- Added regression test suite `tests/modal-mutations.test.tsx` (36 total tests passing across 7 test files).
- Bounded scheduler-debug Meta, Airtable schedule, and candidate-media checks so a stalled provider cannot leave the page loading indefinitely; the UI now distinguishes checking, connected, and failed diagnostics without exposing a Cron secret preview.
- Added the two implementation plans, root README, documentation index, Git workflow, and project AGENTS rules.
- Archived the historical scheduler repair audit and removed its byte-for-byte duplicate from `Claude outputs/`.
- Implemented durable automation queue on `codex/safe-instagram-scheduling`:
  - Added Postgres DDL schema (`server/db/schema.sql`) and database client (`server/db/client.ts`) with Neon Postgres and provider-isolated test mock support.
  - Implemented `server/automation/jobs.ts` with future PHT timestamp validation, deterministic SHA-256 media versioning, atomic claims (`FOR UPDATE SKIP LOCKED`), 1/5/15-minute retry backoff, and cancellation conflict detection.
  - Made `POST /api/schedules` the single unified scheduling entry point: creates durable job in queue, locks previewed media/caption snapshot, and updates Airtable with validated PHT timestamp.
  - Modernized `DELETE /api/schedules`: rejects cancellation if publication is in-flight (HTTP 409) and cancels job before restoring Airtable to `Completed`.
  - Modernized `/api/schedules/runner`: removed insecure query parameter secrets (enforces `Authorization: Bearer <CRON_SECRET>`), reads due jobs from Postgres instead of scanning 79 Airtable tables, records Meta publication ID before Airtable status sync to prevent duplicate posts, and respects `AUTOMATION_KILL_SWITCH`.
  - Updated `components/content-preview-modal.tsx`: unified "Tag as Scheduled" and "Confirm" flows through `POST /api/schedules`, eliminating unvalidated direct PATCH calls to `/api/content-outputs`.
  - Added 19 provider-isolated regression tests in `tests/durable-scheduling.test.ts` (69 total tests passing across 10 test files).
  - Synchronized `package-lock.json` and `pnpm-lock.yaml` for Vercel deployment compatibility.

## Verification

`npm test`: 69 passed across ten test files. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. Provider requests in these tests are fixtures, not live integration evidence.

A read-only local diagnostics run with the operator's configured local environment verified Meta and Airtable connectivity and loaded the schedule/catalog. This does not verify the Vercel Production environment, a native Cron invocation, or an Instagram publication.

## Next work, in order

1. (Completed) Fix UI mutation handlers that still ignore failed schedule/cancel responses and remove duplicate writes.
2. (Completed) Protect runner route with Bearer-only auth, add kill switch, implement durable Postgres queue with atomic claims, locked snapshots, and bounded retries.
3. Provision/connect Neon Postgres on Vercel (`DATABASE_URL`) and verify schema initialization.
4. Finish mapping fixtures, rate-limit handling across instances, legacy tips-feed route consolidation, and non-overlapping calendar polling.
5. Complete CI, browser/visual regression, documentation consolidation, operational runbooks, package-manager cleanup, and remote GitHub settings verification.
6. Provision/verify environment settings, rotate the exposed secret, verify Vercel Pro, and perform the approved Cron cutover and controlled Instagram test.

No production deployment, GitHub push, provider schema change, or live Instagram test was performed in this implementation batch.

## External evidence needed

Authenticated Vercel project/plan, production and staging credential presence, chosen durable store connectivity, controlled test account/content, publication ID/permalink, three native Cron invocations, and 24–48-hour cutover observation. None is established by passing unit tests.
