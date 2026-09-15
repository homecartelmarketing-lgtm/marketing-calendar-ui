import { expect, it, vi } from "vitest"

vi.mock("@/lib/tables-config", () => ({
  AIRTABLE_BASE_ID: "appTest", AIRTABLE_TOKEN: "fake",
  getAllConfiguredTables: () => [{ tableId: "tblTest", category: "Stories", idea: "CTA Story" }],
}))
import { pullAirtableSchedulesWithDiagnostics, clearSchedulesCache } from "@/lib/schedules"
import { beforeEach } from "vitest"

beforeEach(() => {
  clearSchedulesCache()
})

it("includes due records on subsequent Airtable pages", async () => {
  const row = (id: string) => ({ id, fields: { Status: "Scheduled", "Date and Time Scheduled": "2026-09-20T06:30:00Z" } })
  vi.stubGlobal("fetch", vi.fn(async (input: string) => new URL(input).searchParams.has("offset")
    ? Response.json({ records: [row("rec101")] })
    : Response.json({ records: Array.from({ length: 100 }, (_, i) => row(`rec${i}`)), offset: "next-page" })))
  const result = await pullAirtableSchedulesWithDiagnostics()
  expect(result.failedTables).toEqual([])
  expect(result.schedules["2026-09-20"]).toHaveLength(101)
  expect(result.schedules["2026-09-20"][100]).toMatchObject({ recordId: "rec101", time: "14:30" })
})

it("reports a malformed schedule page rather than making scheduled content disappear silently", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ unexpected: [] })))
  const result = await pullAirtableSchedulesWithDiagnostics()
  expect(result.failedTables).toHaveLength(1)
})
