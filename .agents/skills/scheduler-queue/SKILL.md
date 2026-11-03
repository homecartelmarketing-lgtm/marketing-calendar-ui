---
name: scheduler-queue
description: Use when changing or diagnosing scheduled publishing in this repo — the Neon Postgres automation_jobs queue, PHT timestamp validation, reschedule/cancel behavior, Vercel Cron, the manual runner trigger, retries, the kill switch, or endpoints like init-db, backfill-queue, and queue-status. Prevents silent non-publishing and duplicate posts.
---

# Durable scheduler and queue

Covers `server/automation/jobs.ts`, `server/db/client.ts`, `server/db/schema.sql`, `app/api/schedules/*`, `vercel.json`, and `lib/schedules.ts`.

## When to use

- A row shows `Scheduled` in Airtable but nothing publishes.
- You are changing scheduling, rescheduling, cancellation, retries, or Cron.
- `queue-status` shows `usingMockDb: true` in a deployment.
- You need to run a maintenance endpoint or explain why a job is stuck.
- You are adding a new code path that schedules content.

## Non-negotiable rules

1. **`POST /api/schedules` is the only scheduling entry point.** It must:
   - validate a future PHT timestamp (`validateFuturePhtSchedule`);
   - create/replace the durable job (`createOrReplaceScheduledJob`);
   - write the same validated timestamp to Airtable (`syncAirtableRecord`).
   Never add a path that writes `Status=Scheduled` without a queue job, or a status-only write.
2. **A successful schedule always includes its PHT timestamp.** `syncAirtableRecord` must throw if the date/time is invalid; never silently downgrade to status-only.
3. **Cancel before restoring.** `DELETE /api/schedules` cancels the job first, then restores the record to `Completed`. If the job is `Publishing`, return **409** and do not cancel.
4. **Reschedule replaces the previous job.** `createOrReplaceScheduledJob` cancels the record's active `Scheduled`/`Retry Pending` job. When the previous record is a different row, release that old row back to `Completed`.
5. **Atomic claim only.** Use `claimDueJobs()` with `FOR UPDATE SKIP LOCKED`, a 5-minute lease, and a limit of 10. Never use an in-memory lock as production coordination.
6. **Publication ID before status.** `recordJobSuccess()` writes `meta_publication_ids` before Airtable is set to `Posted`. If Airtable fails, log and warn; never re-publish.
7. **Retry policy.** 1 min → 5 min → 15 min, max 3 attempts. Permanent errors go straight to `For Manual`.
8. **Auth fails closed.** Runner and maintenance endpoints require `Authorization: Bearer <CRON_SECRET>`. Query-parameter secrets are forbidden. If `CRON_SECRET` is missing, deny.
9. **Kill switch.** `AUTOMATION_KILL_SWITCH=true` pauses all claims without cancelling rows.
10. **Live publishing is gated.** Live only when `NODE_ENV=production` or `ENABLE_AUTOMATION_SCHEDULING=true`; otherwise simulate (unless `SIMULATE=0`). `AUTOMATION_ALLOWLIST_RECORDS` can restrict records.
11. **Mock DB must not reach production.** `isMockDb()` is true when `NODE_ENV=test`, `VITEST` is set, or no database URL exists. `usingMockDb: true` in a deployment is an incident: schedules look real but nothing is durable.
12. **Database URL priority.** `SUPABASE_DATABASE_URL` → `SUPABASE_DB_URL` → `POSTGRES_DATABASE_URL` → `DATABASE_URL` → `POSTGRES_URL` → `NEON_DATABASE_URL` → `NEON_URL`. Do not "simplify" this list; Vercel's Neon integration injects `POSTGRES_DATABASE_URL`.

## Key files and responsibilities

| Concern | File |
| :--- | :--- |
| Validation, idempotency, cancel, retry, claims | `server/automation/jobs.ts` |
| DB URL, mock DB, `splitSqlStatements`, `initDbSchema` | `server/db/client.ts` |
| Tables and indexes | `server/db/schema.sql` |
| Unified schedule API | `app/api/schedules/route.ts` |
| Runner (Cron + manual trigger) | `app/api/schedules/runner/route.ts` |
| Server-side trigger without exposing the secret | `app/api/schedules/trigger/route.ts` |
| Diagnostics / backfill / schema bootstrap | `app/api/schedules/queue-status/route.ts`, `backfill-queue/route.ts`, `init-db/route.ts` |
| Cron every minute | `vercel.json` |
| Airtable read + PHT parsing | `lib/schedules.ts` |

## Diagnostic runbook

Use `Authorization: Bearer <CRON_SECRET>` for every call.

1. **Is the DB real?** `GET /api/schedules/queue-status` → check `usingMockDb`, `count`, `jobs`.
2. **Airtable says Scheduled, queue is empty.**
   - `POST /api/schedules/backfill-queue` (enqueue only; does not publish).
   - Past-due rows are skipped and must be rescheduled through the Calendar UI.
3. **Schema missing / Neon multi-statement error.**
   - `POST /api/schedules/init-db`. It applies `schema.sql` through `splitSqlStatements()` because Neon's HTTP driver rejects multi-statement queries.
4. **Preview works, Production does not.**
   - Preview and Production can use **separate Neon databases** even when Vercel scopes env vars to both. Run `init-db` and `backfill-queue` separately per environment.
5. **A job is stuck or failed.**
   - Read `last_error_code`, `last_error_message`, `attempts`, `next_attempt_at` from `queue-status`.
   - `For Manual` means retries are exhausted or the error was permanent; fix the cause, then reschedule.
6. **Emergency stop.**
   - Set `AUTOMATION_KILL_SWITCH=true` and redeploy. This pauses claims; it does not change Airtable rows.

## Tests

- `tests/durable-scheduling.test.ts` — validation, idempotency, claims, retries, cancel conflicts, media refresh, publication ordering, trigger route.
- `tests/schedule-reads.test.ts` / `tests/schedule-writes.test.ts` — pagination, PHT, status/date writes.
- Mock DB is used automatically in tests; never connect to Neon or Airtable.

## Red flags

- Runner scanning Airtable tables instead of claiming due jobs.
- A new `PATCH Status=Scheduled` outside `POST /api/schedules`.
- Cancelling a `Publishing` job instead of returning 409.
- Dropping a timestamp to make a write "succeed".
- Adding an in-memory lock and calling it durable.
- Treating `usingMockDb: true` as normal.
- Exposing `CRON_SECRET` to the client or accepting it as a query parameter.
