import { NextRequest, NextResponse } from "next/server"
import { pullAirtableSchedulesWithDiagnostics } from "@/lib/schedules"
import { createOrReplaceScheduledJob, getActiveJobByRecordId } from "@/server/automation/jobs"
import { ScheduleValidationError } from "@/server/airtable/write-schedule"

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

// One-time backfill: Airtable rows marked "Scheduled" before the durable
// queue existed have no matching automation_jobs row, so the runner will
// never pick them up. This enqueues a job for each one that's missing it.
// Does not touch Airtable and does not trigger the runner — enqueue only.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { schedules, failedTables } = await pullAirtableSchedulesWithDiagnostics({ forceFresh: true })

  const enqueued: string[] = []
  const alreadyQueued: string[] = []
  const skippedPastDue: { foreignKeyId: string; scheduled: string }[] = []
  const failed: { foreignKeyId: string; error: string }[] = []

  for (const isoDate of Object.keys(schedules)) {
    for (const entry of schedules[isoDate]) {
      try {
        const existing = await getActiveJobByRecordId(entry.recordId)
        if (existing) {
          alreadyQueued.push(entry.foreignKeyId)
          continue
        }

        const mediaUrl = entry.mediaUrl || entry.slides?.[0]
        if (!mediaUrl) {
          failed.push({ foreignKeyId: entry.foreignKeyId, error: "No media URL available" })
          continue
        }

        await createOrReplaceScheduledJob({
          recordId: entry.recordId,
          tableId: entry.tableId,
          category: entry.category,
          idea: entry.idea,
          fixture: entry.fixture,
          foreignKeyId: entry.foreignKeyId,
          isoDate: entry.isoDate,
          time: entry.time,
          caption: entry.caption || "",
          mediaType: entry.mediaType || "image",
          mediaUrl,
          mediaUrls: entry.slides && entry.slides.length > 0 ? entry.slides : [mediaUrl],
        })
        enqueued.push(entry.foreignKeyId)
      } catch (err: any) {
        if (err instanceof ScheduleValidationError && /future/i.test(err.message)) {
          skippedPastDue.push({ foreignKeyId: entry.foreignKeyId, scheduled: `${entry.isoDate} ${entry.time}` })
        } else {
          failed.push({ foreignKeyId: entry.foreignKeyId, error: err?.message || String(err) })
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      enqueuedCount: enqueued.length,
      alreadyQueuedCount: alreadyQueued.length,
      skippedPastDueCount: skippedPastDue.length,
      failedCount: failed.length,
    },
    enqueued,
    alreadyQueued,
    skippedPastDue,
    failed,
    airtableReadFailures: failedTables,
  })
}
