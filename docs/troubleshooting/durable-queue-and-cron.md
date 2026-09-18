# Troubleshooting: Durable Queue & Vercel Cron

#troubleshooting #postgres #neon #cron #queue

This playbook addresses common pitfalls with Neon serverless Postgres, Vercel Cron triggers, and durable queue synchronization.

---

## 🚨 Error Catalog & Diagnostics

### 1. `cannot insert multiple commands into a prepared statement`
* **Symptom**: Running `POST /api/schedules/init-db` fails when applying `server/db/schema.sql`.
* **Root Cause**: Neon's HTTP serverless driver does not allow sending multiple semicolon-separated SQL commands in a single query parameter.
* **Solution**:
  - Always use `splitSqlStatements()` in [`server/db/client.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/server/db/client.ts).
  - It strips full-line comments (`-- ...`) and splits on `;` to execute each statement sequentially.

### 2. `usingMockDb: true` in Vercel Deployment
* **Symptom**: Server logs show `[Database] Using in-memory mock database` even though a Neon database is connected in Vercel.
* **Root Cause**: The Neon-Vercel integration injects `POSTGRES_DATABASE_URL`, but old code only looked for `DATABASE_URL`.
* **Solution**:
  - Verify [`server/db/client.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/server/db/client.ts) reads in priority order:
    `process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL`
  - Check Vercel project environment settings to confirm the variable is assigned to Preview and Production environments.

### 3. Airtable Shows `Scheduled` but Queue Has 0 Jobs
* **Symptom**: Calendar displays scheduled slots, but `/scheduler-debug` shows 0 active jobs or the runner executes nothing.
* **Root Cause**: Posts were tagged as scheduled before the Postgres schema was initialized or while running on an in-memory mock database.
* **Solution**:
  1. Call `POST /api/schedules/backfill-queue` with header `Authorization: Bearer <CRON_SECRET>`.
  2. The backfill endpoint scans Airtable for active `Scheduled` rows and inserts missing queue jobs without creating duplicate entries.
  3. Note: If a post's scheduled PHT time has already passed, it will be skipped and must be manually rescheduled via the Calendar UI.

### 4. Separate Neon Databases for Preview vs Production
* **Symptom**: Backfilling jobs in Preview deployment does not make them appear in Production.
* **Root Cause**: Vercel sets separate Neon database branches/instances for Preview and Production environments.
* **Solution**:
  - Run maintenance tasks (`init-db`, `backfill-queue`) independently on both Preview and Production URLs using their respective `CRON_SECRET`.

### 5. Halting All Automated Posts (`AUTOMATION_KILL_SWITCH`)
* **Emergency Action**: To immediately freeze all automated publishing without canceling individual schedules:
  - In Vercel Environment Variables, set `AUTOMATION_KILL_SWITCH="true"`.
  - Redeploy. The runner will log that the kill switch is active and gracefully exit without claiming jobs.

---

## 🔗 Related Notes
- [[architecture/durable-scheduling-queue|Durable Scheduling Queue Architecture]]
- [[architecture/system-blueprint|System Blueprint]]
