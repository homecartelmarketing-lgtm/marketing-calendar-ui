// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ScheduledPostsModal } from "@/components/scheduled-posts-modal"
import type { ScheduledEntry } from "@/app/api/schedules/route"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const testScheduledEntry: ScheduledEntry = {
  recordId: "recTest123",
  tableId: "tblTest456",
  isoDate: "2026-09-15",
  rowKey: "key123",
  category: "Stories",
  idea: "CTA Story",
  time: "10:00",
  foreignKeyId: "cid123",
  status: "Scheduled",
  caption: "Test caption",
  mediaUrl: "https://media.example/photo.jpg",
  slides: ["https://media.example/photo.jpg"],
  mediaType: "image",
  updatedAt: "2026-09-15T00:00:00.000Z",
}

describe("ScheduledPostsModal mutation handling", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.spyOn(window, "alert").mockImplementation(() => {})
  })

  it("sends only DELETE /api/schedules without duplicate PATCH /api/content-outputs on cancellation", async () => {
    const fetchCalls: { url: string; method?: string }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url: String(url), method: init?.method || "GET" })
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      })
    )

    const onCancelMock = vi.fn()

    render(
      <ScheduledPostsModal
        onClose={() => {}}
        schedules={{ "2026-09-15": [testScheduledEntry] }}
        onScheduleCancelled={onCancelMock}
        onJumpToDate={() => {}}
      />
    )

    const cancelButtons = screen.getAllByRole("button", { name: /cancel schedule/i })
    fireEvent.click(cancelButtons[0])

    await vi.waitFor(() => expect(onCancelMock).toHaveBeenCalledWith("2026-09-15", "key123", "cid123"))

    // Verify exactly one fetch call occurred
    expect(fetchCalls.length).toBe(1)
    expect(fetchCalls[0].url).toContain("/api/schedules")
    expect(fetchCalls[0].method).toBe("DELETE")
    // Ensure no redundant PATCH /api/content-outputs was made
    expect(fetchCalls.some((c) => c.url.includes("/api/content-outputs"))).toBe(false)
  })

  it("does not trigger onScheduleCancelled and alerts error when DELETE /api/schedules fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ success: false, error: "Airtable connection timed out" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      })
    )

    const onCancelMock = vi.fn()
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {})

    render(
      <ScheduledPostsModal
        onClose={() => {}}
        schedules={{ "2026-09-15": [testScheduledEntry] }}
        onScheduleCancelled={onCancelMock}
        onJumpToDate={() => {}}
      />
    )

    const cancelButtons = screen.getAllByRole("button", { name: /cancel schedule/i })
    fireEvent.click(cancelButtons[0])

    await vi.waitFor(() => expect(alertMock).toHaveBeenCalled())
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("Airtable connection timed out"))
    expect(onCancelMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/meta-post route behavior", () => {
  it("returns statusSyncWarning when Meta succeeds but Airtable status update fails", async () => {
    vi.stubEnv("SIMULATE", "1")
    const { POST } = await import("@/app/api/meta-post/route")

    // Mock publishToInstagram as success and syncAirtableRecord as failure
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.airtable.com")) {
          return new Response("Airtable 422 schema error", { status: 422 })
        }
        return new Response(JSON.stringify({ id: "meta_post_999" }), { status: 200 })
      })
    )

    const req = new Request("http://localhost:3000/api/meta-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaUrl: "https://media.example/photo.jpg",
        category: "Stories",
        recordId: "rec123",
        tableId: "tbl123",
        isoDate: "2026-09-15",
        time: "10:00",
      }),
    })

    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.statusSyncWarning).toBeDefined()
  })

  it("rejects publication with 400 if mediaUrl is missing", async () => {
    const { POST } = await import("@/app/api/meta-post/route")

    const req = new Request("http://localhost:3000/api/meta-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Stories",
        recordId: "rec123",
        tableId: "tbl123",
      }),
    })

    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.message).toContain("Media URL is required")
  })
})
