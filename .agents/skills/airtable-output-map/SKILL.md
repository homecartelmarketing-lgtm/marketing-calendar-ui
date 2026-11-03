---
name: airtable-output-map
description: Use when changing or debugging Airtable mapping in this repo — adding a pipeline table, fixing an empty gallery, choosing final media fields, ordering carousel slides, deriving Foreign Key IDs, filtering Completed vs For Manual, or handling pagination, rate limits, and partial failures. Keeps lib/output-media.ts as the single source of truth.
---

# Airtable output mapping

Covers `lib/tables-config.ts`, `lib/output-media.ts`, `lib/output-mapping.ts`, `lib/schedules.ts`, `server/airtable/records.ts`, `server/airtable/write-schedule.ts`, `app/api/content-outputs/route.ts`, and `app/api/discard-archive/route.ts`.

## When to use

- A finished row does not appear in the gallery or calendar.
- A new pipeline/table needs to be added (done means mapped, filtered, and media-extracted).
- A carousel has the wrong slide order or missing slides.
- A `For Manual` or `Discard` row shows up as a candidate.
- You need to change status handling, pagination, or Airtable writes.

## Non-negotiable rules

1. **One media selector.** `extractOutputMedia()` in `lib/output-media.ts` is the single source of truth for final media. Do not add a second field list in a route, component, modal, or test helper.
2. **Field order is never slide order.** Select explicit fields, and map multi-slide outputs explicitly:
   - Moodboard #2: `["Moodboard #2 Converted", "Blended Image"]` — both required; omit the record if either is missing.
   - Day & Night Feed: `["Day Image", "Night Image"]` when both exist.
   - Collection Category: `Blended Image1..5` in numeric order.
   - Tips & Edu Feed: cover first (`Thumbnail with Text` / `Thumbnail`), then `Tips and Edu Feeds`.
3. **Only final outputs are eligible.** Never select input drafts, intermediate blends, or non-video Reel attachments. Reels must resolve to a video MIME/extension.
4. **Status filtering is strict.**
   - Gallery candidates: `isCompletedOrDoneStatus()` → only `Completed`, `Complete`, `Done` (case-insensitive).
   - Exclude `For Manual`, `Discard`, `Scheduled`, `Posted` from candidate lists.
   - Calendar reads `Scheduled` and `Posted` only.
   - Never use truthiness or substring matching for status.
5. **Empty is not an error.** A provider failure must not look like an empty gallery:
   - all tables fail → HTTP 502 with `status: "error"`;
   - some tables fail → return successful items plus `diagnostics.partial`.
6. **Pagination is mandatory.** `readAirtableRecords()` follows `offset`, dedupes by record ID, rejects invalid pages, and detects a repeated offset. It uses `pageSize=100`, a 25 s overall deadline, and a 10 s per-request timeout.
7. **Pacing is per instance.** The 250 ms per-base pacing is not distributed rate limiting. Do not claim it prevents 429s across Vercel instances.
8. **Tables are data, not branches.** Register new tables in `getAllConfiguredTables()` (`lib/tables-config.ts`) with env-key override plus fallback. Do not scatter table IDs through components. The function dedupes and accepts `AIRTABLE_TABLE_ID_*` env entries.
9. **Foreign Key IDs are canonical.** Trust `Foreign Key ID`, then `CID`, then `Foreign Key`. Otherwise derive from category + idea + fixture (`deriveForeignKeyId`) and never fall back to a raw `rec...` ID. Default index is `-1`.
10. **Writes are validated.** `syncAirtableRecord()` requires valid `tbl...`/`rec...` IDs and a valid PHT timestamp. For schedules, never write status without the timestamp. It retries alternate date/status fields only on 422 and clears dates for `Completed`, `For Manual`, and `Discard`.
11. **Discard has an external side effect.** Discarding uploads media to Zoho WorkDrive. A code rollback does not undo that upload; record the affected IDs.

## Adding a pipeline table

1. Add the table to `getAllConfiguredTables()` with `tableId`, `category`, `idea`, and `fixtureType`.
2. Add its final-media field names to `getFinalOutputCandidates()` and, if ordering is non-obvious, to `extractOutputMedia()`.
3. Verify `deriveForeignKeyId()` produces the expected `<IDEA>-<FORMAT>-<FIXTURE>-<N>`.
4. Add a regression test with a fixture record.
5. Run `npm test`, `npm run typecheck`, `npm run build`.

## Common failures

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Rows beyond the first 100 are missing | Pagination ignored | Use `readAirtableRecords()`; never fetch one page |
| Gallery empty for one pipeline | Wrong table ID or wrong final field | Check `tables-config.ts`, then `getFinalOutputCandidates()` with a real record |
| Carousel order wrong / duplicated | Relied on field order or spread all attachments | Explicit ordered field list in `extractOutputMedia()` |
| `For Manual` appears as a candidate | Truthy/substring status check | Use `isCompletedOrDoneStatus()` and exclude explicitly |
| Whole gallery disappears on one bad table | Provider error swallowed as [] | Return partial diagnostics; 502 only if all tables fail |
| FK shows `REC...` | Raw record ID used as fallback | Use `deriveForeignKeyId()` |
| Schedule saved without date | Status-only fallback | `syncAirtableRecord()` must throw |

## Tests

- `tests/output-media.test.ts` — field selection and slide order.
- `tests/content-outputs.test.ts` — pagination, partial failures, status filtering.
- `tests/airtable-records.test.ts` — reader pagination/invalid pages.
- `tests/schedule-reads.test.ts` / `tests/schedule-writes.test.ts` — PHT and write validation.
- Tests use fake credentials and a fetch stub from `tests/setup.ts`.

## Red flags

- A new `extractSomething()` inside a component or route.
- Substring matching on status (`includes("complete")`) for candidates.
- Reading `.fields` values in object key order.
- Catching an Airtable error and returning an empty array.
- Hard-coding a new `tbl...` in a component instead of `tables-config.ts`.
- Status write without the scheduled timestamp.
