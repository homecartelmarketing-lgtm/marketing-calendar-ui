import { NextRequest, NextResponse } from "next/server"
import { executeSql, isMockDb } from "@/server/db/client"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  const authHeader = request.headers.get("authorization")
  if (!authHeader) return false
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  return token === cronSecret
}

// Read-only diagnostic: lists what's actually sitting in the durable queue,
// so an Airtable "Scheduled" row can be cross-checked against a real job.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  if (isMockDb()) {
    return NextResponse.json({ success: true, usingMockDb: true, jobs: [] })
  }

  try {
    const rows = await executeSql(
      `SELECT id, record_id, table_id, foreign_key_id, category, status,
              scheduled_time, scheduled_iso, time_pht, created_at, updated_at,
              attempts, max_attempts, next_attempt_at,
              last_error_code, last_error_message, meta_publication_ids
       FROM automation_jobs
       ORDER BY created_at DESC
       LIMIT 100`
    )
    return NextResponse.json({ success: true, usingMockDb: false, count: rows.length, jobs: rows })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Query failed" },
      { status: 500 }
    )
  }
}
