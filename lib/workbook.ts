import { read, utils } from "xlsx"
import { CONTENT_TYPES, type ContentEntry, type ContentType } from "@/lib/content"
import { MONTH_NAMES } from "@/lib/calendar-data"

/**
 * The uploaded content-calendar workbook mirrors the printed calendar: each
 * month is its own sheet laid out as a 7-column week grid. Every weekday
 * occupies a block of 4 spreadsheet columns — [type, idea, time, status] —
 * so the seven weekday blocks start at these column offsets.
 */
const WEEKDAY_BASES = [0, 4, 8, 12, 16, 20, 24]

export type WorkbookImportResult = {
  /** Entries keyed by ISO date (YYYY-MM-DD), across every month sheet. */
  byDate: Record<string, ContentEntry[]>
  /** Imported months as `YYYY-MM`, in sheet order. */
  months: string[]
  /** Number of distinct dates that received at least one entry. */
  dayCount: number
}

function normalizeType(value: unknown): ContentType | null {
  if (value == null) return null
  const s = String(value).trim().toLowerCase()
  return CONTENT_TYPES.find((t) => t.toLowerCase() === s) ?? null
}

/** Excel stores times as a Date anchored to 1899-12-31 in UTC. */
function formatTime(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getUTCHours()}:${String(value.getUTCMinutes()).padStart(2, "0")}`
  }
  return null
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Parse a content-calendar workbook (`.xlsx`) into entries keyed by ISO date.
 * Sheets whose names are not month names (e.g. "Auto Compute", "Caption") are
 * ignored. The year is read from the date marker cell near the top of each
 * month sheet.
 */
export function parseContentWorkbook(data: ArrayBuffer): WorkbookImportResult {
  const wb = read(new Uint8Array(data), { type: "array", cellDates: true })
  const byDate: Record<string, ContentEntry[]> = {}
  const months: string[] = []

  for (const name of wb.SheetNames) {
    const monthIdx = MONTH_NAMES.indexOf(name.trim())
    if (monthIdx < 0) continue

    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
    })

    // Derive the year from the first real date found in the header rows.
    let year: number | null = null
    for (const row of rows.slice(0, 5)) {
      for (const cell of row) {
        if (cell instanceof Date && cell.getUTCFullYear() > 1900) {
          year = cell.getUTCFullYear()
          break
        }
      }
      if (year) break
    }
    if (!year) continue
    months.push(`${year}-${String(monthIdx + 1).padStart(2, "0")}`)

    for (const base of WEEKDAY_BASES) {
      let currentDay: number | null = null
      let lastType: ContentType | null = null

      for (const row of rows) {
        const head = row[base]
        const idea = row[base + 1]
        const time = row[base + 2]
        const status = row[base + 3]

        // A day-number row carries only the day number in the block's first cell.
        if (
          typeof head === "number" &&
          Number.isInteger(head) &&
          idea == null &&
          time == null &&
          status == null
        ) {
          currentDay = head
          lastType = null
          continue
        }

        if (idea == null || currentDay == null) continue

        // A blank type cell means "same type as the row above" (merged group).
        const entryType: ContentType | null = normalizeType(head) ?? lastType
        if (!entryType) continue
        lastType = entryType

        const key = isoDate(year, monthIdx, currentDay)
        ;(byDate[key] ??= []).push({
          type: entryType,
          idea: String(idea).trim(),
          time: formatTime(time),
          status: status == null ? null : String(status).trim(),
        })
      }
    }
  }

  return { byDate, months, dayCount: Object.keys(byDate).length }
}
