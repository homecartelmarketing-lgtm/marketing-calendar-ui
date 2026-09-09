/**
 * Meta Business API Integration Client & Helpers
 * Ready for automatic posting to Facebook & Instagram Graph API
 */

export interface MetaConfig {
  pageId?: string
  instagramAccountId?: string
  accessToken?: string
  apiVersion?: string
}

export function getMetaConfig(): MetaConfig {
  return {
    pageId: process.env.META_PAGE_ID,
    instagramAccountId: process.env.META_IG_ACCOUNT_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
    apiVersion: process.env.META_API_VERSION || "v19.0",
  }
}

export interface PostContentPayload {
  category: "Feeds" | "Stories" | "Reels"
  caption?: string
  mediaUrl: string
  mediaType: "image" | "video"
  scheduledPublishTime?: number // Unix timestamp
}

export interface MetaPublishResponse {
  success: boolean
  id?: string
  error?: string
  isSimulated?: boolean
}

/**
 * Publishes content to Instagram via the Instagram Graph API.
 * Follows the 2-step container creation and media publish flow:
 * 1. POST /{ig-user-id}/media (create container)
 * 2. POST /{ig-user-id}/media_publish (publish container)
 */
export async function publishToInstagram(
  payload: PostContentPayload
): Promise<MetaPublishResponse> {
  const config = getMetaConfig()

  if (!config.accessToken || !config.instagramAccountId) {
    // Graceful fallback when user has not yet configured Meta API credentials
    return {
      success: true,
      id: `simulated_meta_${Date.now()}`,
      isSimulated: true,
      error: "Meta credentials not yet configured. Simulated success.",
    }
  }

  try {
    const baseUrl = `https://graph.facebook.com/${config.apiVersion}/${config.instagramAccountId}`

    // 1. Create Media Container
    const containerParams: Record<string, string> = {
      access_token: config.accessToken,
    }

    if (payload.category === "Stories") {
      containerParams["media_type"] = "STORIES"
      if (payload.mediaType === "video") {
        containerParams["video_url"] = payload.mediaUrl
      } else {
        containerParams["image_url"] = payload.mediaUrl
      }
    } else if (payload.category === "Reels") {
      containerParams["media_type"] = "REELS"
      containerParams["video_url"] = payload.mediaUrl
      if (payload.caption) containerParams["caption"] = payload.caption
    } else {
      // Feeds
      if (payload.mediaType === "video") {
        containerParams["media_type"] = "VIDEO"
        containerParams["video_url"] = payload.mediaUrl
      } else {
        containerParams["image_url"] = payload.mediaUrl
      }
      if (payload.caption) containerParams["caption"] = payload.caption
    }

    // Stories in Meta Graph API do not accept scheduled_publish_time; only Reels and Feeds do
    if (payload.scheduledPublishTime && payload.category !== "Stories") {
      containerParams["published"] = "false"
      containerParams["scheduled_publish_time"] = String(payload.scheduledPublishTime)
    }

    const createRes = await fetch(`${baseUrl}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    })

    const createData = await createRes.json()
    if (!createRes.ok || !createData.id) {
      return {
        success: false,
        error: createData.error?.message || "Failed to create media container",
      }
    }

    const creationId = createData.id

    // 2. Publish Media Container
    const publishRes = await fetch(`${baseUrl}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: config.accessToken,
      }),
    })

    const publishData = await publishRes.json()
    if (!publishRes.ok || !publishData.id) {
      return {
        success: false,
        error: publishData.error?.message || "Failed to publish media container",
      }
    }

    return {
      success: true,
      id: publishData.id,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unexpected error during Meta publishing",
    }
  }
}
