# Architecture: Output Media Selection Rules

#architecture #media #airtable #pipelines

All media resolution logic is centralized in [`lib/output-media.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/lib/output-media.ts). Do not duplicate media extraction logic inside API routes or UI components.

---

## 🎨 Pipeline Media Requirements

### 1. Moodboard #2 Feed (Strict 2-Photo Carousel)
* **Slide 1**: `Moodboard #2 Converted` (resilient aliases: `Moodboard #2`, `Moodboard 2`).
* **Slide 2**: `Blended Image` (resilient aliases: `Blended`, `Slide 2`).
* **Strict Rule**: **Both photos are strictly required**. If either photo attachment is missing, the media extractor returns empty and the record is excluded from candidates.

### 2. Moodboard #1 Feed
* Single final moodboard image attachment.
* Excludes draft attachments, work-in-progress renders, and temporary files.

### 3. Day & Night Feed
* Evaluates dual-image or single-image configurations:
  * Slide 1: Day view attachment.
  * Slide 2: Night view attachment.
* Validated against Airtable table IDs: `tblSceuLVvLMQ6wWp`, `tblIgRlTtO7Y2EGIo`, `tblcKHAVYgzIcmabT`, `tbljsKOEhc0618qbM`.

### 4. Style Reel Slideshow
* Validated against Airtable table `tblFFEvkHb3jLKrcv`.
* Derives fixture type directly from Foreign Key ID (e.g., `SR-REEL-CH-*` -> `Chandelier`).
* Extracts `Item Name 1..5` and corresponding slide attachments.
* Bidirectional pipeline matcher prevents cross-matching with "1 Product, 3 Styles".

---

## 🚦 Candidate Status Filters (`isCompletedOrDoneStatus`)

To prevent unfinished creative drafts from leaking into the scheduler:
- **Eligible Statuses**: `Completed`, `Complete`, `Done` (case-insensitive).
- **Strictly Excluded**: `For Manual`, `Discard`, `In Progress`, `Draft`, `Needs Review`.
- Records marked `Posted` in historical tables are treated as completed references or suppressed from active candidate selection dropdowns.

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]
- [[troubleshooting/airtable-sync-issues|Troubleshooting Airtable Sync Issues]]
