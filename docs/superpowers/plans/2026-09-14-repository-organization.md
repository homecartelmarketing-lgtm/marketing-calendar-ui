# Repository Organization Implementation Plan

> For agentic workers: implement incrementally in this task, validate moved links and commands, and keep the Next.js-managed AGENTS block intact.

**Goal:** Provide a discoverable documentation set and safe, traceable development workflow for humans and AI agents.

**Architecture:** Root files contain entry points and short rules. Canonical procedures live under `docs/`; historical plans move to `docs/archive/`. Documentation describes actual behavior and labels planned features.

**Tech stack:** Markdown, npm, GitHub pull requests and Actions, Vercel Preview/Production.

**Spec:** [Repository design](../specs/2026-09-14-repository-documentation-organization-design.md).

## 1. Entry points and AI instructions

**Files:** `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/README.md`.

- [ ] Write prerequisites, validated commands, architecture summary, and links in root README.
- [ ] Append scope, UI preservation, framework docs, testing, secret handling, branch, and approval rules outside the generated AGENTS block.
- [ ] Retain `CLAUDE.md` as the reference to canonical AGENTS instructions.
- [ ] Document branch → local commit → authorized push → Preview/CI → approved PR merge → production verification.
- [ ] Document how to report and rotate leaked credentials without publishing secret values.

## 2. Consolidate existing material

**Files:** root deployment/setup guides, duplicate scheduler plans, `docs/deployment/`, `docs/integrations/`, `docs/archive/`.

- [ ] Read and sanitize each guide; migrate active Vercel/Zoho guides to their canonical folders.
- [ ] Preserve a single historical scheduler repair plan after comparing duplicates.
- [ ] Label Catalyst and local Cloudflare deployment status explicitly; retain configuration until support is resolved.
- [ ] Update every internal link, including archive provenance and companion specs/plans.
- [ ] Keep one package manager after a clean npm install/build; document why the second lockfile is removed.

## 3. Developer and operator references

**Files:** architecture, reference, testing, operations, and decisions folders listed in the spec.

- [ ] Document runtime data flow, field registry, content categories, status transitions, and environment presence requirements without real values.
- [ ] Document the actual storage/authentication choices after implementation, including retention and migration/recovery behavior.
- [ ] Write scheduler and output troubleshooting procedures with observable symptoms, safe checks, recovery, and verification.
- [ ] Record test matrix and results; distinguish mocked validation from staging/live evidence.
- [ ] Write release/rollback procedures, incident steps, and irreversible external effects.

## 4. GitHub and documentation gates

**Files:** `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `scripts/check-docs.mjs`, `docs/development/git-workflow.md`.

- [ ] Add a PR template with problem/result, verification, deployment requirements, and rollback.
- [ ] Implement a Markdown link validator that ignores fenced examples and checks actual local references.
- [ ] Document required checks and main branch protection; distinguish written instructions from remotely enabled rules.
- [ ] Record commits and release references for backtracking, using `git revert` instead of rewriting shared main history.
- [ ] Verify all documented local commands, links, and the final tree. Commit only reviewed files.

## Completion evidence

Each completed task must point to the actual file or command result. Plans do not count as completed implementation. Live deployment and GitHub settings require independent external verification.
