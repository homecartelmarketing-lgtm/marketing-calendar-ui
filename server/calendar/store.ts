import type { ContentEntry } from "@/lib/content"
import { monthsFromDays } from "@/lib/calendar-months"
import { executeSql, getDatabaseUrl } from "@/server/db/client"

export class CalendarStorageUnavailable extends Error {
  constructor() {
    super("Calendar storage is not configured. Set the database URL used by the scheduler.")
    this.name = "CalendarStorageUnavailable"
  }
}

export type CalendarImportMeta = {
  monthKey: string
  sourceFile: string
  importedAt: string
}

export type CalendarSnapshot = {
  months: string[]
  days: Record<string, ContentEntry[]>
  imports: CalendarImportMeta[]
}

export type CalendarSaveInput = {
  byDate: Record<string, ContentEntry[]>
  /** Months declared by the workbook, including sheets with no entries. */
  months?: string[]
}

export type CalendarSaveResult = {
  savedMonths: string[]
  skippedMonths: string[]
  importedAt: string
}

type StorageMode = "postgres" | "memory" | "unavailable"

export function resolveStorageMode(
  options: { hasDbUrl?: boolean; nodeEnv?: string; isTest?: boolean } = {},
): StorageMode {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV
  const isTest = options.isTest ?? (nodeEnv === "test" || Boolean(process.env.VITEST))
  if (isTest) return "memory"

  const hasDbUrl = options.hasDbUrl ?? Boolean(getDatabaseUrl())
  if (hasDbUrl) return "postgres"
  return nodeEnv === "production" ? "unavailable" : "memory"
}

type MemoryMonth = {
  monthKey: string
  year: number
  month: number
  days: Record<string, ContentEntry[]>
  sourceFile: string
  importedAt: string
}

const memoryMonths = new Map<string, MemoryMonth>()
let tableReady = false

export function resetCalendarStoreForTests(): void {
  memoryMonths.clear()
  tableReady = false
}

function requireMode(): StorageMode {
  const mode = resolveStorageMode()
  if (mode === "unavailable") throw new CalendarStorageUnavailable()
  return mode
}

async function ensureTable(): Promise<void> {
  if (tableReady) return
  await executeSql(
    `CREATE TABLE IF NOT EXISTS calendar_months (
       month_key   TEXT PRIMARY KEY,
       year        INTEGER NOT NULL,
       month       INTEGER NOT NULL,
       days        JSONB NOT NULL,
       source_file TEXT NOT NULL,
       imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  )
  tableReady = true
}

function parseDays(value: unknown): Record<string, ContentEntry[]> {
  if (!value) return {}
  if (typeof value === "string") return JSON.parse(value) as Record<string, ContentEntry[]>
  return value as Record<string, ContentEntry[]>
}

function splitMonthDays(
  byDate: Record<string, ContentEntry[]>,
  monthKey: string,
): Record<string, ContentEntry[]> {
  const days: Record<string, ContentEntry[]> = {}
  for (const [iso, entries] of Object.entries(byDate)) {
    if (iso.startsWith(`${monthKey}-`)) days[iso] = entries
  }
  return days
}

export async function loadCalendar(): Promise<CalendarSnapshot> {
  const mode = requireMode()

  if (mode === "memory") {
    const rows = [...memoryMonths.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    const days: Record<string, ContentEntry[]> = {}
    for (const row of rows) Object.assign(days, row.days)
    return {
      months: rows.map((row) => row.monthKey),
      days,
      imports: rows
        .map(({ monthKey, sourceFile, importedAt }) => ({ monthKey, sourceFile, importedAt }))
        .sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
    }
  }

  await ensureTable()
  const rows = await executeSql<{
    month_key: string
    days: unknown
    source_file: string
    imported_at: string | Date
  }>(
    `SELECT month_key, days, source_file, imported_at
       FROM calendar_months
      ORDER BY month_key ASC`,
  )

  const days: Record<string, ContentEntry[]> = {}
  for (const row of rows) Object.assign(days, parseDays(row.days))

  return {
    months: rows.map((row) => row.month_key),
    days,
    imports: rows
      .map((row) => ({
        monthKey: row.month_key,
        sourceFile: row.source_file,
        importedAt: new Date(row.imported_at).toISOString(),
      }))
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
  }
}

export async function saveCalendar(
  input: CalendarSaveInput,
  sourceFile: string,
): Promise<CalendarSaveResult> {
  const mode = requireMode()
  if (mode === "postgres") await ensureTable()

  const importedAt = new Date().toISOString()
  const declared = new Set<string>([...(input.months ?? []), ...monthsFromDays(input.byDate)])
  const savedMonths: string[] = []
  const skippedMonths: string[] = []

  for (const monthKey of [...declared].sort()) {
    const parts = /^(\d{4})-(\d{2})$/.exec(monthKey)
    const monthDays = splitMonthDays(input.byDate, monthKey)
    if (!parts || Object.keys(monthDays).length === 0) {
      skippedMonths.push(monthKey)
      continue
    }

    const year = Number(parts[1])
    const month = Number(parts[2])

    if (mode === "memory") {
      memoryMonths.set(monthKey, { monthKey, year, month, days: monthDays, sourceFile, importedAt })
    } else {
      await executeSql(
        `INSERT INTO calendar_months (month_key, year, month, days, source_file, imported_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT (month_key) DO UPDATE SET
           year = EXCLUDED.year,
           month = EXCLUDED.month,
           days = EXCLUDED.days,
           source_file = EXCLUDED.source_file,
           imported_at = EXCLUDED.imported_at`,
        [monthKey, year, month, JSON.stringify(monthDays), sourceFile],
      )
    }

    savedMonths.push(monthKey)
  }

  return { savedMonths, skippedMonths, importedAt }
}
