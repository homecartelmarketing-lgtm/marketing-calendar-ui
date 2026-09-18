import { NextRequest, NextResponse } from "next/server"
import { publishToInstagram } from "@/lib/meta-api"
import { syncAirtableRecord } from "@/lib/schedules"
import { extractOutputMedia } from "@/lib/output-media"
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID } from "@/lib/tables-config"
import { readAirtableRecordById } from "@/server/airtable/records"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mediaUrl,
      mediaUrls,
      mediaType,
      caption,
      category,
      idea,
      recordId,
      tableId,
      isoDate,
      time,
    } = body

    if (!mediaUrl && (!mediaUrls || mediaUrls.length === 0)) {
      return NextResponse.json(
        { success: false, message: "Media URL is required to publish to Meta" },
        { status: 400 }
      )
    }

    let effectiveMediaUrl = mediaUrl || (mediaUrls && mediaUrls[0])
    let effectiveMediaUrls: string[] =
      Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls : [effectiveMediaUrl]

    // Airtable attachment URLs are signed and expire a few hours after being generated.
    // The client may have loaded this media a while ago, so refresh it from Airtable
    // right before publishing instead of trusting whatever the browser still has cached.
    if (recordId && tableId) {
      try {
        const freshRecord = await readAirtableRecordById({
          baseId: AIRTABLE_BASE_ID,
          tableId,
          recordId,
          token: AIRTABLE_TOKEN,
        })
        if (freshRecord) {
          const fresh = extractOutputMedia(freshRecord.fields, category || "Stories", idea || "")
          if (fresh.mediaUrl) {
            effectiveMediaUrl = fresh.mediaUrl
            effectiveMediaUrls = fresh.slides && fresh.slides.length > 0 ? fresh.slides : [fresh.mediaUrl]
          }
        }
      } catch (refreshErr: any) {
        console.warn(
          `[Meta Post Media Refresh] Using client-provided URL for ${recordId} — refresh failed:`,
          refreshErr?.message
        )
      }
    }

    // Call Instagram publishing via Meta API
    const publishResult = await publishToInstagram({
      category: category || "Stories",
      mediaUrl: effectiveMediaUrl,
      mediaUrls: effectiveMediaUrls,
      mediaType: mediaType === "video" ? "video" : "image",
      caption,
    })

    if (!publishResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: publishResult.error || "Failed to publish to Meta API",
        },
        { status: 500 }
      )
    }

    // Update Airtable record directly to Posted
    let statusSyncWarning: string | undefined = undefined
    if (recordId && tableId) {
      try {
        await syncAirtableRecord(tableId, recordId, "Posted", isoDate, time)
      } catch (patchErr: any) {
        console.warn("Could not patch status to Posted:", patchErr)
        statusSyncWarning = patchErr?.message || "Failed to update Airtable status to Posted"
      }
    }

    return NextResponse.json({
      success: true,
      id: publishResult.id,
      isSimulated: publishResult.isSimulated,
      statusSyncWarning,
      message: "Successfully published to Instagram!",
    })
  } catch (error: any) {
    console.error("Meta post route error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
