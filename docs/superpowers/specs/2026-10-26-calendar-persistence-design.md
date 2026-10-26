# Content Calendar Persistence — Design

**Date:** 2026-10-26
**Status:** Proposed
**Branch:** `codex/calendar-persistent-import`

## Problem

The Content Calendar imports an `.xlsx` entirely in the browser and keeps the result in React state. Three consequences:

1. `components/content-calendar.tsx` hard-codes October (`2026-10`) as the month to open after an import, so a November (or any new month) workbook appears not to work.
2. A refresh or a new browser session discards the import. Teammates never see it.
3. The calendar's baseline is baked at build time from `data/oct-calendar.xlsx` into `lib/content-data.json`, and `scripts/parse-calendar.mjs` only lists July–October. New months require a developer and a redeploy.

## Goal

An imported workbook becomes the calendar's durable source of truth:

- Upload from the UI → parsed on the server → saved per month in Postgres.
- Opening the calendar loads the saved months and merges them over the built-in seed.
- The month to open after an import is chosen generically; no month name appears in the code.
- The built-in seed remains only as a fallback for months that have never been imported.

## Non-goals

- Editing calendar entries in the UI.
- Changing parser semantics (times, weekday blocks, status normalization, `Scheduled` → `To Do`).
- Changing Airtable scheduling, the publishing queue, or any provider integration.
- Per-user calendars, version history UI, or import undo.
- Normalizing non-exact sheet names such as `Nov 2026` (documented as a limitation).

## Decisions

| Decision | Choice |
| --- | --- |
| Storage | Existing Postgres (Neon/Supabase) used by the scheduler |
| CSV | Persisted through the same endpoint as XLSX |
| Import authorization | No new auth, parity with `/api/schedules`; deployment protection recommended |
| Month on first load | Newest saved month; otherwise the existing September 2026 default |
| Sheet matching | Exact English month name (unchanged) |

## Architecture

### 1. Database table

Added to `server/db/schema.sql` (additive, idempotent):

```sql
CREATE TABLE IF NOT EXISTS calendar_months (
  month_key   TEXT PRIMARY KEY,          -- '2026-11'
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,          -- 1-12
  days        JSONB NOT NULL,            -- { '2026-11-01': [{ type, idea, time, status }] }
  source_file TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

One row per month. An import **replaces the whole row** for every month it contains, so removing an entry from the workbook removes it from the calendar. Months not present in the upload are untouched (importing December never erases November).

The store also runs `CREATE TABLE IF NOT EXISTS` once per process before its first query, so deployment does not depend on someone calling `/api/schedules/init-db`.

### 2. Store — `server/calendar/store.ts`

```ts
type CalendarSnapshot = {
  months: string[]
  days: Record<string, ContentEntry[]>
  imports: { monthKey: string; sourceFile: string; importedAt: string }[]
}

loadCalendar(): Promise<CalendarSnapshot>   // imports newest first
saveCalendar(
  result: { byDate: Record<string, ContentEntry[]> },
  sourceFile: string,
): Promise<{ savedMonths: string[]; skippedMonths: string[]; importedAt: string }>
```

Storage resolution:

- **Real Postgres** (`getDatabaseUrl()` set, not test): SQL via `executeSql`.
- **Dev/test without a DB** (`isMockDb()`): module-level `Map`, so an import survives page refreshes while `next dev` runs. Exposed `resetCalendarStoreForTests()`.
- **Production without a DB**: throw `CalendarStorageUnavailable`. The API maps it to HTTP 503. Never silently pretend a write succeeded.

`saveCalendar` derives the month key from each `YYYY-MM-DD` date, upserts one row per month, and skips months whose parsed entry count is zero. Empty sheets therefore never wipe an existing month; they are reported as `skippedMonths`.

### 3. API — `app/api/calendar/route.ts`

`export const dynamic = "force-dynamic"` and `revalidate = 0`.

**`GET`** → `{ success, months, days, imports }`. Never returns a token or raw provider error.

**`POST`** — `multipart/form-data` with one `file` field:

1. Reject missing file → 400.
2. Reject size > 4 MiB → 413 (Vercel caps request bodies near 4.5 MiB).
3. `.xlsx` / `.xls` → `parseContentWorkbook(buffer)`.
4. `.csv` → `parseContentCsv(text)`; entries without a date (`loose`) are ignored and counted in the response.
5. Reject when no dated entries are produced → 400 with a clear message.
6. `saveCalendar(...)`, then return `{ months, savedMonths, skippedMonths, dayCount, importedAt, fileName }`.

Status codes: 400 invalid input, 413 too large, 503 storage unavailable, 500 unexpected. No stack traces or credential values in responses.

### 4. Client — `components/content-calendar.tsx`

**Load:** on mount, `GET /api/calendar`. While loading, the seed renders and the import button is disabled. On success:

- Merge with `mergeCalendar(seedDays, savedMonths, savedDays)`:
  - start from the seed,
  - delete every seed date whose `YYYY-MM` is in `savedMonths`,
  - overlay `savedDays`.
  This makes an uploaded month authoritative instead of a per-date merge that could leak stale seed entries.
- Open the newest saved month. If none, keep September 2026.

**Import:** upload the file to `POST /api/calendar`, then re-fetch. The response supplies the summary and last-import metadata. On failure, keep the previous data and show the error; no local state is cleared.

**Month selection:** replaces the two hard-coded October expressions (`components/content-calendar.tsx:108` for CSV, `:126` for XLSX) with one pure helper:

```ts
pickImportTargetMonth(importedMonths: string[], knownMonths: string[]): string | null
```

- Normalize to unique ascending `YYYY-MM`.
- Known = seed `CONTENT_MONTHS` ∪ saved months ∪ months already in the current overrides.
- Return the earliest imported month not in known; otherwise the latest imported month.

Examples: July–November → November; November only → November; December only after November → December; January 2027 → January 2027; July–October re-uploaded → October.

**Status copy:** `Imported N days across M months · November 2026 · huling import Oct 26, 2026`.

### 5. Seed script — `scripts/parse-calendar.mjs`

Replace the fixed `MONTH_SHEETS = ["July", "August", "September", "October"]` with detection of every sheet named after a month. The script remains a build-time seed tool; runtime reads come from the database. `data/oct-calendar.xlsx` and `lib/content-data.json` are not deleted.

## Data flow

```
Upload (.xlsx/.csv)
  → POST /api/calendar
  → parse (existing lib/workbook.ts or lib/csv.ts)
  → upsert one calendar_months row per imported month
  → response summary
  → client re-fetches GET /api/calendar
  → merge over seed
  → open pickImportTargetMonth(...)
```

Page load:

```
GET /api/calendar → saved months + days
  → merge over seed (saved months replace seed months)
  → open newest saved month
```

## Edge cases

| Case | Behavior |
| --- | --- |
| Workbook sheet named `Nov 2026` | Ignored (exact match unchanged); import reports zero dated entries |
| Empty month sheet | Skipped and reported; existing saved month is not cleared |
| Same file uploaded twice | Idempotent upsert; no duplicates |
| CSV with undated rows | Dated rows persist; undated rows ignored and counted |
| DB unavailable in production | 503 with a clear message; seed still renders |
| Two imports at once | Per-month primary-key upsert; last write wins for that month |
| Re-import of an old month | Whole month replaced; other months untouched |
| Refresh after import | Saved months reload from the database |

## Testing

Provider- and database-isolated; no live services.

1. `pickImportTargetMonth`: November, December, January 2027, no-new-month → latest, empty input.
2. `mergeCalendar`: saved month removes seed dates for that month; other seed months survive.
3. Store: import November then December keeps both; re-import November replaces only November; empty month is skipped.
4. Storage mode: real DB, dev mock, production-without-DB → unavailable.
5. API: generated `.xlsx` returns 200 and saved months; missing file 400; empty workbook 400; oversized file 413.
6. Manual browser: November upload → refresh → November persists; December-only upload → November remains; a January 2027 workbook opens January.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- Local `npm run dev` walkthrough of the three manual flows above.

Local tests do not prove the production database write or the deployed build; those are tracked as external verification after the user authorizes a push/deploy.

## Risks

- **Database configuration:** Preview and Production need the database URL the scheduler already uses. Missing it makes imports return 503.
- **No UI authentication:** the app is already open-API (for example `/api/schedules`). The import endpoint follows that parity; Vercel Deployment Protection is recommended.
- **No undo UI:** a bad workbook can overwrite that month. Re-uploading the correct file repairs it. The response and last-import label make the active source visible.
- **Upload size:** capped at 4 MiB.
- **Sheet naming:** only exact English month names are recognized.

## Rollback

The table is additive and the seed files are untouched. Reverting the committing change restores the previous calendar behavior. No destructive migration or data deletion is part of this work.

## Definition of done

- Import persists across refresh and browser sessions.
- November, December, and January 2027 each open automatically after import.
- Importing one month never removes another.
- The two hard-coded October expressions and the fixed seed month list are gone.
- All automated checks pass and the manual flows are recorded.
