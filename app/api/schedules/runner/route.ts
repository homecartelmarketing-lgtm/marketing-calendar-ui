import { NextRequest, NextResponse } from "next/server"
import { publishToInstagram } from "@/lib/meta-api"
import { pullAirtableSchedules, ScheduledEntry } from "@/lib/schedules"
import { AIRTABLE_BASE_ID, AIRTABLE_TOKEN } from "@/lib/tables-config"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // Fail closed if CRON_SECRET is not configured
  if (!cronSecret) {
    console.warn("[Runner Auth] Request denied: CRON_SECRET is not configured on the server.")
    return false
  }

  // Check Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (token === cronSecret) return true
  }

  // Check query parameter ?secret=<secret> or ?key=<secret>
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get("secret") || searchParams.get("key")
  if (querySecret === cronSecret) return true

  return false
}

async function updateAirtableRecordStatus(tableId: string, recordId: string, status: string): Promise<void> {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { Status: status } }),
    }
  )

  if (!res.ok) {
    const errBody = await res.text().catch(() => "")
    throw new Error(`Failed to update Airtable record ${recordId} to status '${status}': HTTP ${res.status} ${errBody}`)
  }
}

async function runScheduledJobs(originUrl: string) {
  // 1. Fetch live schedules directly from Airtable (Single Source of Truth)
  const schedules = await pullAirtableSchedules()
  const now = new Date()
  const results: {
    key: string
    isoDate: string
    time: string | null
    category: string
    idea: string
    action: "published" | "pending_future" | "error"
    timeDiffMinutes?: number
    details?: any
  }[] = []

  for (const [isoDate, entries] of Object.entries(schedules)) {
    for (const entry of entries) {
      if (entry.status !== "Scheduled") continue

      // Parse scheduled time strictly in Philippine Time (PHT: UTC+08:00)
      const timePart = (entry.time || "00:00").padStart(5, "0")
      const scheduledDatePht = new Date(`${isoDate}T${timePart}:00+08:00`)
      const timeDiffMinutes = Math.round((scheduledDatePht.getTime() - now.getTime()) / 60000)

      // If scheduled time has arrived or already passed
      if (now.getTime() >= scheduledDatePht.getTime()) {
        try {
          let mediaUrl = entry.mediaUrl || ""

          // Fallback: If mediaUrl wasn't directly found in record, query content-outputs
          if (!mediaUrl) {
            try {
              const outRes = await fetch(
                new URL(
                  `/api/content-outputs?category=${encodeURIComponent(entry.category)}&type=${encodeURIComponent(entry.idea)}`,
                  originUrl
                ).toString()
              )
              if (outRes.ok) {
                const outData = await outRes.json()
                const matchedItem = (outData.items || []).find(
                  (it: any) => it.recordId === entry.recordId || it.foreignKeyId === entry.foreignKeyId
                )
                mediaUrl = matchedItem?.slides?.[0] || matchedItem?.videoUrl || ""
              }
            } catch (fetchErr) {
              console.warn("Could not retrieve mediaUrl from outputs fallback:", fetchErr)
            }
          }

          if (!mediaUrl) {
            results.push({
              key: entry.rowKey,
              isoDate,
              time: entry.time,
              category: entry.category,
              idea: entry.idea,
              action: "error",
              details: "No image or video URL found for this fixture",
            })
            continue
          }

          // Concurrency lock: Mark record as 'Publishing' before contacting Meta API
          // This stops concurrent runs from attempting to publish the same record.
          try {
            await updateAirtableRecordStatus(entry.tableId, entry.recordId, "Publishing")
          } catch (lockErr: any) {
            console.error(`[Runner Lock Error] Could not lock record ${entry.recordId}:`, lockErr)
            results.push({
              key: entry.rowKey,
              isoDate,
              time: entry.time,
              category: entry.category,
              idea: entry.idea,
              action: "error",
              details: `Concurrency lock failed: ${lockErr?.message || lockErr}`,
            })
            continue
          }

          // Publish to Instagram (Stories as STORIES, Reels as REELS, Feeds as VIDEO/image)
          const publishRes = await publishToInstagram({
            category: entry.category,
            mediaUrl,
            mediaUrls: entry.slides && entry.slides.length > 0 ? entry.slides : [mediaUrl],
            mediaType: entry.category === "Reels" ? "video" : (entry.mediaType || "image"),
            caption: entry.caption,
          })

          if (publishRes.success) {
            // Flip Airtable status to 'Posted' and verify successful write
            try {
              await updateAirtableRecordStatus(entry.tableId, entry.recordId, "Posted")
            } catch (postErr: any) {
              console.error(`[Runner Status Error] Meta succeeded but failed to update status to Posted on ${entry.recordId}:`, postErr)
            }

            results.push({
              key: entry.rowKey,
              isoDate,
              time: entry.time,
              category: entry.category,
              idea: entry.idea,
              action: "published",
              details: publishRes,
            })
          } else {
            // Revert status to Scheduled or Error so it doesn't stay stuck in Publishing
            try {
              await updateAirtableRecordStatus(entry.tableId, entry.recordId, "Error")
            } catch {
              await updateAirtableRecordStatus(entry.tableId, entry.recordId, "Scheduled").catch(() => {})
            }

            results.push({
              key: entry.rowKey,
              isoDate,
              time: entry.time,
              category: entry.category,
              idea: entry.idea,
              action: "error",
              details: publishRes.error,
            })
          }
        } catch (err: any) {
          // In case of unhandled exception, release lock
          await updateAirtableRecordStatus(entry.tableId, entry.recordId, "Scheduled").catch(() => {})

          results.push({
            key: entry.rowKey,
            isoDate,
            time: entry.time,
            category: entry.category,
            idea: entry.idea,
            action: "error",
            details: err?.message || err,
          })
        }
      } else {
        // Pending future schedule
        results.push({
          key: entry.rowKey,
          isoDate,
          time: entry.time,
          category: entry.category,
          idea: entry.idea,
          action: "pending_future",
          timeDiffMinutes,
        })
      }
    }
  }

  return results
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized: Invalid or missing secret token",
      },
      { status: 401 }
    )
  }

  try {
    const originUrl = request.nextUrl.origin
    const results = await runScheduledJobs(originUrl)

    const publishedCount = results.filter((r) => r.action === "published").length
    const pendingCount = results.filter((r) => r.action === "pending_future").length
    const errorCount = results.filter((r) => r.action === "error").length

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        published: publishedCount,
        pending: pendingCount,
        errors: errorCount,
        totalEvaluated: results.length,
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
