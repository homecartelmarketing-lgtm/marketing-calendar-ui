import { NextRequest, NextResponse } from "next/server"
import { pullAirtableSchedulesWithDiagnostics, syncAirtableRecord, ScheduledEntry } from "@/lib/schedules"
import { AIRTABLE_BASE_ID, AIRTABLE_TOKEN, getAllConfiguredTables } from "@/lib/tables-config"
import { getMetaConfig, publishToInstagram } from "@/lib/meta-api"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const metaConfig = getMetaConfig()
    const cronSecret = (process.env.CRON_SECRET || "").trim()

    // 1. Check Meta Graph API connectivity and get account handle
    let metaStatus: {
      configured: boolean
      verified: boolean
      username?: string
      name?: string
      id?: string
      error?: string
    } = {
      configured: Boolean(metaConfig.accessToken && metaConfig.instagramAccountId),
      verified: false,
    }

    if (metaStatus.configured) {
      try {
        const testRes = await fetch(
          `https://graph.facebook.com/${metaConfig.apiVersion || "v19.0"}/${metaConfig.instagramAccountId}?fields=id,username,name&access_token=${metaConfig.accessToken}`,
          { next: { revalidate: 0 } }
        )
        const testData = await testRes.json()
        if (testRes.ok && testData.id) {
          metaStatus.verified = true
          metaStatus.username = testData.username
          metaStatus.name = testData.name
          metaStatus.id = testData.id
        } else {
          metaStatus.error = testData.error?.message || "Meta token invalid or missing Instagram permissions"
        }
      } catch (err: any) {
        metaStatus.error = err?.message || "Failed to reach Meta Graph API"
      }
    }

    // 2. Fetch all scheduled items from Airtable
    const { schedules, failedTables } = await pullAirtableSchedulesWithDiagnostics()
    const now = new Date()

    const scheduledList: Array<ScheduledEntry & {
      phtScheduledString: string
      isOverdue: boolean
      diffMinutes: number
      hasMedia: boolean
    }> = []

    for (const [isoDate, entries] of Object.entries(schedules)) {
      for (const entry of entries) {
        if (entry.status !== "Scheduled") continue

        const timePart = (entry.time || "00:00").padStart(5, "0")
        const scheduledPht = new Date(`${isoDate}T${timePart}:00+08:00`)
        const diffMinutes = Math.round((scheduledPht.getTime() - now.getTime()) / 60000)
        const isOverdue = now.getTime() >= scheduledPht.getTime()

        scheduledList.push({
          ...entry,
          phtScheduledString: `${isoDate} ${timePart} (PHT)`,
          isOverdue,
          diffMinutes,
          hasMedia: Boolean(entry.mediaUrl || (entry.slides && entry.slides.length > 0)),
        })
      }
    }

    // Sort: overdue first, then by earliest scheduled
    scheduledList.sort((a, b) => a.diffMinutes - b.diffMinutes)

    // 3. Fetch candidate completed items with real media for 1-click test scheduling
    const candidateFixtures: Array<{
      recordId: string
      tableId: string
      category: string
      idea: string
      itemName: string
      mediaUrl: string
      status: string
    }> = []

    try {
      const sampleTables = getAllConfiguredTables().slice(0, 8)
      for (const tbl of sampleTables) {
        if (candidateFixtures.length >= 12) break
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tbl.tableId}?maxRecords=3`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
          next: { revalidate: 60 },
        })
        if (!res.ok) continue
        const data = await res.json()
        for (const r of data.records || []) {
          const fields = r.fields || {}
          let mediaUrl = ""
          for (const val of Object.values(fields)) {
            if (Array.isArray(val) && val[0]?.url) {
              mediaUrl = val[0].url
              break
            }
          }
          if (mediaUrl) {
            candidateFixtures.push({
              recordId: r.id,
              tableId: tbl.tableId,
              category: tbl.category,
              idea: tbl.idea,
              itemName: fields["Item Name"] || fields["ID"] || fields["Foreign Key ID"] || tbl.idea,
              mediaUrl,
              status: fields["Status"] || "Completed",
            })
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }

    // Current PHT Time representation
    const phtDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)

    const phtTimeStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now)

    return NextResponse.json({
      success: true,
      system: {
        serverUtc: now.toISOString(),
        phtNow: `${phtDateStr} ${phtTimeStr} PHT (UTC+08:00)`,
        cronSecretConfigured: Boolean(cronSecret),
        cronSecretPreview: cronSecret ? `${cronSecret.slice(0, 6)}...${cronSecret.slice(-4)}` : "NOT_CONFIGURED",
        airtableConfigured: Boolean(AIRTABLE_TOKEN && AIRTABLE_BASE_ID),
        airtableBaseId: AIRTABLE_BASE_ID,
        metaStatus,
        failedTablesCount: failedTables.length,
        failedTables: failedTables.length > 0 ? failedTables : undefined,
      },
      scheduledCount: scheduledList.length,
      scheduledItems: scheduledList,
      candidateFixtures,
    })
  } catch (error: any) {
    console.error("Scheduler debug GET failed:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Debug inspection failed" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === "trigger-runner") {
      const originUrl = request.nextUrl.origin
      const cronSecret = process.env.CRON_SECRET?.trim()
      const startTime = Date.now()

      const runnerRes = await fetch(new URL("/api/schedules/runner", originUrl).toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
        cache: "no-store",
      })

      const elapsedMs = Date.now() - startTime
      const runnerData = await runnerRes.json()

      return NextResponse.json({
        success: runnerRes.ok,
        status: runnerRes.status,
        elapsedMs,
        response: runnerData,
      })
    }

    if (action === "test-post-now") {
      const { mediaUrl, caption, category = "Stories", tableId, recordId } = body
      if (!mediaUrl) {
        return NextResponse.json({ success: false, error: "Media URL is required to publish" }, { status: 400 })
      }

      const publishRes = await publishToInstagram({
        category,
        mediaUrl,
        mediaUrls: [mediaUrl],
        mediaType: "image",
        caption: caption || "Home Cartel test post",
      })

      if (publishRes.success && tableId && recordId) {
        await syncAirtableRecord(tableId, recordId, "Posted").catch(() => {})
      }

      return NextResponse.json({
        success: publishRes.success,
        publishId: publishRes.id,
        isSimulated: publishRes.isSimulated,
        error: publishRes.error,
        message: publishRes.success
          ? "Successfully published live to Instagram!"
          : publishRes.error || "Failed to publish to Instagram",
      })
    }

    if (action === "schedule-new-item") {
      const { tableId, recordId, isoDate, time, category, caption, mediaUrl } = body
      if (!tableId || !recordId || !isoDate || !time) {
        return NextResponse.json(
          { success: false, error: "tableId, recordId, isoDate, and time are required" },
          { status: 400 }
        )
      }

      await syncAirtableRecord(tableId, recordId, "Scheduled", isoDate, time)

      return NextResponse.json({
        success: true,
        message: `Scheduled successfully for ${isoDate} at ${time} PHT`,
        isoDate,
        time,
      })
    }

    if (action === "quick-reschedule") {
      const { tableId, recordId, minutesFromNow = 2 } = body
      if (!tableId || !recordId) {
        return NextResponse.json({ success: false, error: "tableId and recordId are required" }, { status: 400 })
      }

      // Calculate target time in PHT: now + minutesFromNow
      const target = new Date(Date.now() + minutesFromNow * 60000)
      const isoDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(target)

      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(target)

      await syncAirtableRecord(tableId, recordId, "Scheduled", isoDate, time)

      return NextResponse.json({
        success: true,
        message: `Successfully rescheduled to ${isoDate} ${time} PHT (${minutesFromNow} min from now)`,
        isoDate,
        time,
      })
    }

    if (action === "set-status") {
      const { tableId, recordId, status } = body
      if (!tableId || !recordId || !status) {
        return NextResponse.json({ success: false, error: "tableId, recordId, and status are required" }, { status: 400 })
      }

      await syncAirtableRecord(tableId, recordId, status)

      return NextResponse.json({
        success: true,
        message: `Updated record ${recordId} status to '${status}'`,
      })
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 })
  } catch (error: any) {
    console.error("Scheduler debug POST failed:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to execute debug action" },
      { status: 500 }
    )
  }
}
