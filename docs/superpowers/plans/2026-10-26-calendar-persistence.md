# Content Calendar Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every uploaded calendar workbook the durable, month-generic source of truth for the Content Calendar.

**Architecture:** The browser uploads the file to a new `/api/calendar` route; the server parses it with the existing parsers and upserts one `calendar_months` row per imported month in Postgres. On page load the client fetches those months, replaces the seed data for those months, and opens the newest saved month. A pure helper chooses the month to open after an import without naming any month.

**Tech Stack:** Next.js 16.3.3 App Router route handlers, React 19, TypeScript 5.7, Vitest 5, `xlsx` 0.20.3, Postgres via `server/db/client.ts` (`postgres` or Neon HTTP).

**Spec:** [Content Calendar Persistence — Design](../specs/2026-10-26-calendar-persistence-design.md)

## Global Constraints

- Do not commit, push, merge, or deploy until the user explicitly approves. Local checkpoints may be prepared but not committed.
- Tests must never call a live database or provider. `tests/setup.ts` makes every unstubbed `fetch` throw.
- Do not change parser semantics in `lib/workbook.ts` or `lib/csv.ts` (times, weekday blocks, `Scheduled` → `To Do`).
- Preserve the existing calendar, gallery, modal, and header layout.
- Only exact English month sheet names (`November`, not `Nov 2026`) are recognized.
- Upload cap is 4 MiB (`4 * 1024 * 1024` bytes).
- Production without a database URL must fail with HTTP 503; never report a save that did not happen.
- No tokens, `.env` values, authorization headers, or raw provider errors in responses, commits, or docs.

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/calendar-months.ts` (create) | Pure month/merge helpers shared by the API and the client |
| `server/calendar/store.ts` (create) | Postgres/memory persistence for `calendar_months` |
| `app/api/calendar/route.ts` (create) | `GET` snapshot, `POST` upload → parse → save |
| `server/db/schema.sql` (modify) | Declare `calendar_months` |
| `components/content-calendar.tsx` (modify) | Load saved months, persist imports, generic month selection |
| `components/calendar-nav.tsx` (modify) | Disable Import while the saved calendar is loading |
| `scripts/parse-calendar.mjs` (modify) | Detect every month sheet instead of a fixed list |
| `tests/calendar-months.test.ts` (create) | Month selection and merge tests |
| `tests/calendar-store.test.ts` (create) | Upsert, replace-by-month, storage-mode tests |
| `tests/calendar-api.test.ts` (create) | Upload GET/POST behavior with generated workbooks |
| `docs/troubleshooting/calendar-import-timezone.md` (modify) | Note the new runtime data source |
| `docs/architecture/system-blueprint.md` (modify) | Record the calendar import flow |
| `docs/README.md` (modify) | Link this plan and its spec |
| `docs/daily-logs/2026-10-26.md` (create) | Session record |

---

### Task 1: Pure month helpers

**Files:**
- Create: `lib/calendar-months.ts`
- Test: `tests/calendar-months.test.ts`

**Interfaces:**
- Consumes: `ContentEntry` from `@/lib/content` (type only).
- Produces:
  - `monthKeyFromIso(iso: string): string`
  - `monthsFromDays(days: Record<string, ContentEntry[]>): string[]`
  - `latestMonth(months: string[]): string | null`
  - `pickImportTargetMonth(importedMonths: string[], knownMonths: Iterable<string>): string | null`
  - `mergeCalendarDays(seedDays, savedMonths, savedDays): Record<string, ContentEntry[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/calendar-months.test.ts`:

```ts
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
      pickImportTargetMonth(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"], [
        ...SEED_MONTHS,
        "2026-11",
      ]),
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
    expect(pickImportTargetMonth(["2026-07", "2026-08", "2026-09", "2026-10"], SEED_MONTHS)).toBe(
      "2026-10",
    )
  })

  it("normalizes duplicate and unsorted input", () => {
    expect(
      pickImportTargetMonth(["2026-11", "2026-11", "2026-10"], SEED_MONTHS),
    ).toBe("2026-11")
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calendar-months.test.ts`

Expected: FAIL because `@/lib/calendar-months` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/calendar-months.ts`:

```ts
import type { ContentEntry } from "@/lib/content"

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7)
}

export function monthsFromDays(days: Record<string, ContentEntry[]>): string[] {
  const months = new Set<string>()
  for (const iso of Object.keys(days)) months.add(monthKeyFromIso(iso))
  return [...months].sort()
}

export function latestMonth(months: string[]): string | null {
  if (months.length === 0) return null
  return [...months].sort()[months.length - 1]
}

/**
 * Choose the month to open after an import. Prefer the earliest month the
 * calendar has never seen; otherwise fall back to the latest imported month.
 * No month name is hard-coded.
 */
export function pickImportTargetMonth(
  importedMonths: string[],
  knownMonths: Iterable<string>,
): string | null {
  const sorted = [...new Set(importedMonths)].sort()
  if (sorted.length === 0) return null
  const known = new Set(knownMonths)
  return sorted.find((month) => !known.has(month)) ?? sorted[sorted.length - 1]
}

/**
 * Saved months are authoritative: remove every seed date in a saved month
 * before overlaying the snapshot, so an entry deleted from the workbook really
 * disappears. Months with no snapshot keep the seed.
 */
export function mergeCalendarDays(
  seedDays: Record<string, ContentEntry[]>,
  savedMonths: string[],
  savedDays: Record<string, ContentEntry[]>,
): Record<string, ContentEntry[]> {
  const saved = new Set(savedMonths)
  const merged: Record<string, ContentEntry[]> = {}
  for (const [iso, entries] of Object.entries(seedDays)) {
    if (!saved.has(monthKeyFromIso(iso))) merged[iso] = entries
  }
  for (const [iso, entries] of Object.entries(savedDays)) {
    merged[iso] = entries
  }
  return merged
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calendar-months.test.ts`

Expected: PASS (all tests).

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck`

Expected: PASS. Do not commit yet.

---

### Task 2: Postgres store and schema

**Files:**
- Modify: `server/db/schema.sql`
- Create: `server/calendar/store.ts`
- Test: `tests/calendar-store.test.ts`

**Interfaces:**
- Consumes: `monthKeyFromIso`, `monthsFromDays` from Task 1; `executeSql`, `getDatabaseUrl` from `@/server/db/client`.
- Produces:
  - `CalendarStorageUnavailable`
  - `resolveStorageMode(options?): "postgres" | "memory" | "unavailable"`
  - `loadCalendar(): Promise<CalendarSnapshot>`
  - `saveCalendar(input: CalendarSaveInput, sourceFile: string): Promise<CalendarSaveResult>`
  - `resetCalendarStoreForTests(): void`
  - Types `CalendarSnapshot`, `CalendarImportMeta`, `CalendarSaveInput`, `CalendarSaveResult`

- [ ] **Step 1: Write the failing test**

Create `tests/calendar-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import {
  loadCalendar,
  resetCalendarStoreForTests,
  resolveStorageMode,
  saveCalendar,
} from "@/server/calendar/store"
import type { ContentEntry } from "@/lib/content"

const entry = (idea: string): ContentEntry => ({
  type: "Feeds",
  idea,
  time: "14:00",
  status: "To Do",
})

describe("resolveStorageMode", () => {
  it("uses Postgres when a database URL exists", () => {
    expect(
      resolveStorageMode({ hasDbUrl: true, nodeEnv: "production", isTest: false }),
    ).toBe("postgres")
  })

  it("fails closed in production without a database URL", () => {
    expect(
      resolveStorageMode({ hasDbUrl: false, nodeEnv: "production", isTest: false }),
    ).toBe("unavailable")
  })

  it("uses memory in development without a database URL", () => {
    expect(
      resolveStorageMode({ hasDbUrl: false, nodeEnv: "development", isTest: false }),
    ).toBe("memory")
  })

  it("always uses memory in tests", () => {
    expect(resolveStorageMode({ hasDbUrl: true, nodeEnv: "production", isTest: true })).toBe(
      "memory",
    )
  })
})

describe("calendar store", () => {
  beforeEach(() => {
    resetCalendarStoreForTests()
  })

  it("saves November then December without losing either month", async () => {
    await saveCalendar(
      { byDate: { "2026-11-01": [entry("November")] }, months: ["2026-11"] },
      "nov.xlsx",
    )
    await saveCalendar(
      { byDate: { "2026-12-01": [entry("December")] }, months: ["2026-12"] },
      "dec.xlsx",
    )

    const snapshot = await loadCalendar()

    expect(snapshot.months).toEqual(["2026-11", "2026-12"])
    expect(snapshot.days["2026-11-01"][0].idea).toBe("November")
    expect(snapshot.days["2026-12-01"][0].idea).toBe("December")
    expect(snapshot.imports.map((item) => item.monthKey)).toEqual(["2026-12", "2026-11"])
  })

  it("replaces only the re-imported month", async () => {
    await saveCalendar(
      { byDate: { "2026-11-01": [entry("Old November")], "2026-11-02": [entry("Removed")] } },
      "nov-v1.xlsx",
    )
    await saveCalendar(
      { byDate: { "2026-12-01": [entry("December")] } },
      "dec.xlsx",
    )
    await saveCalendar(
      { byDate: { "2026-11-01": [entry("New November")] } },
      "nov-v2.xlsx",
    )

    const snapshot = await loadCalendar()

    expect(snapshot.days["2026-11-01"][0].idea).toBe("New November")
    expect(snapshot.days["2026-11-02"]).toBeUndefined()
    expect(snapshot.days["2026-12-01"][0].idea).toBe("December")
  })

  it("reports an empty declared month as skipped and keeps the saved month", async () => {
    await saveCalendar({ byDate: { "2026-11-01": [entry("November")] } }, "nov.xlsx")

    const result = await saveCalendar(
      { byDate: { "2026-11-01": [entry("November 2")] }, months: ["2026-11", "2026-12"] },
      "mixed.xlsx",
    )

    expect(result.savedMonths).toEqual(["2026-11"])
    expect(result.skippedMonths).toEqual(["2026-12"])
    expect((await loadCalendar()).days["2026-11-01"][0].idea).toBe("November 2")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calendar-store.test.ts`

Expected: FAIL because `@/server/calendar/store` does not exist.

- [ ] **Step 3: Add the table to the schema**

Append to `server/db/schema.sql`:

```sql
-- Imported Content Calendar, one row per month. An import replaces the whole
-- row for every month it contains; months absent from the upload are untouched.
CREATE TABLE IF NOT EXISTS calendar_months (
  month_key   TEXT PRIMARY KEY,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  days        JSONB NOT NULL,
  source_file TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Write the store**

Create `server/calendar/store.ts`:

```ts
import type { ContentEntry } from "@/lib/content"
import { monthKeyFromIso, monthsFromDays } from "@/lib/calendar-months"
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/calendar-store.test.ts`

Expected: PASS (all tests).

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck`

Expected: PASS. Do not commit yet.

---

### Task 3: Calendar API route

**Files:**
- Create: `app/api/calendar/route.ts`
- Test: `tests/calendar-api.test.ts`

**Interfaces:**
- Consumes: `parseContentWorkbook` (`@/lib/workbook`), `parseContentCsv` (`@/lib/csv`), `loadCalendar`/`saveCalendar`/`CalendarStorageUnavailable` from Task 2.
- Produces:
  - `GET(): Promise<NextResponse>`
  - `POST(request: NextRequest): Promise<NextResponse>`
  - `MAX_UPLOAD_BYTES = 4 * 1024 * 1024`

- [ ] **Step 1: Write the failing test**

Create `tests/calendar-api.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { utils, write } from "xlsx"
import { GET, MAX_UPLOAD_BYTES, POST } from "@/app/api/calendar/route"
import { resetCalendarStoreForTests } from "@/server/calendar/store"

function workbookFile(
  sheetName: string,
  dateSerial: number,
  day: number,
  idea: string,
): File {
  const rows: unknown[][] = []
  rows[2] = [dateSerial]
  rows[4] = [day]
  rows[5] = ["Feeds", idea, 14 / 24, "To Do"]

  const sheet = utils.aoa_to_sheet(rows)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, sheetName)
  const buffer = write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer

  return new File([buffer], `${sheetName}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function csvFile(name: string, text: string): File {
  return new File([text], name, { type: "text/csv" })
}

function postFile(file?: File): NextRequest {
  const form = new FormData()
  if (file) form.append("file", file)
  return new NextRequest("http://localhost/api/calendar", { method: "POST", body: form })
}

describe("calendar API", () => {
  beforeEach(() => {
    resetCalendarStoreForTests()
  })

  it("saves a November workbook and returns it on GET", async () => {
    const response = await POST(postFile(workbookFile("November", 46327, 1, "One Light at a Time")))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.savedMonths).toEqual(["2026-11"])
    expect(body.dayCount).toBe(1)

    const snapshot = await (await GET()).json()
    expect(snapshot.months).toEqual(["2026-11"])
    expect(snapshot.days["2026-11-01"][0].idea).toBe("One Light at a Time")
    expect(snapshot.imports[0].sourceFile).toBe("November.xlsx")
  })

  it("saves a January 2027 workbook without any code change", async () => {
    const response = await POST(postFile(workbookFile("January", 46388, 1, "New Year")))

    expect(response.status).toBe(200)
    expect((await response.json()).savedMonths).toEqual(["2027-01"])
  })

  it("persists a columnar CSV", async () => {
    const response = await POST(
      postFile(csvFile("december.csv", "date,type,idea,time\n2026-12-01,Feeds,Holiday,14:00")),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.savedMonths).toEqual(["2026-12"])
    expect(body.dayCount).toBe(1)
  })

  it("rejects a missing file", async () => {
    const response = await POST(postFile())
    expect(response.status).toBe(400)
  })

  it("rejects a workbook with no calendar entries", async () => {
    const response = await POST(postFile(workbookFile("November", 46327, 1, "")))
    expect(response.status).toBe(400)
  })

  it("rejects a CSV whose rows have no date", async () => {
    const response = await POST(postFile(csvFile("undated.csv", "date,type,idea\n,Feeds,Holiday")))
    expect(response.status).toBe(400)
  })

  it("rejects uploads larger than the cap", async () => {
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.xlsx")
    const response = await POST(postFile(oversized))
    expect(response.status).toBe(413)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calendar-api.test.ts`

Expected: FAIL because `@/app/api/calendar/route` does not exist.

- [ ] **Step 3: Write the route**

Create `app/api/calendar/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { parseContentCsv } from "@/lib/csv"
import { monthsFromDays } from "@/lib/calendar-months"
import { parseContentWorkbook } from "@/lib/workbook"
import {
  CalendarStorageUnavailable,
  loadCalendar,
  saveCalendar,
} from "@/server/calendar/store"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET() {
  try {
    const snapshot = await loadCalendar()
    return NextResponse.json({ success: true, ...snapshot })
  } catch (error) {
    if (error instanceof CalendarStorageUnavailable) {
      return failure(error.message, 503)
    }
    console.error("Failed to load the saved calendar")
    return failure("Unable to load the saved calendar", 500)
  }
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return failure("Send the calendar as multipart form data", 400)
  }

  const file = form.get("file")
  if (!file || typeof file === "string") {
    return failure("Attach an .xlsx, .xls, or .csv calendar file", 400)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return failure("That file is too large. The limit is 4 MB.", 413)
  }

  const fileName = file.name || "calendar"
  const isCsv = /\.csv$/i.test(fileName) || file.type === "text/csv"
  const isWorkbook = /\.(xlsx|xls)$/i.test(fileName)

  if (!isCsv && !isWorkbook) {
    return failure("Upload an .xlsx, .xls, or .csv calendar file", 400)
  }

  try {
    if (isCsv) {
      const parsed = parseContentCsv(await file.text())
      const dayCount = Object.keys(parsed.byDate).length
      if (dayCount === 0) {
        return failure("No dated rows found. Add a YYYY-MM-DD date to each CSV row.", 400)
      }

      const saved = await saveCalendar({ byDate: parsed.byDate }, fileName)
      return NextResponse.json({
        success: true,
        months: monthsFromDays(parsed.byDate),
        savedMonths: saved.savedMonths,
        skippedMonths: saved.skippedMonths,
        dayCount,
        ignoredRows: parsed.loose.length,
        importedAt: saved.importedAt,
        fileName,
      })
    }

    const parsed = parseContentWorkbook(await file.arrayBuffer())
    if (parsed.dayCount === 0) {
      return failure("No calendar data found in that workbook", 400)
    }

    const saved = await saveCalendar(parsed, fileName)
    return NextResponse.json({
      success: true,
      months: parsed.months,
      savedMonths: saved.savedMonths,
      skippedMonths: saved.skippedMonths,
      dayCount: parsed.dayCount,
      ignoredRows: 0,
      importedAt: saved.importedAt,
      fileName,
    })
  } catch (error) {
    if (error instanceof CalendarStorageUnavailable) {
      return failure(error.message, 503)
    }
    console.error("Failed to import the calendar")
    return failure("Couldn't import that calendar file", 500)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calendar-api.test.ts`

Expected: PASS (all tests). The empty-idea workbook must yield 0 entries: `parseGridRows` skips a blank idea.

- [ ] **Step 5: Checkpoint**

Run: `npx vitest run tests/calendar-api.test.ts tests/calendar-store.test.ts tests/calendar-months.test.ts`

Expected: PASS. Do not commit yet.

---

### Task 4: Wire the calendar UI

**Files:**
- Modify: `components/content-calendar.tsx`
- Modify: `components/calendar-nav.tsx`

**Interfaces:**
- Consumes: `CONTENT_MONTHS`, `CONTENT_DAYS`, `buildMonthCells`, `ContentEntry` from `@/lib/content`; `latestMonth`, `mergeCalendarDays`, `pickImportTargetMonth` from Task 1; `GET`/`POST` from Task 3 (`/api/calendar`).
- Produces: no new exports. The rendered calendar loads saved months and persists imports.

- [ ] **Step 1: Replace the imports and state in `components/content-calendar.tsx`**

Replace lines 13–16:

```ts
import { CONTENT_DAYS, buildMonthCells, type ContentEntry } from "@/lib/content"
import { parseContentCsv } from "@/lib/csv"
import { parseContentWorkbook } from "@/lib/workbook"
import type { ScheduledEntry } from "@/app/api/schedules/route"
```

with:

```ts
import {
  CONTENT_DAYS,
  CONTENT_MONTHS,
  buildMonthCells,
  type ContentEntry,
} from "@/lib/content"
import {
  latestMonth,
  mergeCalendarDays,
  pickImportTargetMonth,
} from "@/lib/calendar-months"
import type { ScheduledEntry } from "@/app/api/schedules/route"
```

Replace lines 25–28:

```ts
  // Imported content merged over the built-in workbook data, keyed by ISO date.
  const [overrides, setOverrides] = useState<Record<string, ContentEntry[]>>({})
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importError, setImportError] = useState(false)
```

with:

```ts
  // Months imported through the Studio, loaded from the calendar API.
  const [savedMonths, setSavedMonths] = useState<string[]>([])
  const [savedDays, setSavedDays] = useState<Record<string, ContentEntry[]>>({})
  const [calendarReady, setCalendarReady] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importError, setImportError] = useState(false)
```

- [ ] **Step 2: Load the saved calendar on mount**

Insert this effect immediately after the schedules effect that ends at line 61:

```ts
  // Load the durable calendar, then open the newest saved month. The seed stays
  // visible if storage is unavailable, so the page never renders empty.
  useEffect(() => {
    let cancelled = false

    async function loadSavedCalendar() {
      try {
        const response = await fetch("/api/calendar")
        const data = response.ok ? await response.json() : null
        if (!response.ok || !data?.success) throw new Error("calendar load failed")
        if (cancelled) return

        const months: string[] = Array.isArray(data.months) ? data.months : []
        setSavedMonths(months)
        setSavedDays(data.days && typeof data.days === "object" ? data.days : {})

        const newest = latestMonth(months)
        if (newest) {
          const [year, month] = newest.split("-").map(Number)
          if (year && month) setCurrent({ year, month: month - 1 })
        }
      } catch {
        if (!cancelled) {
          setImportError(true)
          setImportStatus("Saved calendar unavailable — showing the built-in schedule.")
        }
      } finally {
        if (!cancelled) setCalendarReady(true)
      }
    }

    loadSavedCalendar()
    return () => {
      cancelled = true
    }
  }, [])
```

- [ ] **Step 3: Replace the merge and import handler**

Replace line 63:

```ts
  const dayMap = useMemo(() => ({ ...CONTENT_DAYS, ...overrides }), [overrides])
```

with:

```ts
  const dayMap = useMemo(
    () => mergeCalendarDays(CONTENT_DAYS, savedMonths, savedDays),
    [savedMonths, savedDays],
  )
```

Replace lines 87–135 (the `mergeByDate` helper and `handleImportFile`) with:

```ts
  function formatImportDate(value: unknown): string {
    if (typeof value !== "string") return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  async function handleImportFile(file: File) {
    if (!calendarReady) return
    setImportError(false)
    setImportStatus("Importing calendar...")

    // Capture what we knew before the upload so the newly imported month wins.
    const knownMonths = new Set<string>([...CONTENT_MONTHS, ...savedMonths])

    try {
      const form = new FormData()
      form.append("file", file)

      const response = await fetch("/api/calendar", { method: "POST", body: form })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        setImportError(true)
        setImportStatus(result?.error ?? "Couldn't import that file. Try again.")
        return
      }

      const refreshed = await fetch("/api/calendar")
      if (!refreshed.ok) {
        setImportError(true)
        setImportStatus("Imported, but the calendar could not refresh. Reload the page.")
        return
      }
      const snapshot = await refreshed.json().catch(() => null)
      if (!snapshot?.success) {
        setImportError(true)
        setImportStatus("Imported, but the calendar could not refresh. Reload the page.")
        return
      }

      setSavedMonths(Array.isArray(snapshot.months) ? snapshot.months : [])
      setSavedDays(snapshot.days && typeof snapshot.days === "object" ? snapshot.days : {})

      const savedMonthsResult: string[] = Array.isArray(result.savedMonths)
        ? result.savedMonths
        : []
      const target = pickImportTargetMonth(savedMonthsResult, knownMonths)
      if (target) {
        const [year, month] = target.split("-").map(Number)
        if (year && month) setCurrent({ year, month: month - 1 })
      }

      const dayCount = Number(result.dayCount) || 0
      const monthCount = savedMonthsResult.length
      const targetLabel = target
        ? `${MONTH_NAMES[Number(target.slice(5, 7)) - 1]} ${target.slice(0, 4)}`
        : ""
      const importedAt = Array.isArray(snapshot.imports) ? snapshot.imports[0]?.importedAt : null
      const importedLabel = importedAt ? `huling import ${formatImportDate(importedAt)}` : ""
      const ignored = Number(result.ignoredRows) > 0
        ? ` · ${result.ignoredRows} undated row${Number(result.ignoredRows) === 1 ? "" : "s"} ignored`
        : ""

      setImportStatus(
        [
          `Imported ${dayCount} day${dayCount === 1 ? "" : "s"} across ${monthCount} month${monthCount === 1 ? "" : "s"}`,
          targetLabel,
          importedLabel,
        ]
          .filter(Boolean)
          .join(" · ") + ignored,
      )
    } catch {
      setImportError(true)
      setImportStatus("Couldn't import that file. Check your connection and try again.")
    }
  }
```

- [ ] **Step 4: Disable Import until the saved calendar has loaded**

In `components/content-calendar.tsx`, add the prop to `<CalendarNav>`:

```tsx
      <CalendarNav
        onImportFile={handleImportFile}
        importStatus={importStatus}
        importError={importError}
        onDismissStatus={() => setImportStatus(null)}
        importDisabled={!calendarReady}
        activeContent={selectedContent}
        onSelectContent={(category, type) => setSelectedContent({ category, type })}
        onBackToCalendar={() => setSelectedContent(null)}
      />
```

In `components/calendar-nav.tsx`, add the optional prop to the parameter object and its type:

```tsx
  onDismissStatus,
  importDisabled = false,
  activeContent,
  onSelectContent,
  onBackToCalendar,
}: {
  onImportFile: (file: File) => void
  importStatus?: string | null
  importError?: boolean
  onDismissStatus?: () => void
  importDisabled?: boolean
  activeContent?: ActiveContent | null
  onSelectContent?: (category: "Feeds" | "Stories" | "Reels", type: string) => void
  onBackToCalendar?: () => void
})
```

Then set `disabled` on the hidden input and the Import button:

```tsx
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv"
          className="hidden"
          disabled={importDisabled}
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importDisabled}
          className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
        >
```

Add `title={importStatus}` to the status wrapper so the truncated text is readable:

```tsx
          <div
            title={importStatus}
            className={`flex max-w-[220px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shadow-lg ${
```

- [ ] **Step 5: Verify the UI compiles and the old hard-codes are gone**

Run: `npm run typecheck`

Expected: PASS.

Run: `git grep -n -E "2026-10|parseContentWorkbook|parseContentCsv|overrides" -- components/content-calendar.tsx`

Expected: no output.

- [ ] **Step 6: Checkpoint**

Run: `npm test`

Expected: PASS. Do not commit yet.

---

### Task 5: Remove the fixed month list from the seed script

**Files:**
- Modify: `scripts/parse-calendar.mjs`

**Interfaces:**
- Consumes: existing `parseSheet(name)` and `MONTH_NAMES`.
- Produces: `lib/content-data.json` can be regenerated from a workbook containing any month sheets.

- [ ] **Step 1: Replace the fixed list**

Delete line 15:

```js
const MONTH_SHEETS = ["July", "August", "September", "October"]
```

Replace the loop at lines 109–115:

```js
const result = { months: [], days: {} }
for (const name of MONTH_SHEETS) {
  const parsed = parseSheet(name)
  if (!parsed) continue
  result.months.push(parsed.key)
  Object.assign(result.days, parsed.days)
}
```

with:

```js
const result = { months: [], days: {} }
// Every sheet named after a month is collected; no fixed month list.
for (const name of wb.SheetNames) {
  const parsed = parseSheet(name)
  if (!parsed) continue
  result.months.push(parsed.key)
  Object.assign(result.days, parsed.days)
}
```

Replace the fixed-count console lines 122–123:

```js
console.log("September days count:", Object.keys(result.days).filter(k => k.startsWith("2026-09")).length)
console.log("October days count:", Object.keys(result.days).filter(k => k.startsWith("2026-10")).length)
```

with:

```js
for (const month of result.months) {
  console.log(`${month} days count:`, Object.keys(result.days).filter(k => k.startsWith(`${month}-`)).length)
}
```

- [ ] **Step 2: Verify the script still parses the existing workbook**

Run:

```bash
cp lib/content-data.json /tmp/content-data.before.json
node scripts/parse-calendar.mjs data/oct-calendar.xlsx
diff /tmp/content-data.before.json lib/content-data.json
mv /tmp/content-data.before.json lib/content-data.json
```

Expected console output includes `Parsed months: [ '2026-07', '2026-08', '2026-09', '2026-10' ]` and a days count per month. `diff` must report no differences; the restore step keeps the seed file byte-identical.

- [ ] **Step 3: Checkpoint**

Run: `npx vitest run tests/calendar-import.test.ts`

Expected: PASS. Do not commit yet.

---

### Task 6: Documentation, daily log, and full verification

**Files:**
- Modify: `docs/troubleshooting/calendar-import-timezone.md`
- Modify: `docs/architecture/system-blueprint.md`
- Modify: `docs/README.md`
- Create: `docs/daily-logs/2026-10-26.md`

**Interfaces:**
- Consumes: behavior implemented in Tasks 1–5.
- Produces: documentation that names the runtime source of truth and records verification evidence.

- [ ] **Step 1: Update the timezone troubleshooting note**

Append to `docs/troubleshooting/calendar-import-timezone.md`:

```md
## Runtime source of truth (2026-10-26)

Uploaded workbooks are now parsed on the server and stored per month in the
`calendar_months` Postgres table. `lib/content-data.json` is only the seed for
months that have never been imported; it is no longer updated by monthly
uploads, and `scripts/parse-calendar.mjs` is a build-time seed tool only.

Re-importing a month replaces that entire month. Other saved months are
untouched. The timezone rules above still apply because `lib/workbook.ts` and
`lib/csv.ts` were not changed.
```

- [ ] **Step 2: Record the flow in the architecture blueprint**

Append to `docs/architecture/system-blueprint.md`:

```md
### Content Calendar import (`/api/calendar`)

* **POST**: multipart upload (`.xlsx`, `.xls`, or `.csv`) → existing parser →
  one `calendar_months` upsert per imported month. Returns saved and skipped
  months plus the day count.
* **GET**: returns saved months, their entries, and import metadata.
* **Client**: merges saved months over `lib/content-data.json`, opens the newest
  saved month on load, and after an import opens the earliest newly imported
  month (falling back to the latest imported month). No month name is hard-coded.
* **Failure**: production without a database URL returns 503; the seed stays
  visible and nothing is reported as saved.
```

- [ ] **Step 3: Link the design and plan**

In `docs/README.md`, add after the existing plan and spec links:

```md
- [Content Calendar persistence implementation plan](superpowers/plans/2026-10-26-calendar-persistence.md)
- [Content Calendar persistence design](superpowers/specs/2026-10-26-calendar-persistence-design.md)
```

- [ ] **Step 4: Write the daily log**

Create `docs/daily-logs/2026-10-26.md`:

```md
# 2026-10-26 — Content Calendar persistent import

## Problem

Uploading a new-month `.xlsx` appeared to do nothing: the client kept the parse
in React state, hard-coded October as the month to open, and lost the import on
refresh. `lib/content-data.json` was built from a fixed July–October sheet list.

## Change

- Added `calendar_months` (one row per month) and `server/calendar/store.ts`.
- Added `GET`/`POST /api/calendar`; uploads are parsed server-side and upserted
  per month. Re-importing a month replaces that month only.
- The calendar loads saved months on mount and merges them over the seed.
- Month selection is `pickImportTargetMonth`: earliest newly imported month,
  otherwise the latest imported month. November, December, and January 2027 are
  covered by tests.
- `scripts/parse-calendar.mjs` now detects every month sheet.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- Manual: November upload → refresh persists; December-only upload keeps
  November; January 2027 upload opens January.

## Not proven here

Production database writes and the deployed build require an authorized
push/deploy and are tracked separately.
```

- [ ] **Step 5: Run the full verification suite**

Run, in order:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all pass with no whitespace errors.

- [ ] **Step 6: Manual browser verification**

Run `npm run dev`, then:

1. Import a November 2026 workbook. Expected: status shows the import, the calendar opens November, and entries render.
2. Refresh the browser. Expected: November is still open and populated.
3. Import a December-only workbook. Expected: December opens; navigate back to November and confirm its entries remain.
4. Import a January 2027 workbook. Expected: January opens without any code change.
5. Stop `next dev`, restart it, reload. Expected: all saved months remain (local in-memory mode is only expected to survive within one dev-server process; with a configured database they survive restarts).

Record the exact outputs in the daily log under **Verification** before claiming completion.

- [ ] **Step 7: Final checkpoint**

Run: `git status --short`

Expected: only the files listed in this plan plus the pre-existing untracked `.agents/`, `.claude/`, and `skills-lock.json`. Do not stage or commit those pre-existing files. Do not commit or push until the user approves.

---

## Self-Review Against the Spec

| Spec requirement | Task |
| --- | --- |
| `calendar_months` table, one row per month | 2 |
| Upsert replaces one month, keeps the rest | 2 |
| Production without DB → 503, dev/test memory | 2 |
| `GET`/`POST /api/calendar`, 4 MiB cap | 3 |
| CSV persisted like XLSX | 3 |
| Saved months loaded on mount and merged over seed | 4 |
| Generic month selection for XLSX and CSV | 1, 4 |
| Last-import status copy | 4 |
| Seed script no longer lists fixed months | 5 |
| November / December / January 2027 tests | 1, 2, 3 |
| Docs + daily log + verification evidence | 6 |
| Rollback = revert commit, additive table | Global constraints + Task 6 |
