# Troubleshooting: Calendar Import Times Shifted by 8 Hours

#troubleshooting #calendar #xlsx #timezone

---

## 🚨 Symptom
- Planned slot times in the Content Calendar were 8 hours early (Stories 9:00 showed 1:00, Feeds 14:00 showed 6:00, Reels 18:00 showed 10:00) for every month after the October import (`ed8fe94`).
- Because the schedule modal uses the planned slot time (`item.time` in `components/content-preview-modal.tsx`), posts scheduled through the UI could be saved with the early PHT time.

## 🔍 Root Cause
- `xlsx` with `cellDates: true` builds JS `Date` objects from the machine's timezone. `getUTCHours()` on those Dates returned the local hour minus the UTC offset (UTC+8 in Manila), so the result depended on where the parser ran.

## ✅ Solution
- Read workbooks with `cellDates: false`. Time cells arrive as a fraction of a day; `formatTime` in `lib/workbook.ts` converts `Math.round(value * 1440)` to `H:MM`. Year detection uses `SSF.parse_date_code` on the header serial.
- `scripts/parse-calendar.mjs` has the same logic (keep the two in sync) and sorts day keys chronologically.
- Sheet labels such as "Scheduled (via UI)" are normalized to "To Do" in planned slots. Real schedule state comes from Airtable.
- Regression tests in `tests/calendar-import.test.ts` pin the October 1/2 and September 1 times. Run them with `TZ=UTC` and `TZ=Asia/Manila`.

## 🛡️ Prevention
- Regenerating `lib/content-data.json` never touches Airtable or the job queue. Scheduled posts are loaded from `/api/schedules`.
- After any calendar re-import, compare the Scheduled Posts modal times against the sheet.
