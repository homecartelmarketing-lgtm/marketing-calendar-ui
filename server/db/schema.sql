-- Automation Jobs and Execution History Schema
-- Compatible with Neon Postgres / Vercel Marketplace Storage

CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  record_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  category TEXT NOT NULL,
  idea TEXT,
  fixture TEXT,
  foreign_key_id TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  scheduled_iso TEXT NOT NULL,
  time_pht TEXT NOT NULL,
  caption TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'image' | 'video' | 'carousel'
  media_url TEXT NOT NULL,
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  meta_publication_ids JSONB DEFAULT '[]'::jsonb,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron runner looking for due jobs
CREATE INDEX IF NOT EXISTS idx_automation_jobs_due 
  ON automation_jobs (status, scheduled_time, next_attempt_at);

-- Index for lookup by Airtable record ID
CREATE INDEX IF NOT EXISTS idx_automation_jobs_record 
  ON automation_jobs (record_id);

-- Execution log for audit and debugging
CREATE TABLE IF NOT EXISTS automation_runs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL, -- 'vercel-cron' | 'post-now' | 'retry' | 'debug-test'
  attempt INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  meta_publication_ids JSONB DEFAULT '[]'::jsonb,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_job 
  ON automation_runs (job_id);
