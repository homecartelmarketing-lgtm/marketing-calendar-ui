import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { parseContentWorkbook } from "@/lib/workbook"
import { parseContentCsv } from "@/lib/csv"
import { CONTENT_DAYS, CONTENT_MONTHS } from "@/lib/content"

describe("Calendar Content & Import Suite", () => {
  it("includes September and October 2026 in the pre-baked content-data.json", () => {
    expect(CONTENT_MONTHS).toContain("2026-09")
    expect(CONTENT_MONTHS).toContain("2026-10")

    // September has all 30 days
    for (let day = 1; day <= 30; day++) {
      const iso = `2026-09-${String(day).padStart(2, "0")}`
      expect(CONTENT_DAYS[iso]).toBeDefined()
      expect(CONTENT_DAYS[iso].length).toBeGreaterThan(0)
    }

    // October has all 31 days
    for (let day = 1; day <= 31; day++) {
      const iso = `2026-10-${String(day).padStart(2, "0")}`
      expect(CONTENT_DAYS[iso]).toBeDefined()
      expect(CONTENT_DAYS[iso].length).toBeGreaterThan(0)
    }
  })

  it("parses oct-calendar.xlsx workbook correctly across all 4 sheets", () => {
    const buffer = readFileSync("data/oct-calendar.xlsx").buffer
    const result = parseContentWorkbook(buffer)

    expect(result.months).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"])
    expect(result.dayCount).toBeGreaterThanOrEqual(120)

    // Check October 1
    const oct1 = result.byDate["2026-10-01"]
    expect(oct1).toBeDefined()
    expect(oct1.some((e) => e.type === "Reels" && e.idea.includes("Lights"))).toBe(true)

    // Check October 31
    const oct31 = result.byDate["2026-10-31"]
    expect(oct31).toBeDefined()
    expect(oct31.some((e) => e.type === "Feeds")).toBe(true)
  })

  it("parses standard columnar CSV with date, type, idea headers", () => {
    const csv = `date,type,idea,time
2026-10-05,Feeds,Collection Category,6:00
2026-10-05,Stories,CTA,13:00`

    const result = parseContentCsv(csv)
    expect(result.rowCount).toBe(2)
    expect(result.byDate["2026-10-05"]).toHaveLength(2)
    expect(result.byDate["2026-10-05"][0].idea).toBe("Collection Category")
  })

  it("parses 28-column grid CSV export cleanly", () => {
    const gridCsv = `,,,,,,,,,,,,,,,,,,,,,,,,,,,
October 2026,,,,,,,,,,,,,,,,,,,,,,,,,,,
SUN,,,,MON,,,,TUE,,,,WED,,,,THU,,,,FRI,,,,SAT,,,
,,,,,,,,,,,,,,,,1,,,,2,,,,3,,,
,,,,,,,,,,,,,,,,Feeds,NONE,N/A,N/A,Feeds,Product Showcase,14:00,To Do,Feeds,Collection Category,14:00,To Do
,,,,,,,,,,,,,,,,Stories,Day (D&N),1:00,To Do,Stories,CTA,13:00,To Do,Stories,CTA,13:00,To Do`

    const result = parseContentCsv(gridCsv)
    expect(result.rowCount).toBeGreaterThan(0)
    expect(result.byDate["2026-10-01"]).toBeDefined()
    expect(result.byDate["2026-10-02"]).toBeDefined()
    expect(result.byDate["2026-10-02"][0].idea).toBe("Product Showcase")
  })
})
