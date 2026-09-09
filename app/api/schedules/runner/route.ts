import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { publishToInstagram } from "@/lib/meta-api"
import type { ScheduledEntry } from "@/app/api/schedules/route"

const DEFAULT_SCHEDULES_FILE = path.join(process.cwd(), "data", "schedules.json")

function getSchedulesFilePath(): string {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "schedules.json")
  }
  return DEFAULT_SCHEDULES_FILE
}

function readSchedules(): Record<string, ScheduledEntry[]> {
  const filePath = getSchedulesFilePath()
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"))
    }
    if (fs.existsSync(DEFAULT_SCHEDULES_FILE)) {
      return JSON.parse(fs.readFileSync(DEFAULT_SCHEDULES_FILE, "utf-8"))
    }
    return {}
  } catch {
    return {}
  }
}

function writeSchedules(data: Record<string, ScheduledEntry[]>) {
  const filePath = getSchedulesFilePath()
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
  } catch (err) {
    console.warn("Could not write schedules during runner execution:", err)
  }
}

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

async function runScheduledJobs(originUrl: string) {
  const schedules = readSchedules()
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

  let hasChanges = false

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
          let matchedItem: any = null
          let mediaUrl = ""
          try {
            const outRes = await fetch(
              new URL(
                `/api/content-outputs?category=${encodeURIComponent(entry.category)}&type=${encodeURIComponent(entry.idea)}`,
                originUrl
              ).toString()
            )
            if (outRes.ok) {
              const outData = await outRes.json()
              matchedItem = (outData.items || []).find(
                (it: any) => it.foreignKeyId === entry.foreignKeyId
              )
              mediaUrl = matchedItem?.slides?.[0] || matchedItem?.videoUrl || ""
            }
          } catch (fetchErr) {
            console.warn("Could not retrieve mediaUrl from outputs:", fetchErr)
          }

          // Strict Live Check: If Airtable record is no longer 'Scheduled', abort publishing immediately
          if (matchedItem && matchedItem.status !== "Scheduled" && matchedItem.rawStatus !== "Scheduled") {
            entry.status = matchedItem.status || "Completed"
            entry.updatedAt = new Date().toISOString()
            hasChanges = true
            results.push({
              key: entry.rowKey,
              isoDate,
              time: entry.time,
              category: entry.category,
              idea: entry.idea,
              action: "error",
              details: `Live status in Airtable was changed to '${matchedItem.rawStatus || matchedItem.status}'. Auto-posting canceled.`,
            })
            continue
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
            mediaType: entry.category === "Reels" ? "video" : "image",
            caption: entry.caption,
          })

          if (publishRes.success) {
            entry.status = "Posted"
            entry.updatedAt = new Date().toISOString()
            hasChanges = true

            // Patch Airtable status
            if (entry.tableId && entry.recordId) {
              try {
                await fetch(
                  new URL("/api/content-outputs", originUrl).toString(),
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      recordId: entry.recordId,
                      tableId: entry.tableId,
                      status: "Posted",
                      date: entry.isoDate,
                      time: entry.time,
                    }),
                  }
                )
              } catch (patchErr) {
                console.warn("Airtable patch error during runner:", patchErr)
              }
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

  if (hasChanges) {
    writeSchedules(schedules)
  }

  return {
    success: true,
    serverTimePht: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00"),
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
