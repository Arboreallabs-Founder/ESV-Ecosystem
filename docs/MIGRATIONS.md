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
- `20260815000000_performance_analytics.sql` — `performance_weights` (per-org singleton holding
  the scoring formula, editable by founder/admin only) and `performance_adjustments` (signed
  manual points with a mandatory reason). Backs `/analytics`. Note the deliberate omission: leave
  is **not** a scoring signal — see the comment at the top of the migration.
- `20260816000000_leave_policy_and_half_days.sql` — org-wide default leave entitlements
  (`leave_policies`) plus half-day support on `leave_requests`/`leave_balances` (days stored as
  `NUMERIC`, not hours — the ask was explicitly days with halves, not fractional-hour tracking).
- `20260817000000_hr_investor_partner_access_and_birthdays.sql` — adds `hr` to the `investors`,
  `investor_contacts` and `franchise_partners` policies, and adds `birthday_md` /
  `contact_birthday_md` (`MM-DD` text — the year is deliberately not captured, see docs/ROLES.md).
- `20260818000000_push_reasons_deal_updates_todo_weeks.sql` — three additions:
  - `task_pushes` — one row per push with its mandatory reason, plus `blocked_external` and a
    single `blocked_by_user_id`. A **log**, not extra columns on `tasks`: `tasks.pushed_at` /
    `push_count` only ever describe the latest push, which can't answer "why does this keep
    slipping". Read on `/tasks/kpi`.
  - `active_deal_updates` — the timestamped "Latest Update" thread per active deal. INSERT is
    gated on founder/admin **or** membership of the deal's `pipeline_entry_assignees` (the POCs),
    so the RLS policy — not the UI — decides who can post.
  - `personal_todos.work_week_start` + a new **SELECT-only** policy letting founder/admin read
    to-dos that have a work week set. Personal to-dos are otherwise strictly private
    (`user_id = auth.uid()`), and stay that way: filing an item into a work week is the explicit
    opt-in that publishes it to that week's update. `work_week_start IS NULL` remains invisible
    to everyone but its owner.
- `20260819000000_birthday_years.sql` — optional `investors.birthday_year` /
  `franchise_partners.contact_birthday_year` (SMALLINT). Deliberately a separate nullable column
  rather than converting `birthday_md` to a DATE: for most angels and partner contacts the year
  genuinely isn't known, and a DATE forces you to invent one. This way "29 July, year unknown" and
  "29 July 1984" are both representable and both tell the truth. A CHECK keeps a year from existing
  without a day/month, and the day/month remains the sole basis for "is it their birthday today".
- `20260820000000_admin_avatars_and_image_cache.sql` — an additive storage policy letting
  founder/admin manage any object in `profile-photos` (so admins can set someone else's avatar,
  alongside the existing self-service policy), plus a new public `cached-images` bucket for
  mirrored third-party images such as company founder headshots. See `src/lib/image-cache.ts` for
  why pasted URLs are mirrored rather than stored raw — the short version is that LinkedIn-style
  media URLs are signed and expire, so a stored link works today and 404s later.
- `20260821000000_internal_roles_view_org_users.sql` — replaces the associate-only "Associates
  view org users" SELECT policy with one covering `associate`, `general` **and** `hr`. HR and
  general could previously read only their own `users` row, so every embedded person join came
  back NULL — `/approvals` showed requests from "Unknown" and the balances roster had no names.
  Worth remembering as a failure mode: RLS filters a joined row out **silently**, so the symptom
  is a UI fallback rather than an error.
