import rawData from "@/lib/content-data.json"

export type ContentType = "Feeds" | "Reels" | "Stories"

export type ContentEntry = {
  type: ContentType
  idea: string
  time: string | null
  status: string | null
  fixture?: string
  cid?: string
}

type ContentData = {
  months: string[]
  days: Record<string, ContentEntry[]>
}

const data = rawData as ContentData

export const CONTENT_MONTHS = data.months

/** Entries keyed by ISO date (YYYY-MM-DD) as parsed from the workbook. */
export const CONTENT_DAYS: Record<string, ContentEntry[]> = data.days

export const CONTENT_TYPES: ContentType[] = ["Feeds", "Reels", "Stories"]

export const TYPE_TAG_STYLES: Record<ContentType, string> = {
  Feeds: "bg-blue-100 text-blue-600",
  Reels: "bg-orange-100 text-orange-500",
  Stories: "bg-green-100 text-green-600",
}

/** Product fixtures shown in the day-detail Fixture selector. */
export const FIXTURES: { name: string; className: string }[] = [
  { name: "Chandelier", className: "text-green-600" },
  { name: "Cluster Chandelier", className: "text-blue-500" },
  { name: "Floor Lamp", className: "text-orange-500" },
  { name: "Pendant Light", className: "text-red-500" },
  { name: "Table Lamp", className: "text-cyan-500" },
  { name: "Wall Light", className: "text-purple-500" },
]

/** Placeholder CID codes offered in the day-detail CID selector. */
export const CID_CODES: string[] = [
  "XXXX-XXXX-XX-01",
  "XXXX-XXXX-XX-02",
  "XXXX-XXXX-XX-03",
  "XXXX-XXXX-XX-04",
  "XXXX-XXXX-XX-05",
  "XXXX-XXXX-XX-06",
]

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function isRealIdea(idea: string): boolean {
  return idea.trim().toUpperCase() !== "NONE"
}

export const CATEGORY_DOT_STYLES: Record<ContentType, string> = {
  Feeds: "bg-[#eab308]",
  Reels: "bg-[#06b6d4]",
  Stories: "bg-[#10b981]",
}

export const STATUS_PILL_STYLES: Record<string, string> = {
  Posted: "bg-[#d1fae5] text-[#065f46]",
  Scheduled: "bg-[#cffafe] text-[#155e75]",
  Completed: "bg-[#ffedd5] text-[#9a3412]",
  Discard: "bg-[#ffe4e6] text-[#9f1239]",
  "For Manual": "bg-[#ccfbf1] text-[#115e59]",
  "N/A": "bg-neutral-100 text-neutral-400",
}

export type CalendarCell = {
  day: number | null
  iso: string | null
  types: ContentType[]
  entries: ContentEntry[]
}

/**
 * Build the grid for a month using the supplied day map (which may include
 * CSV-imported overrides), padding the leading/trailing blanks to full weeks.
 */
export function buildMonthCells(
  year: number,
  month: number,
  dayMap: Record<string, ContentEntry[]>,
): CalendarCell[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: CalendarCell[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, iso: null, types: [], entries: [] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoDate(year, month, d)
    const entries = dayMap[iso] ?? []
    const types = CONTENT_TYPES.filter((t) =>
      entries.some((e) => e.type === t && isRealIdea(e.idea)),
    )
    cells.push({ day: d, iso, types, entries })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, iso: null, types: [], entries: [] })
  }
  return cells
}

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${LONG_MONTHS[m - 1]} ${d}, ${y}`
}
