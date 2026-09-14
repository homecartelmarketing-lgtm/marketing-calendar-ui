import { afterEach, beforeEach, vi } from "vitest"

// Never load the operator's adjacent automation .env or call live providers.
process.env.MARKETING_AUTOMATION_DIR = "/nonexistent/automation-test-fixtures"
process.env.AIRTABLE_TOKEN = "test-token-not-a-credential"
process.env.AIRTABLE_BASE_ID = "appTest"

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("Unexpected network request: tests must provide a provider fixture")
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
