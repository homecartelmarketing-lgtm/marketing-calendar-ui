# Graph Report - Marketing Output UI  (2026-11-03)

## Corpus Check
- 157 files · ~176,849 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .bat 3, .example 1)

## Summary
- 1148 nodes · 1855 edges · 103 communities (93 shown, 10 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 161 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b87ee64`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- content.ts
- discard-archive/route.ts
- Vitest Setup
- day-detail-modal.tsx
- schedules.ts
- extractOutputMedia
- launch_ui_cloudflare.py
- content-outputs/route.ts
- content-calendar.tsx
- Session Log: 2026-10-01 — October Calendar Time Shift Fix
- Marketing Automation Stabilization Design
- compilerOptions
- runner/route.ts
- components.json
- content-preview-modal.tsx
- universal-content-gallery.tsx
- Content Calendar Persistence — Design
- package.json
- client.ts
- durable-scheduling.test.ts
- Writing tests
- dependencies
- jobs.ts
- Agent steps
- executeSql
- ContentCalendar
- Patterns
- 🎨 Pipeline Media Requirements
- Session Log: 2026-10-21 — Meta Graph API Token Health Audit & Refresh Runbook
- devDependencies
- Setting up e2e
- 🛠️ Summary of Changes
- Implementation Plan: One Part Per Room Reel 2.0s Timing & Precision Hybrid Item Tagging
- Repository and Documentation Organization Design
- Zoho WorkDrive Integration & OAuth Setup Guide
- next-dev-loop
- Next.js App Router Patterns
- Session Log: 2026-10-26 — Content Calendar Persistent Import
- Running a bug bash
- Ship the Marketing Output UI
- docs/README.md
- records.ts
- button.tsx
- Architecture: System Blueprint & End-to-End Data Flow
- HomeCartel Scheduler Repair — revision 3 (historical)
- Automation Stabilization Implementation Plan
- Exploring without a test
- Running tests
- e2e: agentic end-to-end tests
- Instagram publishing (Meta Graph API)
- Cloudflare Quick Tunnel Sharing Guide — Marketing Output UI
- Architecture: Durable Scheduling Queue
- main
- Auto-caption for every Feed and Reel (no fallback template)
- ADR: <Title of Decision>
- 🚨 Error Catalog & Diagnostics
- MockDatabase
- 🚀 24/7 Zero-Cost Backend Hosting Guide (Vercel + Cron-job.org)
- syncAirtableRecord
- scheduler-debug/page.tsx
- Debugging a failing run
- Driving the app over MCP
- 🧭 Navigation & Maps of Content
- Session Log: 2026-10-22 — Supabase Scheduler Queue Health & Audit
- Session Log: 2026-10-29 — Feed & Reel Universal Caption Mapping & Implementation Plan
- Obsidian Vault Setup & User Guide
- Session Log: YYYY-MM-DD — <Title>
- 🚨 Error Catalog
- oct-calendar_01f93b95.md
- scripts
- layout.tsx
- Durable scheduler and queue
- Session Log: 2026-09-28 — October 2026 Calendar Integration & Grid Import Support
- Session Log: 2026-10-07 — House Tour Reel Table Integration
- Session Log: 2026-10-12 — This Mood Every Night Reel Table Integration
- Session Log: 2026-10-15 — Day & Night Story Tagged Item Name Thumbnail Extraction
- Session Log: 2026-10-27 — Moodboard Story Tagged Blended Image Media Selection
- Repository Organization Implementation Plan
- 4. Root files and ownership
- Troubleshooting: <Error or Issue Name>
- 🚨 Error Catalog & Diagnostics
- Troubleshooting: Cloudflare Tunnel & Local Proxy
- Content-Calendar-b79912_f0c79065.md
- vitest
- 4. The work — six phases, in order
- Session Log: 2026-09-16 — Durable Queue Stabilization & Production Deployment
- Session Log: 2026-09-18 — Obsidian Memory Vault Integration & System Blueprint
- Session Log: 2026-11-03 — Moodboard #1 Feed 3-Photo Carousel Media Selection & Graphify Integration
- Content Calendar Persistence Implementation Plan
- 15. Testing strategy
- 6. Git workflow
- Session Log: 2026-09-18 — Day & Night Story Table Configuration & Foreign Key Display Fix
- Stabilization progress — 2026-09-14
- 6. Content-output fetching
- vercel.json
- AGENTS.md
- next.config.mjs
- postcss.config.mjs
- HomeCartel Marketing Output UI

## God Nodes (most connected - your core abstractions)
1. `main()` - 27 edges
2. `syncAirtableRecord()` - 24 edges
3. `extractOutputMedia()` - 22 edges
4. `next` - 20 edges
5. `Marketing Automation Stabilization Design` - 20 edges
6. `ContentCalendar()` - 19 edges
7. `vitest` - 19 edges
8. `createOrReplaceScheduledJob()` - 18 edges
9. `isMockDb()` - 18 edges
10. `executeSql()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `🚦 Candidate Status Filters (`isCompletedOrDoneStatus`)` --references--> `isCompletedOrDoneStatus()`  [INFERRED]
  docs/architecture/output-media-selection.md → app/api/content-outputs/route.ts
- `3. Discarded and Manual Items Appearing in Feed` --references--> `isCompletedOrDoneStatus()`  [INFERRED]
  docs/troubleshooting/airtable-sync-issues.md → app/api/content-outputs/route.ts
- `Implemented locally` --references--> `postNowToMeta()`  [INFERRED]
  docs/operations/implementation-progress.md → components/content-preview-modal.tsx
- `Non-negotiable rules` --references--> `main()`  [INFERRED]
  .claude/skills/ship-output-ui/SKILL.md → launch_ui_cloudflare.py
- `Red flags` --references--> `main()`  [INFERRED]
  .claude/skills/ship-output-ui/SKILL.md → launch_ui_cloudflare.py

## Import Cycles
- 1-file cycle: `lib/content.ts -> lib/content.ts`

## Communities (103 total, 10 thin omitted)

### Community 0 - "content.ts"
Cohesion: 0.05
Nodes (71): dynamic, failure(), GET(), MAX_UPLOAD_BYTES, POST(), revalidate, Read the failure, 🛠️ Work Done & Changes (+63 more)

### Community 1 - "discard-archive/route.ts"
Cohesion: 0.06
Nodes (29): DiscardArchiveRequestBody, dynamic, fetchMediaBuffer(), getOrCreateZohoFolder(), getZohoAccessToken(), maxDuration, POST(), dynamic (+21 more)

### Community 2 - "Vitest Setup"
Cohesion: 0.07
Nodes (27): Cloudflare Workers, Fake timers, For a Hono API route (e.g. `src/routes/health.ts`):, For a React component (e.g. `src/components/Button.tsx`):, For a utility function (e.g. `src/utils/format.ts`):, Global stubs, Jest Migration, Mocking Reference (+19 more)

### Community 3 - "day-detail-modal.tsx"
Cohesion: 0.15
Nodes (23): getTableIdsForPipeline(), matchIdeaTarget(), normalizeIdeaForMatching(), buildSelectionsFromSchedules(), ContentRow(), DayDetailModal(), Dropdown(), DropdownOption (+15 more)

### Community 4 - "schedules.ts"
Cohesion: 0.18
Nodes (19): dynamic, GET(), maxDuration, revalidate, settleWithin(), Phase 3 — Finish what landed halfway · DO NOW, getMetaConfig(), clearSchedulesCache() (+11 more)

### Community 5 - "extractOutputMedia"
Cohesion: 0.14
Nodes (20): Adding a pipeline table, Airtable output mapping, Common failures, Non-negotiable rules, Red flags, Tests, When to use, 🛠️ Work Done & Changes (+12 more)

### Community 6 - "launch_ui_cloudflare.py"
Cohesion: 0.11
Nodes (4): cleanup(), copy_to_clipboard(), ensure_cloudflared_binary(), start_nextjs_server()

### Community 7 - "content-outputs/route.ts"
Cohesion: 0.16
Nodes (14): dynamic, formatDateDisplay(), GET(), getTableTargetsForPipeline(), isCompletedOrDoneStatus(), normalizeStatus(), PATCH(), revalidate (+6 more)

### Community 8 - "content-calendar.tsx"
Cohesion: 0.20
Nodes (11): CalendarLegend(), ActiveContent, NAV_ITEMS, ScheduledPostsModal(), MONTH_NAMES, NAV_MENUS, NavKey, ScheduledEntry (+3 more)

### Community 9 - "Session Log: 2026-10-01 — October Calendar Time Shift Fix"
Cohesion: 0.11
Nodes (17): 🐞 Errors Encountered & Fixed, 🐞 Errors Encountered & Fixed, 📁 Files Touched, 📁 Files Touched, 🎯 Goals & Objectives, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, 🔮 Next Steps & Action Items (+9 more)

### Community 10 - "Marketing Automation Stabilization Design"
Cohesion: 0.11
Nodes (19): 10. Persistent automation runs, 11. Retry and recovery, 12. Vercel Pro Cron migration, 13. Scheduler efficiency, 14. Existing UI preservation and internal refactoring, 16. Observability, 18. Completion criteria, 19. Explicit exclusions (+11 more)

### Community 11 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 12 - "runner/route.ts"
Cohesion: 0.18
Nodes (16): dynamic, GET(), isAuthorized(), isKillSwitchActive(), isLivePublishAllowed(), maxDuration, POST(), Non-negotiable rules (+8 more)

### Community 13 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 14 - "content-preview-modal.tsx"
Cohesion: 0.15
Nodes (13): ContentPreviewModal(), cancelSchedule(), confirmStatusChange(), postNowToMeta(), schedulePost(), untagAsScheduled(), DetailRow(), getTodayPht() (+5 more)

### Community 15 - "universal-content-gallery.tsx"
Cohesion: 0.14
Nodes (7): OutputItem, ContentCard(), STATUS_BADGE_STYLES, STATUS_OPTIONS, StatusFilter, UniversalContentGallery(), VideoPlayer()

### Community 16 - "Content Calendar Persistence — Design"
Cohesion: 0.12
Nodes (17): 1. Database table, 3. API — `app/api/calendar/route.ts`, 4. Client — `components/content-calendar.tsx`, 5. Seed script — `scripts/parse-calendar.mjs`, Architecture, Content Calendar Persistence — Design, Data flow, Decisions (+9 more)

### Community 17 - "package.json"
Cohesion: 0.12
Nodes (16): name, private, version, jsdom, postcss, react-dom, shadcn, tailwindcss (+8 more)

### Community 18 - "client.ts"
Cohesion: 0.17
Nodes (13): dynamic, isAuthorized(), maxDuration, POST(), Key files and responsibilities, @neondatabase/serverless, postgres, AutomationJobRow (+5 more)

### Community 19 - "durable-scheduling.test.ts"
Cohesion: 0.18
Nodes (11): DELETE(), dynamic, GET(), POST(), revalidate, dynamic, maxDuration, POST() (+3 more)

### Community 20 - "Writing tests"
Cohesion: 0.12
Nodes (16): A complete file, Actions, app, Contents, expect, Fixtures, Habits, Locators (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @base-ui/react, class-variance-authority, clsx, lucide-react, @neondatabase/serverless, next, postgres (+7 more)

### Community 22 - "jobs.ts"
Cohesion: 0.24
Nodes (11): dynamic, isAuthorized(), maxDuration, POST(), normalizePhtTime(), computeMediaVersion(), CreateJobInput, createOrReplaceScheduledJob() (+3 more)

### Community 23 - "Agent steps"
Cohesion: 0.14
Nodes (14): act: one goal, Agent steps, assert, waitFor, extract: one question, Beyond the built-in agent, Budgets and cost, Choose an agent, Configure a model, Contents (+6 more)

### Community 24 - "executeSql"
Cohesion: 0.28
Nodes (12): dynamic, GET(), isAuthorized(), maxDuration, Non-negotiable rules, claimDueJobs(), recordJobFailure(), recordJobSuccess() (+4 more)

### Community 25 - "ContentCalendar"
Cohesion: 0.18
Nodes (7): Page(), CalendarGrid(), CalendarNav(), ContentCalendar(), formatImportDate(), handleImportFile(), loadSavedCalendar()

### Community 26 - "Patterns"
Cohesion: 0.15
Nodes (12): Caching Strategies, Data Cache, nextjs-app-router-patterns — detailed patterns and worked examples, Pattern 1: Server Components with Data Fetching, Pattern 2: Client Components with 'use client', Pattern 3: Server Actions, Pattern 4: Parallel Routes, Pattern 5: Intercepting Routes (Modal Pattern) (+4 more)

### Community 28 - "🎨 Pipeline Media Requirements"
Cohesion: 0.15
Nodes (13): 1. Moodboard #2 Feed (Strict 2-Photo Carousel), 2. Moodboard #1 Feed (Strict 3-Photo Carousel), 3. Day & Night Story, 4. Day & Night Feed, 5. Style Reel Slideshow, 6. One Light at a Time Reel, 7. House Tour Reel, 8. This Mood Every Night Reel (+5 more)

### Community 29 - "Session Log: 2026-10-21 — Meta Graph API Token Health Audit & Refresh Runbook"
Cohesion: 0.15
Nodes (13): 🐞 Errors Encountered & Fixed, 📁 Files Touched, Files Touched, Findings & Root Cause Analysis, Goals & Context, 🎯 Goals & Objectives, 🔍 Investigation: Scheduled Content Not Pushing Through, 🚀 Migration: Moving Scheduler Queue to Supabase Postgres (+5 more)

### Community 30 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react, @types/node (+5 more)

### Community 31 - "Setting up e2e"
Cohesion: 0.17
Nodes (12): Contents, Done when, Environment variables the runner reads, Existing MCP registration, Let the runner start the app, Mobile targets, Requirements, Scaffold (+4 more)

### Community 32 - "🛠️ Summary of Changes"
Cohesion: 0.17
Nodes (11): 1. [`lib/output-media.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/lib/output-media.ts), 2. [`lib/output-mapping.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/lib/output-mapping.ts), 3. [`tests/output-media.test.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/tests/output-media.test.ts), 4. [`tests/content-outputs.test.ts`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/tests/content-outputs.test.ts), 5. Documentation & Knowledge Base, 📊 Airtable Tables Verified, 📌 Executive Summary, 🛠️ Summary of Changes (+3 more)

### Community 33 - "Implementation Plan: One Part Per Room Reel 2.0s Timing & Precision Hybrid Item Tagging"
Cohesion: 0.17
Nodes (11): 1. Automation Pipeline (`C:\Users\User\Desktop\marketing-automation`), 2. Marketing Output UI (`c:\Users\User\Downloads\Marketing Output UI`), 🏗️ Architecture & Data Flow, Automated Tests, 🎯 Goal Description, Implementation Plan: One Part Per Room Reel 2.0s Timing & Precision Hybrid Item Tagging, Manual Verification, [MODIFY] `app/api/content-outputs/route.ts` (+3 more)

### Community 34 - "Repository and Documentation Organization Design"
Cohesion: 0.17
Nodes (12): 10. Documentation quality gates, 11. Implementation workstreams, 12. Completion criteria, 13. Actions requiring explicit user approval, 1. Purpose, 2. Core organization rules, 3. Target repository documentation tree, 5. Existing Markdown disposition (+4 more)

### Community 35 - "Zoho WorkDrive Integration & OAuth Setup Guide"
Cohesion: 0.17
Nodes (11): Expected Response:, 🚀 How it Works in Marketing Output UI, In Bash / Command Prompt with curl:, In PowerShell:, 🔑 Step 1: Open Zoho API Console, 📋 Step 2: Obtain Client ID & Client Secret, 🔄 Step 3: Generate the Grant Code, 🎟️ Step 4: Exchange the Code for a Permanent Refresh Token (+3 more)

### Community 36 - "next-dev-loop"
Cohesion: 0.18
Nodes (10): after the edit — verify, before the edit — narrow the scope, gotchas, loop, next-dev-loop, preflight, reference, Report Next.js friction (+2 more)

### Community 37 - "Next.js App Router Patterns"
Cohesion: 0.18
Nodes (10): 1. Rendering Modes, 2. File Conventions, Best Practices, Core Concepts, Detailed patterns and worked examples, Do's, Don'ts, Next.js App Router Patterns (+2 more)

### Community 38 - "Session Log: 2026-10-26 — Content Calendar Persistent Import"
Cohesion: 0.18
Nodes (10): 🔮 Continuation Record for Tomorrow (2026-10-27), 📁 Files Touched, 📁 Files Touched, 🎯 Goals & Objectives, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, ⚠️ Not Proven Here, Session Log: 2026-10-26 — Content Calendar Persistent Import (+2 more)

### Community 39 - "Running a bug bash"
Cohesion: 0.20
Nodes (10): 1. Prepare, 2. Plan charters, 3. Fan out, 4. Merge, 5. Triage, 6. Verify, 7. Report, Contents (+2 more)

### Community 40 - "Ship the Marketing Output UI"
Cohesion: 0.20
Nodes (9): Commit, Emergency stop, Non-negotiable rules, Pre-ship checklist, Push and PR, Red flags, Ship the Marketing Output UI, Vercel (+1 more)

### Community 42 - "records.ts"
Cohesion: 0.31
Nodes (7): AirtableReadError, AirtableRecord, paceRead(), readAirtableRecordById(), readAirtableRecords(), readQueues, options

### Community 43 - "button.tsx"
Cohesion: 0.31
Nodes (7): Button(), buttonVariants, cn(), @base-ui/react, class-variance-authority, clsx, tailwind-merge

### Community 44 - "Architecture: System Blueprint & End-to-End Data Flow"
Cohesion: 0.22
Nodes (9): 1. Candidate Content Discovery (`GET /api/content-outputs`), 2. Post Scheduling (`POST /api/schedules`), 3. Queue Execution Runner (`POST /api/schedules/runner`), Architecture: System Blueprint & End-to-End Data Flow, Content Calendar import (`/api/calendar`), 🔄 Core End-to-End Workflows, 🔑 Environment Variables & Services, 🔗 Related Notes (+1 more)

### Community 45 - "HomeCartel Scheduler Repair — revision 3 (historical)"
Cohesion: 0.22
Nodes (9): 2. Changelog audit — three claims the code does not support, 3. Regressions still open in the publishing path, 5. Verification — five tests, in this order, 6. Hosting — stay on Vercel, 7. Where to start, A. The calendar page publishes to Instagram, And one fix that only landed halfway, B. Nothing stops the same post going out twice — or forever (+1 more)

### Community 46 - "Automation Stabilization Implementation Plan"
Cohesion: 0.22
Nodes (9): 1. Output fetching and regression harness, 2. Security and environment boundaries, 3. Mapping and media correctness, 4. Shared publishing and durable state, 5. Existing diagnostics and UI regression, 6. CI, Cron migration, and operational verification, Automation Stabilization Implementation Plan, Constraints and evidence rules (+1 more)

### Community 47 - "Exploring without a test"
Cohesion: 0.25
Nodes (7): Contents, Exploring without a test, Flags, Reading the result, Start signed in, What a run does, When it does not fit

### Community 48 - "Running tests"
Cohesion: 0.25
Nodes (7): Commands, Contents, Continuous integration, Exit codes, Output, Running tests, The replay cache

### Community 49 - "e2e: agentic end-to-end tests"
Cohesion: 0.25
Nodes (8): e2e: agentic end-to-end tests, Feedback, Quick start, Rerunning a test while you fix it, Rules, Start here: pick the reference for the job, Workflow: fixing a failed test, Workflow: writing a test

### Community 50 - "Instagram publishing (Meta Graph API)"
Cohesion: 0.25
Nodes (7): Failure catalog, Instagram publishing (Meta Graph API), Publish flows, Red flags, Tests before claiming a fix, When to use, Where to change what

### Community 51 - "Cloudflare Quick Tunnel Sharing Guide — Marketing Output UI"
Cohesion: 0.25
Nodes (7): 1. Quickstart (How to Share with Coworkers), 2. Coworker Capabilities & Access Model, 3. How It Works (Architecture), 4. Keeping the Tunnel Active & Shutting Down, Cloudflare Quick Tunnel Sharing Guide — Marketing Output UI, Method A: Double-Click (Recommended for Windows), Method B: Command Line (CLI)

### Community 52 - "Architecture: Durable Scheduling Queue"
Cohesion: 0.25
Nodes (8): 1. Atomic Locking (`FOR UPDATE SKIP LOCKED`), 2. Media Tampering Detection (`media_hash`), 3. Idempotent Publication ID Recording, Architecture: Durable Scheduling Queue, 🔒 Concurrency & Race Condition Safeguards, 💾 Database Schema (`server/db/schema.sql`), 🔗 Related Notes, 🔁 Retry Backoff Policy

### Community 53 - "main"
Cohesion: 0.32
Nodes (7): Backtracking a release, GitHub workflow and backtracking, Remote settings still to verify, 17. Delivery workstreams, 2. Non-negotiable constraints, is_server_healthy(), main()

### Community 54 - "Auto-caption for every Feed and Reel (no fallback template)"
Cohesion: 0.25
Nodes (7): Auto-caption for every Feed and Reel (no fallback template), Context, Design, Docs, Not in scope / needs your OK, Tests (stdlib unittest), Verification

### Community 55 - "ADR: <Title of Decision>"
Cohesion: 0.25
Nodes (7): ADR: <Title of Decision>, Considered Options, context & Problem Statement, Decision Drivers, Decision Outcome, Negative Consequences / Trade-offs, Positive Consequences

### Community 56 - "🚨 Error Catalog & Diagnostics"
Cohesion: 0.25
Nodes (8): 1. `cannot insert multiple commands into a prepared statement`, 2. `usingMockDb: true` in Vercel Deployment, 3. Airtable Shows `Scheduled` but Queue Has 0 Jobs, 4. Separate Neon Databases for Preview vs Production, 5. Halting All Automated Posts (`AUTOMATION_KILL_SWITCH`), 🚨 Error Catalog & Diagnostics, 🔗 Related Notes, Troubleshooting: Durable Queue & Vercel Cron

### Community 58 - "🚀 24/7 Zero-Cost Backend Hosting Guide (Vercel + Cron-job.org)"
Cohesion: 0.25
Nodes (7): 🚀 24/7 Zero-Cost Backend Hosting Guide (Vercel + Cron-job.org), 🏗️ Architecture Summary, 🛠️ Step 1: Push Code to GitHub, ⚡ Step 2: Deploy to Vercel (100% Free), 🔑 Step 3: Configure Environment Variables in Vercel, ⏰ Step 4: Configure 24/7 Auto-Posting with Cron-job.org, ✅ Step 5: Verification & Health Check

### Community 59 - "syncAirtableRecord"
Cohesion: 0.43
Nodes (6): POST(), POST(), 1. What is verified and working, phtScheduleTimestamp(), ScheduleValidationError, syncAirtableRecord()

### Community 60 - "scheduler-debug/page.tsx"
Cohesion: 0.29
Nodes (4): CandidateFixture, ScheduledItem, SystemDiagnostics, @testing-library/react

### Community 61 - "Debugging a failing run"
Cohesion: 0.29
Nodes (6): Contents, Debugging a failing run, Error codes, Flaky tests, Is it the app?, Tools

### Community 62 - "Driving the app over MCP"
Cohesion: 0.29
Nodes (6): Contents, Driving the app over MCP, Rules, Setup, Tools, Workflow

### Community 63 - "🧭 Navigation & Maps of Content"
Cohesion: 0.29
Nodes (7): 1. 📅 Daily Session Logs (Work History & Context), 2. 🛠️ Troubleshooting & Runbooks (Bug Fixes), 3. 🏗️ Architecture & System Blueprint, 4. 📝 Note Templates, 🧭 Navigation & Maps of Content, 🧠 Project Knowledge Base & Memory Vault, 🏷️ Tags & Quick Filters

### Community 64 - "Session Log: 2026-10-22 — Supabase Scheduler Queue Health & Audit"
Cohesion: 0.29
Nodes (6): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-22 — Supabase Scheduler Queue Health & Audit, 🛠️ Work Done & Changes

### Community 65 - "Session Log: 2026-10-29 — Feed & Reel Universal Caption Mapping & Implementation Plan"
Cohesion: 0.29
Nodes (6): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-29 — Feed & Reel Universal Caption Mapping & Implementation Plan, 🛠️ Work Done & Changes

### Community 66 - "Obsidian Vault Setup & User Guide"
Cohesion: 0.29
Nodes (6): 🤖 How AI Assistants (Antigravity & Claude) Use This Memory, 🗺️ How the Vault is Structured, Obsidian Vault Setup & User Guide, 🚀 Quickstart: Opening in Obsidian (1 Minute), ⚙️ Recommended Obsidian Settings, 🔒 Security & Git Hygiene

### Community 67 - "Session Log: YYYY-MM-DD — <Title>"
Cohesion: 0.29
Nodes (6): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: YYYY-MM-DD — <Title>, 🛠️ Work Done & Changes

### Community 68 - "🚨 Error Catalog"
Cohesion: 0.29
Nodes (7): 1. `OAuthException` / Code 190 (Token Expired or Invalidated), 2. Carousel Item Container Creation Failure (Code 36003 or 100), 3. Video Container Not Ready (Code 2207001 or Polling Timeout), 4. Meta Succeeded, but Airtable Status Sync Failed (`statusSyncWarning`), 🚨 Error Catalog, 🔗 Related Notes, Troubleshooting: Meta Graph API Errors

### Community 69 - "oct-calendar_01f93b95.md"
Cohesion: 0.29
Nodes (6): Sheet: August, Sheet: Auto Compute, Sheet: Caption, Sheet: July, Sheet: October, Sheet: September

### Community 70 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, start, test, test:watch, typecheck

### Community 71 - "layout.tsx"
Cohesion: 0.33
Nodes (3): metadata, viewport, @vercel/analytics

### Community 72 - "Durable scheduler and queue"
Cohesion: 0.33
Nodes (5): Diagnostic runbook, Durable scheduler and queue, Red flags, Tests, When to use

### Community 73 - "Session Log: 2026-09-28 — October 2026 Calendar Integration & Grid Import Support"
Cohesion: 0.33
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-09-28 — October 2026 Calendar Integration & Grid Import Support

### Community 74 - "Session Log: 2026-10-07 — House Tour Reel Table Integration"
Cohesion: 0.33
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-07 — House Tour Reel Table Integration

### Community 75 - "Session Log: 2026-10-12 — This Mood Every Night Reel Table Integration"
Cohesion: 0.33
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-12 — This Mood Every Night Reel Table Integration

### Community 76 - "Session Log: 2026-10-15 — Day & Night Story Tagged Item Name Thumbnail Extraction"
Cohesion: 0.33
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-15 — Day & Night Story Tagged Item Name Thumbnail Extraction

### Community 77 - "Session Log: 2026-10-27 — Moodboard Story Tagged Blended Image Media Selection"
Cohesion: 0.33
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-10-27 — Moodboard Story Tagged Blended Image Media Selection

### Community 78 - "Repository Organization Implementation Plan"
Cohesion: 0.33
Nodes (6): 1. Entry points and AI instructions, 2. Consolidate existing material, 3. Developer and operator references, 4. GitHub and documentation gates, Completion evidence, Repository Organization Implementation Plan

### Community 79 - "4. Root files and ownership"
Cohesion: 0.33
Nodes (6): 4. Root files and ownership, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `SECURITY.md`

### Community 80 - "Troubleshooting: <Error or Issue Name>"
Cohesion: 0.33
Nodes (6): 🛡️ Prevention & Regression Testing, 🔗 Related Notes, 🔍 Root Cause, 🛠️ Step-by-Step Resolution, 🚨 Symptom, Troubleshooting: <Error or Issue Name>

### Community 81 - "🚨 Error Catalog & Diagnostics"
Cohesion: 0.33
Nodes (6): 1. Missing Records Beyond First 100 Rows, 2. Status Update Fails on Date Format (`422 Unprocessable Entity`), 3. Discarded and Manual Items Appearing in Feed, 🚨 Error Catalog & Diagnostics, 🔗 Related Notes, Troubleshooting: Airtable Sync Issues

### Community 82 - "Troubleshooting: Cloudflare Tunnel & Local Proxy"
Cohesion: 0.33
Nodes (6): 1. Tunnel URL Disconnected / 502 Bad Gateway, 2. Tunnel Token Configuration, 🚨 Common Pitfalls, 🛠️ Launch Scripts & Components, 🔗 Related Notes, Troubleshooting: Cloudflare Tunnel & Local Proxy

### Community 83 - "Content-Calendar-b79912_f0c79065.md"
Cohesion: 0.33
Nodes (5): Sheet: August, Sheet: Auto Compute, Sheet: Caption, Sheet: July, Sheet: September

### Community 86 - "4. The work — six phases, in order"
Cohesion: 0.40
Nodes (5): 4. The work — six phases, in order, Phase 1 — Table IDs · NEARLY CLOSED, Phase 2 — Put brakes on the runner · DO NOW, Phase 4 — Close the exposure · DO FIRST, Phase 5 — Publishing reliability · WHEN IT BITES

### Community 87 - "Session Log: 2026-09-16 — Durable Queue Stabilization & Production Deployment"
Cohesion: 0.40
Nodes (5): 📁 Files Touched, 🎯 Goals & Objectives, 🔗 Related Notes, Session Log: 2026-09-16 — Durable Queue Stabilization & Production Deployment, 🛠️ Work Done & Changes

### Community 88 - "Session Log: 2026-09-18 — Obsidian Memory Vault Integration & System Blueprint"
Cohesion: 0.40
Nodes (5): 📁 Files Modified / Added, 🎯 Goals & Objectives, 🔮 Next Steps & Recommendations, Session Log: 2026-09-18 — Obsidian Memory Vault Integration & System Blueprint, 🛠️ Work Done & Changes

### Community 89 - "Session Log: 2026-11-03 — Moodboard #1 Feed 3-Photo Carousel Media Selection & Graphify Integration"
Cohesion: 0.40
Nodes (5): 🐞 Errors Encountered & Fixed, 📁 Files Touched, 🎯 Goals & Objectives, 🔮 Next Steps & Action Items, Session Log: 2026-11-03 — Moodboard #1 Feed 3-Photo Carousel Media Selection & Graphify Integration

### Community 90 - "Content Calendar Persistence Implementation Plan"
Cohesion: 0.40
Nodes (3): Content Calendar Persistence Implementation Plan, Global Constraints, Self-Review Against the Spec

### Community 91 - "15. Testing strategy"
Cohesion: 0.40
Nodes (5): 15. Testing strategy, Controlled end-to-end, Integration with mocked providers, UI regression, Unit

### Community 92 - "6. Git workflow"
Cohesion: 0.40
Nodes (5): 6.1 Branch model, 6.2 Required sequence, 6.3 Commit convention, 6.4 Pull-request checklist, 6. Git workflow

### Community 93 - "Session Log: 2026-09-18 — Day & Night Story Table Configuration & Foreign Key Display Fix"
Cohesion: 0.50
Nodes (4): 📁 Files Modified, 🎯 Goals & Objectives, 🔮 Next Steps & Recommendations, Session Log: 2026-09-18 — Day & Night Story Table Configuration & Foreign Key Display Fix

### Community 94 - "Stabilization progress — 2026-09-14"
Cohesion: 0.50
Nodes (4): External evidence needed, Next work, in order, Stabilization progress — 2026-09-14, Verification

### Community 95 - "6. Content-output fetching"
Cohesion: 0.50
Nodes (4): 6.1 Required corrections, 6.2 Normalized contract, 6.3 Target server modules, 6. Content-output fetching

### Community 97 - "vercel.json"
Cohesion: 0.50
Nodes (3): crons, framework, $schema

### Community 101 - "HomeCartel Marketing Output UI"
Cohesion: 0.67
Nodes (3): Current implementation, HomeCartel Marketing Output UI, Local development

## Knowledge Gaps
- **14 isolated node(s):** `data`, `react-dom`, `shadcn`, `tw-animate-css`, `@tailwindcss/postcss` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 647 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `main` to `Repository and Documentation Organization Design`, `launch_ui_cloudflare.py`, `Ship the Marketing Output UI`, `Session Log: 2026-09-28 — October 2026 Calendar Integration & Grid Import Support`, `Marketing Automation Stabilization Design`, `runner/route.ts`, `Writing tests`, `Auto-caption for every Feed and Reel (no fallback template)`, `Session Log: 2026-09-16 — Durable Queue Stabilization & Production Deployment`, `6. Git workflow`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `main()` (e.g. with `Locators` and `Non-negotiable rules`) actually correct?**
  _`main()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `data`, `react-dom`, `shadcn` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05172413793103448 - nodes in this community are weakly interconnected._
- **Why does `Implemented locally` connect `runner/route.ts` to `content.ts`, `extractOutputMedia`, `content-outputs/route.ts`, `records.ts`, `content-preview-modal.tsx`, `client.ts`, `main`, `jobs.ts`, `executeSql`, `Stabilization progress — 2026-09-14`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `syncAirtableRecord()` (e.g. with `Common failures` and `Non-negotiable rules`) actually correct?**
  _`syncAirtableRecord()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `discard-archive/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05757575757575758 - nodes in this community are weakly interconnected._