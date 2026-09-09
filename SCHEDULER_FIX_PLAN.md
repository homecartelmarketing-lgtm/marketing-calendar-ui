# HomeCartel Scheduler Repair

Why schedules vanish on reload, and how to make them stay.

**Current stack:** Next.js 16 on Vercel · cron-job.org (every minute) · Airtable (40+ tables) · Meta Graph API v19.0

A CTA Story you schedule today is saved in three places that disagree with each other. Fix which one is the truth, and the reload bug, the one-post-per-day limit and the hosting question all resolve together.

---

## 1. Diagnosis — the reload bug is five faults stacked

You set a CTA Story, the app says *Successfully scheduled*, you reload, and the row is empty again. Each fault below is enough to lose the schedule on its own. All five are live right now.

### Fault A — the browser and the server use different keys for the same row

The day table numbers its rows by position. Airtable doesn't know about positions, so when the server reads your schedule back it invents a key from the category, the idea and the date. The two never match, so after a reload the modal looks up a row that doesn't exist and draws it blank.

| Saved by the browser | Returned by the server |
|---|---|
| `Stories-0` | `Stories-CTA Story-2026-09-15` |
| Row 0 of the Stories block for that day — a position, not an identity. | Rebuilt from Airtable in `pullAirtableSchedules()`. Same post, different name. |

### Fault B — the reload actively overwrites the good copy with the broken one

`GET /api/schedules` loads your saved entry first, then overlays whatever it rebuilt from Airtable on top — and the overlay wins. The entry that had the right key, the right time and your caption is replaced by the one that has none of that.

```ts
// app/api/schedules/route.ts — GET
const mergedSchedules = { ...localSchedules }
for (const [isoDate, entries] of Object.entries(airtableSchedules)) {
  ...
  mergedSchedules[isoDate][idx] = e   // your saved entry, gone
}
```

### Fault C — on Vercel, the file that holds your schedules doesn't survive the request

Schedules are written to `data/schedules.json`. On Vercel that path is redirected to `/tmp`, which belongs to a single serverless invocation. You save in one, you reload into another, and it starts from an empty file. The same gap means your cron runner never sees what the browser saved — so even without the key mismatch, nothing would ever post.

### Fault D — only one post per category per day can exist

This is the one that blocks what you actually want: different content every day across Feeds, Stories and Reels. When you save a second CTA Story on a date, the server matches it against the first by category and idea alone, and replaces it. Two Stories on one day silently become one.

```ts
// app/api/schedules/route.ts — POST
const existingIndex = dateEntries.findIndex(
  (e) => e.rowKey === rowKey || (e.category === category && e.idea === idea)
)  // any second Story on this date overwrites the first
```

### Fault E — the day modal never re-reads the schedules once they load

`day-detail-modal.tsx` builds its selections inside a `useState` initialiser, and React runs an initialiser exactly once, on mount. `existingSchedules` arrives from a fetch a moment later — by then the initialiser has already run against an empty array, and nothing rebuilds the state. So even with the server fixed and the right key returned, the modal would still open blank until a `useEffect` exists.

### Two more that hide the damage

- The scheduled time is written to Airtable as `2026-09-15T20:00:00.000Z` — Philippine wall-clock stamped as UTC — then read back with `getHours()` in PHT. Every schedule drifts eight hours on the round trip.
- `content-preview-modal.tsx` shows *SUCCESSFULLY UPDATED & SCHEDULED!* from inside its `catch` block, so a save that failed outright looks identical to one that worked.

---

## 2. The fix, in one sentence

> Make Airtable the only place a schedule lives, use the Airtable record ID as the key everywhere, and delete the JSON file cache entirely.

Airtable already stores `Status` and `Date and Time Scheduled` on every record — it is already a complete schedule. The JSON file is a second, competing copy that can't survive on Vercel and can't be seen by the cron runner. Removing it doesn't lose anything; it removes the disagreement.

### This costs nothing to run

The bug is fixed entirely in code you already have, deployed to the Vercel project you already have. No new service, no new account, no new bill. Specifically it does **not** require:

- Cloudflare R2 or any file storage
- A cache layer, Redis, or a database
- A second backend on Railway or anywhere else
- Changing your Airtable schema

Those appear further down because they solve *other* problems. None of them is a prerequisite for this one.

---

## 3. The work — five phases, in order

Phases 1 and 2 are the bug, and they are pure code. Phase 4 is an exposure that outranks everything else and takes twenty minutes. Phase 3 waits until something actually fails, and Phase 5 is mostly deleting things.

### Phase 1 — Stop losing schedules  · DO NOW

One working session. After this, a scheduled CTA Story survives a reload.

- [ ] **Delete `readSchedules`, `writeSchedules` and `memorySchedulesCache`** — in both `schedules/route.ts` and `schedules/runner/route.ts`. Remove `data/schedules.json` and its `.gitignore` line.
- [ ] **Rewrite `GET /api/schedules` to read Airtable only** — keep `pullAirtableSchedules()`, drop the merge. One source, no overlay, nothing to overwrite.
- [ ] **Key every entry by `recordId`, not by position** — have the day table look up its rows by the Airtable record ID the browser already holds in `out.recordId`.
- [ ] **Fix the timezone round trip** — write `2026-09-15T20:00:00+08:00`, read with an explicit `Asia/Manila` formatter instead of `getHours()`.
- [ ] **Show a real error when a save fails** — remove the success toast from the `catch` block in `content-preview-modal.tsx`. Surface the Airtable error text.
- [ ] **Re-sync the day modal when schedules arrive** — add a `useEffect` on `existingSchedules` in `day-detail-modal.tsx`.
- [ ] **Make `syncAirtableRecord()` fail loudly** — it currently tries four fallback shapes and swallows every failure with `console.warn`. Today the local file covers for that; once Airtable is the only source, a swallowed failure means the schedule never existed. Throw, and return the error to the UI.
- [ ] **Consolidate the table lists into one config module** — `pullAirtableSchedules` scans 16 hardcoded tables; `content-outputs` has a longer, different list.

> **Do not split this phase.** Deleting the file cache while the 16-table list is still incomplete would make anything scheduled in a missing table permanently invisible — a worse version of the bug you are fixing. Today the file cache quietly papers over the gap between the two lists. The last two items are what replace it.

### Phase 2 — Different content every day · DO NOW

Many Feeds, Stories and Reels on one date, each independent. Ships right after Phase 1.

- [ ] **Drop the category-and-idea match from `POST`** — match on `recordId` alone. A second CTA Story on the 15th becomes a second row, not a replacement.
- [ ] **Let a day hold any number of slots per category** — the day table currently renders a fixed row set from `content-data.json`. Render one row per scheduled record plus one empty add-row.
- [ ] **Fetch the tables in batches, not all at once** — Airtable allows 5 requests/second per base. Parallel calls will start returning 429s as you add tables.

### Phase 3 — Make the auto-posting trustworthy · WHEN IT BITES

Right now a post can be marked Posted in Airtable without ever reaching Instagram.

- [ ] **Wait for video containers to finish before publishing** — Reels and video Feeds need `GET /{container-id}?fields=status_code` polled until `FINISHED`. Publishing immediately, as the code does now, fails for most videos.
- [ ] **Make missing Meta credentials fail loudly** — `publishToInstagram` returns `success: true, isSimulated: true` when the token is absent, and the runner writes *Posted* to Airtable. One missing variable and a whole week reports as published.
- [ ] **Add a `Publishing` status as a lock** — set it before calling Meta, so an overlapping cron run skips the record instead of double-posting.
- [ ] **Write failures back to an `Error` field** — runner errors currently go into a JSON response nobody reads. Put them in Airtable so they show up in the calendar.
- [ ] **Decide where media is served from** — Meta fetches media over the public internet. Airtable attachment URLs work but expire in ~2 hours. The `/api/media` fallback returns a path into `C:\Users\User\marketing-automation`, which does not exist on any host.

### Phase 4 — Close the exposure · DO FIRST

Do this one first if you only do one thing today.

- [ ] **Rotate the Airtable token and the Meta token** — the live Airtable PAT is committed to `.env.example` and pushed to GitHub, and hardcoded as a fallback in four route files.
- [ ] **Remove the hardcoded token fallbacks** — fail on startup when `AIRTABLE_TOKEN` is missing instead of quietly using a baked-in one.
- [ ] **Scrub `.env.example` and the deploy guide** — placeholders only. `ZOHO_CATALYST_DEPLOY_GUIDE.md` also has the cron secret in plaintext.
- [ ] **Put a password in front of the app** — `/api/meta-post` and `/api/schedules` have no auth at all. Anyone with your Vercel URL can publish to the HomeCartel Instagram account.

### Phase 5 — Settle the hosting · HOUSEKEEPING

- [ ] **Set `maxDuration = 300` on the runner route** — gives the video container polling in Phase 3 room to finish inside one invocation.
- [ ] **Move the cron secret out of the URL** — cron-job.org can send an `Authorization: Bearer` header. A secret in a query string ends up in every access log.
- [ ] **Delete the daily cron from `vercel.json`** — dead weight now that cron-job.org drives the runner, and it misleads whoever reads the repo next.

---

## 4. Execution — Phases 1 and 2, file by file

Four files. Nothing outside the repo changes, and the app stays deployable at every step — the Airtable read path already exists, so you are removing a competing source rather than building a new one.

| File | What changes |
|---|---|
| `app/api/schedules/route.ts` | Drop `fs`, `path`, the `schedules.json` handlers and `memorySchedulesCache`. **GET** queries Airtable and returns every record with `Status = 'Scheduled'`, no merge. **POST** writes straight to Airtable with a `+08:00` offset and matches on `recordId` only. **DELETE** clears the scheduled fields on the record. |
| `app/api/schedules/runner/route.ts` | Read due items from the same Airtable query instead of the JSON file. The live-status re-check can go: once the query itself filters on `Status = 'Scheduled'`, a record cancelled in Airtable is already excluded, so the second check only adds a way to fail. |
| `components/content-preview-modal.tsx` | Replace the success toast in the `catch` block with the actual error text. Make sure `recordId` and `foreignKeyId` are always present in the POST payload. |
| `components/day-detail-modal.tsx` | Match rows by `recordId` and `foreignKeyId` instead of position. Add a `useEffect` that rebuilds selections when `existingSchedules` changes. |

### Verification — four tests

1. **Persistence.** Schedule a CTA Story for 10 September 2026. Reload the page. It stays visible in both the calendar grid and the day modal.
2. **Multiple posts per day.** Schedule a second Story on the same date — a Day & Night or a Product Closeup alongside the CTA. Both appear. Neither replaces the other.
3. **Philippine time.** Schedule a 09:00 post. Reload. It reads 09:00 on the same date — not 17:00, and not the day before.
4. **The runner actually sees it.** Schedule something two minutes out and wait for cron-job.org to fire. It publishes, and `Status` flips to `Posted` in Airtable. This is the test that matters — the first three only prove the browser remembers. Until this one passes, the runner is still blind to everything you schedule, which is the situation today.

---

## 5. Hosting — stay on Vercel

Fly.io was suggested before it was clear you use cron-job.org. That recommendation rested on one assumption: that Vercel's built-in cron capped you at one run per day, which is what `vercel.json` in the repo says. cron-job.org already removes that ceiling, so the reason to move is gone.

The only real Vercel constraint left is the disappearing filesystem — Fault C above. Phase 1 removes your dependence on it, and once Airtable is the source of truth there is nothing about this workload that Vercel handles badly. Hobby functions now run up to 300 seconds, which is more than enough for a Reels container to finish encoding.

| Option | What it costs you | Verdict |
|---|---|---|
| **Vercel + cron-job.org** (what you have) | Free. Needs Phase 1 done, plus `maxDuration = 300` on the runner. | **Keep** |
| **Fly.io** (Singapore region) | ~$2–5/mo and a migration. Buys a real disk, an in-process scheduler and no timeout ceiling. | Only if |
| **Railway** | ~$5/mo. Same benefits as Fly.io with less setup, slightly more money. | Only if |
| **Zoho Catalyst AppSail** | Dockerfile and guide already written, but its container filesystem is wiped on redeploy — so it needs Phase 1 too. | No gain |

**Revisit only if** Reels publishing keeps timing out after Phase 3, or you decide the app itself should host the generated videos rather than Airtable. Both point to a container with a disk. Neither is true today.

### On splitting the backend

The API routes already *are* the backend — server-side Node running on Vercel. Splitting them onto Railway means a second repo, CORS, service-to-service auth, a duplicated Airtable client and two sets of environment variables. It buys nothing here, and Railway is in the cloud too, so it can't see `C:\Users\User\marketing-automation` any better than Vercel can.

Railway genuinely earns its place for a different workload: moving the Qwen / Krea / Fal.ai generation pipeline off the PC so it runs without a computer on. That's long-running, needs a disk and a queue, and would talk to the calendar only through Airtable — a clean split, unlike splitting the API routes.

### On media storage

Airtable's own documentation says attachment URLs are expiring download URLs valid for "at least 2 hours," and that Airtable should not be used as a CDN. Meta doesn't receive the image — it receives a URL and fetches it from its own servers, so every post depends on that link still being alive at the moment Meta reaches for it.

The eventual fix is Cloudflare R2: the generation pipeline uploads the finished file, R2 returns a permanent URL, and that URL goes into a plain text field in Airtable. Free egress, 10 GB free storage, ~$0.75/month at 50 GB. The only cost is a domain for the public URL (~$10/year), since the free `r2.dev` address is rate-limited and documented as development-only.

This is not urgent. The runner already refetches the Airtable URL immediately before publishing, so the link is fresh when it's handed over. Revisit if Reels start failing on media.

---

## 6. Where to start

Rotate the Airtable and Meta tokens now — that one is exposed whether or not anyone has noticed. Then Phase 1 as a single pass, with the table-list consolidation folded in. Everything after that can wait a week without costing you anything.
