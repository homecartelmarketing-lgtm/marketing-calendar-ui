# Automation Stabilization Implementation Plan

> For agentic workers: execute each task with a regression test and review the resulting diff. The user authorized implementation in this task. Keep progress and external verification evidence here.

**Goal:** Repair output fetching, publishing, scheduling, diagnostics, and deployment while preserving the existing UI.

**Architecture:** Keep route URLs and the current output response fields compatible. Extract tested provider and automation services behind the existing routes. Content records remain in Airtable; execution state requires durable atomic storage before production Cron activation.

**Tech stack:** Installed Next.js 16.3.3, TypeScript, npm, Vitest, React Testing Library, Playwright, Airtable, Meta, Vercel.

**Spec:** [Automation design](../specs/2026-09-14-automation-stabilization-design.md).

## Constraints and evidence rules

- Preserve calendar, gallery, modal, and debug layouts. Use existing error/retry controls for errors.
- Read installed Next.js route/auth/testing guides before applicable changes.
- Never use production credentials in automated tests. Provider tests intercept network calls.
- Do not treat an HTTP 200 heartbeat as proof of an Instagram publication.
- Keep live publication tests, production deployment, and credential provisioning explicitly tracked as external verification steps.
- Check account usage periodically and stop work near 2% remaining as requested.
- Commit locally on `codex/` branches; pushing, merging, and live publication retain their separate approval requirements.

## 1. Output fetching and regression harness

**Files:** `package.json`, `vitest.config.mts`, `tests/content-outputs.test.ts`, `server/airtable/records.ts`, `app/api/content-outputs/route.ts`, `components/universal-content-gallery.tsx`.

- [x] Add a test command with isolated fake credentials and provider interception.
- [x] Reproduce loss of the 101st record using 100 records plus an opaque offset on page one and one record on page two.
- [x] Reproduce all-table failure returning a misleading empty success and partial-table failure disappearing from diagnostics.
- [x] Implement bounded paginated reads; reject malformed pages and repeated offsets; deduplicate records and queried table IDs.
- [x] Preserve successful data while reporting safe partial errors; return a provider error if every target fails.
- [x] Cover invalid categories and empty configuration separately from genuine empty results.
- [x] Fix stale gallery requests on category changes and clamp pagination after refresh/filter changes.
- [x] Run `npm test -- tests/content-outputs.test.ts`; then `npm run typecheck` and `npm run build`.

## 2. Security and environment boundaries

**Files:** `server/auth/`, mutation/read routes in `app/api/`, existing debug page, `.env.example`, `tests/auth.test.ts`.

- [ ] Inventory every public data, mutation, upload, local-media, and debug route.
- [ ] Choose and document operator authentication with server-side enforcement and same-origin mutation checks. Protect diagnostics as well as writes.
- [ ] Test missing, malformed, and query-string Cron credentials; permit only the Bearer header and compare safely.
- [ ] Remove secret previews and sanitize errors from provider payloads.
- [ ] Add publishing/scheduler environment switches that default to disabled when configuration is incomplete.
- [ ] Prove unsigned requests cannot trigger Meta, Airtable writes, Zoho uploads, or live debug actions.
- [ ] Preserve Meta media delivery through public or signed URLs that do not need operator sessions.

## 3. Mapping and media correctness

**Files:** `lib/output-mapping.ts`, `lib/tables-config.ts`, `server/content-outputs/`, content route, `tests/output-mapping.test.ts`.

- [ ] Inventory every configured category/idea/fixture combination; distinguish intentional shared tables from conflicting mappings.
- [ ] Extract normalized output types out of Next route modules. Keep existing client fields while documenting generated and scheduled timestamps.
- [ ] Test final attachment selection for every mapping, slide order, MIME detection, missing output, and expiring URLs.
- [ ] Remove draft/input-media fallbacks that can publish the wrong asset; surface missing final media as an actionable error.
- [ ] Limit local-file fallback to configured local development and prevent path traversal.

## 4. Shared publishing and durable state

**Files:** `server/automation/`, `server/instagram/`, `lib/meta-api.ts`, `lib/schedules.ts`, `app/api/meta-post/route.ts`, runner and debug routes, `tests/publishing.test.ts`.

- [ ] Define one publisher input containing content identity, category, caption, ordered media, and publication intent/version.
- [ ] Separate execution statuses from existing Airtable single-select values. Do not add unsupported statuses to content tables.
- [ ] Implement a durable store with atomic claims, owner-checked updates, run history, and unique publication intent keys shared by Post Now and scheduled runs.
- [ ] Persist each Meta container/publication result before proceeding to the next slide; ambiguous network outcomes require reconciliation instead of blind retry.
- [ ] Test simultaneous invocations, expired leases, partial Stories, Meta success followed by Airtable failure, and process interruption.
- [ ] Configure bounded batches, provider deadlines, retry delays, and manual recovery. Define cancellation/reschedule behavior for claimed jobs.
- [ ] Backfill existing scheduled content into the queue using a repeatable dry-run migration and retain rollback instructions.

## 5. Existing diagnostics and UI regression

**Files:** existing `app/scheduler-debug/`, `components/`, `features/`, `tests/`, Playwright config.

- [ ] Route Post Now, Schedule, retry, and debug through the same services.
- [ ] Show heartbeat, job result, and safe provider errors in the existing debug page.
- [ ] Add dry-run diagnostics that never publish or change content status.
- [ ] Test double-clicks, loading/empty/partial-error states, stale responses, filtering, pagination, cancellation, and timezone boundaries.
- [ ] Capture and compare current desktop/mobile UI; split oversized modules only behind passing behavior tests.

## 6. CI, Cron migration, and operational verification

**Files:** `.github/workflows/ci.yml`, `vercel.json`, operational docs, tests and verification scripts.

- [ ] Run typecheck, lint, provider/unit tests, UI tests, production build, secret scan, and documentation link checks in CI.
- [ ] Verify the actual Vercel project is Pro and belongs to the intended production team.
- [ ] Rotate the exposed Cron secret through the operator; never record the value in Git.
- [ ] Configure native Cron at `* * * * *` only after durable publication safety is verified.
- [ ] Pause cron-job.org before native production activation; record three successful native invocations and a controlled scheduled Instagram publication ID/permalink.
- [ ] Monitor 24–48 hours, check missed/duplicate/failed jobs, then retire the old trigger. Code rollback does not delete Instagram posts or undo data writes.

## Current evidence

- Starting point: local design commit `41dc2dc`; no implementation tests configured.
- Confirmed: output route reads one `pageSize=100` page and silently skips non-OK table responses.
- Confirmed: runner has memory-only locks and continues after Airtable rejects `Publishing`.
- Production subscription, new durable storage, authentication configuration, and live publish outcome remain unverified.
