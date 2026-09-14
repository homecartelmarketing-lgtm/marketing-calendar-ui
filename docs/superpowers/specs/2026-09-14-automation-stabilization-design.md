# Marketing Automation Stabilization Design

**Status:** Proposed for review

**Date:** 2026-09-14

**Scope owner:** HomeCartel Marketing
**Companion design:** `2026-09-14-repository-documentation-organization-design.md`

## 1. Purpose

Stabilize the HomeCartel Marketing Output UI so content fetching, immediate publishing, scheduled publishing, diagnostics, and deployment are secure, observable, testable, and easy for developers and AI agents to maintain.

This is one stabilization program delivered through focused branches and pull requests. It is not one giant commit. The final production release may combine the verified work, but every subsystem must remain independently reviewable and reversible.

## 2. Non-negotiable constraints

- Preserve the current calendar UI, visual design, navigation, cards, modals, typography, colors, spacing, and responsive behavior.
- Do not add dashboards, pages, buttons, cards, filters, or decorative UI unless required for security or explicitly approved.
- Keep the existing `/scheduler-debug` page, but protect and simplify its internal implementation.
- Do not expose or log credentials, tokens, private headers, or complete external API payloads.
- Do not deploy from an unreviewed branch or push directly to `main`.
- Do not run a real Instagram publication test without an explicit test record, confirmation, and rollback/cleanup procedure.
- Do not change Airtable schemas or status values without first recording and validating the migration.
- Do not silently swallow integration failures.

## 3. Current verified baseline

- TypeScript strict checking currently passes with `npx tsc --noEmit`.
- `npm audit --omit=dev` currently reports zero known vulnerabilities.
- No lint, automated test, CI, or Markdown-link-check scripts are configured.
- `app/scheduler-debug/page.tsx` is approximately 1,322 lines.
- `components/content-preview-modal.tsx` is approximately 1,225 lines.
- `app/api/content-outputs/route.ts` is approximately 966 lines.
- `components/day-detail-modal.tsx` is approximately 782 lines.
- The content-output endpoint requests `pageSize=100` but does not follow Airtable pagination offsets.
- Several table and integration failures are ignored with `continue`, empty `catch`, or warning-only behavior.
- The scheduler debug API can mutate Airtable and publish live content without its own application-level authentication.
- The scheduler runner is protected by `CRON_SECRET`, but it also accepts query-string secrets.
- The runner uses an in-memory lock, which is not shared across Vercel instances.
- The runner scans configured Airtable content tables every minute.
- Post Now, scheduled publishing, and debug publishing call related logic through different orchestration paths.
- Vercel Pro account status has not yet been verified because the available dashboard session is signed out.

## 4. Target automation architecture

```text
Current Calendar UI
    |
    +-- Post Now ---------+
    +-- Schedule ---------+--> Application API authorization
    +-- Cancel/Reschedule-+             |
                                      v
                              Content normalization
                                      |
                                      v
                              Automation job service
                                |     |      |
                                |     |      +--> Persistent run history
                                |     +---------> Durable idempotency/lock
                                +---------------> Status state machine
                                      |
                                      v
                              Instagram publisher
                                      |
                                      v
                             Airtable final status

Vercel Pro Cron --> Authorized runner --> Due automation jobs only
```

Post Now and scheduled publishing must share the same normalized content contract and publishing service. Their only intentional difference is when the automation job becomes eligible to run.

## 5. Security boundary

### 5.1 User-facing and debug APIs

The following mutation routes require authenticated application access:

- `POST /api/meta-post`
- `POST /api/schedules`
- `DELETE /api/schedules`
- `PATCH /api/content-outputs`
- `POST /api/scheduler-debug`
- `POST /api/scheduler-debug/upload`
- `POST /api/discard-archive`

Read-only diagnostics must not reveal secrets, full private identifiers, or raw provider responses. Debug actions that publish live or mutate Airtable must require an explicit confirmation payload and authorization.

### 5.2 Cron authorization

- Keep `CRON_SECRET` in the Vercel Production environment only.
- Accept only `Authorization: Bearer <CRON_SECRET>` for the runner.
- Remove `?secret=` and `?key=` support.
- Remove the secret preview from the debug UI and API.
- Rotate the previously exposed secret before native Cron activation.

### 5.3 Environment isolation

| Environment | Scheduler | Instagram | Airtable |
|---|---|---|---|
| Local | Disabled by default | Simulation or test account | Development/test base |
| Preview | Disabled | Simulation or test account | Staging base |
| Production | Enabled | HomeCartel production account | Production base |

Production publishing credentials must not be available to ordinary Preview deployments.

## 6. Content-output fetching

### 6.1 Required corrections

- Follow every Airtable `offset` until all pages are collected.
- Apply a bounded request timeout.
- Respect Airtable request-rate constraints with controlled concurrency.
- Return partial-failure diagnostics instead of silently omitting tables.
- Deduplicate with stable identity: category, table ID, and record ID.
- Make record ordering deterministic.
- Fetch fresh attachment URLs close to publication time.
- Validate category, content idea, fixture, field mapping, and attachment type.
- Preserve the rule that generated dates and scheduled dates have different meanings.
- Detect duplicate or contradictory table mappings during startup or CI.

### 6.2 Normalized contract

```ts
export type ContentStatus =
  | "Completed"
  | "Scheduled"
  | "Publishing"
  | "Retry Pending"
  | "Posted"
  | "Failed"
  | "For Manual"
  | "Discard"

export type NormalizedMedia = {
  kind: "image" | "video" | "carousel"
  primaryUrl: string
  urls: string[]
  mimeTypes?: string[]
}

export type ContentOutput = {
  recordId: string
  tableId: string
  cid: string
  category: "Stories" | "Feeds" | "Reels"
  idea: string
  fixture?: string
  status: ContentStatus
  caption: string
  generatedAt?: string
  scheduledAt?: string
  media: NormalizedMedia
}
```

All calendar, preview, Post Now, schedule, runner, and debug code must consume this contract rather than independently guessing Airtable fields.

### 6.3 Target server modules

```text
server/content-outputs/
├── adapters/
│   ├── feeds.ts
│   ├── reels.ts
│   └── stories.ts
├── diagnostics.ts
├── field-registry.ts
├── normalize.ts
├── pagination.ts
├── repository.ts
└── types.ts
```

API routes remain thin: authorize, validate, invoke a service, and serialize a response.

## 7. Media correctness

- Determine video/image type from provider metadata when available, not only filename suffixes.
- Preserve exact slide ordering for carousels and multi-slide Stories.
- Never select draft or layout attachments as final output.
- Validate that the media URL is publicly reachable by Meta before publishing.
- Refresh expiring Airtable attachment URLs immediately before a scheduled attempt.
- Poll video containers until ready or until a documented timeout.
- Record partial publication if one Story slide succeeds and a later slide fails.
- Persist the Meta publication/container IDs needed for diagnosis.

## 8. Scheduling state machine

```text
Completed -> Scheduled -> Publishing -> Posted
                         |          \
                         |           -> For Manual
                         -> Retry Pending -> Publishing
                         -> Failed

Scheduled -> Completed       (cancel)
Scheduled -> Scheduled       (reschedule with a new timestamp/version)
```

Every transition must be implemented in one status service. Illegal transitions return a typed error rather than attempting fallback field values.

## 9. Idempotency, locking, and duplicate prevention

Each publication receives an idempotency key derived from:

```text
recordId + scheduledTimestamp + mediaVersion
```

The system must persist:

- The idempotency key
- Lock owner and expiration
- Attempt number
- Final Meta publication ID
- Final status

An in-memory `Set` may be retained only as a local optimization; it cannot be the correctness mechanism. A second Vercel instance or duplicate cron delivery must find the durable lock or completed idempotency record and must not republish.

If Meta succeeds but the Airtable status update fails, the persistent execution record remains authoritative and prevents another publish.

## 10. Persistent automation runs

```ts
export type AutomationRun = {
  jobId: string
  idempotencyKey: string
  recordId: string
  tableId: string
  scheduledAt: string
  startedAt?: string
  finishedAt?: string
  trigger: "post-now" | "vercel-cron" | "debug-test" | "retry"
  attempt: number
  status: ContentStatus
  metaPublicationIds?: string[]
  errorCode?: string
  safeErrorMessage?: string
}
```

Execution history must survive server restarts and deployments. No secrets or full provider payloads are stored.

## 11. Retry and recovery

| Failure class | Examples | Required action |
|---|---|---|
| Temporary | Timeout, provider 429, provider 5xx | Retry after 1, 5, and 15 minutes |
| Configuration | Expired token, missing permission | Stop and alert; no blind retry |
| Content | Missing/invalid media | Set For Manual |
| Duplicate | Existing completed idempotency key | Return the stored result |
| Unknown | Unexpected exception | Record failure; limited retry only |

No publication retries indefinitely. A `Publishing` job exceeding its lease becomes `Failed` or `For Manual`; it is never automatically republished without idempotency verification.

## 12. Vercel Pro Cron migration

The runner route remains. Only the trigger changes from cron-job.org to Vercel native Cron.

Target `vercel.json` behavior:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/schedules/runner",
      "schedule": "* * * * *"
    }
  ]
}
```

Cutover sequence:

1. Verify the project is on Vercel Pro.
2. Implement and test durable locking and idempotency.
3. Rotate `CRON_SECRET` and configure it for Production.
4. Deploy the Cron configuration through a pull request.
5. Choose a window with no due production posts.
6. Pause cron-job.org immediately before merging to `main`.
7. Verify at least three Vercel Cron invocations in runtime logs.
8. Schedule one controlled production test two minutes ahead.
9. Confirm exactly one Instagram publication and one Posted transition.
10. Monitor for 24–48 hours.
11. Delete the disabled cron-job.org job only after successful monitoring.

Rollback re-enables the saved cron-job.org job only after the native Cron definition is disabled or reverted. The two triggers must not run concurrently.

## 13. Scheduler efficiency

The immediate stabilization may continue using Airtable content tables, but must reduce unnecessary reads and expose failed table counts. The target architecture introduces a central Automation Queue so the runner queries due jobs instead of scanning every content table every minute.

The queue record contains content identity, scheduled time, media version, status, attempt count, idempotency key, and last safe error. Content tables remain the source of generated marketing output; the queue becomes the source of automation execution state.

## 14. Existing UI preservation and internal refactoring

Before refactoring, capture desktop and mobile screenshots of the current calendar, galleries, day modal, preview modal, scheduled-post modal, and scheduler-debug page.

Large files may be split internally into hooks and focused components, but rendered structure and behavior remain stable. No button is removed or renamed without an explicit requirement and regression coverage.

Target feature boundaries:

```text
features/
├── calendar/
├── content-preview/
└── scheduler-debug/

server/
├── airtable/
├── automation/
├── content-outputs/
├── instagram/
└── zoho/
```

## 15. Testing strategy

### Unit

- PHT date/time conversion, including day boundaries
- Airtable pagination beyond 100 records
- Content normalization and field mapping
- Media-type and slide-order selection
- Status transition validation
- Idempotency key generation
- Retry classification and schedule

### Integration with mocked providers

- Airtable success, pagination, 401/403/422/429, and partial-table failure
- Meta image, Reel, carousel, multi-slide Story, timeout, and partial publication
- Post Now and scheduled jobs produce the same normalized publish payload
- Duplicate runner invocation produces one publication
- Meta success plus Airtable failure does not republish
- Cancel and reschedule create the correct job version

### UI regression

- Current desktop and mobile calendar presentation
- Existing navigation, filters, cards, modals, and actions
- Loading, empty, partial-error, and retry states
- Double-click protection without visual redesign

### Controlled end-to-end

- One Story, one Feed, one Reel, and one carousel using staging credentials
- One cancellation, one reschedule, one retry, and one duplicate-trigger test
- One final production test after Vercel Cron cutover

## 16. Observability

Structured logs include request ID, job ID, record ID, trigger, attempt, duration, and safe result. They exclude tokens and raw authorization headers.

The protected existing debug page may display:

- Configuration presence, never values
- Last scheduler heartbeat
- Next due job
- Recent run statuses
- Retry count
- Safe provider errors
- Airtable and Meta connectivity

No additional monitoring page is introduced.

## 17. Delivery workstreams

1. Security and environment isolation
2. Test/CI foundation and UI baseline
3. Airtable schema registry and output fetching
4. Media normalization and output regression matrix
5. Unified publish service and state machine
6. Persistent runs, durable locking, retries, and recovery
7. Protected scheduler-debug refactor
8. Vercel Pro Cron migration
9. Large-file internal refactor with UI freeze
10. Documentation, operational validation, and production cutover

Each workstream uses its own `codex/<task>` branch and pull request. Production deployment occurs only from `main` after required checks pass.

## 18. Completion criteria

- The current UI remains visually and behaviorally equivalent except for confirmed bug fixes and security gates.
- All configured content combinations pass a documented output matrix.
- Airtable records beyond the first 100 are retrievable.
- Partial Airtable failures are visible and actionable.
- Post Now, Schedule, and debug tests use one publisher contract.
- Unauthorized requests cannot mutate Airtable, Zoho, or Instagram.
- Duplicate/overlapping cron invocations cannot publish twice.
- Failed jobs have bounded retries and persistent history.
- Vercel native Cron is active and cron-job.org is retired after monitoring.
- Typecheck, lint, unit tests, integration tests, build, secret scan, and Markdown link checks pass.
- Rollback and incident procedures are verified and documented.

## 19. Explicit exclusions

- No visual redesign
- No new marketing features
- No unrelated Airtable restructuring
- No new content categories without a separate request
- No replacement of Zoho WorkDrive unless separately approved
- No deletion of deployment configurations until their support status is decided
- No direct production publishing from Preview deployments
