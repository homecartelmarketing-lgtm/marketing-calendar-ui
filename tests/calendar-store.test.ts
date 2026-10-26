import { beforeEach, describe, expect, it } from "vitest"
import {
  loadCalendar,
  resetCalendarStoreForTests,
  resolveStorageMode,
  saveCalendar,
} from "@/server/calendar/store"
import type { ContentEntry } from "@/lib/content"

const entry = (idea: string): ContentEntry => ({
  type: "Feeds",
  idea,
  time: "14:00",
  status: "To Do",
})

describe("resolveStorageMode", () => {
  it("uses Postgres when a database URL exists", () => {
    expect(
      resolveStorageMode({ hasDbUrl: true, nodeEnv: "production", isTest: false }),
    ).toBe("postgres")
  })

  it("fails closed in production without a database URL", () => {
    expect(
      resolveStorageMode({ hasDbUrl: false, nodeEnv: "production", isTest: false }),
    ).toBe("unavailable")
  })

  it("uses memory in development without a database URL", () => {
    expect(
      resolveStorageMode({ hasDbUrl: false, nodeEnv: "development", isTest: false }),
    ).toBe("memory")
  })

  it("always uses memory in tests", () => {
    expect(resolveStorageMode({ hasDbUrl: true, nodeEnv: "production", isTest: true })).toBe(
      "memory",
    )
  })
})

describe("calendar store", () => {
  beforeEach(() => {
    resetCalendarStoreForTests()
  })

  it("saves November then December without losing either month", async () => {
    await saveCalendar(
      { byDate: { "2026-11-01": [entry("November")] }, months: ["2026-11"] },
      "nov.xlsx",
    )
    await saveCalendar(
      { byDate: { "2026-12-01": [entry("December")] }, months: ["2026-12"] },
      "dec.xlsx",
    )

    const snapshot = await loadCalendar()

    expect(snapshot.months).toEqual(["2026-11", "2026-12"])
    expect(snapshot.days["2026-11-01"][0].idea).toBe("November")
    expect(snapshot.days["2026-12-01"][0].idea).toBe("December")
    expect(snapshot.imports.map((item) => item.monthKey)).toEqual(["2026-12", "2026-11"])
  })

  it("replaces only the re-imported month", async () => {
    await saveCalendar(
      { byDate: { "2026-11-01": [entry("Old November")], "2026-11-02": [entry("Removed")] } },
      "nov-v1.xlsx",
    )
    await saveCalendar({ byDate: { "2026-12-01": [entry("December")] } }, "dec.xlsx")
    await saveCalendar({ byDate: { "2026-11-01": [entry("New November")] } }, "nov-v2.xlsx")

    const snapshot = await loadCalendar()

    expect(snapshot.days["2026-11-01"][0].idea).toBe("New November")
    expect(snapshot.days["2026-11-02"]).toBeUndefined()
    expect(snapshot.days["2026-12-01"][0].idea).toBe("December")
  })

  it("reports an empty declared month as skipped and keeps the saved month", async () => {
    await saveCalendar({ byDate: { "2026-11-01": [entry("November")] } }, "nov.xlsx")

    const result = await saveCalendar(
      { byDate: { "2026-11-01": [entry("November 2")] }, months: ["2026-11", "2026-12"] },
      "mixed.xlsx",
    )

    expect(result.savedMonths).toEqual(["2026-11"])
    expect(result.skippedMonths).toEqual(["2026-12"])
    expect((await loadCalendar()).days["2026-11-01"][0].idea).toBe("November 2")
  })
})
