import { neon } from "@neondatabase/serverless"
import postgres from "postgres"
import { readFileSync } from "fs"
import { join } from "path"

export interface AutomationJobRow {
  id: string
  idempotency_key: string
  record_id: string
  table_id: string
  category: "Stories" | "Feeds" | "Reels"
  idea?: string | null
  fixture?: string | null
  foreign_key_id?: string | null
  scheduled_time: string | Date
  scheduled_iso: string
  time_pht: string
  caption: string
  media_type: "image" | "video" | "carousel"
  media_url: string
  media_urls: string[] | string
  media_version: string
  status: "Scheduled" | "Publishing" | "Posted" | "Retry Pending" | "For Manual" | "Failed" | "Cancelled"
  attempts: number
  max_attempts: number
  next_attempt_at?: string | Date | null
  lease_owner?: string | null
  lease_expires_at?: string | Date | null
  meta_publication_ids?: string[] | string | null
  last_error_code?: string | null
  last_error_message?: string | null
  created_at: string | Date
  updated_at: string | Date
}

export interface AutomationRunRow {
  id?: number
  job_id: string
  trigger: "vercel-cron" | "post-now" | "retry" | "debug-test"
  attempt: number
  started_at: string | Date
  finished_at?: string | Date | null
  status: string
  meta_publication_ids?: string[] | string | null
  error_code?: string | null
  error_message?: string | null
}

// In-memory mock database for provider-isolated tests and local dev without Postgres
class MockDatabase {
  jobs = new Map<string, AutomationJobRow>()
  runs: AutomationRunRow[] = []

  reset() {
    this.jobs.clear()
    this.runs = []
  }

  insertJob(job: AutomationJobRow) {
    this.jobs.set(job.id, { ...job })
    return { ...job }
  }

  updateJob(id: string, updates: Partial<AutomationJobRow>) {
    const existing = this.jobs.get(id)
    if (!existing) return null
    const updated = { ...existing, ...updates, updated_at: new Date() }
    this.jobs.set(id, updated)
    return { ...updated }
  }

  getJob(id: string) {
    const j = this.jobs.get(id)
    return j ? { ...j } : null
  }

  findActiveJobByRecordId(recordId: string) {
    for (const job of this.jobs.values()) {
      if (
        job.record_id === recordId &&
        (job.status === "Scheduled" || job.status === "Publishing" || job.status === "Retry Pending")
      ) {
        return { ...job }
      }
    }
    return null
  }

  findLatestJobByRecordId(recordId: string) {
    const list = Array.from(this.jobs.values()).filter((j) => j.record_id === recordId)
    if (list.length === 0) return null
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { ...list[0] }
  }

  claimDueJobs(now: Date, limit: number, leaseMinutes: number, runnerId: string): AutomationJobRow[] {
    const claimed: AutomationJobRow[] = []
    const nowTime = now.getTime()
    const leaseExpiry = new Date(nowTime + leaseMinutes * 60 * 1000)

    for (const job of this.jobs.values()) {
      if (claimed.length >= limit) break
      if (job.status !== "Scheduled" && job.status !== "Retry Pending") continue

      const isDue =
        job.status === "Scheduled"
          ? new Date(job.scheduled_time).getTime() <= nowTime
          : job.next_attempt_at
          ? new Date(job.next_attempt_at).getTime() <= nowTime
          : false

      if (!isDue) continue

      const isLeased =
        job.lease_expires_at && new Date(job.lease_expires_at).getTime() > nowTime

      if (isLeased) continue

      // Atomically claim
      const updated: AutomationJobRow = {
        ...job,
        status: "Publishing",
        lease_owner: runnerId,
        lease_expires_at: leaseExpiry,
        updated_at: now,
      }
      this.jobs.set(job.id, updated)
      claimed.push({ ...updated })
    }

    return claimed
  }

  insertRun(run: AutomationRunRow) {
    this.runs.push({ ...run, id: this.runs.length + 1 })
  }
}

const mockDb = new MockDatabase()

let sqlClient: ReturnType<typeof postgres> | null = null
let currentDbUrl: string | null = null

function getSqlClient(dbUrl: string): ReturnType<typeof postgres> {
  if (!sqlClient || currentDbUrl !== dbUrl) {
    if (sqlClient) {
      try {
        sqlClient.end({ timeout: 5 }).catch(() => {})
      } catch {
        // ignore
      }
    }
    currentDbUrl = dbUrl
    sqlClient = postgres(dbUrl, {
      max: 1, // 1 connection per serverless warm instance (Supabase / Vercel best practice)
      prepare: false, // Required for Supabase Transaction Pooler (port 6543)
      ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : "require",
      idle_timeout: 20,
      connect_timeout: 15,
    })
  }
  return sqlClient
}

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_URL
  )
}

export function isMockDb(): boolean {
  return !getDatabaseUrl() || process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)
}

export function getMockDb(): MockDatabase {
  return mockDb
}

export function resetMockDb(): void {
  mockDb.reset()
}

/**
 * Executes a query against Supabase Postgres / Neon Postgres if configured;
 * otherwise throws an error unless in mock mode.
 */
export async function executeSql<T = any>(queryText: string, params: any[] = []): Promise<T[]> {
  const dbUrl = getDatabaseUrl()
  if (!dbUrl || isMockDb()) {
    throw new Error("executeSql called in mock mode: use high-level automation methods")
  }

  // Neon HTTP endpoint compatibility fallback
  if (dbUrl.includes("neon.tech") && !dbUrl.includes("pooler")) {
    const sql = neon(dbUrl)
    const rows = await sql.query(queryText, params)
    return rows as T[]
  }

  // Universal Postgres driver (Supabase Transaction/Session Pooler, direct Supabase, or standard Postgres)
  const client = getSqlClient(dbUrl)
  const rows = await client.unsafe(queryText, params)
  return rows as unknown as T[]
}

/**
 * Splits a .sql file's text into individual executable statements.
 */
export function splitSqlStatements(sqlText: string): string[] {
  const withoutComments = sqlText
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Initializes database schema by applying server/db/schema.sql to Postgres (Supabase or Neon).
 */
export async function initDbSchema(): Promise<{ success: boolean; message: string }> {
  if (isMockDb()) {
    mockDb.reset()
    return { success: true, message: "Initialized in-memory mock schema" }
  }

  const dbUrl = getDatabaseUrl()
  if (!dbUrl) {
    return { success: false, message: "DATABASE_URL not configured" }
  }

  try {
    const schemaPath = join(process.cwd(), "server", "db", "schema.sql")
    const schemaSql = readFileSync(schemaPath, "utf-8")
    const statements = splitSqlStatements(schemaSql)
    for (const statement of statements) {
      await executeSql(statement)
    }
    return { success: true, message: `Postgres schema initialized successfully (${statements.length} statements)` }
  } catch (err: any) {
    return { success: false, message: `Schema initialization failed: ${err?.message || err}` }
  }
}
