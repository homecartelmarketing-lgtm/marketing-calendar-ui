import { read, utils } from "xlsx"
import { readFileSync, writeFileSync } from "fs"

const buf = readFileSync("data/Content-Calendar-5ea729.xlsx")
const wb = read(buf, { cellDates: true })

const DAY_COLS = [0, 4, 8, 12, 16, 20, 24]
const TYPES = new Set(["Feeds", "Reels", "Stories"])
const MONTH_SHEETS = ["July", "August", "September"]

function fmtTime(v) {
  if (v instanceof Date) {
    const h = v.getUTCHours()
    const m = v.getUTCMinutes()
    return `${h}:${String(m).padStart(2, "0")}`
  }
  return null
}

function isDayNumberRow(row) {
  let count = 0
  for (const c of DAY_COLS) {
    const v = row[c]
    if (typeof v === "number" && v >= 1 && v <= 31) count++
  }
  return count >= 2
}

function parseSheet(name) {
  const ws = wb.Sheets[name]
  const rows = utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true })

  // Find the month anchor date (first cell that is a Date).
  let anchor = null
  for (let r = 0; r < 10; r++) {
    const v = rows[r]?.[0]
    if (v instanceof Date) {
      anchor = v
      break
    }
  }
  if (!anchor) return null
  const year = anchor.getUTCFullYear()
  const month = anchor.getUTCMonth() // 0-based

  // Locate all day-number rows.
  const dayRows = []
  for (let r = 0; r < rows.length; r++) {
    if (isDayNumberRow(rows[r])) dayRows.push(r)
  }

  const days = {}

  for (let i = 0; i < dayRows.length; i++) {
    const startRow = dayRows[i]
    const endRow = i + 1 < dayRows.length ? dayRows[i + 1] : rows.length
    const numberRow = rows[startRow]

    for (const base of DAY_COLS) {
      const dayNum = numberRow[base]
      if (typeof dayNum !== "number" || dayNum < 1 || dayNum > 31) continue

      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
      const entries = []
      let currentType = null

      for (let r = startRow + 1; r < endRow; r++) {
        const row = rows[r]
        if (!row) continue
        const typeCell = row[base]
        const idea = row[base + 1]
        const time = row[base + 2]
        const status = row[base + 3]

        const typeStr = typeof typeCell === "string" ? typeCell.trim() : ""
        if (TYPES.has(typeStr)) currentType = typeStr

        const ideaStr = typeof idea === "string" ? idea.trim() : idea == null ? "" : String(idea)
        if (!ideaStr && !TYPES.has(typeStr)) continue
        if (!currentType) continue
        if (!ideaStr) continue

        entries.push({
          type: currentType,
          idea: ideaStr,
          time: fmtTime(time),
          status: typeof status === "string" ? status.trim() : null,
        })
      }

      if (entries.length) days[iso] = entries
    }
  }

  return { year, month, key: `${year}-${String(month + 1).padStart(2, "0")}`, days }
}

const result = { months: [], days: {} }
for (const name of MONTH_SHEETS) {
  const parsed = parseSheet(name)
  if (!parsed) continue
  result.months.push(parsed.key)
  Object.assign(result.days, parsed.days)
}

writeFileSync("lib/content-data.json", JSON.stringify(result, null, 2))
console.log("Months:", result.months)
console.log("Total days with content:", Object.keys(result.days).length)
console.log("Sample 2026-09-03:", JSON.stringify(result.days["2026-09-03"], null, 1))
console.log("Sample 2026-07-01:", JSON.stringify(result.days["2026-07-01"], null, 1))
