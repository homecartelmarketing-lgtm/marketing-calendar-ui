import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

const { targets } = vi.hoisted(() => ({ targets: vi.fn() }))
vi.mock("@/lib/tables-config", () => ({
  AIRTABLE_TOKEN: "test-token",
  AIRTABLE_BASE_ID: "appTest",
  autoEnv: {},
  getAllConfiguredTables: targets,
}))
import { GET, PATCH } from "@/app/api/content-outputs/route"

const table = (id: string) => ({ tableId: id, category: "Stories", idea: "CTA Story" })
const record = (id: string) => ({
  id,
  createdTime: "2026-09-14T00:00:00.000Z",
  fields: {
    Status: "Completed",
    "CTA Converted Image": [{ id: `att${id}`, url: `https://media.example/${id}.jpg`, type: "image/jpeg" }],
    "Date and Time Generated": "2026-09-13T17:30:00.000Z",
  },
})

describe("output status writes", () => {
  it("rejects a missing table instead of reporting a successful unsaved change", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/content-outputs", {
      method: "PATCH", body: JSON.stringify({ recordId: "recTest", status: "Completed" }),
    }))
    expect(response.status).toBe(400)
  })
  it("returns failure when the provider rejects the complete scheduling change", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { type: "UNKNOWN_FIELD_NAME" } }, { status: 422 })))
    const response = await PATCH(new NextRequest("http://localhost/api/content-outputs", {
      method: "PATCH", body: JSON.stringify({ tableId: "tblTest", recordId: "recTest", status: "Scheduled", scheduledIso: "2026-09-20", time: "14:30" }),
    }))
    expect(response.status).toBe(502)
    expect((await response.json()).status).toBe("error")
  })
})
const request = () => new NextRequest("http://localhost/api/content-outputs?category=Stories&type=CTA%20Story")

describe("output data completeness", () => {
  it("does not expose an unrelated source video as the final Reel", async () => {
    targets.mockReturnValue([{ tableId: "tblReel", category: "Reels", idea: "Product Closeup" }])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ records: [{ id: "recDraft", fields: {
      "Foreign Key ID": "draft", "Source Video": [{ url: "https://media.example/source.mp4", type: "video/mp4" }],
    } }] })))
    const body = await (await GET(new NextRequest("http://localhost/api/content-outputs?category=Reels&type=Product%20Closeup"))).json()
    expect(body.items).toEqual([])
  })
  it("returns the 101st record and correctly encodes the opaque pagination cursor", async () => {
    targets.mockReturnValue([table("tblOne")])
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(input)
      if (url.searchParams.has("offset")) {
        expect(url.searchParams.get("offset")).toBe("next/page + value")
        return Response.json({ records: [record("rec101")] })
      }
      return Response.json({ records: Array.from({ length: 100 }, (_, n) => record(`rec${n + 1}`)), offset: "next/page + value" })
    }))
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.total).toBe(101)
    expect(body.items[100].recordId).toBe("rec101")
    expect(body.items[0].generatedDate).toBe("September 14, 2026 (Monday)")
    expect(body.items[0].generatedTime).toBe("01:30")
  })

  it("reports a complete provider outage as an error, not an empty gallery", async () => {
    targets.mockReturnValue([table("tblOne")])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "private-provider-detail" } }, { status: 403 })))
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(502)
    expect(body.status).toBe("error")
    expect(body.diagnostics.failedTables).toBe(1)
    expect(JSON.stringify(body)).not.toContain("private-provider-detail")
  })

  it("keeps successful records and reports partial table failures", async () => {
    targets.mockReturnValue([table("tblOne"), table("tblTwo")])
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) =>
      new URL(input).pathname.endsWith("tblOne")
        ? Response.json({ records: [record("recOne")] })
        : Response.json({}, { status: 403 })))
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items.map((item: { recordId: string }) => item.recordId)).toEqual(["recOne"])
    expect(body.diagnostics).toMatchObject({ partial: true, failedTables: 1, successfulTables: 1 })
  })

  it("does not duplicate cards when configuration repeats the same table", async () => {
    targets.mockReturnValue([table("tblOne"), table("tblOne")])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ records: [record("recOne")] })))
    const body = await (await GET(request())).json()
    expect(body.total).toBe(1)
  })

  it("rejects malformed Airtable pages instead of reporting an empty success", async () => {
    targets.mockReturnValue([table("tblOne")])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ unexpected: [] })))
    expect((await GET(request())).status).toBe(502)
  })

  it("rejects unsupported categories before querying providers", async () => {
    targets.mockReturnValue([])
    const response = await GET(new NextRequest("http://localhost/api/content-outputs?category=Invalid"))
    expect(response.status).toBe(400)
  })

  it("keeps a genuine empty provider result as a successful empty gallery", async () => {
    targets.mockReturnValue([table("tblOne")])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ records: [] })))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect((await response.json()).items).toEqual([])
  })

  it("extracts Moodboard #2 records and derives canonical foreign keys with fixture", async () => {
    targets.mockReturnValue([{ tableId: "tblMb2", category: "Feeds", idea: "Moodboard #2", fixtureType: "Chandelier" }])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      records: [{
        id: "recMb2",
        fields: {
          ID: 4,
          Status: "Completed",
          "FEED - Moodboard #2 Feed (3)": [{ id: "attMb2", url: "https://media.example/mb2.jpg", type: "image/jpeg" }],
        },
      }],
    })))
    const response = await GET(new NextRequest("http://localhost/api/content-outputs?category=Feeds&type=Moodboard%20%232"))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items.length).toBe(1)
    expect(body.items[0].foreignKeyId).toBe("MB2-FEEDS-CH-4")
    expect(body.items[0].fixtureType).toBe("Chandelier")
  })

  it("extracts Tips & Educational Feed records and derives canonical foreign keys with fixture", async () => {
    targets.mockReturnValue([{ tableId: "tblQ65S51Dmauwx4c", category: "Feeds", idea: "Tips & Educational", fixtureType: "Chandelier" }])
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      records: [{
        id: "recTips",
        fields: {
          ID: 4,
          Status: "Complete",
          "Thumbnail with Text": [{ id: "attCover", url: "https://media.example/cover.jpg", type: "image/jpeg" }],
          "Tips and Edu Feeds": [
            { id: "attF1", url: "https://media.example/f1.jpg", type: "image/jpeg" },
            { id: "attF2", url: "https://media.example/f2.jpg", type: "image/jpeg" },
            { id: "attF3", url: "https://media.example/f3.jpg", type: "image/jpeg" },
          ],
        },
      }],
    })))
    const response = await GET(new NextRequest("http://localhost/api/content-outputs?category=Feeds&type=Tips%20%26%20Educational"))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items.length).toBe(1)
    expect(body.items[0].foreignKeyId).toBe("TNE-FEEDS-CH-4")
    expect(body.items[0].fixtureType).toBe("Chandelier")
    expect(body.items[0].slides.length).toBe(4)
  })
})
