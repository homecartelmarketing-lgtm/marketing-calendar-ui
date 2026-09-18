# Obsidian Vault Setup & User Guide

Welcome to the **Marketing Output UI Knowledge Base & Memory Vault**!

This repository uses the `docs/` directory as a first-class **Obsidian Vault**. Storing all project memory in plain Markdown files allows human developers, project managers, and AI assistants (Antigravity, Claude, Cursor) to share the exact same source of truth.

---

## 🚀 Quickstart: Opening in Obsidian (1 Minute)

1. **Download & Install Obsidian** (if not already installed):
   - Download free for Windows/Mac from [obsidian.md](https://obsidian.md).
2. **Open the Vault**:
   - Launch Obsidian.
   - On the starter screen, click **"Open folder as vault"** (or click the vault icon at the bottom-left of Obsidian).
   - Navigate to this project and select the **`docs`** folder:
     `c:\Users\User\Downloads\Marketing Output UI\docs`
   - Click **Select Folder**.
3. **Open the Main Dashboard**:
   - In the file explorer on the left, click on **`00 - Index.md`**.

That's it! Your workspace is now connected to the live repository notes.

---

## 🗺️ How the Vault is Structured

```text
docs/
├── 00 - Index.md                  # Main Map of Content (Dashboard / Hub)
├── OBSIDIAN_SETUP_GUIDE.md        # This guide
├── README.md                      # Developer documentation index
├── daily-logs/                    # What was done each day (work history & commits)
│   ├── 2026-09-18.md
│   └── 2026-09-16.md
├── troubleshooting/               # Step-by-step playbooks for resolving errors
│   ├── meta-api-errors.md
│   ├── durable-queue-and-cron.md
│   ├── airtable-sync-issues.md
│   └── cloudflare-tunnel.md
├── architecture/                  # Deep dives into system design and data models
│   ├── system-blueprint.md
│   ├── durable-scheduling-queue.md
│   └── output-media-selection.md
├── templates/                     # Reusable templates for new notes
│   ├── session-log-template.md
│   ├── troubleshooting-template.md
│   └── architecture-decision-record.md
├── operations/                    # Implementation progress tracking
└── development/                   # Git workflow & coding rules
```

---

## ⚙️ Recommended Obsidian Settings

To get the most out of Obsidian with this codebase:

1. **Internal Links (Wikilinks)**:
   - Go to `Settings` -> `Files and links`.
   - Ensure **"Use [[Wikilinks]]"** is turned **ON**.
   - Set **"New link format"** to **"Shortest path when possible"**.
2. **Attachment Location**:
   - In `Settings` -> `Files and links`, set **"Default location for new attachments"** to `In subfolder under current folder` (or a designated `assets/` folder).
3. **Core Plugins to Enable**:
   - **Graph View**: See the visual web connecting architectures to bugfixes and daily logs.
   - **Backlinks**: See which notes reference the current document.
   - **Outgoing Links**: See links leaving the current document.
   - **Search**: Press `Ctrl + Shift + F` to search across all notes instantly.
   - **Canvas**: For visual mapping and brainstorming flows.
   - **Templates**: For inserting templates from `docs/templates/`.

---

## 🤖 How AI Assistants (Antigravity & Claude) Use This Memory

1. **Pre-task Research**:
   Whenever you give an AI a task (e.g. *"Fix this Meta API error"* or *"Reschedule this post"*), the AI is instructed by `AGENTS.md` to:
   - Search `docs/troubleshooting/` for identical past error codes.
   - Review `docs/architecture/` to ensure new code matches system rules.
2. **Post-task Logging**:
   At the end of each session or major bugfix, the AI will update `docs/daily-logs/YYYY-MM-DD.md` with:
   - Summary of what was changed.
   - Files touched.
   - Bugs resolved.
   - Next actions.
3. **Persistent Memory**:
   Because these files are tracked in Git, the next AI session will never suffer from "context amnesia"—it can simply read the latest log!

---

## 🔒 Security & Git Hygiene

> [!IMPORTANT]
> **Zero Secrets in Markdown Notes**
> - **NEVER** write real API keys, tokens (Meta access tokens, Airtable tokens), database connection strings, or passwords into Obsidian notes.
> - Always use placeholders: `<META_ACCESS_TOKEN>`, `<DATABASE_URL>`, `<CRON_SECRET>`.
> - Our `.gitignore` is pre-configured to ignore local window layout state (`.obsidian/workspace*.json`) so your personal window sizing never clutters Git commits.
