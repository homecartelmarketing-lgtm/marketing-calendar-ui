# Airtable Schedule and Status Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the root causes of HTTP 422 errors during scheduling and status updates across Airtable pipeline tables by adding `"Done"` status fallback, graceful date-clearing fallback for non-date tables on manual/discard actions, and documenting required Airtable schema additions.

**Architecture:** In `server/airtable/write-schedule.ts`, expand candidate statuses for `Completed` to include `"Done"` (`["Completed", "Done", "Complete"]`). For status actions that clear dates (`For Manual`, `Discard`, `Completed`), allow falling back to updating status alone if the table lacks date fields (`Date and Time Scheduled` / `Date and Time`). Maintain strict timestamp enforcement when scheduling (`Scheduled` must always write a timestamp to a valid date field and throw if missing).

**Tech Stack:** Next.js 15, TypeScript, Airtable REST API, Vitest.

**Spec:** Issue report from user screenshot showing `Scheduling Failed: Airtable could not save the complete schedule change (HTTP 422)` on One Part Per Room (`tbldk5nac1UeYHd77` / `RKV-REEL-SET-6`) and previous 422 error on Virtual Staging (`tblPYG5Ed4XURecu6`).

## Global Constraints

- Never mutate live provider data or load operator credentials in unit tests.
- A saved schedule (`Scheduled`) must include its valid PHT timestamp. Do not silently fall back to updating status alone for scheduled posts.
- Maintain existing provider isolation in `server/airtable/write-schedule.ts`.
- All tests must pass: `npm test`, `npm run typecheck`, and `npm run build`.

## Review Focus

1. **Airtable missing "Scheduled" select option**: Tables like `tbldk5nac1UeYHd77` (One Part per Room) lack `"Scheduled"` in the singleSelect options, causing Airtable to return 422 `INVALID_MULTIPLE_CHOICE_OPTIONS`. The plan documents the exact Airtable fix needed.
2. **Airtable missing date field on "For Manual"**: When moving a record to `For Manual` or `Discard` on a table without a date column (e.g. `tblqXkdDw4O7hxJS4`, `tbl026zbECJJ9FRfj`), clearing date shouldn't fail with 422 `UNKNOWN_FIELD_NAME`.
3. **Table uses "Done" instead of "Completed"**: When setting status back to `Completed` on tables that only define `Done` (e.g. `tblPYG5Ed4XURecu6`, `tbldk5nac1UeYHd77`), the write must succeed using `"Done"`.
4. **Strict Schedule Safety**: If someone schedules a post on a table without date fields, `syncAirtableRecord` must still throw an error, preventing orphaned scheduled records.
5. **No regressions on existing schedule writes**: All existing unit tests in `tests/schedule-writes.test.ts` must continue to pass.

---

### Task 1: Add Unit Tests for "Done" Status Fallback and Non-Date Fallback for Date Clearing

**Files:**
- Modify: `tests/schedule-writes.test.ts`

**Interfaces:**
- Consumes: `syncAirtableRecord(tableId, recordId, status, isoDate, time)` from `@/server/airtable/write-schedule`
- Produces: Test cases asserting `"Done"` fallback on `INVALID_MULTIPLE_CHOICE_OPTIONS` and date-clearing fallback when date fields are missing.

- [x] **Step 1: Write failing tests in `tests/schedule-writes.test.ts`**
  - Add test: `falls back to 'Done' when table rejects 'Completed' with INVALID_MULTIPLE_CHOICE_OPTIONS`
  - Add test: `clears date gracefully by falling back to status-only when table lacks date fields for 'For Manual' or 'Discard'`
  - Add test: `still rejects 'Scheduled' when table lacks date fields`

- [x] **Step 2: Run tests to verify they fail**
  - Run: `npm test tests/schedule-writes.test.ts`
  - Expected: FAIL on the new test cases.

---

### Task 2: Implement "Done" Status Fallback and Date-Clearing Resilience in `server/airtable/write-schedule.ts`

**Files:**
- Modify: `server/airtable/write-schedule.ts:40-74`

**Interfaces:**
- Consumes: `AIRTABLE_BASE_ID`, `AIRTABLE_TOKEN`, `phtScheduleTimestamp`
- Produces: Updated `syncAirtableRecord` function with resilient status & date clearing logic.

- [x] **Step 1: Update status candidates**
  - In `server/airtable/write-schedule.ts`:
    ```typescript
    const statuses = normalizedStatus === "Completed"
      ? ["Completed", "Done", "Complete"]
      : [normalizedStatus]
    ```

- [x] **Step 2: Update dateFields candidate loop**
  - For `clearDate` (`"Completed"`, `"For Manual"`, `"Discard"`), allow attempting `["Date and Time Scheduled", "Date and Time", undefined]`.
  - For `Scheduled` (or `scheduledAt`), keep strict `["Date and Time Scheduled", "Date and Time"]` (never `undefined`).
  - When `dateField === undefined`, payload is `{ fields: { Status: candidateStatus } }`.

- [x] **Step 3: Run tests to verify they pass**
  - Run: `npm test tests/schedule-writes.test.ts`
  - Expected: PASS for all tests.

---

### Task 3: Full Verification and Documentation

**Files:**
- Modify: `docs/architecture/output-media-selection.md`
- Modify: `docs/daily-logs/2026-11-03.md`

- [x] **Step 1: Run full test suite and typecheck**
  - Run: `npm test`
  - Run: `npm run typecheck`
  - Run: `npm run build`

- [x] **Step 2: Update documentation**
  - Record the Airtable schema requirements in `docs/architecture/output-media-selection.md` (specifically `tbldk5nac1UeYHd77` missing `"Scheduled"` choice and tables missing date fields).
  - Add session log entry in `docs/daily-logs/2026-11-03.md`.

- [x] **Step 3: Re-index Graphify and Obsidian Canvas**
  - Run: `python -m graphify update .`
  - Run: `python -m graphify export obsidian`
