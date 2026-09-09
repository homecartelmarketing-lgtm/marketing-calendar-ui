import { NextRequest, NextResponse } from "next/server"
import { publishToInstagram } from "@/lib/meta-api"
import { pullAirtableSchedules, ScheduledEntry } from "@/app/api/schedules/route"
import { AIRTABLE_BASE_ID, AIRTABLE_TOKEN } from "@/lib/tables-config"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // Local testing or no secret configured

  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (token === cronSecret) return true
  }

  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get("secret") || searchParams.get("key")
  if (querySecret === cronSecret) return true

  return false
}

async function markAirtableRecordPosted(tableId: string, recordId: string) {
  try {
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { Status: "Posted" } }),
      }
    )
  } catch (err) {
    console.warn(`Could not mark Airtable record ${recordId} as Posted:`, err)
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

          // Publish to Instagram (Stories as STORIES, Reels as REELS, Feeds as VIDEO/image)
          const publishRes = await publishToInstagram({
            category: entry.category,
            mediaUrl,
            mediaType: entry.category === "Reels" ? "video" : (entry.mediaType || "image"),
            caption: entry.caption,
          })

          if (publishRes.success) {
            // Flip Airtable status to 'Posted'
            if (entry.tableId && entry.recordId) {
              await markAirtableRecordPosted(entry.tableId, entry.recordId)
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
        results.push({
          key: entry.rowKey,
          isoDate,
          time: entry.time,
          category: entry.category,
          idea: entry.idea,
          action: "pending_future",
          timeDiffMinutes,
          details: `Scheduled for ${timePart} PHT (${timeDiffMinutes}m remaining)`,
        })
      }
    }
  }

  return {
    success: true,
    serverTimePht: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now),
    processedCount: results.length,
    results,
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Missing or invalid CRON_SECRET" },
      { status: 401 }
    )
  }
  try {
    const data = await runScheduledJobs(request.url)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Runner error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Missing or invalid CRON_SECRET" },
      { status: 401 }
    )
  }
  try {
    const data = await runScheduledJobs(request.url)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Runner error" },
      { status: 500 }
    )
  }
}
