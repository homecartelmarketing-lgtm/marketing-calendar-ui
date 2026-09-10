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
  mediaUrls?: string[]
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
 * Supports multi-slide Stories (sequential) and multi-image Feeds (CAROUSEL).
 */
export async function publishToInstagram(
  payload: PostContentPayload
): Promise<MetaPublishResponse> {
  const config = getMetaConfig()

  if (!config.accessToken || !config.instagramAccountId) {
    if (process.env.SIMULATE === "1") {
      return {
        success: true,
        id: `simulated_meta_${Date.now()}`,
        isSimulated: true,
      }
    }
    return {
      success: false,
      error: "Meta API credentials (META_ACCESS_TOKEN and META_IG_ACCOUNT_ID) are not configured.",
    }
  }

  try {
    const apiVersion = config.apiVersion || "v19.0"
    const graphRoot = `https://graph.facebook.com/${apiVersion}`
    const baseUrl = `${graphRoot}/${config.instagramAccountId}`

    // 1. Handle Multi-slide Instagram Stories (Publish each slide in sequence: slide 1, slide 2, slide 3, slide 4)
    if (payload.category === "Stories" && payload.mediaUrls && payload.mediaUrls.length > 1) {
      const publishedIds: string[] = []
      for (const slideUrl of payload.mediaUrls) {
        const isVid = slideUrl.toLowerCase().includes(".mp4")
        const slideParams: Record<string, string> = {
          access_token: config.accessToken,
          media_type: "STORIES",
          ...(isVid ? { video_url: slideUrl } : { image_url: slideUrl }),
        }

        const createRes = await fetch(`${baseUrl}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slideParams),
        })
        const createData = await createRes.json()
        if (!createRes.ok || !createData.id) {
          return {
            success: false,
            error: createData.error?.message || "Failed to create Story slide container",
          }
        }

        const creationId = createData.id

        if (isVid) {
          const MAX_WAIT_MS = 120000
          const POLL_INTERVAL_MS = 5000
          const startTime = Date.now()
          let isFinished = false

          while (Date.now() - startTime < MAX_WAIT_MS) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
            try {
              const statusRes = await fetch(
                `${graphRoot}/${creationId}?fields=status_code&access_token=${config.accessToken}`
              )
              if (statusRes.ok) {
                const statusData = await statusRes.json()
                if (statusData.status_code === "FINISHED") {
                  isFinished = true
                  break
                } else if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
                  return {
                    success: false,
                    error: `Video container processing failed: ${statusData.status_code}`,
                  }
                }
              }
            } catch {}
          }
          if (!isFinished) {
            return {
              success: false,
              error: "Story video processing timed out before publishing",
            }
          }
        }

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
            error: publishData.error?.message || "Failed to publish Story slide container",
          }
        }
        publishedIds.push(publishData.id)
      }

      return {
        success: true,
        id: publishedIds.join(","),
      }
    }

    // 2. Handle Multi-slide Instagram Feeds (CAROUSEL container)
    if (payload.category === "Feeds" && payload.mediaUrls && payload.mediaUrls.length > 1) {
      const childIds: string[] = []
      for (const itemUrl of payload.mediaUrls) {
        const isVid = itemUrl.toLowerCase().includes(".mp4")
        const itemParams: Record<string, string | boolean> = {
          access_token: config.accessToken,
          is_carousel_item: true,
          ...(isVid ? { video_url: itemUrl, media_type: "VIDEO" } : { image_url: itemUrl }),
        }
        const itemRes = await fetch(`${baseUrl}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemParams),
        })
        const itemData = await itemRes.json()
        if (!itemRes.ok || !itemData.id) {
          return {
            success: false,
            error: itemData.error?.message || "Failed to create carousel item container",
          }
        }
        childIds.push(itemData.id)
      }

      const carouselParams: Record<string, any> = {
        access_token: config.accessToken,
        media_type: "CAROUSEL",
        children: childIds.join(","),
      }
      if (payload.caption) carouselParams["caption"] = payload.caption
      if (payload.scheduledPublishTime) {
        carouselParams["published"] = "false"
        carouselParams["scheduled_publish_time"] = String(payload.scheduledPublishTime)
      }

      const createRes = await fetch(`${baseUrl}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(carouselParams),
      })
      const createData = await createRes.json()
      if (!createRes.ok || !createData.id) {
        return {
          success: false,
          error: createData.error?.message || "Failed to create carousel container",
        }
      }

      const publishRes = await fetch(`${baseUrl}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: config.accessToken,
        }),
      })
      const publishData = await publishRes.json()
      if (!publishRes.ok || !publishData.id) {
        return {
          success: false,
          error: publishData.error?.message || "Failed to publish carousel container",
        }
      }

      return {
        success: true,
        id: publishData.id,
      }
    }

    // 3. Single Media Container (Stories, Reels, or single Feed)
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

    // 2. For video content (Reels & video Feeds), poll status until container is FINISHED
    const isVideo = payload.mediaType === "video" || payload.category === "Reels"
    if (isVideo) {
      const MAX_WAIT_MS = 120000 // up to 2 minutes
      const POLL_INTERVAL_MS = 5000
      const startTime = Date.now()
      let isFinished = false

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        try {
          const statusRes = await fetch(
            `${graphRoot}/${creationId}?fields=status_code&access_token=${config.accessToken}`
          )
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            if (statusData.status_code === "FINISHED") {
              isFinished = true
              break
            } else if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
              return {
                success: false,
                error: `Video container processing failed with status: ${statusData.status_code}`,
              }
            }
          }
        } catch {
          // Retry on intermittent network glitch while polling
        }
      }

      if (!isFinished) {
        return {
          success: false,
          error: "Video container processing timed out on Meta servers before publishing",
        }
      }
    }

    // 3. Publish Media Container
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
