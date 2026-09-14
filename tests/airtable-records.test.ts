import { expect, it, vi } from "vitest"
import { readAirtableRecords } from "@/server/airtable/records"

const options = { baseId: "appTest", tableId: "tblTest", token: "fake" }

it("detects a repeated cursor instead of looping forever", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ records: [], offset: "same" })))
  await expect(readAirtableRecords(options)).rejects.toMatchObject({ code: "REPEATED_OFFSET" })
})

it("deduplicates overlapping pages by the immutable record ID", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => new URL(input).searchParams.has("offset")
    ? Response.json({ records: [{ id: "rec1", fields: { Caption: "latest" } }, { id: "rec2", fields: {} }] })
    : Response.json({ records: [{ id: "rec1", fields: { Caption: "old" } }], offset: "page2" })))
  expect(await readAirtableRecords(options)).toEqual([
    { id: "rec1", fields: { Caption: "latest" } }, { id: "rec2", fields: {} },
  ])
})

it("aborts before making a provider call if the client already cancelled", async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(readAirtableRecords({ ...options, signal: controller.signal })).rejects.toThrow()
})

it("spaces pagination requests instead of bursting past the per-base allowance", async () => {
  const starts: number[] = []
  vi.stubGlobal("fetch", vi.fn(async () => {
    starts.push(Date.now())
    return Response.json({ records: [], ...(starts.length < 6 ? { offset: `page${starts.length}` } : {}) })
  }))
  await readAirtableRecords({ ...options, baseId: "appRateTest" })
  expect(starts[5] - starts[0]).toBeGreaterThanOrEqual(1_000)
})
