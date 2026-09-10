import { NextRequest, NextResponse } from "next/server"
import { publishToInstagram } from "@/lib/meta-api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mediaUrl,
      mediaUrls,
      mediaType,
      caption,
      category,
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

    const effectiveMediaUrl = mediaUrl || (mediaUrls && mediaUrls[0])

    // Call Instagram publishing via Meta API
    const publishResult = await publishToInstagram({
      category: category || "Stories",
      mediaUrl: effectiveMediaUrl,
      mediaUrls: Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls : [effectiveMediaUrl],
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

    // Update Airtable and local schedule if requested
    if (recordId && tableId) {
      try {
        await fetch(
          new URL("/api/content-outputs", request.url).toString(),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordId,
              tableId,
              status: "Posted",
              date: isoDate,
              time,
            }),
          }
        )
      } catch (patchErr) {
        console.warn("Could not patch status to Posted:", patchErr)
      }
    }

    return NextResponse.json({
      success: true,
      id: publishResult.id,
      isSimulated: publishResult.isSimulated,
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
