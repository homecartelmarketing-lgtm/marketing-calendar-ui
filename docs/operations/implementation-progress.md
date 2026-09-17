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
- Moodboard #2 feed output lookup now targets its own Airtable tables, accepts alternate final-media field names, and derives fixture-specific foreign keys. The day detail modal can preselect a completed output for an unmodified fixture/CID row. This is locally tested, not yet verified against live Airtable data.
- Day & Night feed lookup verified against live Airtable tables (`tblSceuLVvLMQ6wWp`, `tblIgRlTtO7Y2EGIo`, `tblcKHAVYgzIcmabT`, `tbljsKOEhc0618qbM`), explicit pipeline fallback table IDs added, duplicate Table Lamp fallback removed from Moodboard #1, and media extraction resilience extended for dual/single Day & Night and candidate attachments.
- Day detail modal now accepts both `Completed` and `Posted` outputs in fixture counts and CID dropdowns (excluding `For Manual` and `Discard`), auto-preselecting matching `Completed` outputs first or `Posted` outputs if calendar row is marked posted, displaying canonical Foreign Key IDs in calendar rows.
- Style Reel Slideshow lookup verified against live Airtable table `tblFFEvkHb3jLKrcv` with fixture type derived from Foreign Key ID (`SR-REEL-CH-*` -> `Chandelier`), bidirectional isolated pipeline matcher preventing cross-matching with "1 Product, 3 Styles", `Item Name 1..5` extraction, and added to `NAV_MENUS.Reels`.
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
- Implemented Moodboard #2 Feed 2-photo carousel, strict status filtering, and modal deduplication on `codex/moodboard-2-feed-two-photos`:
  - `lib/output-media.ts` & `lib/output-mapping.ts`: Moodboard #2 Feed extracts Slide 1 (`Moodboard #2 Converted` with resilient aliases) and Slide 2 (`Blended Image` with resilient aliases). Both photos are strictly required; records missing either photo return empty media and are omitted from outputs.
  - `app/api/content-outputs/route.ts`: added `isCompletedOrDoneStatus` filter, strictly requiring Airtable status `Completed`, `Complete`, or `Done` (case-insensitive) for candidate outputs.
  - `components/day-detail-modal.tsx`: deduplicated planned slot rows so an idea only appears once per day. When multiple schedules share an idea, the latest one is matched and duplicate extra rows are suppressed. Dropdown candidates strictly require `Completed` status.
  - `components/content-preview-modal.tsx` & `app/api/schedules/route.ts`: when rescheduling a slot that already had an active scheduled record, the previous record is automatically released back to `Completed` in Airtable and its queue job cancelled to prevent stale duplicate schedules.
  - Completely removed "Posted" status across the Content Calendar UI:
    - `lib/schedules.ts`: queries Airtable with `filterByFormula: "Status='Scheduled'"` so only active scheduled posts load into the calendar, locking only scheduled foreign keys.
    - `components/calendar-grid.tsx`: filters `daySchedules` strictly by `status === "Scheduled"`, completely eliminating "Posted" pills from calendar day cells.
    - `components/day-detail-modal.tsx`: converts legacy posted entries to `Completed`, restricts candidate dropdowns strictly to `Completed` items, and strips any `[Posted]` labels.
    - `components/scheduled-posts-modal.tsx`: removed "Publish History" tab and `historyList`, displaying only the active upcoming queue.
  - Updated unit tests (`tests/output-media.test.ts`, `tests/content-outputs.test.ts`, `tests/modal-mutations.test.tsx`): 86 tests passing across 10 test files.
- Root-caused why Content Calendar schedules did not execute while `/scheduler-debug` schedules did: both paths enqueue an identical durable job via `createOrReplaceScheduledJob`, but only `/scheduler-debug` ever calls `/api/schedules/runner` (auto-trigger-if-due, plus a manual "Trigger Runner" button). The Calendar path relied solely on the Vercel Cron entry in `vercel.json`, which per item 6 below is not yet cut over/verified in this environment, and `DATABASE_URL` was unset locally (`isMockDb()` true), so the "durable" queue was in-memory only.
  - Added `app/api/schedules/trigger/route.ts`: a server-side-only POST endpoint that forwards to `/api/schedules/runner` with the server's own `CRON_SECRET`, mirroring the pattern already used by `app/api/scheduler-debug/route.ts`'s `trigger-runner` action, without ever exposing the secret to the client.
  - `components/content-preview-modal.tsx` `schedulePost()`: after a successful `POST /api/schedules`, if the scheduled PHT time is already due, silently (fire-and-forget) calls `/api/schedules/trigger` so the job executes immediately instead of waiting on external Cron. No visible UI change — the existing Calendar layout is preserved per project rules. Safe to layer on top of Cron once it's live, since `claimDueJobs` claims atomically and a job cannot be double-processed.
  - Added `tests/durable-scheduling.test.ts` coverage for the new trigger route (forwards `Authorization: Bearer <CRON_SECRET>` without requiring it from the client; reports failure without throwing if the runner call errors): 90 tests passing across 10 test files.
  - Found the Vercel project's `DATABASE_URL` (set 2 days before the Neon integration was connected) was likely stale/unrelated to the actual connected Neon database. Rather than hand-copy the Neon integration's connection string (its value is a locked/sensitive Vercel variable and cannot be copied even from the dashboard), `server/db/client.ts` `getDatabaseUrl()` now checks `POSTGRES_DATABASE_URL` (the Neon-Vercel integration's own variable name) first, falling back to `DATABASE_URL`/`POSTGRES_URL`/`NEON_DATABASE_URL`/`NEON_URL` for compatibility.
  - Added `app/api/schedules/init-db/route.ts`: a `CRON_SECRET`-protected POST endpoint that runs the existing (previously unwired) `initDbSchema()` against the live Neon database, to create `automation_jobs`/`automation_runs` without needing direct database console access.
  - `initDbSchema()` originally sent `schema.sql` as one multi-statement query, which Neon's HTTP driver rejects ("cannot insert multiple commands into a prepared statement"). Extracted a pure, tested `splitSqlStatements()` (`server/db/client.ts`) that strips full-line comments then splits on `;`. A first version of this filter incorrectly dropped an entire statement whenever a comment preceded it on the same trimmed chunk (silently applied only 1 of 5 statements while still reporting success) — fixed and covered by a regression test asserting all 5 statements survive parsing of the real `schema.sql`.
  - Verified end-to-end on the `codex/calendar-runner-trigger` Preview deployment (branch pushed, approved by operator): `POST /api/schedules/init-db` created `automation_jobs`/`automation_runs` on the live Neon DB (`usingMockDb: false`, confirming the `POSTGRES_DATABASE_URL` fallback fix works in a real deployed environment).
  - Found via a new read-only `GET /api/schedules/queue-status` that all 14 pre-existing Airtable "Scheduled" rows had **zero** matching `automation_jobs` rows — they were enqueued before the durable queue had a working schema/connection, so the runner had nothing to claim for them despite Airtable showing them as scheduled. Added `POST /api/schedules/backfill-queue`: a one-time, `CRON_SECRET`-protected endpoint that enqueues a job for each Airtable "Scheduled" row missing one (skipping rows already queued, and rows whose PHT time has already passed — reported separately rather than bypassing future-time validation). Run once on the Preview deployment: 13 of 14 rows backfilled successfully; 1 (`CTA-STORY-TL-1`, scheduled 2026-09-16 13:26 PHT) was already past-due and needs manual rescheduling through the Calendar UI. Confirmed via `queue-status` afterward: `count: 13`.
  - No live Instagram publish or runner trigger was performed against this data — only durable-queue bookkeeping (schema creation, job inserts) to match what Airtable already showed as scheduled.
  - Merged to `main` via PR #7 (https://github.com/homecartelmarketing-lgtm/marketing-calendar-ui/pull/7, operator-approved with explicit awareness that Production Cron was already active) and deployed to Production. **Important correction**: Preview and Production turned out to use *separate* Neon databases despite the `POSTGRES_DATABASE_URL`/`CRON_SECRET` Vercel env vars both being scoped to "Production and Preview" in the dashboard UI — that scoping controls which environments can *read* the variable, not that both environments share one value/database. Production's `queue-status` read 0 pre-existing rows even after the Preview backfill. Re-ran `init-db` (schema already present, idempotent) and `backfill-queue` directly against Production: 24 rows newly enqueued, 2 already queued (freshly scheduled by the operator through the live Calendar UI during verification, confirming the fix works in Production), 1 past-due skipped (`CTA-STORY-TL-1`), 0 failed.
  - Operator should manually reschedule `CTA-STORY-TL-1` (originally 2026-09-16 13:26 PHT) through the Calendar UI to a new future time — it has no queue entry and will not auto-publish.

## Verification

Latest local run: `npm test`: 90 passed across ten test files. `npm run typecheck`: passed (0 errors). `npm run build`: passed (clean production compile, includes new `/api/schedules/trigger` route). Provider requests in these tests are fixtures, not live integration evidence. The Calendar-to-runner trigger has only been verified locally against the mock DB; it does not confirm a live Vercel Cron invocation or a live Instagram publish — see "Next work" item 6.

A read-only local diagnostics run with the operator's configured local environment verified Meta and Airtable connectivity and loaded the schedule/catalog. This does not verify the Vercel Production environment, a native Cron invocation, or an Instagram publication.

## Next work, in order

1. (Completed) Fix UI mutation handlers that still ignore failed schedule/cancel responses and remove duplicate writes.
2. (Completed) Protect runner route with Bearer-only auth, add kill switch, implement durable Postgres queue with atomic claims, locked snapshots, and bounded retries.
3. (Completed 2026-09-17) Neon Postgres was already connected on Vercel via the marketplace integration; schema initialization was unwired (`initDbSchema()` existed but no route called it) and the app preferred a stale `DATABASE_URL` over the integration's actual `POSTGRES_DATABASE_URL`. Both fixed; schema verified present and populated on Production (see above).
4. Finish mapping fixtures, rate-limit handling across instances, legacy tips-feed route consolidation, and non-overlapping calendar polling.
5. Complete CI, browser/visual regression, documentation consolidation, operational runbooks, package-manager cleanup, and remote GitHub settings verification.
6. Vercel Pro confirmed. Cron cutover confirmed already active in Production (`/api/schedules/runner`, every minute, enabled) prior to this work — not something this session provisioned. `CRON_SECRET` was visible in an operator-shared screenshot during manual browser-console verification (no alternative existed to call protected diagnostic routes without a running server); operator was advised to rotate it and declined for now. A controlled/approved Instagram test still has not been performed — only durable-queue bookkeeping.

No production deployment, GitHub push, provider schema change, or live Instagram test was performed in this implementation batch.

## External evidence needed

Authenticated Vercel project/plan, production and staging credential presence, chosen durable store connectivity, controlled test account/content, publication ID/permalink, three native Cron invocations, and 24–48-hour cutover observation. None is established by passing unit tests.
