import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { publishToInstagram } from "@/lib/meta-api"

describe("Meta Instagram publishing container readiness", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      META_ACCESS_TOKEN: "mock_test_token_not_a_credential",
      META_IG_ACCOUNT_ID: "17841400000000000",
      META_API_VERSION: "v19.0",
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it("polls container status until FINISHED for images before calling media_publish", async () => {
    const fetchCalls: { url: string; method?: string; body?: any }[] = []
    let statusPollCount = 0

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        const method = init?.method || "GET"
        const body = init?.body ? JSON.parse(init.body as string) : undefined
        fetchCalls.push({ url: urlStr, method, body })

        if (urlStr.includes("/media_publish")) {
          // If media_publish is called, container must already be FINISHED
          expect(statusPollCount).toBeGreaterThanOrEqual(1)
          return Response.json({ id: "pub_12345" })
        }

        if (urlStr.includes("?fields=status_code")) {
          statusPollCount++
          if (statusPollCount === 1) {
            return Response.json({ status_code: "IN_PROGRESS" })
          }
          return Response.json({ status_code: "FINISHED" })
        }

        if (urlStr.endsWith("/media") && method === "POST") {
          return Response.json({ id: "container_image_001" })
        }

        return Response.json({ error: { message: "Not found" } }, { status: 404 })
      })
    )

    const result = await publishToInstagram({
      category: "Stories",
      mediaUrl: "https://example.com/slide1.jpg",
      mediaType: "image",
    })

    expect(result.success).toBe(true)
    expect(result.id).toBe("pub_12345")
    expect(statusPollCount).toBe(2)

    // Ensure media_publish was called with creation_id
    const publishCall = fetchCalls.find((c) => c.url.includes("/media_publish"))
    expect(publishCall).toBeDefined()
    expect(publishCall?.body.creation_id).toBe("container_image_001")
  })

  it("polls each slide container for multi-slide Stories before publishing each", async () => {
    const publishedCreationIds: string[] = []
    const statusChecks: string[] = []

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        const method = init?.method || "GET"
        const body = init?.body ? JSON.parse(init.body as string) : undefined

        if (urlStr.endsWith("/media") && method === "POST") {
          const id = body.image_url.includes("slide1") ? "cont_s1" : "cont_s2"
          return Response.json({ id })
        }

        if (urlStr.includes("?fields=status_code")) {
          statusChecks.push(urlStr)
          return Response.json({ status_code: "FINISHED" })
        }

        if (urlStr.includes("/media_publish")) {
          publishedCreationIds.push(body.creation_id)
          return Response.json({ id: `pub_${body.creation_id}` })
        }

        return Response.json({ error: { message: "Not found" } }, { status: 404 })
      })
    )

    const result = await publishToInstagram({
      category: "Stories",
      mediaUrl: "https://example.com/slide1.jpg",
      mediaUrls: ["https://example.com/slide1.jpg", "https://example.com/slide2.jpg"],
      mediaType: "image",
    })

    expect(result.success).toBe(true)
    expect(result.id).toBe("pub_cont_s1,pub_cont_s2")
    expect(publishedCreationIds).toEqual(["cont_s1", "cont_s2"])
    expect(statusChecks.length).toBe(2)
  })

  it("retries media_publish when Meta returns Error 9007 (Media ID is not available)", async () => {
    let publishAttempts = 0

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        const method = init?.method || "GET"

        if (urlStr.endsWith("/media") && method === "POST") {
          return Response.json({ id: "cont_retry_1" })
        }

        if (urlStr.includes("?fields=status_code")) {
          return Response.json({ status_code: "FINISHED" })
        }

        if (urlStr.includes("/media_publish")) {
          publishAttempts++
          if (publishAttempts === 1) {
            // First publish attempt gets the 9007 error
            return Response.json(
              {
                error: {
                  message: "Media ID is not available",
                  code: 9007,
                  type: "OAuthException",
                },
              },
              { status: 400 }
            )
          }
          // Second publish attempt succeeds
          return Response.json({ id: "pub_after_retry" })
        }

        return Response.json({ error: { message: "Not found" } }, { status: 404 })
      })
    )

    const result = await publishToInstagram({
      category: "Stories",
      mediaUrl: "https://example.com/slide.jpg",
      mediaType: "image",
    })

    expect(result.success).toBe(true)
    expect(result.id).toBe("pub_after_retry")
    expect(publishAttempts).toBe(2)
  })

  it("stops and reports explicit error if Meta returns status_code ERROR during container processing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        const method = init?.method || "GET"

        if (urlStr.endsWith("/media") && method === "POST") {
          return Response.json({ id: "cont_err_1" })
        }

        if (urlStr.includes("?fields=status_code")) {
          return Response.json({
            status_code: "ERROR",
            status: "The image format is not supported or corrupted",
          })
        }

        if (urlStr.includes("/media_publish")) {
          // Should NEVER be called if container status is ERROR
          throw new Error("media_publish was unexpectedly called for an errored container")
        }

        return Response.json({ error: { message: "Not found" } }, { status: 404 })
      })
    )

    const result = await publishToInstagram({
      category: "Feeds",
      mediaUrl: "https://example.com/bad-image.bmp",
      mediaType: "image",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("The image format is not supported or corrupted")
  })

  it("polls both child containers and parent carousel container before publishing multi-image Feeds", async () => {
    const checkedContainers: string[] = []

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        const method = init?.method || "GET"
        const body = init?.body ? JSON.parse(init.body as string) : undefined

        if (urlStr.endsWith("/media") && method === "POST") {
          if (body.is_carousel_item) {
            return Response.json({ id: `item_${body.image_url.includes("1") ? "1" : "2"}` })
          }
          return Response.json({ id: "carousel_parent" })
        }

        if (urlStr.includes("?fields=status_code")) {
          if (urlStr.includes("item_1")) checkedContainers.push("item_1")
          if (urlStr.includes("item_2")) checkedContainers.push("item_2")
          if (urlStr.includes("carousel_parent")) checkedContainers.push("carousel_parent")
          return Response.json({ status_code: "FINISHED" })
        }

        if (urlStr.includes("/media_publish")) {
          expect(body.creation_id).toBe("carousel_parent")
          return Response.json({ id: "pub_carousel_123" })
        }

        return Response.json({ error: { message: "Not found" } }, { status: 404 })
      })
    )

    const result = await publishToInstagram({
      category: "Feeds",
      mediaUrl: "https://example.com/img1.jpg",
      mediaUrls: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
      mediaType: "image",
    })

    expect(result.success).toBe(true)
    expect(result.id).toBe("pub_carousel_123")
    expect(checkedContainers).toContain("item_1")
    expect(checkedContainers).toContain("item_2")
    expect(checkedContainers).toContain("carousel_parent")
  })
})
