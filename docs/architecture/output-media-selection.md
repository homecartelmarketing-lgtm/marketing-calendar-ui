# Architecture: Output Media Selection Rules

#architecture #media #airtable #pipelines

All media resolution logic is centralized in [`lib/output-media.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/lib/output-media.ts). Do not duplicate media extraction logic inside API routes or UI components.

---

## 🎨 Pipeline Media Requirements

### 1. Moodboard #2 Feed (Strict 2-Photo Carousel)
* **Slide 1**: `Moodboard #2 Converted` (resilient aliases: `Moodboard #2`, `Moodboard 2`).
* **Slide 2**: `Blended Image` (resilient aliases: `Blended`, `Slide 2`).
* **Strict Rule**: **Both photos are strictly required**. If either photo attachment is missing, the media extractor returns empty and the record is excluded from candidates.

### 2. Moodboard #1 Feed (Strict 3-Photo Carousel)
* **Slide 1**: `Moodboard Converted` (resilient aliases: `Converted Moodboard`, `Moodboard #1 Converted`, `Moodboard 1 Converted`).
* **Slide 2**: `Moodboard Added Watermark` (resilient aliases: `Added Watermark`, `Watermarked Moodboard`, `Moodboard Watermarked`; fallback: `Blended Image with Name text`, `Blended Image with Item Name`, `Blended with Item Name`, `Blended Image with Name`, `Blended Image`, `Moodboard V1 Blended`).
* **Slide 3**: `Closeup Photo` (resilient aliases: `Closeup`, `Product Closeup`, `Closeup Photo Converted`, `Converted Closeup Photo`).
* **Strict Rule**: **All three photos are strictly required**. If any attachment is missing, the media extractor returns empty and the record is excluded from candidates.
* Validated across 3 Airtable tables: `tbl9u5vjgx8kuE44R` (Chandelier), `tblOvvYdgsNTXh2zK` (Pendant Light), and `tbl6uTmwM23KK9ocO` (Floor Lamp).

### 3. Day & Night Story
* **Tagged Item Name Attachment**: Evaluates `Blended Image with Name text` (resilient aliases: `Blended Image with Item Name`, `Blended with Item Name`, `Blended Image with Name`).
* **Fallback**: Raw untagged multi-attachment field `STORY - Day & Night (2)`.
* Validated across 5 Airtable tables: `tblKkCf88UVQ3Yu07` (Chandelier), `tblaNyYZCR7E6TXtv` (Pendant Light), `tblr1hlsjGcs9QKCy` (Floor Lamp), `tblhvM9Saq18YqONB` (Table Lamp), and `tblgcvB4WFKOpSIQl` (Cluster Chandelier).
* Thumbnail rendered in Output UI matches Slide 1 (`slides[0]`), showing the item-name stamped deliverable.

### 4. Day & Night Feed
* Evaluates dual-image or single-image configurations:
  * Slide 1: Day view attachment (`Day Image` + `Night Image`, or `FEED - Day & Night (2)`).
  * Fallback: `Blended Image with Name text` (with item-name aliases) or `STORY - Day & Night (2)`.
* Validated against Airtable table IDs: `tblSceuLVvLMQ6wWp`, `tblIgRlTtO7Y2EGIo`, `tblcKHAVYgzIcmabT`, `tbljsKOEhc0618qbM`.

### 5. Style Reel Slideshow
* Validated against Airtable table `tblFFEvkHb3jLKrcv`.
* Derives fixture type directly from Foreign Key ID (e.g., `SR-REEL-CH-*` -> `Chandelier`).
* Extracts `Item Name 1..5` and corresponding slide attachments.
* Bidirectional pipeline matcher prevents cross-matching with "1 Product, 3 Styles".

### 6. One Light at a Time Reel
* Airtable table `tblJpEtBudQZda319` ("One at a time lights"); override with `AIRTABLE_TABLE_ID_ONE_AT_A_TIME_LIGHTS`.
* Video candidates (in order): `Final Video`, `Raw Video`, `REEL - One at a Time Lights`.
* Foreign Key ID prefix `OATL-REEL-<fixture code>-<ID>`; code `LR` maps to the `Living Room` fixture.
* Item names come from `Item Name1..4`; when absent they are parsed from `Scraped Items` (one line per slot, `Slot N (Fixture) | Name | ...`, second `|` column is the name).
* The table needs a `Date and Time Scheduled` (or `Date and Time`) field before a schedule can be saved; without it `syncAirtableRecord` fails with an error rather than saving status alone.

### 7. House Tour Reel
* Airtable table `tblqXkdDw4O7hxJS4` ("House Tour Reel"); override with `AIRTABLE_TABLE_ID_HOUSE_TOUR_REEL`.
* Video candidates (in order): `Final Video`, `Raw Video`, `REEL - House Tour`, `House Tour Reel`.
* Foreign Key ID prefix `HTR-REEL-<fixture code>-<ID>`; code `SET` maps to `House Tour` fixture.
* Item names are extracted from `Item Name1..11` (and spaced aliases `Item Name 1..11`, covering up to 11 rooms/furniture slots).
* **Multi-Item UI Presentation**: In `ContentPreviewModal`, when `itemNames.length > 1`, the field dynamically displays `Item Names (N)` with a scrollable numbered list (`max-h-36 overflow-y-auto`) so all 11 room items are visible without single-line ellipsis truncation. The calendar CID dropdown subLabel displays `(+N more items)` to signify multi-item records.
* The table needs a `Date and Time Scheduled` (or `Date and Time`) field in Airtable before a live schedule timestamp can be saved; without it `syncAirtableRecord` fails with an error rather than silently saving status alone.

### 8. This Mood Every Night Reel
* Airtable table `tblDa5UOTUTlU1Xxy` ("This Mood Every Night"); override with `AIRTABLE_TABLE_ID_THIS_MOOD_EVERY_NIGHT_REEL`.
* Video candidates (in order): `Final Video`, `Raw Video`, `REEL - This Mood Every Night`, `This Mood Every Night Reel`.
* Foreign Key ID prefix `TMEN-REEL-<fixture code>-<ID>`; code `SET` maps to `This Mood Every Night` fixture.
* Item names are extracted from `Item Name1..7` (covering all 7 luxury nighttime room slots).
* The table needs a `Date and Time Scheduled` (or `Date and Time`) field in Airtable before a live schedule timestamp can be saved; without it `syncAirtableRecord` fails with an error rather than silently saving status alone.

### 9. One Part Per Room Reel
* Airtable table `tbldk5nac1UeYHd77` ("One Part Per Room"); override with `AIRTABLE_TABLE_ID_ONE_PART_PER_ROOM_REEL`.
* Video candidate strictly: `Final Video` (records without a valid video in `Final Video` are excluded from candidates).
* Foreign Key ID prefix `OPPR-REEL-<fixture code>-<ID>`; code `SET` maps to `One Part Per Room` fixture.
* Item names are extracted from `Item Name1..20` or parsed from `Scraped Items`.
* **Airtable Schema Requirements**:
  * Must have `Date and Time Scheduled` (or `Date and Time`) date field enabled with time.
  * `Status` singleSelect choices must include `Scheduled`, `Complete` / `Done`, `For Manual`, `Posted`. Without `Scheduled` choice, scheduling fails with HTTP 422 `INVALID_MULTIPLE_CHOICE_OPTIONS`.
* The table needs a `Date and Time Scheduled` (or `Date and Time`) field in Airtable before a live schedule timestamp can be saved; without it `syncAirtableRecord` fails with an error rather than silently saving status alone.

### 10. Virtual Staging Reel (Non-Fixture Single Pipeline)
* Airtable table `tblPYG5Ed4XURecu6` ("Virtual Staging Reel", view `viwrnlnwammnCQCLd`); override with `AIRTABLE_TABLE_ID_VIRTUAL_STAGING_REEL`.
* Video candidate fields (in order): `Final Video`, `Raw Video`, `REEL - Virtual Staging`, `Virtual Staging Reel`.
* Foreign Key ID format: `VST-REEL-SET-<ID>` (e.g. `VST-REEL-SET-4`, `VST-REEL-SET-9`). Code `SET` represents the global scene setup.
* Captions are extracted from the `Caption Generated` field.
* **Non-Fixture UI Behavior**: In the Marketing AI Content Automation dashboard and Day Detail Modal, Virtual Staging is a single continuous pipeline without lighting fixture variants (no Chandelier, Pendant Light, etc.).
  * `isNonFixtureIdea()` identifies Virtual Staging and removes the `[Fixture]` dropdown in `DayDetailModal`.
  * The Content ID dropdown spans the full available width (`col-span-2`), directly listing all available CIDs without requiring fixture pre-selection.
  * Auto-selection automatically picks the first available completed record (`pool[0]`) rather than waiting for fixture matching.

---

## 🚦 Candidate Status Filters (`isCompletedOrDoneStatus`) & Schedule Sync Resilience

To prevent unfinished creative drafts from leaking into the scheduler:
- **Eligible Statuses**: `Completed`, `Complete`, `Done` (case-insensitive).
- **Strictly Excluded**: `For Manual`, `Discard`, `In Progress`, `Draft`, `Needs Review`.
- Records marked `Posted` in historical tables are treated as completed references or suppressed from active candidate selection dropdowns.

### Schedule Sync & Status Resilience (`server/airtable/write-schedule.ts`)
- **Status Fallback**: When reverting or updating status to `Completed`, `syncAirtableRecord` attempts `["Completed", "Done", "Complete"]` to support tables whose singleSelect choices only include `Done`.
- **Date Clearing Resilience**: When changing status to `For Manual`, `Discard`, or `Completed`, `syncAirtableRecord` attempts clearing `Date and Time Scheduled` and `Date and Time`. If both columns return `UNKNOWN_FIELD_NAME` (because the table lacks date columns), it gracefully falls back to updating the status field alone without throwing an error.
- **Strict Schedule Safety**: For `Scheduled`, writing a timestamp to a valid date field is non-negotiable. If both date fields fail, the schedule write is rejected to prevent orphaned headless schedule entries.

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]
- [[troubleshooting/airtable-sync-issues|Troubleshooting Airtable Sync Issues]]
