# Architecture: Durable Scheduling Queue

#architecture #postgres #queue #scheduler

The durable scheduling queue guarantees that every scheduled marketing post is recorded reliably, protected against server restarts and parallel runner race conditions, and published exactly once to Instagram.

---

## 💾 Database Schema (`server/db/schema.sql`)

The queue is backed by Neon serverless PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS automation_jobs (
    id SERIAL PRIMARY KEY,
    airtable_record_id VARCHAR(64) NOT NULL,
    airtable_table_id VARCHAR(64) NOT NULL,
    fixture_id VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    media_urls TEXT[] NOT NULL,
    media_hash VARCHAR(64) NOT NULL,
    caption TEXT,
    scheduled_time_pht TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_airtable_record UNIQUE (airtable_record_id)
);

CREATE TABLE IF NOT EXISTS automation_runs (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES automation_jobs(id) ON DELETE CASCADE,
    attempt INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    meta_post_id VARCHAR(128),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE
);
```

---

## 🔒 Concurrency & Race Condition Safeguards

### 1. Atomic Locking (`FOR UPDATE SKIP LOCKED`)
When the runner queries for due jobs:
```sql
SELECT * FROM automation_jobs
WHERE status = 'pending'
  AND scheduled_time_pht <= NOW()
ORDER BY scheduled_time_pht ASC
LIMIT 5
FOR UPDATE SKIP LOCKED;
```
* **Why**: If multiple runner instances fire simultaneously (e.g. Vercel Cron + manual trigger), they will never grab the same job. Each worker skips locked rows and processes distinct jobs.

### 2. Media Tampering Detection (`media_hash`)
* Before enqueuing, the server computes a deterministic SHA-256 hash of all media attachment URLs.
* When the runner executes, if the attachments have been deleted or swapped in Airtable without a re-schedule, the execution halts safely rather than publishing corrupted media.

### 3. Idempotent Publication ID Recording
* The runner creates the Instagram media container and publishes it *first*.
* The resulting `meta_post_id` is persisted to `automation_runs` *before* attempting the Airtable status update.
* If Airtable is down or throttles the status update, the post is NOT retried (preventing duplicate Instagram posts).

---

## 🔁 Retry Backoff Policy

When a transient network error or temporary Meta API timeout occurs:
- **Attempt 1**: Failed -> Retried after 1 minute.
- **Attempt 2**: Failed -> Retried after 5 minutes.
- **Attempt 3**: Failed -> Retried after 15 minutes.
- **Exceeded Max Attempts**: Job status transitions to `failed` and logs to `/scheduler-debug`.

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]
- [[troubleshooting/durable-queue-and-cron|Troubleshooting Durable Queue & Cron]]
- [[troubleshooting/meta-api-errors|Troubleshooting Meta API Errors]]
