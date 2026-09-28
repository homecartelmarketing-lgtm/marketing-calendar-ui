import { read, utils } from "xlsx"
import type { ContentEntry, ContentType } from "@/lib/content"
import { MONTH_NAMES } from "@/lib/calendar-data"
import { parseGridRows } from "@/lib/workbook"

const VALID_TYPES: ContentType[] = ["Feeds", "Reels", "Stories"]

/** Split a single CSV line honoring double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((v) => v.trim())
}

function normalizeType(value: string): ContentType | null {
  const match = VALID_TYPES.find((t) => t.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

export type CsvImportResult = {
  /** Entries grouped by ISO date when the CSV includes a `date` column. */
  byDate: Record<string, ContentEntry[]>
  /** Rows without a date column, applied to the currently open day. */
  loose: ContentEntry[]
  rowCount: number
}

/**
 * Parse a content-calendar CSV. Supports both:
 * 1. Standard columnar CSV with headers: date, type, idea, time, fixture, cid
 * 2. Exported 7-column weekday grid CSV mirroring the printed calendar sheets
 */
export function parseContentCsv(text: string): CsvImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const result: CsvImportResult = { byDate: {}, loose: [], rowCount: 0 }
  if (lines.length === 0) return result

  // 1. Check if the CSV is a calendar grid (e.g. exported sheet from Excel)
  const firstHeader = splitLine(lines[0]).map((h) => h.toLowerCase())
  const isColumnar =
    firstHeader.includes("type") &&
    (firstHeader.includes("idea") || firstHeader.includes("title") || firstHeader.includes("date"))

  if (!isColumnar) {
    try {
      const wb = read(text, { type: "string" })
      const sheetName = wb.SheetNames[0]
      if (sheetName) {
        const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
          header: 1,
          defval: null,
        })

        // Detect month and year from top rows
        let detectedMonth: number | null = null
        let detectedYear = 2026
        for (const row of rows.slice(0, 10)) {
          for (const cell of (row as unknown[]) || []) {
            if (typeof cell === "string") {
              for (let i = 0; i < MONTH_NAMES.length; i++) {
                if (cell.toLowerCase().includes(MONTH_NAMES[i].toLowerCase())) {
                  detectedMonth = i
                }
              }
              const ym = cell.match(/\b(20\d\d)\b/)
              if (ym) detectedYear = parseInt(ym[1], 10)
            }
          }
        }

        if (detectedMonth !== null) {
          const count = parseGridRows(rows, detectedYear, detectedMonth, result.byDate)
          if (count > 0) {
            result.rowCount = count
            return result
          }
        }
      }
    } catch {
      // Fall back to columnar parsing below
    }
  }

  // 2. Standard columnar parsing
  const header = splitLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const di = idx("date")
  const ti = idx("type")
  const ii = idx("idea")
  const tmi = idx("time")
  const fi = idx("fixture")
  const ci = idx("cid")

  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r])
    const type = normalizeType(ti >= 0 ? cols[ti] ?? "" : "")
    const idea = ii >= 0 ? cols[ii] ?? "" : ""
    if (!type || !idea) continue

    const entry: ContentEntry = {
      type,
      idea,
      time: tmi >= 0 && cols[tmi] ? cols[tmi] : null,
      status: null,
      fixture: fi >= 0 && cols[fi] ? cols[fi] : undefined,
      cid: ci >= 0 && cols[ci] ? cols[ci] : undefined,
    }

    const dateVal = di >= 0 ? cols[di] : ""
    if (dateVal) {
      const iso = normalizeDate(dateVal)
      if (iso) {
        ;(result.byDate[iso] ??= []).push(entry)
        result.rowCount++
        continue
      }
    }
    result.loose.push(entry)
    result.rowCount++
  }

  return result
}

/** Accept YYYY-MM-DD or M/D/YYYY and return an ISO YYYY-MM-DD string. */
function normalizeDate(value: string): string | null {
  const v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, m, d, y] = slash
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}
