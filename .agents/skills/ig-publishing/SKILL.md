---
name: ig-publishing
description: Use when changing or debugging Instagram publishing through the Meta Graph API in this repo — Stories, Feeds, carousels, Reels, Post Now, the scheduler runner, Error 9007, expired Airtable attachment URLs, or container readiness. Enforces fresh media refresh, FINISHED polling, publication-ID-before-status ordering, and duplicate-post prevention.
---

# Instagram publishing (Meta Graph API)

Covers `lib/meta-api.ts`, `app/api/meta-post/route.ts`, `app/api/schedules/runner/route.ts`, and the publishing tests.

## When to use

- A post fails with `Media ID is not available`, Error 9007, `OAuthException`, carousel item errors, or a video timeout.
- You are adding a new publish entry point or changing Stories/Feeds/Reels payloads.
- You are touching the "Post Now" button, the runner, or media selection for publishing.
- A post appears live on Instagram but Airtable still says `Scheduled`.

## Non-negotiable rules

1. **Refresh the media URL immediately before publishing.** Airtable attachment URLs are signed and expire after a few hours. Never trust the browser URL (`/api/meta-post`) or the queue snapshot (`automation_jobs.media_url`).
   - Use `readAirtableRecordById()` from `server/airtable/records.ts`.
   - Re-extract with `extractOutputMedia()` from `lib/output-media.ts`.
   - Fall back to the original URL only if the refresh itself fails, and log a warning.
2. **Never call `media_publish` before the container is `FINISHED`.** Meta processes image downloads and video transcoding asynchronously. Poll `GET /{creation-id}?fields=status_code,status` via `waitForContainerReady()` for:
   - single images, single videos, Reels;
   - **every** multi-slide Story slide;
   - **every** carousel child, then the parent carousel.
3. **Retry transient 9007 only.** Use `publishContainerWithRetry()` (2 retries, 2.5 s backoff in production). Do not retry permission/invalid/unsupported errors.
4. **Persist the Meta publication ID before writing Airtable status.** In the runner, `recordJobSuccess()` runs before `syncAirtableRecord(..., "Posted")`. If Airtable fails afterwards, report a warning — never repost.
5. **Stories do not accept `scheduled_publish_time`.** Only Reels and Feeds do. Multi-slide Stories are published sequentially, one container per slide.
6. **A success is not a success without an ID.** Treat a missing `id` as failure.
7. **No secrets in output.** Never log `META_ACCESS_TOKEN`, authorization headers, or raw provider responses into commits, docs, or UI.

## Publish flows

| Category | Payload | Container sequence |
| :--- | :--- | :--- |
| Stories, 1 slide | `media_type=STORIES`, `image_url` or `video_url` | create → wait FINISHED → publish |
| Stories, N slides | one container per slide | for each slide: create → wait → publish |
| Feeds, 1 item | `image_url` or `media_type=VIDEO` + `video_url` | create → wait → publish |
| Feeds, N items | children with `is_carousel_item=true` | each child create → wait; then parent `media_type=CAROUSEL` → wait → publish |
| Reels | `media_type=REELS`, `video_url`, `caption` | create → wait (video budget 120 s) → publish |

Environment: `META_ACCESS_TOKEN`, `META_IG_ACCOUNT_ID`, optional `META_API_VERSION` (default `v19.0`), `SIMULATE=1` for simulated success with no credentials.

## Failure catalog

| Symptom | Likely cause | Action |
| :--- | :--- | :--- |
| Code 190 / OAuthException | Expired or invalidated 60-day token | Rotate `META_ACCESS_TOKEN`; requires operator action, not code |
| Error 9007 / "Media ID is not available" | Container not FINISHED yet, or URL expired | Verify FINISHED polling on **all** formats; verify fresh URL refresh |
| Carousel 36003/100 | Unreachable child URL or unsupported aspect ratio | Check each URL in a browser; verify JPEG/PNG between 4:5 and 1.91:1 |
| Video container timeout | Large file still transcoding | Check `status` field; adjust only the video budget, not the image flow |
| `statusSyncWarning` | Meta succeeded, Airtable write failed | **Do not repost.** Inspect `automation_jobs.meta_publication_ids`; fix Airtable manually |
| Image Stories/Feeds fail instantly | Publishing before FINISHED (old bug) | Ensure `waitForContainerReady()` is called for images too |

## Where to change what

- Graph calls and polling: `lib/meta-api.ts`.
- One-off "Post Now": `app/api/meta-post/route.ts`.
- Scheduled publishing, retries, status sync: `app/api/schedules/runner/route.ts`.
- Media field selection: `lib/output-media.ts` (see the `airtable-output-map` skill).
- Queue success/failure bookkeeping: `server/automation/jobs.ts` (see the `scheduler-queue` skill).

## Tests before claiming a fix

Run `npm test` and add/extend provider-isolated tests:

- `tests/meta-publishing.test.ts` — container polling for images, multi-slide Stories, carousel children + parent, 9007 retry, terminal ERROR.
- `tests/modal-mutations.test.tsx` — Post Now refreshes the record; falls back on refresh failure.
- `tests/durable-scheduling.test.ts` — runner refreshes media; publication ID ordering.

Tests must stub `fetch`; never load real credentials or publish live. A passing unit test does **not** prove a live Instagram publication.

## Red flags

- A new route/module that calls `graph.facebook.com` directly instead of `publishToInstagram()`.
- Polling only when `isVideo` is true.
- Using `payload.mediaUrl` without the Airtable refresh.
- Marking a job `Posted` before `recordJobSuccess()`.
- Retrying any error, or retrying more than twice.
- Logging tokens or dumping raw provider errors into docs.
