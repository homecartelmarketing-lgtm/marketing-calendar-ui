import { afterEach, beforeEach, expect, it, vi } from "vitest"

const neverCompletes = new Promise<never>(() => {})

vi.mock("@/lib/schedules", () => ({
  pullAirtableSchedulesWithDiagnostics: vi.fn(),
  syncAirtableRecord: vi.fn(),
}))

vi.mock("@/lib/tables-config", () => ({
  AIRTABLE_BASE_ID: "appTest",
  AIRTABLE_TOKEN: "test-token-not-a-credential",
  getAllConfiguredTables: vi.fn(),
}))

vi.mock("@/lib/meta-api", () => ({
  getMetaConfig: vi.fn(),
  publishToInstagram: vi.fn(),
}))

import { GET } from "@/app/api/scheduler-debug/route"
import { pullAirtableSchedulesWithDiagnostics } from "@/lib/schedules"
import { getAllConfiguredTables } from "@/lib/tables-config"
import { getMetaConfig } from "@/lib/meta-api"

beforeEach(() => {
  vi.mocked(pullAirtableSchedulesWithDiagnostics).mockReturnValue(neverCompletes)
  vi.mocked(getAllConfiguredTables).mockReturnValue([])
  vi.mocked(getMetaConfig).mockReturnValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

it("returns bounded partial diagnostics when the Airtable schedule scan stalls", async () => {
  vi.useFakeTimers()
  vi.stubEnv("CRON_SECRET", "test-cron-secret-not-a-credential")

  let response: Response | undefined
  void GET().then((value) => {
    response = value
  })

  await vi.advanceTimersByTimeAsync(10_000)

  expect(response, "the diagnostics request should settle instead of hanging").toBeDefined()
  const body = await response!.json()
  expect(body).toMatchObject({
    success: true,
    system: {
      airtableConfigured: true,
      airtableStatus: "checking",
      scheduleScanStatus: "timed_out",
      cronSecretConfigured: true,
    },
    scheduledCount: 0,
    scheduledItems: [],
  })
  expect(body.system).not.toHaveProperty("cronSecretPreview")
})

it("does not let candidate fixture requests hold the diagnostics response open", async () => {
  vi.useFakeTimers()
  vi.mocked(pullAirtableSchedulesWithDiagnostics).mockResolvedValue({
    schedules: {},
    failedTables: [],
  })
  vi.mocked(getAllConfiguredTables).mockReturnValue([
    { tableId: "tblTest", category: "Stories", idea: "CTA Story" },
  ])
  vi.stubGlobal("fetch", vi.fn(() => neverCompletes))

  let response: Response | undefined
  void GET().then((value) => {
    response = value
  })

  await vi.advanceTimersByTimeAsync(10_000)

  expect(response, "candidate lookup should be best-effort").toBeDefined()
  expect(await response!.json()).toMatchObject({
    success: true,
    candidateFixtures: [],
  })
})

it("bounds the Meta account verification request", async () => {
  vi.useFakeTimers()
  vi.mocked(getMetaConfig).mockReturnValue({
    accessToken: "test-token-not-a-credential",
    instagramAccountId: "test-account",
  })
  vi.mocked(pullAirtableSchedulesWithDiagnostics).mockResolvedValue({
    schedules: {},
    failedTables: [],
  })
  vi.stubGlobal("fetch", vi.fn(() => neverCompletes))

  let response: Response | undefined
  void GET().then((value) => {
    response = value
  })

  await vi.advanceTimersByTimeAsync(10_000)

  expect(response, "Meta verification must not hang the whole page").toBeDefined()
  expect(await response!.json()).toMatchObject({
    success: true,
    system: {
      metaStatus: {
        configured: true,
        verified: false,
        error: "Meta verification timed out",
      },
    },
  })
})

it("does not return raw Meta provider errors", async () => {
  vi.mocked(getMetaConfig).mockReturnValue({
    accessToken: "test-token-not-a-credential",
    instagramAccountId: "test-account",
  })
  vi.mocked(pullAirtableSchedulesWithDiagnostics).mockResolvedValue({
    schedules: {},
    failedTables: [],
  })
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("provider details containing a credential")
  }))

  const body = await (await GET()).json()

  expect(body.system.metaStatus.error).toBe("Failed to reach Meta Graph API")
  expect(JSON.stringify(body)).not.toContain("provider details")
})
