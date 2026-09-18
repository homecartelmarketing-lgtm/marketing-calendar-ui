import { NextRequest, NextResponse } from "next/server"
import { publishToInstagram } from "@/lib/meta-api"
import { syncAirtableRecord } from "@/lib/schedules"
import { extractOutputMedia } from "@/lib/output-media"
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID } from "@/lib/tables-config"
import { readAirtableRecordById } from "@/server/airtable/records"
import {
  claimDueJobs,
  recordJobSuccess,
  recordJobFailure,
} from "@/server/automation/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  // Fail closed if CRON_SECRET is not configured
  if (!cronSecret) {
    console.warn("[Runner Auth] Request denied: CRON_SECRET is not configured on the server.")
    return false
  }

  // Accept Bearer <secret> only; query parameters are disabled for safety
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (token === cronSecret) return true
  }

  return false
}

function isKillSwitchActive(): boolean {
  return process.env.AUTOMATION_KILL_SWITCH === "true"
}

function isLivePublishAllowed(): boolean {
  // Safe default: live publishing is disabled outside Production unless explicitly enabled
  if (process.env.NODE_ENV === "production") return true
  if (process.env.ENABLE_AUTOMATION_SCHEDULING === "true") return true
  return false
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized: Invalid or missing Bearer authorization token",
      },
      { status: 401 }
    )
  }

  if (isKillSwitchActive()) {
    return NextResponse.json({
      success: true,
      paused: true,
      message: "Automation runner paused by AUTOMATION_KILL_SWITCH",
      summary: { claimed: 0, published: 0, retrying: 0, manual: 0, errors: 0 },
      results: [],
    })
  }

  try {
    const liveAllowed = isLivePublishAllowed()
    const allowlistRecords = process.env.AUTOMATION_ALLOWLIST_RECORDS
      ? process.env.AUTOMATION_ALLOWLIST_RECORDS.split(",").map((s) => s.trim()).filter(Boolean)
      : null

    // Atomically claim due jobs from Postgres
    const dueJobs = await claimDueJobs({ limit: 10, leaseMinutes: 5 })

    const results: {
      jobId: string
      recordId: string
      category: string
      action: "published" | "simulated" | "retry_scheduled" | "manual_required" | "skipped_allowlist"
      details?: any
    }[] = []

    for (const job of dueJobs) {
      // Check allowlist if configured
      if (allowlistRecords && !allowlistRecords.includes(job.record_id)) {
        results.push({
          jobId: job.id,
          recordId: job.record_id,
          category: job.category,
          action: "skipped_allowlist",
          details: "Record not in AUTOMATION_ALLOWLIST_RECORDS",
        })
        continue
      }

      // Parse media URLs safely
      let mediaUrls: string[] = []
      if (Array.isArray(job.media_urls)) {
        mediaUrls = job.media_urls
      } else if (typeof job.media_urls === "string") {
        try {
          mediaUrls = JSON.parse(job.media_urls)
        } catch {
          mediaUrls = [job.media_url]
        }
      }
      if (mediaUrls.length === 0 && job.media_url) {
        mediaUrls = [job.media_url]
      }

      // Content validation
      if (mediaUrls.length === 0 || !job.media_url) {
        await recordJobFailure(job.id, {
          message: "No media URL provided for scheduled job",
          isPermanent: true,
        })
        try {
          await syncAirtableRecord(job.table_id, job.record_id, "For Manual", job.scheduled_iso, job.time_pht)
        } catch {}
        results.push({
          jobId: job.id,
          recordId: job.record_id,
          category: job.category,
          action: "manual_required",
          details: "Missing media URL",
        })
        continue
      }

      // Execute Instagram publish (or simulate if outside production without explicit flag)
      if (!liveAllowed && process.env.SIMULATE !== "0") {
        // Safe simulation outside production
        const simId = `simulated_meta_${Date.now()}`
        await recordJobSuccess(job.id, [simId])
        try {
          await syncAirtableRecord(job.table_id, job.record_id, "Posted", job.scheduled_iso, job.time_pht)
        } catch (syncErr: any) {
          console.warn("[Runner Simulation Sync Warning]", syncErr?.message)
        }
        results.push({
          jobId: job.id,
          recordId: job.record_id,
          category: job.category,
          action: "simulated",
          details: { id: simId, isSimulated: true },
        })
        continue
      }

      // Live publish to Meta.
      // Airtable attachment URLs are signed and expire a few hours after being generated.
      // The queue only stores whatever URL was valid at schedule time, so a post scheduled
      // hours/days out would otherwise hand Meta a dead link ("Media ID is not available").
      // Re-fetch the record right before publishing instead of trusting the stored snapshot.
      let liveMediaUrl = job.media_url
      let liveMediaUrls = mediaUrls
      try {
        const freshRecord = await readAirtableRecordById({
          baseId: AIRTABLE_BASE_ID,
          tableId: job.table_id,
          recordId: job.record_id,
          token: AIRTABLE_TOKEN,
        })
        if (freshRecord) {
          const fresh = extractOutputMedia(freshRecord.fields, job.category, job.idea || "")
          if (fresh.mediaUrl) {
            liveMediaUrl = fresh.mediaUrl
            liveMediaUrls = fresh.slides && fresh.slides.length > 0 ? fresh.slides : [fresh.mediaUrl]
          }
        }
      } catch (refreshErr: any) {
        console.warn(
          `[Runner Media Refresh] Using stored snapshot for ${job.record_id} — refresh failed:`,
          refreshErr?.message
        )
      }

      const publishRes = await publishToInstagram({
        category: job.category,
        mediaUrl: liveMediaUrl,
        mediaUrls: liveMediaUrls,
        mediaType: job.category === "Reels" ? "video" : job.media_type === "video" ? "video" : "image",
        caption: job.caption,
      })

      if (publishRes.success) {
        const publicationId = publishRes.id || "published"

        // 1. Persist publication ID in Postgres BEFORE updating Airtable status
        await recordJobSuccess(job.id, [publicationId])

        // 2. Update Airtable status to Posted
        try {
          await syncAirtableRecord(job.table_id, job.record_id, "Posted", job.scheduled_iso, job.time_pht)
        } catch (postErr: any) {
          console.error(
            `[Runner Status Error] Meta succeeded (${publicationId}) but failed to update Airtable status to Posted on ${job.record_id}:`,
            postErr
          )
        }

        results.push({
          jobId: job.id,
          recordId: job.record_id,
          category: job.category,
          action: "published",
          details: publishRes,
        })
      } else {
        // Determine if error is permanent (invalid media, missing token) or temporary (timeout, rate limit)
        const errMsg = publishRes.error || "Unknown Meta publish error"
        const isPermanent =
          errMsg.toLowerCase().includes("permission") ||
          errMsg.toLowerCase().includes("invalid") ||
          errMsg.toLowerCase().includes("unsupported")

        const failureResult = await recordJobFailure(job.id, {
          message: errMsg,
          isPermanent,
        })

        if (failureResult.nextStatus === "For Manual") {
          try {
            await syncAirtableRecord(job.table_id, job.record_id, "For Manual", job.scheduled_iso, job.time_pht)
          } catch {}
          results.push({
            jobId: job.id,
            recordId: job.record_id,
            category: job.category,
            action: "manual_required",
            details: errMsg,
          })
        } else {
          results.push({
            jobId: job.id,
            recordId: job.record_id,
            category: job.category,
            action: "retry_scheduled",
            details: `Retry in ${failureResult.retryInMinutes}m: ${errMsg}`,
          })
        }
      }
    }

    const publishedCount = results.filter((r) => r.action === "published" || r.action === "simulated").length
    const retryCount = results.filter((r) => r.action === "retry_scheduled").length
    const manualCount = results.filter((r) => r.action === "manual_required").length

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        claimed: dueJobs.length,
        published: publishedCount,
        retrying: retryCount,
        manual: manualCount,
        errors: manualCount,
      },
      results,
    })
  } catch (error: any) {
    console.error("Runner execution failed:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal runner error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
