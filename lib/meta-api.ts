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

export interface ContainerStatusResult {
  ready: boolean
  error?: string
}

/**
 * Polls the Meta Graph API media container status until it reaches FINISHED or a terminal error.
 * Meta processes image downloads and video transcoding asynchronously; calling media_publish
 * before the container reaches FINISHED results in Error 9007 ("Media ID is not available").
 */
export async function waitForContainerReady(params: {
  graphRoot: string
  creationId: string
  accessToken: string
  isVideo?: boolean
  pollIntervalMs?: number
  maxWaitMs?: number
}): Promise<ContainerStatusResult> {
  const { graphRoot, creationId, accessToken, isVideo = false } = params
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true"
  const defaultMaxWait = isVideo ? 120_000 : 30_000
  const defaultInterval = isVideo ? 3_000 : 1_500
  const maxWaitMs = params.maxWaitMs ?? (isTestEnv ? 500 : defaultMaxWait)
  const pollIntervalMs = params.pollIntervalMs ?? (isTestEnv ? 10 : defaultInterval)
  const initialWaitMs = isTestEnv ? 0 : (isVideo ? 2_000 : 1_000)

  if (initialWaitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, initialWaitMs))
  }

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const statusRes = await fetch(
        `${graphRoot}/${creationId}?fields=status_code,status&access_token=${accessToken}`
      )
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        const statusCode = statusData.status_code
        if (statusCode === "FINISHED") {
          return { ready: true }
        } else if (statusCode === "ERROR" || statusCode === "EXPIRED") {
          const detail = statusData.status || statusData.error?.message || statusCode
          return {
            ready: false,
            error: `Media container processing failed on Meta servers: ${detail}`,
          }
        }
      }
    } catch {
      // Allow intermittent network blips during polling
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return {
    ready: false,
    error: `Media container processing timed out on Meta servers (${isVideo ? "video" : "image"}) before publishing`,
  }
}

/**
 * Calls Meta's /{ig-user-id}/media_publish endpoint with retry handling for transient 9007 errors.
 */
export async function publishContainerWithRetry(params: {
  baseUrl: string
  creationId: string
  accessToken: string
  maxRetries?: number
  retryDelayMs?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { baseUrl, creationId, accessToken, maxRetries = 2 } = params
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true"
  const retryDelay = params.retryDelayMs ?? (isTestEnv ? 10 : 2500)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const publishRes = await fetch(`${baseUrl}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    })

    const publishData = await publishRes.json().catch(() => ({}))
    if (publishRes.ok && publishData.id) {
      return { success: true, id: publishData.id }
    }

    const errorMessage = publishData.error?.message || "Failed to publish media container"
    const errorCode = publishData.error?.code
    const isMediaIdUnavailable =
      errorCode === 9007 || errorMessage.toLowerCase().includes("media id is not available")

    if (isMediaIdUnavailable && attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      continue
    }

    return { success: false, error: errorMessage }
  }

  return { success: false, error: "Failed to publish media container after retries" }
}

/**
 * Publishes content to Instagram via the Instagram Graph API.
 * Follows the 2-step container creation and media publish flow:
 * 1. POST /{ig-user-id}/media (create container)
 * 2. GET /{creation-id}?fields=status_code (poll until FINISHED)
 * 3. POST /{ig-user-id}/media_publish (publish container)
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
        const createData = await createRes.json().catch(() => ({}))
        if (!createRes.ok || !createData.id) {
          return {
            success: false,
            error: createData.error?.message || "Failed to create Story slide container",
          }
        }

        const creationId = createData.id
        const readyCheck = await waitForContainerReady({
          graphRoot,
          creationId,
          accessToken: config.accessToken,
          isVideo: isVid,
        })
        if (!readyCheck.ready) {
          return {
            success: false,
            error: readyCheck.error || "Story slide processing failed before publishing",
          }
        }

        const publishOutcome = await publishContainerWithRetry({
          baseUrl,
          creationId,
          accessToken: config.accessToken,
        })
        if (!publishOutcome.success || !publishOutcome.id) {
          return {
            success: false,
            error: publishOutcome.error || "Failed to publish Story slide container",
          }
        }
        publishedIds.push(publishOutcome.id)
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
        const itemData = await itemRes.json().catch(() => ({}))
        if (!itemRes.ok || !itemData.id) {
          return {
            success: false,
            error: itemData.error?.message || "Failed to create carousel item container",
          }
        }

        const childReady = await waitForContainerReady({
          graphRoot,
          creationId: itemData.id,
          accessToken: config.accessToken,
          isVideo: isVid,
        })
        if (!childReady.ready) {
          return {
            success: false,
            error: childReady.error || "Carousel item processing failed before publishing",
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
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok || !createData.id) {
        return {
          success: false,
          error: createData.error?.message || "Failed to create carousel container",
        }
      }

      const carouselReady = await waitForContainerReady({
        graphRoot,
        creationId: createData.id,
        accessToken: config.accessToken,
        isVideo: false,
      })
      if (!carouselReady.ready) {
        return {
          success: false,
          error: carouselReady.error || "Carousel container processing failed before publishing",
        }
      }

      const publishOutcome = await publishContainerWithRetry({
        baseUrl,
        creationId: createData.id,
        accessToken: config.accessToken,
      })
      if (!publishOutcome.success || !publishOutcome.id) {
        return {
          success: false,
          error: publishOutcome.error || "Failed to publish carousel container",
        }
      }

      return {
        success: true,
        id: publishOutcome.id,
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

    const createData = await createRes.json().catch(() => ({}))
    if (!createRes.ok || !createData.id) {
      return {
        success: false,
        error: createData.error?.message || "Failed to create media container",
      }
    }

    const creationId = createData.id
    const isVideo = payload.mediaType === "video" || payload.category === "Reels"

    const readyCheck = await waitForContainerReady({
      graphRoot,
      creationId,
      accessToken: config.accessToken,
      isVideo,
    })
    if (!readyCheck.ready) {
      return {
        success: false,
        error: readyCheck.error || "Media container processing failed before publishing",
      }
    }

    const publishOutcome = await publishContainerWithRetry({
      baseUrl,
      creationId,
      accessToken: config.accessToken,
    })
    if (!publishOutcome.success || !publishOutcome.id) {
      return {
        success: false,
        error: publishOutcome.error || "Failed to publish media container",
      }
    }

    return {
      success: true,
      id: publishOutcome.id,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unexpected error during Meta publishing",
    }
  }
}
