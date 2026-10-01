import { SSF, read, utils } from "xlsx"
import { readFileSync, writeFileSync } from "fs"

// Raw serials (no cellDates): SheetJS builds Dates from the machine timezone, which
// shifted every time by the UTC offset. Keep this in sync with lib/workbook.ts.
const buf = readFileSync(process.argv[2] ?? "data/oct-calendar.xlsx")
const wb = read(buf, { cellDates: false })

const DAY_COLS = [0, 4, 8, 12, 16, 20, 24]
const CONTENT_TYPES = ["Feeds", "Reels", "Stories"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]
const MONTH_SHEETS = ["July", "August", "September", "October"]

function normalizeType(value) {
  if (value == null) return null
  const s = String(value).trim().toLowerCase()
  return CONTENT_TYPES.find((t) => t.toLowerCase() === s) ?? null
}

function fmtTime(v) {
  if (typeof v === "number" && v >= 0 && v < 1) {
    const minutes = Math.round(v * 1440) % 1440
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
  }
  return null
}

// The real schedule state lives in Airtable, never in the planned slot.
function normStatus(v) {
  if (v == null) return null
  const s = String(v).trim()
  return /^scheduled/i.test(s) ? "To Do" : s
}

function parseSheet(name) {
  const ws = wb.Sheets[name]
  if (!ws) return null

  const monthIdx = MONTH_NAMES.indexOf(name.trim())
  if (monthIdx < 0) return null

  const rows = utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true })

  // Find the year from header rows, fallback to 2026
  let year = 2026
  for (const row of rows.slice(0, 10)) {
    for (const cell of (row || [])) {
      if (typeof cell === "number" && cell > 40000 && cell < 80000) {
        year = SSF.parse_date_code(cell).y
        break
      }
    }
  }

  const days = {}

  for (const base of DAY_COLS) {
    let currentDay = null
    let lastType = null

    for (const row of rows) {
      if (!row) continue
      const head = row[base]
      const idea = row[base + 1]
      const time = row[base + 2]
      const status = row[base + 3]

      // A day number row has an integer day in head and null in other columns
      if (
        typeof head === "number" &&
        Number.isInteger(head) &&
        head >= 1 &&
        head <= 31 &&
        idea == null &&
        time == null &&
        status == null
      ) {
        currentDay = head
        lastType = null
        continue
      }

      if (idea == null || currentDay == null) continue

      const entryType = normalizeType(head) ?? lastType
      if (!entryType) continue
      lastType = entryType

      const ideaStr = String(idea).trim()
      if (!ideaStr) continue

      const iso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`
      ;(days[iso] ??= []).push({
        type: entryType,
        idea: ideaStr,
        time: fmtTime(time),
        status: normStatus(status),
      })
    }
  }

  const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`
  return { year, month: monthIdx, key: monthKey, days }
}

const result = { months: [], days: {} }
for (const name of MONTH_SHEETS) {
  const parsed = parseSheet(name)
  if (!parsed) continue
  result.months.push(parsed.key)
  Object.assign(result.days, parsed.days)
}
// Chronological day keys (the weekday-block scan otherwise groups them by weekday).
result.days = Object.fromEntries(Object.entries(result.days).sort(([a], [b]) => a.localeCompare(b)))

writeFileSync("lib/content-data.json", JSON.stringify(result, null, 2))
console.log("Parsed months:", result.months)
console.log("Total days with content:", Object.keys(result.days).length)
console.log("September days count:", Object.keys(result.days).filter(k => k.startsWith("2026-09")).length)
console.log("October days count:", Object.keys(result.days).filter(k => k.startsWith("2026-10")).length)
console.log("Sample 2026-09-01:", result.days["2026-09-01"])
console.log("Sample 2026-10-01:", result.days["2026-10-01"])
console.log("Sample 2026-10-31:", result.days["2026-10-31"])
