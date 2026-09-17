import { NextRequest, NextResponse } from "next/server"
import { initDbSchema, isMockDb } from "@/server/db/client"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  const authHeader = request.headers.get("authorization")
  if (!authHeader) return false
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  return token === cronSecret
}

// One-off/idempotent schema bootstrap for the durable automation queue.
// Protected the same way as /api/schedules/runner so it can't be called publicly.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await initDbSchema()
  return NextResponse.json({ ...result, usingMockDb: isMockDb() })
}
