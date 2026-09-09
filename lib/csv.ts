import type { ContentEntry, ContentType } from "@/lib/content"

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
 * Parse a content-calendar CSV. Recognized headers (case-insensitive):
 * date, type, idea, time, fixture, cid. `date` is optional — rows without a
 * date are returned in `loose` and applied to the open day.
 */
export function parseContentCsv(text: string): CsvImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const result: CsvImportResult = { byDate: {}, loose: [], rowCount: 0 }
  if (lines.length === 0) return result

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
