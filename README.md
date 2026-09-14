# HomeCartel Marketing Output UI

Next.js calendar and output galleries for Airtable-generated marketing content, with Instagram publishing and scheduling diagnostics.

## Local development

Use Node.js with npm. Install dependencies with `npm ci`, configure local environment variables privately, then run `npm run dev`. Open the local URL printed by Next.js.

```sh
npm test
npm run typecheck
npm run build
```

Tests intercept provider requests and use fake credentials. Normal development and existing debug actions can access live services if real credentials are configured.

## Current implementation

Output and schedule reads follow Airtable pagination. Output responses report partial failures; invalid scheduling changes fail instead of reporting an unsaved success. Shared media selection is in `lib/output-media.ts`; Airtable read/write services are in `server/airtable/`.

The broader stabilization is in progress. Durable publishing locks, application authentication, and production Vercel Cron cutover are not yet complete. Installing or paying for Vercel Pro alone does not verify these application behaviors.

- [Documentation index](docs/README.md)
- [AI agent instructions](AGENTS.md)
- [GitHub workflow](docs/development/git-workflow.md)
- [Implementation progress](docs/operations/implementation-progress.md)
