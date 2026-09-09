# HomeCartel Scheduler Repair — revision 3

*Reviewed against the code after commit `2630494`.*

Two commits landed the whole of revision 1 plus the table-ID audit. What remains is the publishing path — and three claims in the changelog that the code does not support.

**Status:** 79 table IDs verified · 2 regressions still open · 3 changelog claims unmet · 22 items open

---

## 1. What is verified and working

Checked against the source, not the commit message.

- `schedules.json`, `readSchedules`, `writeSchedules` and `memorySchedulesCache` are gone; Airtable is the sole source of truth
- `GET /api/schedules` reads Airtable only — no merge, nothing to overwrite
- `rowKey` is the immutable Airtable record ID; `POST` matches on `recordId` alone
- Writes use `+08:00`; reads use a real `Asia/Manila` `Intl` formatter
- `syncAirtableRecord()` throws instead of swallowing failures
- `day-detail-modal` has the reactive `useEffect`, and renders extra rows for records beyond the fixed set — multiple posts per day genuinely works
- Save failures raise a real error instead of a success toast
- Airtable calls batch in fives; `maxDuration = 300` is set
- `lib/tables-config.ts` holds 85 entries with 79 unique IDs, **every one the correct 17-character shape** — the 35 invented placeholders are gone
- `content-outputs/route.ts` now imports `getAllConfiguredTables()` from the same config

---

## 2. Changelog audit — three claims the code does not support

Everything else in the changelog checks out. These three read as done and are not.

| Claim | What the code says |
|---|---|
| "Removed baked-in fallback tokens across route files" | The live Airtable PAT is still hardcoded at `app/api/content-outputs/route.ts:488`. It moved line numbers; it did not leave. That file also still defines its own `loadAutomationEnv()` alongside the shared config. |
| "Scrubbed exposed tokens" | The Airtable placeholder in `.env.example` is done. `CRON_SECRET` is still plaintext in four places: `.env.example:17` and `:20`, `VERCEL_DEPLOYMENT_GUIDE.md:49`, `ZOHO_CATALYST_DEPLOY_GUIDE.md:107`. And scrubbing a file never un-leaks Git history — the token still has to be rotated. |
| "`npm run build` compiled successfully with 0 errors" | True, but it proves less than it sounds: `next.config.mjs:5` still sets `typescript.ignoreBuildErrors: true`, so type errors cannot fail the build. 1225 ms is a cache hit, not a cold compile. |

One thing no static audit can confirm: that each verified ID is mapped to the *right* idea and fixture. The IDs are real and correctly shaped, but only verification test 1 — opening a month and checking every content type is selectable — proves the mapping.

---

## 3. Regressions still open in the publishing path

The invented table IDs are gone. These two did not move.

### A. The calendar page publishes to Instagram

`components/content-calendar.tsx:58` still sets an interval that calls the runner every sixty seconds for as long as the tab is open — a second publishing trigger alongside cron-job.org.

```ts
const interval = setInterval(async () => {
  const runnerRes = await fetch("/api/schedules/runner")   // this publishes
  ...
}, 60000)
```

Two people with the calendar open plus the cron job is three concurrent publish attempts a minute against the same records. The UI should refresh from `/api/schedules` and never touch the runner.

### B. Nothing stops the same post going out twice — or forever

Three things compound. `markAirtableRecordPosted()` still never checks `res.ok` and still swallows its own failure, so a failed write leaves the record at `Scheduled` and the next run publishes it again, every minute, until someone notices. There is still no `Publishing` lock, so concurrent runs both see it as due. And `publishToInstagram` still returns `success: true, isSimulated: true` when Meta credentials are missing, so a missing environment variable produces a fake success the runner then tries to record.

```ts
async function markAirtableRecordPosted(tableId, recordId) {
  try { await fetch(...) }
  catch (err) { console.warn(...) }   // and no res.ok check
}
```

The old JSON file recorded `Posted` locally and acted as a backstop. That backstop is gone.

### And one fix that only landed halfway

`content-outputs/route.ts:678` PATCH still writes `` `${date}T${time}:00.000Z` `` — the timezone fix reached `schedules/route.ts` and nowhere else, and that path is still live through `meta-post` and the cancel flow.

> **The shape of it now:** the data layer is sound. The thing that publishes has no brakes, and every open browser tab is a second publisher racing the cron job.

---

## 4. The work — six phases, in order

### Phase 1 — Table IDs · NEARLY CLOSED

- [x] **Export every table ID and name from the Airtable base** — done in `2630494` via the Airtable metadata API.
- [x] **Rebuild `lib/tables-config.ts` from that export** — done: 85 entries, 79 unique IDs, all correct shape.
- [ ] **Make an unreachable table loud, not silent** — `if (!res.ok) return` is what hid 35 broken IDs, and it is still there. Log the table ID and status, and return a count of failed tables so the next bad ID surfaces in a day, not a month.

### Phase 2 — Put brakes on the runner · DO NOW

The publishing path is the least safe part of the system. Do this before any end-to-end test on a real schedule.

- [ ] **Stop the browser calling the runner** — point the 60-second interval in `content-calendar.tsx` at `/api/schedules`. The UI refreshes; only cron publishes.
- [ ] **Add a `Publishing` status as a lock** — set it on the record *before* calling Meta, so a concurrent run sees it and skips.
- [ ] **Make `markAirtableRecordPosted()` check `res.ok` and throw** — a swallowed failure here is what turns one post into an endless loop.
- [ ] **Make `isAuthorized()` fail closed** — `runner/route.ts:11` returns `true` when `CRON_SECRET` is unset. A missing environment variable should stop the runner, not open it.

### Phase 3 — Finish what landed halfway · DO NOW

Two write paths that disagree is how the original bug started.

- [ ] **Apply the `+08:00` fix to `content-outputs/route.ts:678`** — still writing `.000Z`, still reached through `meta-post` and the cancel flow.
- [ ] **Finish the `content-outputs` migration** — it imports `getAllConfiguredTables()` but still keeps its own `loadAutomationEnv()` and hardcoded token. Delete both.
- [ ] **Move `pullAirtableSchedules()` into `lib/`** — it is exported from a route file and imported by another route. Next.js validates route exports; only `ignoreBuildErrors` is hiding it.
- [ ] **Turn off `typescript.ignoreBuildErrors`** — it is what let the above through, and it is why a green build means less than it should.

### Phase 4 — Close the exposure · DO FIRST

- [ ] **Rotate the Airtable token and the Meta token** — the same live PAT is in Git history and still hardcoded at `content-outputs/route.ts:488`.
- [ ] **Remove that last hardcoded fallback** — fail on startup when `AIRTABLE_TOKEN` is missing.
- [ ] **Scrub `CRON_SECRET` from the four places listed above.**
- [ ] **Put a password in front of the app** — `/api/meta-post` and `/api/schedules` still have no auth. Anyone with the Vercel URL can publish to the HomeCartel account.

### Phase 5 — Publishing reliability · WHEN IT BITES

- [ ] **Poll video containers before publishing** — Reels and video Feeds need `GET /{container-id}?fields=status_code` until `FINISHED`.
- [ ] **Make missing Meta credentials fail, not simulate** — `lib/meta-api.ts:53` is unchanged. Gate it behind an explicit `SIMULATE=1` or delete it.
- [ ] **Write failures back to an `Error` field** — runner errors go into a JSON response nobody reads.
- [ ] **Decide where media is served from** — Airtable attachment URLs expire in about two hours and Airtable documents that it is not a CDN. See the media note below.

### Phase 6 — Housekeeping · WHENEVER

- [ ] **Delete `data/schedules.json` and its `.gitignore:23` line** — both still present.
- [ ] **Add `.gitattributes` with `* text=auto eol=lf`** — CRLF churn keeps producing diffs of hundreds of unchanged lines.
- [ ] **Fix the dead branch in `getLockedForeignKeys`** — `pullAirtableSchedules` filters on `Status='Scheduled'`, so the `Posted` branch can never fire; a posted CID no longer blocks rescheduling.
- [ ] **Move the cron secret to an `Authorization` header** — a secret in a query string lands in every access log.
- [ ] **Delete the daily cron from `vercel.json`** — dead weight now that cron-job.org drives the runner.

---

## 5. Verification — five tests, in this order

**Test 5 publishes to the real account. Do not run it until Phase 2 is done** — without the lock, a failed status write turns one test post into a loop.

1. **Every content type appears.** Open a month and confirm Tips & Educational, Myth vs Fact, Product Showcase, This or That and Before/After are all selectable with real CIDs. This is the only real proof that the 79 IDs are mapped to the right ideas and fixtures.
2. **Persistence.** Schedule a CTA Story, reload, and it stays — in both the calendar grid and the day modal.
3. **Multiple posts per day.** Schedule a second Story on the same date. Both appear. Neither replaces the other.
4. **Philippine time, both write paths.** Schedule a 09:00 post, reload, confirm 09:00 on the same date. Then cancel and reschedule through the preview modal — the path that goes via `content-outputs` — and check the time again.
5. **One post, exactly once.** Schedule something two minutes out with the calendar tab *closed*. Let cron-job.org fire. It publishes once, `Status` flips to `Posted`, and the next run skips it. Repeat with the tab open — still exactly one post.

---

## 6. Hosting — stay on Vercel

Fly.io was suggested before it was clear cron-job.org drives the runner. That rested on Vercel's built-in cron capping you at one run per day, which is what `vercel.json` still says. cron-job.org already removes that ceiling. The only real Vercel constraint was the disappearing filesystem, and that dependency is now gone. Hobby functions run up to 300 seconds, which covers a Reels container finishing its encode.

| Option | What it costs you | Verdict |
|---|---|---|
| **Vercel + cron-job.org** (what you have) | Free. The filesystem dependency it disliked is already removed. | **Keep** |
| **Fly.io** (Singapore region) | ~$2–5/mo and a migration. Buys a real disk, an in-process scheduler and no timeout ceiling. | Only if |
| **Railway** | ~$5/mo. Same benefits, less setup, slightly more money. | Only if |
| **Zoho Catalyst AppSail** | Dockerfile and guide already written, but its container filesystem is wiped on redeploy. | No gain |

**A separate backend is not the answer.** The API routes already are the backend — server-side Node on Vercel. Splitting them onto Railway means a second repo, CORS, service-to-service auth and duplicated Airtable code, and Railway is in the cloud too, so it can see `C:\Users\User\marketing-automation` no better than Vercel can. Railway earns its place for a different job: moving the Qwen / Krea / Fal.ai generation pipeline off the PC, talking to the calendar only through Airtable.

**On media.** Meta does not receive the image — it receives a URL and fetches it from its own servers, so every post depends on that link still being alive when Meta reaches for it. Airtable's own documentation says attachment URLs last "at least 2 hours" and that Airtable is not a CDN. Cloudflare R2 is the eventual fix: permanent URL in a plain text field, free egress, 10 GB free, about $0.75/month at 50 GB, plus roughly $10/year for a domain to serve it from. Not urgent — the runner refetches the URL immediately before publishing. Revisit if Reels start failing on media.

---

## 7. Where to start

Rotate the tokens, then Phase 2. The data layer is sound now; the publishing path is the weakest part of the system, and every open browser tab is currently a second publisher racing the cron job.
