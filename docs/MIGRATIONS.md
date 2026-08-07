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
- `20260822000000_leave_type_wfh_enum.sql` — adds `'wfh'` to the `leave_type` enum. **Standalone,
  and must run before `20260822100000`**: Postgres rejects a new enum value used by any statement
  in the same transaction that added it. Same reason `20260814000000` (the `hr` role) is its own
  migration.
- `20260822100000_wfh_entitlement.sql` — `leave_policy.wfh_days NUMERIC NOT NULL DEFAULT 24`,
  backfilled to 24 for existing orgs. Modelled as an entitlement like the others rather than a
  separate concept: WFH isn't leave in the HR sense, but it's requested, approved and counted
  against an annual allowance identically, so reusing `leave_requests` keeps one approval queue
  and one balance calculation instead of a parallel set that would drift. 24 is a starting
  standard, editable on the Balances tab like every other entitlement.
- `20260823000000_employee_profiles.sql` — Phase 1 of HR document generation. `employee_profiles`
  keyed to `users` rather than more columns on `users` itself: that table is `select('*')`-ed in a
  dozen places, so a date of birth added there would start flowing into task-board payloads. Read
  by founder/admin/HR plus self; **written by founder/admin/HR only** — an employee editing their
  own joining date would be editing the source of their own letters.
- `20260823100000_employee_compensation.sql` — Phase 2. Effective-dated compensation, never
  overwritten: a payslip for March must reflect March. Founder/admin/HR for every operation, with
  **no self-read policy** — showing someone their own CTC is a feature to design, not a default to
  fall into. DELETE is founder-only because removing a record destroys the basis of any payslip
  already issued against it.
- `20260823200000_document_engine.sql` — Phase 3. `document_types` (the catalogue, seeded),
  `document_permissions` (the approved issuance matrix as data, so granting middle management
  compensation letters later is an UPDATE rather than a deploy), and `issued_documents`. Plus
  `next_document_human_id()` (advisory-locked so concurrent issuers can't take the same number),
  `verify_document()` (SECURITY DEFINER, returns only what a verifier needs, granted to `anon`),
  and the private `hr-documents` bucket. Note there is **no DELETE policy** on `issued_documents`:
  a withdrawn document is revoked, not erased, or its verification link 404s and reads as a fake.

  **Fixed after a failed first apply:** the `issued_documents` INSERT policy compared
  `document_permissions.role` (TEXT) against `get_user_role()` (the `user_role` enum). Postgres
  has no implicit `text = user_role` operator, so the statement errored and — because the SQL
  editor runs a paste as one transaction — the entire migration rolled back, leaving phases 1 and
  2 applied and phase 3 absent. The column stays TEXT on purpose, so adding a `manager` role later
  is a row rather than an `ALTER TYPE`; the comparison now casts with `::TEXT`. Worth remembering:
  a partial-looking outcome across a batch of migrations usually means one of them rolled back
  whole, not that some statements within it survived.
- `20260826000000_partner_company_intake.sql` — partner-sourced company intake: `partner_companies`
  plus `users.is_sgp_coordinator`. The partner-side sibling of Deal Desk. Submissions are
  deliberately **not** rows in `companies` — a partner lead is something someone vouched for, not a
  company of record, and mixing them would put unvetted entries into the table everything else
  treats as authoritative. Coordinator is a **flag, not a role**: they are an associate who also
  does this, so a role would force a choice between their existing permissions and this one.
  RLS keeps partners isolated from each other — a partner sees only what they submitted, an
  assignee only what was handed to them, coordinators and leadership the whole queue. No DELETE
  policy: a submission evidences a partner's contribution, so it is closed with a reason rather
  than erased.

### `20260827000000_associates_create_events.sql`
Lets **associates create events**. The care here is that `bulletin_posts` holds both company
announcements and events, told apart by `post_type` — adding `associate` to the existing policy
would silently have handed them the announcement board too. So the grant is written against
`post_type = 'event'` explicitly, in both the `USING` and the `WITH CHECK`: without it in the
`WITH CHECK`, an associate could take their own event and convert it into an announcement.
Editing is narrower than creating — an associate may fix an event they created (`created_by =
auth.uid()`), not someone else's. Delete, pin, complete and attendee management stay founder/admin.

### `20260828000000_deal_partner_visibility.sql`
Adds `active_deals.visible_to_partners` (default **true**) so founders/admins can keep a deal off
the partner portal. Default is true deliberately: partners can see everything today, so defaulting
to false would empty their portal the moment the migration runs. The control is "hide this one",
not "share this one".

Enforced by gating `entry_has_partner_visible_deal()` inside the `pipeline_entries` partner policy
rather than by adding a policy to `active_deals` — permissive policies are OR'd, so a new policy
could only widen partner access, never narrow it. Partner *shares* are untouched: a share is money
owed for a deal they brought in, and hiding a deal must not erase the record of it.

### `20260829000000_attendance_statements.sql`
Monthly attendance statements — the app version of the sheet HR sends on WhatsApp before payroll.
`attendance_statements` (one per person per month) plus `attendance_statement_lines` (one row per
exception, the way the sheet works).

The load-bearing decision is that a statement is a **snapshot, not a live view**. Lines are rows,
not a query over `leave_requests`; if it recomputed on read, a leave approved after the fact would
silently change what someone already approved and the approval would mean nothing. Auto lines are
copied in when HR pulls them and can only be re-pulled while the statement is still editable.

`source` ('auto' | 'manual') is stored because it is shown: leave, WFH and events come from the
app's records, while late logins, missed punch-outs, half days and Saturday attendance have no
source here — nothing records a punch, `hr_clock_settings` only defines the windows. Someone being
asked to approve a deduction should know which lines a person typed.

RLS: managers are `founder/admin/hr` via `is_attendance_manager()` — the same set that already
decides leave requests, rather than a third definition of "lead". An employee reads their own
statement but **never a draft**, which is HR's working copy. Locked statements cannot be deleted.

### `20260901000000_investor_lists.sql`
Investor lists: the shortlist a founder approves before we approach anyone. `investor_lists` +
`investor_list_items` + `investor_list_exclusions` (the founder's own "don't contact these").

Two rules are enforced by **triggers**, not by the UI, because both decide who receives a founder's
raise plans: lists exist only on deals tagged **Investment Banking**, and **angel investors cannot
be added** — an angel is a person, often one the founder knows.

The founder has no account, so the public page goes through three SECURITY DEFINER functions keyed
on the share token: `get_investor_list_public` returns **fund name and website only** (no ticket
size, stage, sectors or internal notes), `submit_investor_list_response` writes every decision in
one call, and `mark_investor_list_viewed` records the first open.

Items default to `approved = true`: the founder is removing objections, not building a list from
scratch. A re-submission ticks everything and then clears the named ones, so it **replaces** the
previous answer rather than merging with it — changing your mind has to actually work.
