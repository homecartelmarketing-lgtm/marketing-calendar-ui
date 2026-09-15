import { NextRequest, NextResponse } from "next/server"
import {
  pullAirtableSchedulesWithDiagnostics,
  getLockedForeignKeys,
  syncAirtableRecord,
  type ScheduledEntry,
} from "@/lib/schedules"
import {
  createOrReplaceScheduledJob,
  cancelScheduledJob,
} from "@/server/automation/jobs"

export type { ScheduledEntry }

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    // Pure Airtable read: Single Source of Truth with zero local merge conflicts
    const { schedules, failedTables } = await pullAirtableSchedulesWithDiagnostics()
    const lockedForeignKeys = getLockedForeignKeys(schedules)

    return NextResponse.json({
      success: true,
      schedules,
      lockedForeignKeys,
      failedTablesCount: failedTables.length,
      failedTables: failedTables.length > 0 ? failedTables : undefined,
    })
  } catch (error: any) {
    console.error("Failed to load schedules from Airtable:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load schedules" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScheduledEntry
    const {
      isoDate,
      recordId,
      tableId,
      status,
      time,
      category,
      caption,
      mediaUrl,
      slides,
      mediaType,
    } = body

    if (!recordId || !tableId) {
      return NextResponse.json(
        { success: false, message: "recordId and tableId are required to schedule" },
        { status: 400 }
      )
    }

    const finalStatus = status || "Scheduled"

    if (finalStatus === "Scheduled") {
      const effectiveMediaUrl = mediaUrl || (slides && slides[0]) || ""
      const effectiveSlides =
        slides && slides.length > 0 ? slides : effectiveMediaUrl ? [effectiveMediaUrl] : []

      if (!effectiveMediaUrl) {
        return NextResponse.json(
          { success: false, message: "Media URL or slides are required to schedule a post" },
          { status: 400 }
        )
      }

      // 1. Create durable automation job (validates future PHT timestamp)
      let job
      try {
        job = await createOrReplaceScheduledJob({
          recordId,
          tableId,
          category: (category as any) || "Stories",
          idea: body.idea,
          fixture: body.fixture,
          foreignKeyId: body.foreignKeyId,
          isoDate,
          time,
          caption: caption || "",
          mediaType:
            mediaType === "video"
              ? "video"
              : effectiveSlides.length > 1
              ? "carousel"
              : "image",
          mediaUrl: effectiveMediaUrl,
          mediaUrls: effectiveSlides,
        })
      } catch (valErr: any) {
        return NextResponse.json(
          { success: false, message: valErr?.message || "Invalid schedule parameters" },
          { status: 400 }
        )
      }

      // 2. Sync directly to Airtable with validated PHT timestamp
      await syncAirtableRecord(tableId, recordId, "Scheduled", isoDate, time)

      const newEntry: ScheduledEntry = {
        ...body,
        rowKey: recordId,
        status: "Scheduled",
        updatedAt: new Date().toISOString(),
      }

      return NextResponse.json({
        success: true,
        entry: newEntry,
        jobId: job.id,
      })
    }

    // For non-Scheduled updates (e.g. Completed, For Manual)
    await syncAirtableRecord(tableId, recordId, finalStatus, isoDate, time)

    const newEntry: ScheduledEntry = {
      ...body,
      rowKey: recordId,
      status: finalStatus,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      entry: newEntry,
    })
  } catch (error: any) {
    console.error("Error saving schedule to Airtable:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save schedule" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableId = searchParams.get("tableId")
    const recordId = searchParams.get("recordId")

    if (!tableId || !recordId) {
      return NextResponse.json(
        { success: false, message: "tableId and recordId are required to delete schedule" },
        { status: 400 }
      )
    }

    // 1. Cancel in durable queue (checks for publication conflicts)
    const cancelRes = await cancelScheduledJob(recordId)
    if (!cancelRes.success) {
      return NextResponse.json(
        { success: false, message: cancelRes.error || "Cannot cancel schedule" },
        { status: cancelRes.status || 409 }
      )
    }

    // 2. Reset Airtable record back to Completed and clear scheduled date
    await syncAirtableRecord(tableId, recordId, "Completed", undefined, undefined)

    return NextResponse.json({
      success: true,
      message: "Schedule cancelled and restored in Airtable",
    })
  } catch (error: any) {
    console.error("Error deleting schedule:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete schedule" },
      { status: 500 }
    )
  }
}
