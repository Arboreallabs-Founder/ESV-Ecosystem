# Migration phases

Ecosystem went live (Vercel + the linked Supabase project) after an initial build push. To mark
that line, migrations are labeled in **phases** — but only in this document, not by moving or
renaming any file in `supabase/migrations/`.

## Why documentation-only, not folders

This repo is CLI-linked to the live Supabase project (see `supabase/config.toml` and
`supabase/.temp/project-ref`). The Supabase CLI tracks which migrations have been applied by
matching exact filenames/timestamps in `supabase/migrations/` against a table in the remote
database. Moving files into a subfolder, or renaming them, breaks that matching — the CLI would no
longer recognize them as already-applied, and the next `supabase db push` could try to re-run or
misapply all of them against the live database. So this folder stays flat, exactly as the CLI
expects, forever. Phase labeling lives here instead.

## Phase 1 — pre-launch (all 51 files, 2026-05-26 through 2026-08-12)

Everything from `20260526000000_init_schema.sql` through
`20260812000000_general_hr_and_events_edit_log.sql`. This is the schema as it stood when the app
went live — initial tables, RLS, multi-tenancy, Deal Desk, Companies, the `general` role, and
everything else built before launch.

## Phase 2 — post-launch (2026-08-12 onward)

Every migration created from now on. No special filename prefix needed — just keep using the
standard `<UTC timestamp>_<name>.sql` convention the CLI requires
(`supabase migration new <name>` generates this automatically). This document is the source of
truth for where the Phase 1 / Phase 2 line falls; there's nothing in the filenames themselves that
marks it.

- `20260813000000_hr_clock_and_birthdays.sql` — `hr_clock_settings` (per-org clock-in/out reminder
  windows) and `hr_birthdays`, backing the top-right HR clock widget. Same visibility/edit tiers as
  `hr_policies`.
- `20260814000000_add_hr_role.sql` — adds the `hr` enum value. Standalone (Postgres requires a new
  enum value committed before any later migration can reference it in a policy).
- `20260814100000_hr_role_tasks_rls.sql` — adds `hr` to every tasks/recurring-tasks policy `general`
  already has (additive, `general` untouched).
- `20260814200000_hr_role_hr_zone_bulletin_events_rls.sql` — `hr` becomes the create/edit tier on
  `hr_policies`/`bulletin_posts`/edit logs, replacing `general` there (view-tier policies just gain
  `hr` alongside every existing role).
- `20260814300000_hr_role_clock_and_birthdays_narrow.sql` — narrows `hr_clock_settings`/
  `hr_birthdays` to founder/admin/hr only, dropping associate/general. The one role-RLS change this
  batch that removes access rather than granting it.
- `20260814400000_leave_requests.sql` — `leave_type`/`approval_status` enums, `leave_requests`
  table. Simple request/approval log, no balance tracking.
- `20260814500000_expense_requests_and_bucket.sql` — `expense_type` enum, `expense_requests` table,
  and the private `expenses` Storage bucket (same org-prefixed-path pattern as the `deal-desk`
  bucket) for invoice attachments.
- `20260814600000_kudos.sql` — `kudos` table backing the new Engage area.
- `20260814700000_approvals_notify_founders.sql` — widens `escalations.linked_type` to accept
  `leave_request`/`expense_request` and adds `hr` to `"Escalations insert"`, so an admin/HR
  approving a leave/expense request can auto-notify every founder by reusing the escalations table.
- `20260814800000_leave_balances.sql` — `leave_balances` (per-person entitled days + a manual
  "already used" baseline for Earned/Sick/My Day/Compensatory only — Unpaid is uncapped).
  Informational only, nothing blocks a request that exceeds the remaining balance. Managed by
  founder/admin/hr on the new "Balances" tab on `/approvals`.
