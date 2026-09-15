// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import SchedulerDebugPage from "@/app/scheduler-debug/page"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it("shows a diagnostics failure instead of false missing-credential statuses", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ success: false }, { status: 504 }))
  )

  render(<SchedulerDebugPage />)

  expect((await screen.findAllByText("CHECK FAILED")).length).toBeGreaterThan(0)
  expect(screen.queryByText("Meta credentials missing or invalid.")).toBeNull()
  expect(screen.queryByText("DISCONNECTED")).toBeNull()
  expect(screen.queryByText("Not configured")).toBeNull()
})

it("stops waiting when the diagnostics request never responds", async () => {
  vi.useFakeTimers()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    }))
  )

  render(<SchedulerDebugPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000)
  })

  expect(screen.getAllByText("CHECK FAILED").length).toBeGreaterThan(0)
})

it("shows the actual twenty-second auto-sync interval", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({
      success: true,
      system: {
        serverUtc: "2026-09-15T00:00:00.000Z",
        phtNow: "2026-09-15 08:00:00 PHT (UTC+08:00)",
        cronSecretConfigured: true,
        airtableConfigured: true,
        airtableStatus: "connected",
        airtableBaseId: "appTest",
        scheduleScanStatus: "complete",
        metaStatus: { configured: true, verified: true },
      },
      scheduledItems: [],
      scheduledCount: 0,
      candidateFixtures: [],
    }))
  )

  render(<SchedulerDebugPage />)

  expect(await screen.findByRole("button", { name: "Auto-sync: ON (20s)" })).toBeDefined()
})
