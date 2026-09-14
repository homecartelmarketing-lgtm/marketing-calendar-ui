<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HomeCartel project rules

- Read `docs/README.md` and the active implementation plans before changing automation behavior.
- Check `git status` and preserve unrelated changes. Work on a focused `codex/` branch.
- Preserve the existing calendar, galleries, modals, and scheduler-debug layout unless the user requests a visual change.
- Keep provider calls in server services and shared media-selection rules in `lib/output-media.ts`.
- Reproduce behavior bugs with provider-isolated tests. Run `npm test`, `npm run typecheck`, and `npm run build` before claiming the implementation passes.
- Tests must never load real operator credentials or publish, upload, or mutate live provider data.
- Never put real tokens, `.env` contents, authorization headers, or raw provider errors in commits or documentation.
- A saved schedule must include its valid PHT timestamp. Do not silently fall back to updating status alone.
- Use durable atomic execution state before enabling production scheduling; an in-memory lock is insufficient.
- Keep implementation progress honest: local tests do not prove a live Instagram publication or a successful deployment.
- Follow `docs/development/git-workflow.md`. Ask before pushing, creating a PR, merging, deploying, or performing a live publication test.
- Update relevant documentation with behavior/configuration changes and leave a precise continuation record for unfinished work.
