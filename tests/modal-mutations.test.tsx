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

  it("renders scheduled queue and excludes posted/manual items from the modal", () => {
    const postedStory: ScheduledEntry = {
      ...testScheduledEntry,
      rowKey: "postedStoryKey",
      recordId: "recPosted1",
      foreignKeyId: "POSTED-STORY-1",
      status: "Posted",
      category: "Stories",
    }
    const postedFeed: ScheduledEntry = {
      ...testScheduledEntry,
      rowKey: "postedFeedKey",
      recordId: "recPosted2",
      foreignKeyId: "POSTED-FEED-2",
      status: "Posted",
      category: "Feeds",
    }
    const manualItem: ScheduledEntry = {
      ...testScheduledEntry,
      rowKey: "manualKey",
      recordId: "recManual1",
      foreignKeyId: "MANUAL-ITEM-3",
      status: "For Manual",
      category: "Reels",
    }

    render(
      <ScheduledPostsModal
        onClose={() => {}}
        schedules={{
          "2026-09-15": [testScheduledEntry, postedStory, postedFeed, manualItem],
        }}
        onScheduleCancelled={() => {}}
        onJumpToDate={() => {}}
      />
    )

    // Scheduled item is rendered in queue
    expect(screen.getByText("cid123")).toBeTruthy()
    // Posted and manual items are completely excluded from the content calendar modal
    expect(screen.queryByText("POSTED-STORY-1")).toBeNull()
    expect(screen.queryByText("POSTED-FEED-2")).toBeNull()
    expect(screen.queryByText("MANUAL-ITEM-3")).toBeNull()
    expect(screen.queryByText("Publish History")).toBeNull()
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

describe("DayDetailModal Day & Night output handling", () => {
  it("populates and enables Posted outputs with their Foreign Key ID", async () => {
    const { DayDetailModal } = await import("@/components/day-detail-modal")
    const mockOutput = {
      recordId: "recqD0jcA15fGGgLI",
      tableId: "tblSceuLVvLMQ6wWp",
      category: "Feeds",
      contentType: "Day & Night",
      foreignKeyId: "DN-FEEDS-CH-1",
      status: "Completed",
      rawStatus: "Completed",
      date: "2026-07-02",
      time: "10:00",
      mediaType: "image",
      slides: ["https://media.example/day.jpg", "https://media.example/night.jpg"],
      caption: "Day and Night Chandelier",
      airtableUrl: "https://airtable.com/appTest/tblSceuLVvLMQ6wWp/recqD0jcA15fGGgLI",
      itemNames: ["Danka Deux | Modern Chandelier"],
      fixtureType: "Chandelier",
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/content-outputs")) {
          return new Response(JSON.stringify({ items: [mockOutput] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 })
      })
    )

    render(
      <DayDetailModal
        iso="2026-07-02"
        entries={[
          {
            type: "Feeds",
            idea: "Day & Night",
            time: "10:00",
            status: "Posted",
          },
        ]}
        onClose={() => {}}
      />
    )

    // Wait for the fetch and auto-selection to populate the Foreign Key ID
    await vi.waitFor(() => {
      expect(screen.getByText("DN-FEEDS-CH-1")).toBeDefined()
      expect(screen.getByText("Chandelier")).toBeDefined()
    })
  })

  it("populates and enables Style Reel Slideshow with derived Chandelier and Foreign Key ID", async () => {
    const { DayDetailModal } = await import("@/components/day-detail-modal")
    const mockOutput = {
      recordId: "rec2wToEWsPNOPoIF",
      tableId: "tblFFEvkHb3jLKrcv",
      category: "Reels",
      contentType: "Styled Reel Slideshow",
      foreignKeyId: "SR-REEL-CH-11",
      status: "Completed",
      rawStatus: "Done",
      date: "2026-07-02",
      time: "18:00",
      mediaType: "video",
      videoUrl: "https://media.example/reel.mp4",
      slides: [],
      caption: "Style Reel Slideshow caption",
      airtableUrl: "https://airtable.com/appTest/tblFFEvkHb3jLKrcv/rec2wToEWsPNOPoIF",
      itemNames: ["Nordic Chandelier", "Linear Glow"],
      fixtureType: "Chandelier",
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/content-outputs")) {
          return new Response(JSON.stringify({ items: [mockOutput] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 })
      })
    )

    render(
      <DayDetailModal
        iso="2026-07-02"
        entries={[
          {
            type: "Reels",
            idea: "Styled Reel Slideshow",
            time: "18:00",
            status: "Posted",
          },
        ]}
        onClose={() => {}}
      />
    )

    // Wait for auto-selection to populate SR-REEL-CH-11 under Chandelier
    await vi.waitFor(() => {
      expect(screen.getByText("SR-REEL-CH-11")).toBeDefined()
      expect(screen.getByText("Chandelier")).toBeDefined()
    })
  })

  it("derives Chandelier for Style Reel Slideshow when existing schedule has SR-REEL-CH-11 but fixture is undefined", async () => {
    const { DayDetailModal } = await import("@/components/day-detail-modal")
    const mockSchedule = {
      recordId: "recSched123",
      tableId: "tblFFEvkHb3jLKrcv",
      category: "Reels",
      idea: "Styled Reel Slideshow",
      time: "18:00",
      status: "Posted",
      foreignKeyId: "SR-REEL-CH-11",
      isoDate: "2026-09-21",
      fixture: "", // deliberately empty, simulating missing fixture field in Airtable
    }

    const mockOutput = {
      recordId: "rec2wToEWsPNOPoIF",
      tableId: "tblFFEvkHb3jLKrcv",
      category: "Reels",
      contentType: "Styled Reel Slideshow",
      foreignKeyId: "SR-REEL-CH-11",
      status: "Completed",
      rawStatus: "Done",
      date: "2026-09-21",
      time: "18:00",
      mediaType: "video",
      videoUrl: "https://media.example/reel.mp4",
      slides: [],
      caption: "Style Reel Slideshow caption",
      airtableUrl: "https://airtable.com/appTest/tblFFEvkHb3jLKrcv/rec2wToEWsPNOPoIF",
      itemNames: ["Nordic Chandelier"],
      fixtureType: "Chandelier",
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/content-outputs")) {
          return new Response(JSON.stringify({ items: [mockOutput] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 })
      })
    )

    render(
      <DayDetailModal
        iso="2026-09-21"
        entries={[
          {
            type: "Reels",
            idea: "Styled Reel Slideshow",
            time: "18:00",
            status: "To Do",
          },
        ]}
        existingSchedules={[mockSchedule as any]}
        onClose={() => {}}
      />
    )

    // Should immediately show Chandelier derived from SR-REEL-CH-11 and the CID
    await vi.waitFor(() => {
      expect(screen.getByText("SR-REEL-CH-11")).toBeDefined()
      expect(screen.getByText("Chandelier")).toBeDefined()
    })
  })

  it("prevents duplicate rows in DayDetailModal when multiple schedules exist for the same idea on a date", async () => {
    const { DayDetailModal } = await import("@/components/day-detail-modal")
    const mockSchedule1 = {
      recordId: "rec1",
      tableId: "tblStory",
      category: "Stories",
      idea: "CTA Story",
      time: "13:26",
      status: "Scheduled",
      foreignKeyId: "CTA-STORY-TL-1",
      isoDate: "2026-09-16",
      fixture: "Table Lamp",
    }
    const mockSchedule2 = {
      recordId: "rec2",
      tableId: "tblStory",
      category: "Stories",
      idea: "CTA Story",
      time: "13:41",
      status: "Scheduled",
      foreignKeyId: "CTA-STORY-TL-2",
      isoDate: "2026-09-16",
      fixture: "Table Lamp",
    }
    const mockSchedule3 = {
      recordId: "rec3",
      tableId: "tblStory",
      category: "Stories",
      idea: "CTA Story",
      time: "13:43",
      status: "Scheduled",
      foreignKeyId: "CTA-STORY-CH-12",
      isoDate: "2026-09-16",
      fixture: "Chandelier",
    }

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [] })))

    render(
      <DayDetailModal
        iso="2026-09-16"
        entries={[
          {
            type: "Stories",
            idea: "CTA",
            time: "21:00",
            status: "To Do",
          },
        ]}
        existingSchedules={[mockSchedule1 as any, mockSchedule2 as any, mockSchedule3 as any]}
        onClose={() => {}}
      />
    )

    // The modal should only render ONE row for CTA Story, not 3 duplicate rows
    expect(screen.getByRole("button", { name: "CTA" })).toBeDefined()
    expect(screen.queryByRole("button", { name: "CTA Story" })).toBeNull()
    // It should pick the latest scheduled item (mockSchedule3: 13:43 and CTA-STORY-CH-12)
    expect(screen.getByText("13:43")).toBeDefined()
    expect(screen.getByText("CTA-STORY-CH-12")).toBeDefined()
  })
})
