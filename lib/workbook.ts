import { SSF, read, utils } from "xlsx"
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

/**
 * Excel stores times as a fraction of a day. Read raw (`cellDates: false`) the
 * value is timezone-independent; a Date is only trustworthy for legacy callers,
 * and CSV exports give a string.
 */
export function formatTime(value: unknown): string | null {
  if (typeof value === "number") {
    if (!(value >= 0 && value < 1)) return null
    const minutes = Math.round(value * 1440) % 1440
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
  }
  if (value instanceof Date) {
    return `${value.getUTCHours()}:${String(value.getUTCMinutes()).padStart(2, "0")}`
  }
  if (typeof value === "string") {
    const m = value.match(/(\d{1,2}):(\d{2})/)
    if (m) return `${parseInt(m[1], 10)}:${m[2]}`
  }
  return null
}

/**
 * Sheet labels like "Scheduled (via UI)" are typed by hand; the real schedule
 * state lives in Airtable, so planned slots never carry a Scheduled status.
 */
export function normalizePlannedStatus(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return /^scheduled/i.test(s) ? "To Do" : s
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Parse grid rows laid out as 7 weekday column blocks into byDate entries.
 */
export function parseGridRows(
  rows: unknown[][],
  year: number,
  monthIdx: number,
  byDate: Record<string, ContentEntry[]>,
): number {
  let count = 0
  for (const base of WEEKDAY_BASES) {
    let currentDay: number | null = null
    let lastType: ContentType | null = null

    for (const row of rows) {
      if (!row) continue
      const head = row[base]
      const idea = row[base + 1]
      const time = row[base + 2]
      const status = row[base + 3]

      // A day-number row carries only the day number in the block's first cell.
      const headNum =
        typeof head === "number" && Number.isInteger(head)
          ? head
          : typeof head === "string" && /^\d{1,2}$/.test(head.trim())
          ? parseInt(head.trim(), 10)
          : null

      if (
        headNum != null &&
        headNum >= 1 &&
        headNum <= 31 &&
        idea == null &&
        time == null &&
        status == null
      ) {
        currentDay = headNum
        lastType = null
        continue
      }

      if (idea == null || currentDay == null) continue

      // A blank type cell means "same type as the row above" (merged group).
      const entryType: ContentType | null = normalizeType(head) ?? lastType
      if (!entryType) continue
      lastType = entryType

      const ideaStr = String(idea).trim()
      if (!ideaStr) continue

      const key = isoDate(year, monthIdx, currentDay)
      ;(byDate[key] ??= []).push({
        type: entryType,
        idea: ideaStr,
        time: formatTime(time),
        status: normalizePlannedStatus(status),
      })
      count++
    }
  }
  return count
}

/**
 * Parse a content-calendar workbook (`.xlsx`) into entries keyed by ISO date.
 * Sheets whose names are not month names (e.g. "Auto Compute", "Caption") are
 * ignored. The year is read from the date marker cell near the top of each
 * month sheet.
 */
export function parseContentWorkbook(data: ArrayBuffer): WorkbookImportResult {
  // Raw serials (no cellDates): SheetJS builds Dates from the machine timezone,
  // which shifted every time by the UTC offset (14:00 became 6:00 in Manila).
  const wb = read(new Uint8Array(data), { type: "array", cellDates: false })
  const byDate: Record<string, ContentEntry[]> = {}
  const months: string[] = []

  for (const name of wb.SheetNames) {
    const monthIdx = MONTH_NAMES.indexOf(name.trim())
    if (monthIdx < 0) continue

    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
    })

    // Derive the year from the first real date or 4-digit year found in the header rows.
    let year: number | null = null
    for (const row of rows.slice(0, 5)) {
      for (const cell of row) {
        // Header date marker arrives as an Excel serial (e.g. 46296 = 2026-10-01).
        if (typeof cell === "number" && cell > 40000 && cell < 80000) {
          const parsed = SSF.parse_date_code(cell)
          if (parsed?.y) {
            year = parsed.y
            break
          }
        }
        if (cell instanceof Date && cell.getUTCFullYear() > 1900) {
          year = cell.getUTCFullYear()
          break
        }
        if (typeof cell === "string") {
          const ym = cell.match(/\b(20\d\d)\b/)
          if (ym) {
            year = parseInt(ym[1], 10)
            break
          }
        }
      }
      if (year) break
    }
    if (!year) year = 2026
    months.push(`${year}-${String(monthIdx + 1).padStart(2, "0")}`)

    parseGridRows(rows, year, monthIdx, byDate)
  }

  return { byDate, months, dayCount: Object.keys(byDate).length }
}
