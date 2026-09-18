# Architecture: System Blueprint & End-to-End Data Flow

#architecture #system-blueprint #overview

This document outlines the high-level architecture of the **Marketing Output UI** application, its external dependencies, and how data moves across the system from content generation to Instagram publication.

---

## 🗺️ System Component Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 Operator UI                  │
                  │  (Content Calendar, Modals, Scheduler-Debug) │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTP (JSON)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Next.js Application Layer                              │
│                                                                                 │
│   GET /api/content-outputs ──► Reads Airtable candidate records                 │
│   POST /api/schedules     ──► Atomic Queue Job + Airtable Status Update         │
│   POST /api/schedules/runner ─► Claims due Postgres jobs, publishes to Meta     │
│   POST /api/meta-post     ──► Instant Post-Now bypassing queue                  │
│   POST /api/schedules/trigger ─► Internal runner trigger for due jobs           │
└───────────────┬─────────────────────────┬────────────────────────┬──────────────┘
                │                         │                        │
                ▼                         ▼                        ▼
     ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
     │   Neon PostgreSQL   │   │    Airtable API     │   │   Meta Graph API    │
     │  (Durable Queue &   │   │  (Content Outputs,  │   │  (Instagram Feed &  │
     │   Execution Runs)   │   │   Schedules, CID)   │   │   Reels Publishing) │
     └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
                ▲
                │ HTTP Trigger (Cron Secret)
     ┌─────────────────────┐
     │  Vercel Cron Job    │
     │  (Every 1-5 mins)   │
     └─────────────────────┘
```

---

## 🔄 Core End-to-End Workflows

### 1. Candidate Content Discovery (`GET /api/content-outputs`)
* **Trigger**: User opens the calendar day detail modal or content preview modal.
* **Flow**:
  1. Server scans candidate Airtable output tables (Moodboard #1, Moodboard #2 Feed, Day & Night, Style Reels).
  2. Strict status filter: Only records with status `Completed`, `Complete`, or `Done` are loaded (excluding `For Manual` and `Discard`).
  3. Media extraction rules apply (see [[architecture/output-media-selection|Output Media Selection Rules]]): checks attachment fields and validates required images/videos.
  4. Deduplicates planned slots so each concept appears once.

### 2. Post Scheduling (`POST /api/schedules`)
* **Trigger**: User selects a scheduled date/time (PHT) and clicks "Confirm" or "Tag as Scheduled".
* **Flow**:
  1. Validates future PHT timestamp (`Asia/Manila` timezone).
  2. Computes SHA-256 hash of media attachments to detect upstream tampering.
  3. Enqueues atomic job into Neon Postgres table `automation_jobs` (status: `pending`).
  4. Updates matching Airtable record status to `Scheduled` with the validated PHT timestamp.
  5. If already due at the moment of scheduling, fires background request to `/api/schedules/trigger`.

### 3. Queue Execution Runner (`POST /api/schedules/runner`)
* **Trigger**: Vercel Cron or manual trigger from `/scheduler-debug`.
* **Security**: Strictly enforces `Authorization: Bearer <CRON_SECRET>`.
* **Flow**:
  1. Checks `AUTOMATION_KILL_SWITCH`. If true, skips execution.
  2. Claims due jobs using Postgres `FOR UPDATE SKIP LOCKED` to prevent duplicate parallel runners.
  3. Calls Meta Graph API to create media container and publish to Instagram.
  4. Saves Meta Publication ID to database run log (`automation_runs`).
  5. Syncs Airtable status to `Posted` (if Airtable sync fails, logs `statusSyncWarning` without re-posting).

---

## 🔑 Environment Variables & Services

| Variable Name | Purpose | Criticality |
| :--- | :--- | :--- |
| `POSTGRES_DATABASE_URL` / `DATABASE_URL` | Neon Postgres durable queue connection string | **CRITICAL** (Falls back to mock in-memory DB if missing) |
| `CRON_SECRET` | Bearer token protecting `/api/schedules/runner` | **CRITICAL** (Blocks unauthorized runner triggers) |
| `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID` | Airtable API access for content records | **CRITICAL** |
| `META_ACCESS_TOKEN` / `META_PAGE_ID` | Meta Graph API credentials for Instagram | **CRITICAL** |
| `AUTOMATION_KILL_SWITCH` | Emergency brake (`true`/`false`) halting publishing | Safety control |

---

## 🔗 Related Notes
- [[architecture/durable-scheduling-queue|Durable Scheduling Queue Deep-Dive]]
- [[architecture/output-media-selection|Output Media Selection Rules]]
- [[troubleshooting/durable-queue-and-cron|Troubleshooting Durable Queue & Cron]]
- [[troubleshooting/meta-api-errors|Troubleshooting Meta API Errors]]
