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

---

## 🔗 Related Notes
- [[architecture/output-media-selection|Output Media Selection Rules]]
- [[architecture/system-blueprint|System Blueprint]]
