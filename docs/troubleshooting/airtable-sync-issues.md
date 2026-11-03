# Troubleshooting: Airtable Sync Issues

#troubleshooting #airtable #api #sync

This guide documents common issues encountered when reading or writing marketing records to Airtable.

---

## 🚨 Error Catalog & Diagnostics

### 1. Missing Records Beyond First 100 Rows
* **Symptom**: Some finished content outputs or scheduled posts don't appear in the calendar or candidates list.
* **Root Cause**: Airtable API paginates in pages of 100 records using an `offset` token. If pagination is not followed, later rows are missed.
* **Solution**:
  - Ensure API client loops while `data.offset` is present.
  - Implement deduplication of records by Airtable ID (`rec...`) in case of overlapping pagination tokens.

### 2. Status Update Fails on Date Format (`422 Unprocessable Entity`)
* **Symptom**: Updating a schedule timestamp fails with invalid date or malformed cell format.
* **Root Cause**: Airtable date fields expect ISO 8601 strings or formatted PHT strings depending on field configuration. Silently dropping the timestamp and updating status alone is strictly prohibited by project rules.
* **Solution**:
  - Always validate the date using `date-fns` or native `Intl` in PHT timezone (`Asia/Manila`) before submitting PATCH requests.
  - Reject the schedule write with a client-visible 400 error rather than silently saving a broken schedule.

### 3. Discarded and Manual Items Appearing in Feed
* **Symptom**: Items marked `For Manual` or `Discard` show up in candidate dropdowns.
* **Root Cause**: Filtering logic checking only for truthy values or fuzzy status strings.
* **Solution**:
  - Apply `isCompletedOrDoneStatus` strictly requiring `Completed`, `Complete`, or `Done` (case-insensitive).
  - Explicitly exclude `For Manual` and `Discard`.

### 4. Non-Fixture Pipeline Locked Out on "Select Fixture first"
* **Symptom**: When opening Day Detail Modal for pipelines that do not use lighting fixture categories (e.g., Virtual Staging, House Tour, This Mood Every Night, One Part Per Room), all fixtures in the Fixture dropdown show `(0)` and the Content ID dropdown remains disabled with `"Please select a Fixture first"`.
* **Root Cause**: The modal previously assumed every pipeline maps to lighting fixture variants (Chandelier, Pendant Light, etc.). For single pipelines with a global scene (`fixtureType: "SET"`), no records match individual lighting fixture codes, locking out selection.
* **Solution**:
  - Use `isNonFixtureIdea(idea, category)` in `components/day-detail-modal.tsx`.
  - For non-fixture pipelines, omit the `[Fixture]` dropdown completely and span the Content ID dropdown across the full available space (`col-span-2 sm:col-span-2`).
  - Auto-select `pool[0]` directly without waiting for a lighting fixture match.

---

## 🔗 Related Notes
- [[architecture/output-media-selection|Output Media Selection Rules]]
- [[architecture/system-blueprint|System Blueprint]]
