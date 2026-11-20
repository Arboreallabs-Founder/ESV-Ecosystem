# Integration tests (AI connector, against staging)

These drive the real `/api/mcp` route end to end with real sign-in tokens, so RLS, the guards, the
stage-automation trigger and the `activity_events` trigger are all exercised for real.

They run against the **staging** Supabase project ("Ecosystem Secondary",
`txjpduzasshgbeunjgyi`), never production — `env.ts` refuses the production project ref.

## Setup (once)

1. `.env.staging.local` (gitignored) holds `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`
   and `STAGING_DB_POOLER_URL` (the session pooler — the direct DB host is IPv6-only).
2. Staging needs production's schema. The migrations folder can't rebuild it from scratch (the
   pipelines/forms tables, `approved_emails` and others were created outside it), so staging is a
   schema-only copy of production plus any newer migrations:
   `powershell -File scripts/staging/rebuild.ps1 -Dump <prod-schema.sql> -After <newest prod migration>`.
   See docs/MCP.md → Staging for producing the dump.

## Run

```bash
# 1. the app, pointed at staging (separate terminal)
NEXT_PUBLIC_SUPABASE_URL=<staging url> NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging publishable key> npx next dev -p 3123
# 2. the tests (seeds test users and the "ESV Referrals" pipeline first)
npm run test:integration
```

Each run creates companies/entries/deals with a unique suffix; they're test data on staging only.
