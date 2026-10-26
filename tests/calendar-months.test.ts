import { describe, expect, it } from "vitest"
import {
  latestMonth,
  mergeCalendarDays,
  monthsFromDays,
  monthKeyFromIso,
  pickImportTargetMonth,
} from "@/lib/calendar-months"
import type { ContentEntry } from "@/lib/content"

const entry = (idea: string): ContentEntry => ({
  type: "Feeds",
  idea,
  time: "14:00",
  status: "To Do",
})

const SEED_MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"]

describe("monthKeyFromIso", () => {
  it("returns the YYYY-MM prefix", () => {
    expect(monthKeyFromIso("2026-11-01")).toBe("2026-11")
  })
})

describe("monthsFromDays", () => {
  it("returns sorted unique month keys", () => {
    const days = {
      "2026-11-02": [entry("b")],
      "2026-11-01": [entry("a")],
      "2026-10-31": [entry("c")],
    }
    expect(monthsFromDays(days)).toEqual(["2026-10", "2026-11"])
  })
})

describe("latestMonth", () => {
  it("returns the newest month regardless of input order", () => {
    expect(latestMonth(["2026-10", "2027-01", "2026-11"])).toBe("2027-01")
  })

  it("returns null when there is no saved data", () => {
    expect(latestMonth([])).toBeNull()
  })
})

describe("pickImportTargetMonth", () => {
  it("opens November when the workbook adds it", () => {
    expect(
      pickImportTargetMonth(
        ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"],
        SEED_MONTHS,
      ),
    ).toBe("2026-11")
  })

  it("opens December", () => {
    expect(
      pickImportTargetMonth(
        ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"],
        [...SEED_MONTHS, "2026-11"],
      ),
    ).toBe("2026-12")
  })

  it("opens January 2027", () => {
    expect(
      pickImportTargetMonth(
        ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"],
        [...SEED_MONTHS, "2026-11", "2026-12"],
      ),
    ).toBe("2027-01")
  })

  it("falls back to the latest imported month when nothing is new", () => {
    expect(
      pickImportTargetMonth(["2026-07", "2026-08", "2026-09", "2026-10"], SEED_MONTHS),
    ).toBe("2026-10")
  })

  it("normalizes duplicate and unsorted input", () => {
    expect(pickImportTargetMonth(["2026-11", "2026-11", "2026-10"], SEED_MONTHS)).toBe(
      "2026-11",
    )
  })

  it("returns null for an empty import", () => {
    expect(pickImportTargetMonth([], SEED_MONTHS)).toBeNull()
  })
})

describe("mergeCalendarDays", () => {
  it("replaces seed dates for saved months and keeps other months", () => {
    const seed = {
      "2026-10-01": [entry("Old October")],
      "2026-09-01": [entry("Seed September")],
    }
    const saved = {
      "2026-10-01": [entry("New October")],
      "2026-11-01": [entry("November")],
    }

    const merged = mergeCalendarDays(seed, ["2026-10", "2026-11"], saved)

    expect(merged["2026-10-01"][0].idea).toBe("New October")
    expect(merged["2026-09-01"][0].idea).toBe("Seed September")
    expect(merged["2026-11-01"][0].idea).toBe("November")
  })

  it("drops seed dates in a saved month that the snapshot no longer contains", () => {
    const seed = {
      "2026-10-01": [entry("Old")],
      "2026-10-02": [entry("Old 2")],
    }

    const merged = mergeCalendarDays(seed, ["2026-10"], {
      "2026-10-01": [entry("New")],
    })

    expect(merged["2026-10-02"]).toBeUndefined()
  })
})
