import { expect, it, vi } from "vitest"
import { syncAirtableRecord } from "@/lib/schedules"

it("does not claim a schedule is saved when both date columns are rejected", async () => {
  const writes: Record<string, unknown>[] = []
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { fields } = JSON.parse(init.body as string)
    writes.push(fields)
    return "Date and Time Scheduled" in fields || "Date and Time" in fields
      ? Response.json({ error: { type: "UNKNOWN_FIELD_NAME" } }, { status: 422 })
      : Response.json({ id: "recTest", fields })
  }))
  await expect(syncAirtableRecord("tblTest", "recTest", "Scheduled", "2026-09-20", "14:30")).rejects.toThrow()
  expect(writes.every(fields => "Date and Time Scheduled" in fields || "Date and Time" in fields)).toBe(true)
})

it("does not retry an unauthorized write with alternate schemas", async () => {
  const writes: unknown[] = []
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    writes.push(init.body)
    return Response.json({ error: { type: "AUTHENTICATION_REQUIRED" } }, { status: 401 })
  }))
  await expect(syncAirtableRecord("tblTest", "recTest", "Scheduled", "2026-09-20", "14:30")).rejects.toThrow()
  expect(writes).toHaveLength(1)
})

it.each([
  ["2026-02-30", "14:30"], ["2026-09-20", "25:00"], ["2026-09-20", ""], [undefined, "14:30"],
])("rejects invalid or incomplete scheduling date/time %s %s", async (date, time) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "recTest" })))
  await expect(syncAirtableRecord("tblTest", "recTest", "Scheduled", date, time)).rejects.toThrow()
})

it("writes Philippine wall-clock time with an explicit UTC offset", async () => {
  let saved: unknown
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    saved = JSON.parse(init.body as string).fields
    return Response.json({ id: "recTest", fields: saved })
  }))
  await syncAirtableRecord("tblTest", "recTest", "Scheduled", "2026-09-20", "14:30")
  expect(saved).toEqual({ Status: "Scheduled", "Date and Time Scheduled": "2026-09-20T14:30:00+08:00" })
})

it("normalizes single-digit hour like '9:00' to '09:00' when writing schedule timestamp", async () => {
  let saved: unknown
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    saved = JSON.parse(init.body as string).fields
    return Response.json({ id: "recTest", fields: saved })
  }))
  await syncAirtableRecord("tblTest", "recTest", "Scheduled", "2026-09-20", "9:00")
  expect(saved).toEqual({ Status: "Scheduled", "Date and Time Scheduled": "2026-09-20T09:00:00+08:00" })
})

it("cancels schedules with the legacy date column without leaving the old timestamp", async () => {
  let saved: unknown
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { fields } = JSON.parse(init.body as string)
    if ("Date and Time Scheduled" in fields) return Response.json({ error: { type: "UNKNOWN_FIELD_NAME" } }, { status: 422 })
    saved = fields
    return Response.json({ id: "recTest", fields })
  }))
  await syncAirtableRecord("tblTest", "recTest", "Completed")
  expect(saved).toEqual({ Status: "Completed", "Date and Time": null })
})
