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

## Verification

`npm test`: 50 passed across nine test files. `npm run typecheck`: passed. `npm run build`: passed. Provider requests in these tests are fixtures, not live integration evidence.

A read-only local diagnostics run with the operator's configured local environment verified Meta and Airtable connectivity and loaded the schedule/catalog. This does not verify the Vercel Production environment, a native Cron invocation, or an Instagram publication.

## Next work, in order

1. (Completed) Fix UI mutation handlers that still ignore failed schedule/cancel responses and remove duplicate writes.
2. Protect read/mutation/debug/upload routes, remove the secret preview/query-secret authorization, and separate simulation from live publishing.
3. Implement durable publication claims, execution history, shared Post Now/runner orchestration, reconciliation, and bounded retry/recovery.
4. Finish mapping fixtures, rate-limit handling across instances, legacy tips-feed route consolidation, and non-overlapping calendar polling.
5. Complete CI, browser/visual regression, documentation consolidation, operational runbooks, package-manager cleanup, and remote GitHub settings verification.
6. Provision/verify environment settings, rotate the exposed secret, verify Vercel Pro, and perform the approved Cron cutover and controlled Instagram test.

No production deployment, GitHub push, provider schema change, or live Instagram test was performed in this implementation batch. The old runner still has memory-only locking; native Cron must remain inactive until durable safety is implemented.

## External evidence needed

Authenticated Vercel project/plan, production and staging credential presence, chosen durable store connectivity, controlled test account/content, publication ID/permalink, three native Cron invocations, and 24–48-hour cutover observation. None is established by passing unit tests.
