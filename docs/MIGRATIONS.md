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

### `20260903000000_investor_notes.sql` / `20260904000000_investor_logo.sql`
`investors.notes` — the fund's own words, and where an ambiguous ticket size is parked rather than
guessed at (198 funds had text the loader had been silently dropping). `pg_trgm` so the notes are
searchable. `investors.logo_url` takes a URL rather than an upload: no Vercel compute, no Supabase
storage, and a broken logo is a cosmetic failure.

### `20260905000000_partner_deal_visibility.sql`
`deal_category_fields.visible_to_partners`, defaulting **false**. The column holding a field's name
is `label`, not `name` — the first version of this migration used `name` and failed outright, which
is how it came to be skipped while the ones after it were applied. Deal fields are user-defined, so
which ones a partner may see cannot be hardcoded — and a field added tomorrow must be private until
someone decides otherwise, because that list includes fee structures and mandate links.

Also **drops** the partner INSERT policies on `investors` and `investor_contacts`. A partner adding
an investor we already hold creates a duplicate record and a fee-split claim over a relationship
that was already ours. `partner_visible_deal_fields` answers "what does a partner see" in one query.

### `20260906000000_partner_pipeline.sql`
One route for partner-sourced companies. There were two: `/my-companies` wrote a `partner_companies`
row with no stages, and a pipeline form link went straight onto a board, skipping the coordinator
entirely. Both now land as `pipeline_entries` on the **Partner Sourced** pipeline (`is_partner_intake`,
one per org).

The INSERT policy pins the stage to the pipeline's `lead` stage and the partner to themselves;
there is deliberately **no UPDATE policy**, because a partner advancing their own referral to
"Accepted" is the bypass this replaces. Existing `partner_companies` rows are carried across.

### `20260907000000_partner_form.sql`
`forms.is_partner_form` — one per org, the only form partners may issue links from. A trigger
refuses to point it at any pipeline other than the partner-intake one: without that, the bypass
returns by an *edit* rather than a new form, silently. `attribute_entry_to_partner()` sets
`sourced_by_partner_id` from the link's creator at insert time, because the submitting form is
public and unauthenticated and cannot be trusted to say who referred it.

### `20260908000000_partner_form_questions.sql`
The real Partner Form — the questions the old JotForm collected — replacing 20260907's six-question
placeholder, plus `forms.display_name`: what the public page shows, separate from the internal
title. "Partner Form" tells the team where a submission came from and tells a founder nothing.

`get_public_form(token)` **wraps** `get_form_for_submission` rather than replacing it. That function
is the only thing between an anonymous visitor and the `forms` table, and rewriting it to add one
field is more risk than the field is worth; a NULL from the inner call stays NULL, so the public
page's error handling is untouched.

Conditional questions are asked by **branching**, not by trusting people to skip: the renderer
requires an answer to every question it shows, so a question that does not apply is a dead end.
mcq edges match on the **option id** — the renderer sends the id back, and an edge conditioned on
the label silently falls through to the default path.

The rebuild refuses to run if any `pipeline_entry_answers` reference the form's nodes: replacing
the questions would take the answers with them.

### `20260909000000_partner_deal_summary.sql`
`get_partner_deal_summary(deal_id)` — the projection a partner is allowed on a deal, as one
SECURITY DEFINER call.

20260905 decided which deal *fields* a partner may read, and that works. But raise progress, the
ESV point of contact, the company logo and the linked company profile were all coming back empty
for partners — not because anyone decided they should, but because the page derives them from rows
RLS correctly hides. Raise progress in particular read "₹0 committed, 0 commitments" on a deal that
was ₹1.08 Cr in from eleven investors: the one thing the spec explicitly promised them was the one
thing showing zero.

The fix is **not** to widen those policies. A partner must not read investor rows, the user
directory, or the company database. The function returns **aggregates instead of rows** — a total
and a count, never a list — plus assignee names and photos and the logo. It re-checks everything
itself rather than leaning on RLS: caller is a partner, deal is in their org, deal is actually
marked visible to partners. Any of those failing returns NULL.

The raise **percentage** is deliberately not returned. It is computed client-side from the target
field the partner can already see, so the denominator is always on the page — and if that field is
closed to partners the bar disappears with it.

### `20260910000000_partner_referrals.sql`
Investor referrals, the company credit tag, and a leak found while building them.

**The leak.** My Companies was showing a partner every entry on the *Imported Deals* pipeline —
real ESV deals they had nothing to do with, with the founder's name and email on each.
`fetchMySubmissions` selected `pipeline_entries` with **no filter at all**, trusting RLS to scope
it, and RLS did not. The query now filters by the partner-intake pipeline **and** by
`sourced_by_partner_id`. The policy side still needs the wide policy found and removed — permissive
policies are OR'd, so adding a narrow one can only widen access.

`rls_policy_audit` exists for exactly that: `pg_policies` is not reachable through PostgREST, so
"what can a partner actually read" has been unanswerable without opening the SQL editor. Granted to
`service_role` only, which already bypasses RLS and so gains nothing it did not have.

**`companies.referred_by_partner_id`** — the other half of "my companies". A partner who introduces
a company we already have on file should not re-enter it as a submission; a coordinator tags the
existing record instead, and it appears on their page.

**`partner_investor_referrals`** — deliberately *not* a row in `investors`. A referral is a claim
about a relationship, not a fund record, and it must not enter the database everyone searches until
someone has checked whether we already hold it. The coordinator either tags the fund we have or
creates it; both credit the partner, and a fund already credited to a *different* partner refuses
the write, because two partners claiming one relationship is a fee question, not a click.

**`get_partner_deal_summaries()`** — 20260909 did one deal; the Active Deals list had the identical
problem on every card. The ESV contact now also carries email, phone and designation: telling a
partner who their point of contact is with no way to reach them is a name, not a contact.

### `20260911000000_active_deal_documents.sql`
`active_deal_documents` — IM, financials, deck, MIS and data room on a deal, as **links rather than
uploads**. The files already live where they are edited; copying them here would give us two
versions and no way to tell which is current.

The kind is a fixed five-value CHECK. Free text would give us "Dataroom", "Data room" and
"DataRoom" inside a fortnight — the same drift that produced three sector vocabularies. Several of
a kind are expected and allowed: a deal has multiple MIS months and more than one deck.

Category fields were the wrong home for these. They are per-category, so the same link had to be
re-entered on a deal tagged both Syndicate and Investment Banking, and there was room for exactly
one of each.

RLS: founders/admins/**associates** write — associates work the deals, and making them ask someone
else to paste a link is how links stay in WhatsApp. `general` reads. Partners read only, and only
where three separate conditions hold: they are a partner, the deal is open to them, and that
particular document is marked shared.

**This opens the IM to partners, which `20260905` deliberately did not.** That was the right default
for an unclassified field; this is an explicit decision to share these five, and `visible_to_partners`
is per document so any single one can still be withheld.

### `20260912000000_partner_deal_intro.sql`
Adds `company_one_liner` to `get_partner_deal_summary` and `get_partner_deal_summaries`.

"Earlyseed Ventures presents this exciting investment opportunity — *X* — <intro>" needs the intro,
and the intro is `companies.one_liner`, which a partner cannot read. One more field on a projection
that already exists, rather than a policy handing them the company database.

### `20260913000000_company_share_intro.sql`
`companies.share_intro` — up to 200 characters, used as the introduction in the WhatsApp share
message, falling back to `one_liner`.

Separate from `one_liner` rather than replacing it. The one-liner is written for a *card*:
"clean-label food brand" tells a colleague scanning a list what a company is, and tells someone
being asked to invest nothing at all. Making the card carry two sentences of pitch would wreck the
list the one-liner exists for.

200 characters because it is read in a chat window, under a heading and above a list of links —
long enough for two real sentences, short enough that nobody scrolls past it, which is the same
thing as nobody reading it. The cap is a column CHECK, a constant in `deal-pitch.ts`, and a
`maxLength` on the textarea, so the three cannot disagree.

The fallback is resolved **in the RPC** (`COALESCE(NULLIF(btrim(share_intro), ''), one_liner)`), so
a partner and an associate looking at the same deal never see different introductions.

### `20260914000000_fundraise_status.sql`
The Fundraise Status List — what happens after a founder approves an investor list. Each approved
fund becomes a row we work: `fundraise_lists` (one per deal, own share token), `fundraise_entries`
(the fund + its major status), `fundraise_events` (the full internal timeline).

**Eight stored statuses, nine spoken of.** "Ghosted" is *derived* by `is_fundraise_ghosted()` —
30 days since the status last changed, and only while the fund is in flight. Nothing is written, so
it cannot disagree with the timeline it is read from, and it stops being true the moment anything
moves. There is no scheduler in this app; a stored flag would need one and could drift.

`status_changed_at` is separate from any "updated at" on purpose: it is the ghosting clock, and a
comment or a logged call must **not** reset it, or a fund nobody has heard from would look alive
because we talked about it among ourselves.

**Two audiences, one table.** `fundraise_events.founder_visible` defaults **false** — an event
nobody has classified stays with the team. Rejection reasons are always the founder's to see, and
the action forces one: "they passed" with no reason teaches nobody anything and cannot enrich the
fund's profile.

The founder link is its **own token**, separate from `investor_lists.share_token`. They answer
different questions at different times, and one link that silently changes meaning after approval
is worse than two that each do one thing. `get_fundraise_public` decides exactly what the token
buys; `add_fundraise_founder_comment` is their only write, and it verifies the token owns the entry
— without that check a valid token for one mandate could comment on any fund on any other.

`investor_rejections` answers "what has this fund passed on, and why" without re-deriving it from
the mandates later.

### `20260915000000_automatic_tasks.sql` / `20260916000000_fix_automatic_task_priority.sql`
Automatic Tasks: work raised by a fund's status rather than typed by someone. `tasks.source`,
`auto_rule`, `fundraise_entry_id`, `escalated_at`, and a partial unique index giving one *open*
task per rule per fund — without it every page load would add another.

New policies were required, not optional: the existing associate rules are `assignee_id =
auth.uid()`, so an **unowned** task would have been invisible to exactly the people whose work this
is. Internal roles can now see, complete and comment on automatic tasks without gaining access to
anyone else's manual ones.

`20260916` fixes a real defect in `20260915`: `tasks.priority` is an enum, and the generator built
it with a `CASE` expression, which is `text`. A bare literal coerces from `unknown`; a `CASE` result
does not. The function raised for any fund that matched a rule and returned cleanly when nothing
matched — so the success case was the one that did nothing, and calling it once against an empty
table proved nothing.

### `20260917000000_pre_workflow_and_angels.sql`
The pre-workflow statuses, connection tagging, and Angel Reachout.

**`fundraise_entries.status` becomes TEXT with a CHECK.** Nine new statuses sit *before* the
existing nine, and `ALTER TYPE … ADD VALUE` cannot be used in the transaction that adds it — which
is exactly what the Supabase SQL editor gives you. TEXT with a CHECK has the same guarantees, no
transaction trap, and adding the next status is a one-line change. Free to do while
`fundraise_entries` was still empty.

`investor_contacts.connected_partner_id` and `connected_founder` sit on the **contact**, not the
fund: a fund has several people at it and only one of them is anybody's connection. The partner
attribution is what fees are eventually calculated from.

`angel_reachout_lists` + `angel_reachout_members` — one list is one collaborative task. Members
default to `included = true` (§15): the list is something you narrow. `investor_angel_interactions`
is a view rather than a copy, so an investor's history cannot drift from what was recorded.

Two more automatic rules: a contact search stalled past a week, and an introduction waiting past a
week. Both are the failure mode §9 and §10 exist to prevent.

### `20260918000000_event_poster.sql`
`bulletin_posts.poster_url` plus a public `event-posters` bucket.

An uploaded file rather than another pasted link, because the two link fields events already carry
are Google Drive/Photos URLs and those cannot be rendered — a Drive `…/view?usp=sharing` link
serves an HTML viewer page, so an `<img>` pointed at one shows a broken icon.

Public bucket: the poster is displayed inline on a list of cards. Private would mean minting a
signed URL per event per page load, and refreshing them before expiry, to protect an image whose
entire purpose is being circulated. Writes are limited to the roles that may edit an event at all.

### `20260919000000_partner_attribution_approval.sql`
Two signatures before a partner is credited with anything.

**One ledger, not three flows.** A company through a partner's form, an investor referral, and an
admin ticking "referred by" in the database are the same claim — *this partner introduced this, and
is owed a fee*. `partner_attribution_claims` is what all four routes file into, and the SGP Desk
reads it as one queue.

**A trigger, not a column REVOKE.** Six code paths wrote `referred_by_partner_id` directly, so an
approval screen in front of them would have been decoration. `guard_partner_attribution()` refuses
any change to that column — INSERT as well as UPDATE — unless `app.applying_attribution` is set,
which only `apply_partner_attribution()` does. Column-level REVOKE was the first attempt and was
wrong: re-granting the other 48 columns on `companies` by name would leave every future column
silently unwritable.

The trigger fires for service_role and the SQL editor too. That is deliberate — "an admin goes into
the database and tags them" is the case it exists for. For a genuine data fix,
`SET LOCAL app.applying_attribution = 'on'` in the same transaction.

`users.is_sgp_approver` holds the second signature (set for Nimit). `apply_partner_attribution`
checks `coordinator_at` rather than `coordinator_by`, so the rows carried in from before approvals
existed — which had a real coordinator step but no record of who — are not permanently unapplyable.

The three already-tagged investors are backfilled at `pending_founder` rather than grandfathered as
approved: nobody signed the fee-bearing half, and a ledger full of claims no one approved is worse
than three items on a Monday agenda. `partner_companies` is renamed rather than dropped — no writer
since `20260906`, no reader since the Desk stopped rendering it, three historical rows worth keeping.

### `20260920000000_lock_down_privilege_escalation.sql`
The first batch from the 13 Aug security audit.

**Role escalation.** RLS decides which *rows* a caller may write, never which *values* — the
existing "Org admins update user roles" policy was correct about the row and silent about the role,
so a tenant founder could set themselves `super_admin` and `is_super_admin()` bypasses org scoping
across the estate. Triggers on `users` and `approved_emails` now refuse that, and refuse moving a
user between organisations, which is the same escalation wearing a different hat. They fire for
`service_role` too: the create-user Edge Function holds the service key and takes a caller-supplied
role. Escape hatch for deliberate platform work: `SET LOCAL app.allow_super_admin = 'on'`.

**Bearer tokens.** `"Anon read form links by token"` was `USING (true)` — every row, tokens
included. Dropped, and the `anon` grant revoked so a future permissive policy cannot silently
re-open it. Verified safe first: the renderer goes through `get_public_form()`, which is
`SECURITY DEFINER` and does not consult RLS.

**One repair.** Verifying the audit meant running the attacks against the live database. They
succeeded, so the probe cleared Meridian Angel Network's partner tag. The claim was restored at
once; the tag is restored here because the 20260919 guard correctly refuses it from anywhere else,
and fabricating a founder signature to tidy it up would be the dishonesty the ledger exists to
prevent.

### `20260921000000_investor_list_suggestions_and_live_edit.sql`
Founder suggestions, and editing a list that is already out.

A `kind` column on `investor_list_exclusions` rather than a second table: an exclusion and a
suggestion are one object with the sign flipped — a name typed from memory that somebody here has
to match against a fund we hold before it can be acted on. Same lifecycle, same matching step, same
RLS. The table name is now half right and is left alone deliberately; renaming it would break every
policy and code reference in the window between the migration running and the build deploying.

`submit_investor_list_response` gains `p_suggestions` and the four-argument version is dropped.
The drop is what keeps the window safe, not what threatens it: PostgREST passes arguments by name
and Postgres resolves a four-name call against the five-parameter function because the fifth has a
default — but only while there is one candidate. Leaving both would make that call ambiguous.

`get_investor_list_public` now returns per-item `decided_at`. No column records "added since the
founder replied": every item is stamped on submit, so a NULL `decided_at` on a responded list *is*
a fund that arrived afterwards. Derived rather than stored, so it cannot drift.

### `20260922000000_merge_duplicate_investors.sql`
Merging duplicate investor records.

The visible symptom was on investor lists: a fund appearing twice in the suggestions, once as a
thematic match and once as sector-agnostic. That is **not** a banding bug — a record lands in
exactly one band. It is two records each qualifying honestly on their own tags, so the fix belongs
at the source.

`merge_investors(p_keep, p_merge)` reads `pg_constraint` at run time and repoints every foreign key
referencing `investors`, rather than working from a hand-written list of tables. A list stops being
complete the next time somebody adds a table, and the failure is silent — a row still pointing at a
deleted record, or children taken out by `ON DELETE CASCADE`.

Unique-constraint collisions are handled by falling back to a delete: if repointing would collide,
the keeper already has that relationship and the loser row is redundant. Scalars fill only the
gaps on the keeper, arrays union, notes concatenate with a provenance line.

Scoped to the caller org, not merely to "both records in the same org" — this is `SECURITY
DEFINER`, and same-org-as-each-other would let one tenant merge another tenant's records.

`find_investor_duplicates()` groups by name with fund suffixes stripped, so "Blume" and "Blume
Ventures" surface. Deliberately loose and deliberately not automatic: it over-matches, which is why
it is a review screen with a chosen keeper and a confirmation.

### `20260923000000_task_assignment_by_coordinators.sql`
An SGP coordinator could not hand a submission to anybody but themselves.

The 42501 was **not** the INSERT policy — that admits exactly the roles the dropdown offers. The
action inserts with a RETURNING clause (`.insert(...).select("id")`), and Postgres checks the
**SELECT** policy on the row being returned. `Associates view own tasks` allowed a row only where
`assignee_id = auth.uid()`, so an associate creating a task for a colleague passed the write and
was refused the read-back of the row they had just written.

Worth remembering: a policy set can permit a write and still fail it if the statement reads.
Anywhere `.insert().select()` meets a SELECT policy narrower than the INSERT one, the same thing
happens.

SELECT and UPDATE now also admit `created_by` and `assigned_by_id` — you can see and correct work
you assigned, which is a gap in the task board independent of the Desk. INSERT additionally admits
an `admin` assignee, on request; `founder` is deliberately excluded.

### `20260924000000_partners_only_the_partner_form.sql`
A partner may hold one link, on the partner form, and nothing else.

`Org internal form links access` is an ALL policy whose role list included `franchise_partner`.
Permissive policies are OR'd, so the two narrow partner policies beneath it decided nothing —
the wide one had already said yes. That gave a partner INSERT on **any** form and any number of
links, SELECT with no `created_by` filter (every link in the org, including internal ones), and
UPDATE/DELETE on those same rows.

This is the trap `20260910` wrote down after the last occurrence: *"permissive policies are OR'd,
so adding a narrow one can only widen access; the wide one has to be found and removed."* The
narrow policies were added and the wide one was left in place.

The one-link cap is a trigger, not a unique index, because the rule is about who the creator is —
internal users legitimately hold several links on one form (the founder account has three on
Series A), so `UNIQUE (form_id, created_by)` would break them to constrain partners.

### `20260926000000_referral_investor_type.sql`
`partner_investor_referrals.service_type` — what the partner says the investor is.

Accepting a referral as a new record must set `investors.service_type` (NOT NULL), and nobody had
been asked, so the coordinator guessed from twelve options on behalf of someone who already knew.
It matters more than tidiness: investor lists exclude `angel_investor` in the database so a
founder's raise plans never reach an angel who might know them personally, and a type guessed
wrong in that direction defeats a rule the schema goes out of its way to enforce.

TEXT with no enum constraint, deliberately. A referral is a claim from outside the building; an
enum would reject the whole submission over a value we have not thought of rather than recording
what they said. It is validated where it is used — on accept, against `SERVICE_TYPE_LABELS`.

### `20260927000000_remove_investor_referral.sql`
A partner can clear a referral off their own list.

`20260910` ruled this out in as many words: *"Deliberately no partner UPDATE or DELETE. Withdrawing
a referral after we have acted on it rewrites who introduced whom."* That still holds for a decided
referral — it is what two partners' competing claims would be settled against — but not for a
pending one, where nobody has acted and nothing is lost.

So the one gesture does two things: **pending is deleted, decided is hidden** via `dismissed_at`.
The partner view filters on it; the coordinator queue does not.

Done in a `SECURITY DEFINER` function because RLS grants rows and never columns — a partner UPDATE
policy on this table would also let them write `status` and mark their own referral accepted.
The `anon` grant is revoked by name, since `REVOKE … FROM PUBLIC` does not remove it (that is how
`withdraw_partner_attribution` ended up callable by anyone).

### 20260928000000_form_contact_fields.sql
`form_nodes.contact_field` ('name' | 'email' | 'phone'). The public renderer always appended its own
"Your Name / Your Email" step after the last question; the Partner Form and Jotforms also ask for
those as questions, so a founder was asked twice. Tagged questions now feed the submitter fields and
the trailing step asks only for what is missing, disappearing when nothing is. Tags the existing
questions on those forms and rebuilds `get_public_form` to carry the new key.

### 20260930000000_notifications.sql
`notifications` and `push_tokens`. One table for every "something happened that involves you", and
one function in front of it.

This reverses `20260814700000`, which chose the escalations table *"rather than a new notifications
table"*. That was right while one flow needed it. Six do now, and the gap is not cosmetic: **the
person who submits a leave or expense request is never told the outcome.** No code path told them.
Kudos recipients got nothing, escalation recipients got a row in a list they had to go and visit,
and `notify_founders_of_approval` wrote escalation rows it did not mean because there was nowhere
else to put them. That function and its file are gone; the rows are notifications now.

The second reason is the phone. The bell's "seen" marker was one localStorage timestamp, per
browser by construction — read it on a laptop and the phone still badges. Read state is `read_at`
now, and survives the trip.

`kind` is TEXT + CHECK, not an enum, for the reason `20260917000000` and `20260926000000` give:
`ALTER TYPE … ADD VALUE` cannot run in the transaction that uses the value, and the SQL editor is
one transaction. `link` is stored rather than derived from kind + an id — the bell renders a link
and does not know what a task is, which is what keeps the next twelve kinds from touching it.

SELECT is `is_super_admin() OR user_id = auth.uid()` with **no** founder/admin oversight branch: an
unread pile is not managerial data, and the `*_edit_log` tables already carry the audit. Being
role-independent is what lets a `franchise_partner` read an escalation addressed to them.

Marking read is a `SECURITY DEFINER` function, not an UPDATE policy — RLS grants rows and never
columns, the wall `20260927000000` documents. A policy scoped to `user_id = auth.uid()` would also
let a recipient rewrite `title`, `body` and `link`, which is the one thing this table must not
allow if it is to stand as the record of what someone was told. `anon` is revoked by name.

`push_tokens` is inert — nothing writes to it until the Capacitor clients exist. It ships now so
push is one function body filling in rather than a migration plus twelve call sites revisited.

No DELETE policy and no purge job, on the terms `20260914000000` set out: there is no scheduler in
this app, and the edit logs, `task_pushes`, `fundraise_events` and `deal_stage_history` all grow
unbounded already.

Broadcasts are opt-in. Announcements and events only notify when the poster ticks "Notify the
team", off by default — a retroactively logged past event should not badge thirty people.

### 20260929000000_attendance_and_leave_policies.sql
The two signed HR policy documents as `hr_policies` rows — Attendance and Working Hours, and
Leave. Data, not schema: no table is created or altered.

Both are transcribed from the circulated PDFs, not rewritten. Where a source contradicts itself
the contradiction is carried across verbatim and noted in the migration's own header, because a
policy is the company's word and an import is not the place to edit it. The three known ones:
the attendance policy says 9 hours per day in §4 and §4.4 but 8 excluding breaks in §4.1; it
reuses the numbers 4.1/4.2 for two different pairs of clauses (the section numbering here follows
that document's own table of contents, its only internally consistent one); and the leave policy
tabulates 10 festival holidays, says 12 in prose, and lists 15.

Bodies are written in the Markdown subset `src/lib/policy-doc.ts` parses. That parser is
deliberately closed and falls through to paragraphs, so policies written before it render exactly
as they did. Guarded with `WHERE NOT EXISTS` on the title, so re-running cannot duplicate a row or
clobber an edit HR has since made in the app.

### 20261001000000_holidays.sql
`holidays` — the company calendar, one row per non-working day.

Note the timestamp: this was written as `20260930000000` and renamed when
`20260930000000_notifications.sql` landed on `main` first. Two files sharing a timestamp is not
cosmetic — the CLI's ledger keys on that prefix, so a fresh environment would apply one and
silently skip the other. Same-day migrations need distinct timestamps.

The list previously existed only as a table inside the Leave Policy's *prose*, which is
unreadable to code, and the cost was a live bug: `requestDays()` counted calendar days inclusive,
so a Friday-to-Monday leave was charged 4 days including the Sunday and a leave spanning Diwali
was charged for Diwali. That figure feeds the monthly attendance statement and from there a
salary deduction.

Sundays are deliberately **not** rows. The weekly off is a rule (`src/lib/working-days.ts`), not a
calendar entry; seeding 52 Sundays a year is a list nobody maintains. Saturday *is* a working day
here per the Attendance policy, so a holiday falling on one (15-08-2026) is a real row.

The Special Holiday Week is deliberately **not** seeded. The policy grants 5 days of paid leave
taken within 15 Dec - 5 Jan — an entitlement with its own lapse rule, not a company-wide closure.
Putting it on the calendar would mark three weeks non-working for everyone and quietly stop
charging leave taken in them.

RLS is the one departure from the neighbouring HR tables: every internal role **reads** it
(`hr_birthdays` is founder/admin/hr only), because the leave form shows a live working-day count
as someone picks dates. Writes stay founder/admin/hr. `UNIQUE (org_id, holiday_date)` stops a
duplicate double-counting a day off; the seed is `ON CONFLICT DO NOTHING`.

### 20261002000000_todo_subtasks_and_day_plans.sql
Sub-tasks on `personal_todos`, and the `day_plans` table behind the daily plan / end-of-day wrap.
One migration because they are one feature: you write the day's plan, the lines become to-dos, the
to-dos hold sub-items, and all of it rolls up into the week.

**Depth is capped at one level**, by trigger rather than convention. A `CHECK` cannot see other
rows, so `personal_todos_enforce_one_level()` rejects a parent that itself has a parent, and an
item that already has children from becoming a child. It is `SECURITY DEFINER` so the cap cannot
be defeated by RLS hiding the parent row. Arbitrary depth was considered and dropped: a personal
list that allows it becomes an outliner nobody maintains, and the two-level assumption is baked
into every query and render downstream.

`plan_date` is a third date alongside `due_date` and `work_week_start`, and all three earn their
place: due date is a commitment, work week is an act of sharing, plan date is an intention revised
daily. An item can be planned for today, due Friday, and filed under this week at once.

**The visibility change is the load-bearing part.** `20260818000000` made week-assigned to-dos
readable by founders/admins on the reasoning that assigning a week *is* the opt-in. Day plans work
differently by explicit decision: a report is read by leadership whether or not you tick anything,
because submitting it is sending it. So `day_plans` is lead-readable outright, the personal_todos
lead-read policy widens to `work_week_start IS NOT NULL OR plan_date IS NOT NULL` (a report whose
items are unreadable is useless), and a third policy lets leads read sub-tasks *of* rows they can
already see. Anything with no work week and no plan date stays private to its owner, as before.
The modal says all of this at the point of writing — a surface that looks private and is not would
be worse than one that is simply honest.

That third policy goes through `todo_parent_is_shared()`, a `SECURITY DEFINER` function, rather
than a subquery. A policy on `personal_todos` that selects from `personal_todos` re-enters RLS and
Postgres aborts with infinite recursion — the same reason `get_user_role()` exists rather than a
subquery over `users`.

### 20261003000000_todo_mentions.sql
`personal_todo_mentions` — a narrow, deliberate crack in the same privacy `20260728000000`
established: type `@Name` into a sub-task and that one person gets a notification and read-only
access to that one row, on their own to-do page. Nothing else on the list opens up — not the
parent, not siblings, not the rest of the board.

Reuses the exact pattern `todo_parent_is_shared()` set in `20261002000000` for the same reason:
a new SELECT policy on `personal_todos`, `"Users read subtasks mentioning them"`, checks
`personal_todo_mentions` — a *different* table — so it does not re-enter `personal_todos`' own RLS
and needs no `SECURITY DEFINER` wrapper (that wrapper is only for a policy that has to look at a row
it does not otherwise have access to; here the mentioned user is checking a table they can read
directly). The INSERT policy on `personal_todo_mentions` itself does the mirror check — a caller may
only tag people on a `personal_todos` row they own — via a plain `EXISTS`, not a definer function,
since the owner can already see their own row under normal RLS.

Adds `'mention'` to `notifications.kind`'s `CHECK` (dropped and recreated by name, per the
TEXT-not-enum reasoning `20260930000000` documents). The mention picker only offers itself inside a
sub-task's title, not a top-level to-do or `notes` — narrower surface, and it matches the one-level
depth cap `20261002000000` put in place.

### 20261004000000_fix_todo_mentions_recursion.sql
**Broke everyone's to-do list in production for the time between the two migrations.**
`20261003000000`'s new `personal_todos` policy checked `EXISTS (... FROM personal_todo_mentions ...)`
inline. `personal_todo_mentions`'s own SELECT policy checks `EXISTS (... FROM personal_todos ...)`
right back. Postgres evaluates every permissive policy on a table for every SELECT against it, so
*any* query against `personal_todos` — including an owner reading their own list — walked
`personal_todos -> personal_todo_mentions -> personal_todos` and Postgres aborted with "infinite
recursion detected in policy". `getMyTodos()` only read the `data` field, not `error`, so the
failure rendered as a silently empty list rather than a visible one — reported as "my to-dos are
gone." (`getMyTodos()`/`getMyMentions()` now throw on a read error, in the same commit as this
migration, so this class of failure surfaces instead of hiding.)

This is the indirect form of the exact bug `todo_parent_is_shared()` exists to prevent
(`20261002000000`): that one guards a policy that queries its *own* table; this is two tables'
policies querying *each other*. Same fix, one level removed: `todo_is_mentioned_for_current_user()`
is `SECURITY DEFINER`, so it reads `personal_todo_mentions` outside RLS instead of through it,
which is what breaks the cycle.

### 20261005000000_internal_roles_read_approved_emails.sql
`fetchAllUsers()` (`src/lib/partners.ts`) reads `approved_emails` to exclude revoked-but-not-deleted
accounts from any picker built off the full user list — the @mention picker on personal to-dos is
the newest caller, but the Weekly Update page's founder filter has used it since before this
migration. `"Org admins manage approved emails"` (`20260700300000`) only grants founder/admin/
super_admin SELECT on that table, so for every other internal role the inner query silently
returned zero rows (RLS filters, it does not error) and `fetchAllUsers()` filtered out *every* user
as a result — reported as "nothing shows up" in the mention dropdown for a non-admin caller, a
second, independent cause of that symptom alongside the client-side portal bug fixed the same day
(see `src/app/(app)/my-todos/_components/MyTodosClient.tsx` — the dropdown was also being clipped by
its card's `overflow: hidden`).

Same shape as `"Internal roles view org users"` (`20260821000000`) on the `users` table: a narrow,
additive SELECT policy for the same five internal roles, OR'd in alongside the existing admin-only
`FOR ALL` policy rather than replacing it, so who can *edit* the allowlist stays founder/admin only.

### 20261006000000_external_users.sql
`is_external` on `approved_emails` and `users` — see [ROLES.md](ROLES.md#is_external--orthogonal-to-role)
for the full picture. Deliberately a plain column, not RLS-gated on its own: it's read by ordinary
app-layer queries (the attendance/leave-balance/kudos roster builders, and `requireRole()`'s
`isExternal` return value), not by a policy that needs to hide the column from anyone — every
internal role that can already read a `users` row can already read this one.

`handle_new_user()` is `CREATE OR REPLACE`d rather than left alone, same as `20260700400000` did for
adding `org_id` — it's the one place a brand-new row's columns get filled in from `approved_emails`,
so a copy step added anywhere else would only run for people who sign in after that migration,
silently skipping anyone invited before it. No RLS or enum changes needed: role itself is untouched,
`is_external` just rides alongside it through the same trigger.

### 20261007000000_associate_referral_form.sql
A shareable form for associates, the same shape as the partner form (`20260906000000` /
`20260907000000`): a dedicated "Associate Sourced" pipeline (`is_associate_intake`), a dedicated
"Associate Referral" form pointed at it (`is_associate_form`), and a `sourced_by_associate_id`
column on `pipeline_entries` credited to whoever shared the link.

Not built on `desk_deals` (Deal Desk). `createDeskDeal` (same day) already covers "an associate
types in a company they heard about"; this is the other half — a link sent so the company submits
*itself* — which needs the anonymous-submission path `/f/[token]` + `submit_form_entry()` already
provide. Reusing that is strictly less work than building a second one, and it gets a Kanban board
for free (`/pipelines/[id]`, already generic).

**The attribution trigger is generalised, not duplicated.** `attribute_entry_to_partner()`
(`20260906000000`) only ever fired for a partner's link. Renamed to `attribute_entry_to_sourcer()`,
it now does one lookup of the link's creator and credits `sourced_by_partner_id` if they're a
partner or `sourced_by_associate_id` otherwise (founder/admin/associate/general/hr — anyone without
a `franchise_partner_id`). This is a strict widening: previously a non-partner's link left an entry
completely unattributed, so nothing that reads `sourced_by_partner_id` changes behaviour, and
nothing read `sourced_by_associate_id` before this migration existed for it to affect.

Deliberately **no new `form_links`/`forms` policy**: `"Org internal form links access"`
(`20260924000000`) already lets founder/admin/associate create and read a link on *any* form in
their org, which is exactly what letting them issue a link to this one needs. The partner form
needed its own lock-down policies because a partner is external and was using that breadth to skip
the SGP coordinator; an associate issuing a link to a different internal form isn't bypassing
anything, so no equivalent restriction was added here.

The new `"Sourcing user reads own sourced entries"` policy is a plain
`sourced_by_associate_id = auth.uid()` check — no subquery into `pipeline_entries` itself, so it
carries none of the indirect-recursion risk `20261004000000` had to fix for personal to-do mentions.

### 20261008000000_esv_referral_for_everyone.sql
Opens `20261007000000`'s pipeline/form to every internal role, not just associates — one link
anyone on the team can post on LinkedIn or send directly. Data-only: the `is_associate_*` column
and flag names stay as they are (renaming buys nothing this soon after creating them and risks
more), what changes is the seeded row's public-facing copy (`forms.title`/`description` — shown to
the anonymous person filling the form in at `/f/[token]`, never internal-only) and the pipeline's
internal name, from "Associate Sourced" to "ESV Referrals" since it's no longer accurate once every
role can source through it.

**Backfills a link for everyone already here.** A one-time `DO` block, not an ongoing job: it
inserts a `form_links` row for every founder/admin/associate/general/hr user who doesn't already
have one on this form. Anyone who joins afterward gets theirs the normal way — the first time they
open `/referrals`, via the already-idempotent `getOrCreateMyAssociateReferralLink()`.

No new RLS: `fetchAllReferralLinks()` (the `/admin/referrals` "everyone's links" page) reads off
`"Org internal form links access"` (`20260924000000`), which already lets founder/admin read every
`form_link` in the org — this page is an app-layer view over data they could already query, not a
new grant.

### 20261009000000_esv_founder_form.sql
The link goes to **founders filling it in about their own company**, not to someone passing a lead
on — the `20261007`/`20261008` copy was worded as a third-party referral. Now: internal title "ESV
Founder Intake", public `display_name` "Tell us about your startup", questions in the founder's own
voice. Questions are updated **in place** (matched on the seeded wording), not rebuilt, because
`pipeline_entry_answers` points at `form_nodes` ids.

It also fixes a double-ask: "Who is the contact…" was free text with no `contact_field`, so
`FormRenderer`'s trailing name/email step asked again. It's now "Your name" (`contact_field =
'name'`) plus a new "Your email" (`'email'`) spliced in before the last question — with both tagged
the trailing step is skipped and the answers land in `submitter_name`/`submitter_email`.

**Narrows `"Sourcing user reads own sourced entries"` to the referral pipeline.** Because
`attribute_entry_to_sourcer()` credits any internal user's link on *any* form, the `20261007`
version let an associate read entries on other pipelines they'd issued a link for. The pipeline
check goes through the `SECURITY DEFINER` `is_associate_intake_pipeline()` rather than a subquery,
so it can't re-enter a `pipelines` policy (the `20261004000000` recursion class).

### 20261010000000_esv_founder_form_matches_partner_form.sql
The ESV founder link goes to startup founders who reached out; the team wants the **same intake the
Partner Form collects**, so the `20261009` five-question placeholder is replaced by a clone of the
org's live partner form (nodes, MCQ options, branch edges, `contact_field` tags, and its
founder-facing `display_name`/`description`). Cloned at migration time so builder edits since
`20260908` come across; rows copied via `jsonb_populate_record` because the `form_*` tables predate
this migration history and a hand-written column list could drop one. Branch edges hold the chosen
option's id in `condition_value`, so those are remapped. Afterwards the two forms are independent —
editing one doesn't change the other. Skipped (with a NOTICE) for any org whose founder form already
has answers.

**Companies only after acceptance, for this form.** `submit_form_entry()` (`20260726000000`)
creates-or-links a Company at submission for every public form, which would put every founder who
reaches out — including ones later rejected — into Companies as a "prospect". `acceptDeal` already
creates-or-links on acceptance, so for `is_associate_form` the submission-time step is skipped. The
Partner Form and all other forms keep the old behaviour; the function body is otherwise unchanged.

### 20261011000000_referral_slugs.sql
Readable founder links: `/apply/sakshay` instead of `/f/<random token>`, since these get posted on
LinkedIn. `form_links.slug` is a second name for the same link row — `/f/<token>` keeps working and
attribution is untouched. **Founder form only**, enforced by the `form_links_referral_slug` trigger:
tokens elsewhere are bearer secrets (`20260920000000`), and a guessable name only makes sense on a
form that's public by design (worst case, someone submits through a colleague's slug and credits
them).

Slugs come from the first name (then email local part), lowercased, `-2`/`-3` on a clash, unique
globally on `lower(slug)` because the URL has no org in it. The trigger assigns one to every new
founder-form link (so every creation path gets one) and the backfill gives existing links theirs,
oldest first so the longest-standing person keeps the plain name. `resolve_referral_slug()` is the
anon-callable lookup `/apply/[slug]` uses; returning the token discloses nothing new, since holding
the slug already lets you submit through that link. Renaming a slug (`setReferralSlug`, own link or
any as founder/admin) retires the old `/apply/` address.

### 20261012000000_submission_to_company_profile.sql
Founder-form and Partner Form answers now reach the company profile. Before this, accepting an entry
created the company by name only; everything else stayed in `pipeline_entry_answers`.

`form_nodes.field_key` says what each answer means (`website`, `ask`, `annual_revenue`, `deck_url`,
`prefunding_interest`…) — explicit rather than matched on wording, same reasoning as
`contact_field`. Tagged here on both forms by their current wording, old and 20260925 variants.

`apply_entry_to_company(entry, overwrite)` maps the tagged answers onto the company: website,
incorporation type, ARR (last-FY turnover), MRR (last month), pre-money (valuation), ask, sectors
(submitted first, the team's kept after), the founder (matched by name; LinkedIn added), and the deck
into Documents. `acceptDeal` calls it with `overwrite = true` — the team chose "latest submission
wins". Business stage is deliberately **not** mapped: the profile's `stage` is a funding round that
drives investor matching, the form's is Idea/MVP/Early revenue. `parse_inr_amount()` reads amounts
as founders type them ("2 Cr", "₹50L", "5,00,000"); unparseable ones are left out rather than
guessed. `SECURITY DEFINER` with its own org/role check, so an RLS refusal can't make a fill fail
silently. **No backfill**, by decision — past companies are unchanged until re-accepted; the
function's `overwrite = false` mode exists for a later one.

The full submission shows on the profile as the Application section (`fetchCompanyApplications`),
grouped by `field_key`, with the services the founder asked for pulled out as highlights.

No scheduler is involved: there is no nightly job that opens or closes a day plan, on the terms
`20260914000000` set out. A plan exists because someone wrote it.

### 20261013000000_general_founder_link.sql
One general link to the ESV founder form, for the website and the company LinkedIn page:
`/apply` (bare — personal links stay at `/apply/<name>`). It is a `form_links` row on the founder
form with `is_general = true` and no creator, so `attribute_entry_to_sourcer` credits nobody and it
doesn't inflate anyone's count on /admin/referrals. Same questions, same ESV Referrals pipeline, same
company-profile fill on acceptance. One per form (partial unique index); never given a personal slug;
only founder/admin can delete it or change the flag (`protect_general_link`), since the Share tab
lets associates manage links and deleting it would break the website's Apply button.
`resolve_general_founder_link()` resolves it for anonymous visitors, as `resolve_referral_slug` does
for the personal ones. `form_links.created_by` becomes nullable (a no-op if it already was).

### 20261014000000_projects.sql
**Projects**: prefunding engagements get their own section (`/projects`), moved out of Active
Deals where Prefunding was a category with one "Engagement Letter" field.

- `projects` moves through shared stages once (lead → first_call → proposal → data → advance → work
  → handover → completed, or dormant when the proposal is declined). Payments (advance/balance),
  Drive folder, proposal link, post-handover changes (`changes_used`, CHECK ≤ 2), partner credit and
  the client's `share_token` live on it.
- `project_services` is the cart (ex-GST `price_inr`, typed per project) and, once work starts,
  each service's own track: draft_1 → draft_2 → final, or for valuation model_built → with_valuer →
  valuer_approved → draft_report → client_approved → final.
- `project_members` holds Connect / Lead / Design / Finance; one person can hold several.
- `project_checklist_items` is the data checklist, seeded from the services on acceptance
  (templates in `src/lib/project-model.ts`, from the Aaiba Design and Grounded Cafe proposals).
- `project_events` is the timeline.
- Visibility: `can_see_project()`: every internal user sees every project; external users only
  those they hold a role on. `guard_project_update` restricts partner credit to founder/admin and
  payments to founder/admin/project lead.
- Tasks: `tasks.source` gains `'project'` and `tasks.project_id`. `sync_project_tasks()` raises the
  current step's task for the matching role holder and closes the ones the project moved past; one
  task per rule per project ever (unique index), so a task ticked off early doesn't come back.
- `get_project_public(token)` backs the client's read-only `/pr/<token>` page (stages, tracks,
  outstanding data, payment status, contact; never prices or notes). `get_partner_projects()` backs
  the "Projects you brought in" section of the partner portal.
- Existing Prefunding deals were moved over (active → in progress, dormant → dormant, closed →
  completed; archived left alone), their assignees becoming leads. A Prefunding-only deal is
  archived; a deal with other categories just loses Prefunding. `deal_categories.retired` hides
  Prefunding from every category picker.

### 20261015000000_projects_task_copies_and_drive_link.sql
Projects follow-up (decisions of 2026-09-29). **Everyone holding a role gets their own copy** of
that role's task: `project_role_holders()` returns everyone in the role (falling back to the leads,
then the connects), `sync_project_tasks` inserts one task per holder, and the unique index is now
per rule per project per person. Someone taken off a role has their open copy deleted (not ticked,
so it doesn't count as completed on their weekly update). **The client's `/pr/` link shows the Drive
project folder** once it's linked (`get_project_public` returns `drive_url`), since that's where the
client uploads their data. Ends by re-syncing every live project so shared roles get copies now.

### 20261016000000_form_answers_survive_edits.sql
**Fixes form responses disappearing.** Saving a form in the builder (`saveFormGraph`) deleted every
`form_node` and re-inserted it with the same id; `pipeline_entry_answers.node_id` cascaded, so every
save wiped every stored answer to that form (entries kept their title, which is copied from the
first answer, and showed "No answers recorded"). The same save dropped `form_nodes.field_key`.
The builder now upserts nodes and options and deletes only the ones removed. Belt and braces here:
answers keep their own copy of the question's wording (`question_text`, filled by trigger on
insert and backfilled), and the node FK is now `ON DELETE SET NULL`, so removing a question keeps
its answers. The 20261012 `field_key` tags are re-applied. Answers already lost can only come back
from a Supabase backup.

### 20261017000000_pipeline_stage_tasks.sql
**Automatic tasks on pipeline stages.** `pipeline_stage_tasks` holds task templates per stage
(Lead/Accepted/Rejected included): a title (`{name}` → the entry's title), who it goes to
(`assignees` = everyone assigned, one copy each; `mover` = whoever moved it; `user` = a named
person), due-in days and priority. A trigger on `pipeline_entries` (insert and stage change) calls
`raise_stage_tasks()`, so every route into a stage raises them (board moves, accept, reject, and
anonymous form submissions into the first stage) and closes the open ones from the stage the entry
left. `tasks.source` gains `'pipeline'`, with `pipeline_entry_id` and `stage_task_id`. A trigger on
`pipeline_entry_assignees` hands a waiting unassigned task to the first person assigned, gives later
assignees their own copy, and removes an unassigned person's open copies.

### 20261018000000_investor_referral_tree.sql
**Referrals that branch, so a partner's investor can introduce an investor.** Adds
`investors.referred_by_investor_id` beside the existing `referred_by_partner_id`; at most one is set
(`investors_one_referrer`), so a partner tag marks a chain's **root** and the other column is the
links below it. A `BEFORE INSERT OR UPDATE` trigger refuses cycles (A→B→A has no root and would
recurse forever) and caps chains at 32. `investor_root_partner(uuid)` walks one chain up;
`investor_referral_roots` is the whole forest as a view — **revoked from `authenticated`**, because
it is deliberately not `security_invoker` (the walk must cross rows the caller cannot read) and an
open view would hand any partner the org's entire referral graph. `guard_partner_attribution()` is
extended to cover the new column: placing an investor under one of Robin's investors credits Robin
exactly as tagging them to Robin would, so it takes the same two signatures.
`partner_attribution_claims` gains `referrer_investor_id` and the source `'investor_chain'`;
`apply_partner_attribution` re-resolves the root at write time and refuses if the chain moved
between the two signatures. **ESV pays the root partner gross and models nothing below it** — how
the partner and their investors divide that is their own arrangement.

### 20261019000000_partner_earnings_over_tree.sql
**Earnings follow the whole subtree.** `get_partner_earnings` asked
`i.referred_by_partner_id = p_partner_id`, which scored a chained investor zero and usually dropped
the deal from the partner's page entirely. It now resolves each investor to its root partner via
`investor_referral_roots`; fee resolution, base selector and split are untouched. Worked example:
Robin → A → B, B invests 1 Cr at a 6% investor fee, Robin on 50/50 → Robin is owed 3,00,000, i.e. 3%
of the gross crore. Adds `get_partner_referral_tree(uuid)` (the tree to draw — a partner may read
only their own, internal roles any) and `search_investors_for_chain(text, uuid)` (the picker, which
offers only investors already inside some partner's tree, since nobody else can pass credit on).

### 20261020000000_venture_partners.sql
**Venture Partners, as a tier rather than a role.** `franchise_partners.partner_tier` is `'sgp'`
(default — nothing changes for anyone existing) or `'venture'`. A venture partner has **identical
referral rights** and sees a deal only when named on it, via the new `active_deal_partner_access`.
A second `user_role` enum value was rejected: `'franchise_partner'` appears in 68 app checks plus a
long tail of RLS policies, all of which would need widening to keep referral parity, and each one
missed is a silent permission hole. Same reasoning as `is_sgp_coordinator` (20260826000000). The
single predicate `partner_can_see_deal(uuid)` is what every partner-facing read now asks, so the
tiers cannot drift apart; `entry_has_partner_visible_deal` delegates to it.
`active_deals.visible_to_partners` stays the master switch for **both** tiers — a grant does not
override a deal someone deliberately hid. `active_deal_partner_shares` and `get_partner_earnings`
are untouched: money owed must not vanish because a deal stopped being visible.

### 20261021000000_active_deal_raise_shape.sql
**What the round actually looks like.** `active_deals` gains `total_raise`, `external_raised` (of
the round, how much an outside party has already committed) and `min_ticket`, with CHECKs for
non-negative amounts and `external_raised <= total_raise`. What is still **open** is derived
(`total − external − committed through us`), never stored — a stored remaining disagrees with the
investor rows the moment one is edited, invisibly. `get_partner_deal_summary` and
`get_partner_deal_summaries` carry all three, so **partners see the minimum ticket and the external
raise** by instruction; both also move onto `partner_can_see_deal`, which previously would have let
a venture partner read every deal's summary while the entry policy correctly refused them the page.

### 20261022000000_partner_can_see_deal_unlinked.sql
**Fixes an empty portal for partner users with no partner record.** `partner_can_see_deal()`
(20261020000000) inner-joined `franchise_partners` on `users.franchise_partner_id`; the path it
replaced never touched that table. A `franchise_partner` whose `franchise_partner_id` is still NULL
therefore matched nothing and saw no deals at all — and that is the routine state between creating a
partner user and filling in their agreement, which is what the "N partners are missing details"
banner on `/admin/partners` counts. Now a LEFT JOIN with `COALESCE(fp.partner_tier, 'sgp')`, so an
unlinked account behaves exactly as before, and the org check is back on the user's own `org_id`
rather than the partner record's. Venture gating is untouched — an account with no partner row
cannot be venture-tier.

### 20261023000000_partner_reads_referral_subtree.sql
**A partner's investor list follows the chain, like everything else already did.** 20261018/19 moved
credit, earnings and the tree diagram onto the subtree but left the investor LIST matching
`referred_by_partner_id = <partner>`, i.e. direct referrals only — so a partner with Aster → Bluefin
→ Coral saw one fund on `/investors` while `/earnings` showed a tree of four and paid them on all of
it. Adds a permissive SELECT policy rather than editing the existing one, whose name is not knowable
from the repo (same situation as 20260828000000). The id set comes from
`my_partner_investor_ids()` — no arguments, derived from `auth.uid()`, SECURITY DEFINER because the
roots view is revoked from `authenticated`, and set-returning/STABLE so the planner resolves it once
per query instead of running a recursive CTE per row. UPDATE stays pinned to direct referrals and
`investor_contacts` is untouched: being credited for a chain is a reason to see a fund, not to edit
its record or read its contact book.

### 20261024000000_fee_kinds_and_split_per_kind.sql
**A partner's cut differs by which fee it is.** The model was one split against one base, which is
true of PJ/HS/PR (50% of both transaction and success fees) and false of everyone else — Robin takes
25% of the transaction fee and **none** of the success fee; so do RD (45%) and Nishant (50%);
Soonicorn and Signal take 60% of the success fee and nothing of the transaction fee. Under the old
model Robin's FWDA share computed as 25% × (trx + success) = ₹2,62,500 against an actual ₹1,57,500 —
a lakh out, stated confidently. `active_deal_investor_fees.fee_kind`
(`transaction`/`success`/`carry`/`other`, defaulting to `other`) and
`active_deal_partner_shares.split_{transaction,success,carry}_pct` fix it; `get_partner_earnings` now
sums kind by kind and returns the per-kind bases and splits so a number can be checked against a fee
sheet. **Backward compatible by construction**: every per-kind split falls back to `split_pct`, which
falls back to the partner standard, so with nothing set the arithmetic is identical to before. The
function signature changed (breakdown columns added), so it is dropped and recreated rather than
replaced. See `scripts/import/fwda_tranche2.sql` for the data this was built against.

### 20261025000000_admins_can_approve_attribution.sql
**Founders and admins can give the second signature, not just the flagged approver.** 20260919000000
made the approver a flag rather than a role so one named person signed each fee off; in practice
that made a single inbox the bottleneck for every claim, and claims that wait stop being filed.
`sgp_can_approve()` now returns true for founders and admins as well as anyone carrying
`is_sgp_approver`, and the action guard matches. **Deliberately unchanged:**
`apply_partner_attribution` still refuses a claim whose coordinator and founder signatures come from
the same person — widening *who* may give the second signature does not widen *how many* one person
may give, so every attribution still needs two humans. `is_sgp_approver` is kept rather than
dropped: it still marks who is expected to do this rather than merely permitted, and it is how an
associate holds the second signature without being an admin.

### 20261026000000_exclude_deal_from_partner_earnings.sql
**Take one deal off one partner's earnings.** A deal reaches a partner's page because they sourced
it or one of their investors is on it — usually right, occasionally not (an investor who came in
independently and was tagged later, a deal the partner was taken off, a duplicate). The only lever
was setting the split to 0, which leaves the deal on their page at ₹0 and invites the question
rather than settling it. `active_deal_partner_shares.excluded` drops it instead: `share_amount` is
zeroed **inside** the function so no caller can total a column that should not have been counted,
and `getMyEarnings` filters the row out before a partner sees it. A flag rather than deleting the
share row, so the agreed split survives and including it again restores it. The function still
**returns** excluded rows, carrying `is_excluded` — filtering them in SQL would hide them from the
admin too, and an exclusion nobody can see is one nobody can undo.

### 20261027000000_active_deal_valuation.sql
**What the company was worth when the money went in.** `active_deals.valuation` plus
`valuation_basis` (`pre`/`post`, nullable). The basis is a column rather than a convention because
"₹103 Cr" means two different things depending on whether the round sits inside it — on FWDA's
₹16 Cr round that is ₹16 Cr of company, and the implied stake is 15.5% or 13.4% accordingly. The
deal page derives what the round buys **only** when the basis is recorded; a percentage from a guess
reads exactly like one from a fact. The workbook's 3x and 10x figures are deliberately not stored —
they are the valuation times three and ten, storing a multiplication is how two numbers come to
disagree, and a projection beside a fact gets read as one. Carried to partners by both summary
functions, same reasoning as the minimum ticket (20261021000000): it is in the deck, and a partner
quoting a stale one is worse than them knowing it. Backfills FWDA Tranche 2 at ₹103 Cr pre.

### 20261029000000_partner_ledger.sql
**A partner's account: the buy-in, what they paid against it, and what we paid them.** An SGP buys
in, and that buy-in is settled two ways — they pay it, or we hold back earnings and put those
against it. Neither existed anywhere, so "what do we owe Robin" and "what does Robin still owe us"
were spreadsheet questions. `partner_ledger_entries` is one table of lines with four kinds: `buy_in`
(what they owe), `payment` (cash from them), `adjustment` (earnings withheld and applied to the
buy-in — the one line that both reduces the buy-in **and** settles earnings, and the mechanism this
exists for), and `payout` (cash from us; `reference` is the receipt number, and the action refuses a
payout without one). `amount` is always positive and `entry_type` decides direction — a signed
amount only works while every reader remembers the convention. **Balances are summed by
`get_partner_ledger_summary`, never stored**, so the figures and the lines cannot disagree; the
buy-in outstanding is not clamped at zero, because an overpayment is real and showing it as nil
would hide money owed back. The buy-in is a line rather than a column on `franchise_partners`, so a
renegotiated partner gets a second line and keeps the first. Partners read their own account and
write nothing — writing would be deciding you had paid; associates read, founders/admins write.
