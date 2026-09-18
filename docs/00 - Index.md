# 🧠 Project Knowledge Base & Memory Vault

Welcome to the central memory index for **HomeCartel Marketing Output UI**. This hub connects our daily dev logs, architectural patterns, troubleshooting runbooks, and automation specs.

> **Vault Status**: Active  
> **Repository**: `homecartelmarketing-lgtm/marketing-calendar-ui`  
> **Tech Stack**: Next.js 16 (App Router), React 19, Neon Postgres, Airtable API, Meta Graph API, Tailwind CSS, Vitest  

---

## 🧭 Navigation & Maps of Content

```
                   [[00 - Index]]
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
[[daily-logs/]]   [[troubleshooting/]]  [[architecture/]]
 (What we did)       (How we fix)       (How it works)
```

### 1. 📅 Daily Session Logs (Work History & Context)
*Keep track of session progress, files modified, and next steps so any developer or AI can resume instantly.*
- [[daily-logs/2026-09-18|2026-09-18 — Obsidian Memory Vault Integration & Meta API Diagnostics]]
- [[daily-logs/2026-09-16|2026-09-16 — Durable Queue Backfill, Neon DB Fallback Fix, & PR #7 Deploy]]
- [[operations/implementation-progress|Full Historical Stabilization Progress (Audit)]]

---

### 2. 🛠️ Troubleshooting & Runbooks (Bug Fixes)
*Fast diagnosis and proven solutions for third-party integrations and runtime errors.*
- [[troubleshooting/meta-api-errors|Meta Graph API Errors (Token Expiry, Container IDs, Status Warnings)]]
- [[troubleshooting/durable-queue-and-cron|Durable Queue & Cron Issues (Neon Postgres, Statement Splitting, Backfill)]]
- [[troubleshooting/airtable-sync-issues|Airtable Sync Issues (Pagination, Foreign Key Parsing, Status Sync)]]
- [[troubleshooting/cloudflare-tunnel|Cloudflare Tunnels (Local Launch, Token Setup, Zero Trust Routing)]]

---

### 3. 🏗️ Architecture & System Blueprint
*System specifications, data flows, and design rules to preserve system integrity.*
- [[architecture/system-blueprint|System Blueprint & End-to-End Data Flow]]
- [[architecture/durable-scheduling-queue|Durable Scheduling Queue (Postgres DDL, Worker Locking, Retries)]]
- [[architecture/output-media-selection|Output Media Selection Rules (Moodboards, Day & Night, Style Reels)]]
- [[development/git-workflow|Git Workflow & Release Backtracking]]

---

### 4. 📝 Note Templates
*Standard templates for keeping notes structured and easy for AI to parse.*
- [[templates/session-log-template|Daily Session Log Template]]
- [[templates/troubleshooting-template|Troubleshooting Playbook Template]]
- [[templates/architecture-decision-record|Architecture Decision Record (ADR) Template]]

---

## 🏷️ Tags & Quick Filters
- `#daily-log` : Session logs and changelogs
- `#troubleshooting` : Bug fixes and error solutions
- `#architecture` : System design and data models
- `#meta-api` : Instagram & Facebook Graph API integration
- `#airtable` : Airtable API and schema rules
- `#postgres` : Neon Postgres durable queue
- `#cron` : Vercel Cron and scheduling runner
