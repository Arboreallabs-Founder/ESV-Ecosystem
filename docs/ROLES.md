# ESV Ecosystem — Roles & Permissions

> Last updated: 2026-08-14 (added the `hr` role, Engage/Kudos, Leave & Expense approvals).
> This is the authoritative reference for what each role can and cannot do.
> Enforcement happens at **two layers**: server-action guards (`requireRole` / `requireAdmin` /
> `requireInternal`) and Postgres **RLS policies** (`get_user_role()`, `get_user_org_id()`,
> `is_super_admin()` — all `SECURITY DEFINER`). The UI mirrors these but is never the security boundary.

---

## The seven roles

| Role | Type | Scope |
|------|------|-------|
| **super_admin** | Platform | Cross-org. `org_id = NULL`. Manages organizations; bypasses org scoping. |
| **founder** | Internal | Full access within their org. |
| **admin** | Internal | Full access within their org (functionally equal to founder). |
| **associate** | Internal | Day-to-day operator with limited admin/edit rights; tasks scoped to self. |
| **general** | Internal | Narrow operator added 2026-08-05. Read-only on the deal pipeline (pipelines/active deals/companies/investors); full task access (same as associate). Lost HR policies/Bulletin/Events edit rights on 2026-08-14 when `hr` took over that tier — now read-only there too, same as associate. |
| **hr** | Internal | Narrow HR-operator role added 2026-08-14. Nav access limited to the Team section only (Tasks, Bulletin, Events, HR Zone, Approvals, Engage) — no Dashboard, Deal Flow, Database, or Admin section access. Can create/edit (not delete) HR Zone policies, Bulletin posts, and Events; full task parity with general; sole role (with founder/admin) that can see/adjust the HR clock-in/out widget and manage birthdays; one of three leave/expense approvers. |
| **franchise_partner** | External | Referral partner. Read-mostly; scoped to their **own** links & referrals. |

"Internal" = founder, admin, associate, general, hr. Everything is **org-scoped**: a user only ever
sees data in their own organization (super_admin excepted).

---

## Capability matrix (quick reference)

Legend: ✅ full · 🟡 limited/conditional · 👁 read-only · ❌ none

| Capability | Founder | Admin | Associate | General | HR | Partner | Super admin |
|---|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pipelines board (view/move/assign) | ✅ | ✅ | 🟡 assigned | 👁 | ❌ | ❌ | ❌ |
| Build / edit forms | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate submission links | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| My Submissions (own sourced entries) | — | — | — | — | — | 👁 | ❌ |
| Active Deals — view | ✅ all org | ✅ all org | ✅ all org | 👁 all org | ❌ | 👁 all org¹ | ❌ |
| Active Deals — edit investors/fees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Partner deal shares — set base + split | ✅ | ✅ | 👁 | ❌ | ❌ | ❌ | ❌ |
| Partner earnings — view | ✅ per partner³ | ✅ per partner³ | 👁 | ❌ | ❌ | 👁 own only⁴ | ❌ |
| Accept a deal (entry → Accepted) | ✅ | ✅ | 🟡 if assigned | ❌ | ❌ | ❌ | ❌ |
| Deal categories (CRUD) | ✅ | ✅ | 👁 | ❌ | ❌ | 👁 | ❌ |
| Investors — create | ✅ | ✅ | ✅ | ❌ | ✅ | 🟡 referrals | ❌ |
| Investors — edit | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 own referrals² | ❌ |
| Investors — delete | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Investors — view | ✅ | ✅ | ✅ | 👁 | ✅ | 🟡 own referrals | ❌ |
| Set ESV POC on investor | ✅ | ✅ | 🟡 on create | ❌ | ❌ | ❌ | ❌ |
| Tasks — view | ✅ all | ✅ all | 🟡 own assigned | 🟡 own assigned | 🟡 own assigned | ❌ | ❌ |
| Tasks — create/assign | ✅ non-partners | ✅ non-partners | 🟡 self/associates/general/hr | 🟡 self/associates/general/hr | 🟡 self/associates/general/hr | ❌ | ❌ |
| Tasks — push (new date) | 🟡 own | 🟡 own | 🟡 own | 🟡 own | 🟡 own | ❌ | ❌ |
| Tasks — KPI view | ✅ everyone | ✅ everyone | 🟡 own | 🟡 own | 🟡 own | ❌ | ❌ |
| Escalations — view | ✅ all | ✅ all | 🟡 own raised | ❌ | ❌ | 🟡 sent to them | ❌ |
| Escalations — raise | ❌ | ✅ | ✅ | ❌ | ❌⁵ | ❌ | ❌ |
| Escalations — set status | ✅ | ✅ | 🟡 own raised | ❌ | ❌⁵ | 🟡 received | ❌ |
| HR clock widget & birthdays | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| HR policies — create/edit (not delete) | ✅ | ✅ | ❌ | 👁 | ✅ | 👁 | ❌ |
| Bulletin — create/edit (not delete) | ✅ | ✅ | ❌ | 👁 | ✅ | 👁 | ❌ |
| Events — create, and edit **your own** | ✅ | ✅ | ✅ | 👁 | ✅ | 👁 | ❌ |
| Engage — give kudos | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Engage — delete a kudos | ✅ | ✅ | 🟡 own given | 🟡 own given | ✅ | ❌ | ❌ |
| Leave requests — submit | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Leave / Expense requests — approve | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approvals page (`/approvals`) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Analytics page (`/analytics`)⁶ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Analytics — record an adjustment | ✅ | ✅ | ❌ | ❌ | ❌⁶ | ❌ | ❌ |
| Analytics — edit scoring weights | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Leave balances — set entitlement/used | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Leave balances — view own remaining | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| User management (`/admin/users`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ cross-org |
| Partner management (`/admin/partners`) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Manage organizations | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Wiki | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**General role note:** added 2026-08-05 (`20260805000000_add_general_role.sql` onward), purpose-built
as a narrower operator than associate — read-only into the deal/investor pipeline, but full task
parity with associate. Briefly (2026-08-12 to 2026-08-14) also had write access to HR policies and
Bulletin/Events posts; that tier moved to the new `hr` role on 2026-08-14 and general is read-only
there again. See [FUNCTIONALITY.md](FUNCTIONALITY.md) for the full module rundown.

**HR role note:** added 2026-08-14 alongside the HR clock widget, Engage/Kudos, and Leave & Expense
approvals. Nav-visible only in the Team section (Tasks, Bulletin, Events, HR Zone, Approvals,
Engage) — no Dashboard, Deal Flow, Database, or Admin section. Owns the create/edit (not delete)
tier on HR Zone policies, Bulletin, and Events (taking that over from `general`), is the only
non-founder/admin role that can see or adjust the top-right HR clock-in/out widget and manage
birthdays, and is one of three leave/expense approvers (with founder and admin) — see the Leave &
Expense / Approvals module section below for the founder-notify-on-admin/HR-approval rule.

¹ Partners see all active deals **in their org**, but inside each deal only their **own referred
investors** are listed and the Investment/Earnings totals are computed from those only. Everything in
deal detail is **read-only** for partners.
² Partners may edit only investors they referred, and **cannot** change the ESV POC or the referral
attribution.
³ Founders/admins open a per-partner page from the Partners tab listing every deal the partner is tied
to, with org total earning, referred earning, a base selector, an editable split %, and the resulting
share. Associates can read it but not change the share config.
⁴ Partners see a **My Earnings** page with only their **own** final share per deal (₹) — never org
totals or other investors. Computed server-side via the `get_partner_earnings` SECURITY DEFINER function.
⁶ `/analytics` is currently gated to **founder/admin only** while the scoring model is being
evaluated — set in `CAN_VIEW` in `src/app/(app)/analytics/page.tsx` and the nav `roles` array in
`AppShell.tsx`. The RLS underneath is deliberately wider than the UI: `performance_adjustments`
still grants SELECT to HR and to `user_id = auth.uid()`, and the personal-scorecard branch is still
wired up, so re-opening access to HR/associate/general is a UI-only change requiring no migration.
⁵ HR cannot raise or act on an escalation through the UI (`updateEscalationStatus`'s app-layer guard
doesn't include `hr`, and only founders/partners are valid recipients). The `"Escalations insert"`
RLS policy was widened to include `hr` purely so the backend can auto-insert a founder-notify row
attributed to an HR approver when they approve a leave/expense request — see Leave & Expense /
Approvals below. This is not a user-facing escalations capability.

---

## By module

### Authentication & accounts
- Sign-in via Google OAuth (primary) or email/password. Only **pre-approved emails**
  (`approved_emails`) can create an account; the `handle_new_user()` trigger blocks others.
- All roles can change their own password.
- New self-signups default to **associate** but are blocked unless pre-approved.

### Admin — Users (`/admin/users`)
- **Founder / Admin**: add approved users, set/edit role, revoke access (removes from allowlist,
  deletes the auth user, and cascades the partner record). Scoped to their org.
- **Super admin**: same, across all orgs.
- **Associate / Partner**: no access.

### Admin — Partners (`/admin/partners`)
- **Founder / Admin**: create partner records, fill/edit partner details (fee splits, contract
  link), and link a partner record to a portal user account.
- **Associate / Partner**: no access. A partner can view only their **own** partner record (via RLS).

### Organizations (multi-tenancy)
- **Super admin** only: create/manage organizations. All other roles are pinned to a single
  `org_id` and can never read or write another org's data.

### Pipelines & Forms (intake)
- **Build / edit / delete forms and pipelines, manage stages**: Founder / Admin only.
- **View the pipeline Kanban board, move entries, manage assignees**: Internal roles. Associates can
  update entries **assigned to them**.
- **Generate personalised submission links** (`/f/[token]`): all authenticated roles, incl. partners.
- **Assignees** on a deal/entry: any internal user can be assigned; **partners can never be assigned**.
- **Partners** have no pipeline board; they see **My Submissions** — the entries that came in through
  *their own* links — read-only.
- Public form submission (`/f/[token]`) is open to anonymous submitters via a scoped anon policy.

### Stage questions (custom pipeline stages)
- **Define**: Founder / Admin attach question fields (label + type: text/numeric/percentage/url +
  required) to **custom** stages when creating/editing a stage. Lead/Accepted/Rejected never carry
  questions (Accepted keeps its categories modal, Rejected its reason modal).
- **Answer**: when **anyone who can move an entry** (founder/admin, or an associate assigned to it)
  moves it **into** a stage with questions, they must answer the required ones before the move commits.
- **Edit later**: Founder / Admin can edit a stage's recorded answers from the entry detail card;
  associates only set them at move-time.
- **View**: answers show in the entry detail card and in the active deal detail card. **Partners**
  see them read-only in the active deal detail (only for deals/investors they're entitled to).

### Active Deals (`/active-deals`)
- **View**: all four roles see the deals in their org.
  - Internal users see full deal detail and the complete investor list.
  - **Partners** see every deal in the org but, within a deal, only the investors **they referred**,
    with totals (Total Investment / Total Earnings) calculated from those referrals only. The entire
    deal detail panel is **read-only** for partners. Deals they sourced via their link are tagged "via [their name]".
- **Accept a deal** (move a pipeline entry to Accepted, creating the active deal): Internal.
  Associates may only accept entries **assigned to them**.
- **Manage deal investors** (add/remove, set investing Yes/No, amounts) and **fees** (add/edit/
  toggle/delete): Internal only.

### Partner earnings & deal shares
- A partner's earning on a deal = **split% × base**. `split%` defaults to the partner's **Standard Fee
  Split** (`franchise_partners.success_fee_split_pct`) and is overridable per deal; `base` is the deal's
  **total org earning** or the earning from the **partner's referred investors**, chosen per deal.
- **Admin/Founder** manage this on a **per-partner page** (`/admin/partners/[partnerId]`): every deal the
  partner is tied to (deal **sourced via their link**, or one of their **referred investors is on the
  deal**), each row showing org total earning, referred earning, a base selector, an editable
  split % (blank = use Standard Fee Split), and the computed share. Associates can view, not edit.
- **Partners** get a **My Earnings** page (`/earnings`) showing only their **own** final share per deal
  and a total — **no** org totals, splits config, or other investors. The share is computed server-side
  by the `get_partner_earnings` SECURITY DEFINER function, so partners never read other investors' rows.
- Config persists in `active_deal_partner_shares` (one row per deal+partner; org-scoped RLS, partner may
  read only their own rows). Earning math mirrors the deal detail's "Total Earnings" exactly.
- **Deal categories & fields** (`/admin/categories`): create/edit/delete is **Founder / Admin**;
  internal & partners read them as needed to render deals.

### Investors (`/investors`)
- **Create**: Internal users create any investor. **Partners** create only **referrals**, which are
  auto-tagged as referred-by-them; the ESV POC field is hidden and never set by a partner.
- **Edit**: **Founder / Admin** edit any investor including ESV POC and referral attribution.
  **Partners** may edit only their **own referrals**, and may **not** change the ESV POC or
  reassign the referral. **Associates cannot edit** investors (create only).
- **Delete**: Founder / Admin only.
- **ESV POC** (one or more team members per investor) is **admin-owned**; partners can view but
  never change it.
- **Contacts**: internal users add/edit/delete; partners may **add** contacts to their own
  referrals but not edit/delete them.
- **Visibility**: internal users see all org investors; **partners see only their own referrals**.

### Tasks (`/tasks` → Board / KPI)
- **Board columns**: To Do · Done (the old "In Progress" was removed).
- **View**: Founder / Admin see **all** org tasks. **Associates see only tasks assigned to them.**
  **Partners have no access** (redirected to their portal) and **cannot be assigned tasks**.
- **Create & assign**:
  - Founder / Admin: assign to anyone **except partners**.
  - Associate: assign only to **themselves or other associates**.
- **Status changes**: founders/admins on any org task; associates on their own assigned tasks.
  Moving to Done stamps `completed_at`; moving back clears it.
- **Push**: only the **assignee** can push their own task, choosing a new target date (records
  `pushed_date`, `pushed_at`, increments `push_count`). The original due date is retained.
- **Assigned-by**: every task shows who created it.
- **KPI view** (`/tasks/kpi`): metrics are On-time / Pushed / Pending / Not-completed.
  - Founder / Admin: per-person table for the whole team plus org totals.
  - Associate: their own numbers only.
  - Definitions — *On time*: Done on/before the due date · *Pushed*: pushed at least once ·
    *Not completed*: open and past the effective deadline (`pushed_date ?? due_date`) ·
    *Pending*: open and within the effective deadline.

### Escalations (`/escalations`)
- **Raise**: **Associates and admins only**. An escalation has a subject, optional details, exactly
  **one recipient** (a founder or a partner), and an optional link to one active deal / pipeline entry
  / task / investor (a title snapshot is stored so partners can see "re: X" without entity access).
- **Recipients**: only **founders** and **partners** can be selected as recipients. Founders cannot
  raise; partners cannot raise.
- **Status**: Open → Acknowledged → Resolved (no reply thread). Can be changed by the **recipient**
  (incl. a partner), the **raiser**, or any **founder/admin**. Resolving stamps `resolved_at`.
- **Visibility**: founders/admins see **all** escalations in the org (oversight); associates see only
  the ones **they raised**; partners see only the ones **addressed to them**. Other orgs are hidden.
- **Delete**: the raiser or a founder/admin.

### HR Zone, Bulletin & Events (`/hr`, `/bulletin`, `/events`)
- **View**: Founder/Admin/Associate/General/HR see HR policies, Bulletin posts, and Events;
  partners have no access.
- **Create/edit (not delete)**: Founder/Admin/HR only. `general` had this tier from 2026-08-12 to
  2026-08-14; it's now read-only there, same as associate.
- **Create an event**: Founder/Admin/HR, and **Associate** (added 2026-08-06). An associate may
  edit an event they created but not one someone else made, and cannot pin — pinning is an admin
  decision, so `createEvent` forces `pinned: false` for them and `updateEvent` preserves the
  existing value rather than taking it from the form.
- **Delete/pin (Bulletin) / delete/pin/complete/attendee-manage (Events)**: Founder/Admin only —
  HR does not get this tier, matching the "create/edit, not delete" pattern used everywhere else.
- **RSVP to an event**: any internal role, including HR — self only, never on someone else's behalf.
- **HR clock widget & birthdays**: the top-right India-time clock (with Clock In/Clock Out reminder
  windows) and the birthday list are visible/editable to **Founder/Admin/HR only** — narrower than
  the rest of the HR Zone page. Associate/General see neither the widget nor the admin card at all
  (not even read-only) when they visit `/hr` — they see policies (read-only) and their own leave/
  expense requests instead.

### Engage — Kudos (`/engage`)
- **Give kudos**: any internal role (Founder/Admin/Associate/General/HR) can give a short
  recognition message to any other internal org member (never themselves). Partners have no access.
- **Feed**: public to the same internal-role set — everyone sees everyone's kudos, newest first.
- **Delete**: the giver, or Founder/Admin/HR (moderation) — mirrors Escalations' "raiser or
  founder/admin" delete pattern.
- No edit — kudos are immutable once given.

### Leave & Expense requests / Approvals (`/hr`, `/approvals`)
- **Submit**: any internal role (Founder/Admin/Associate/General/HR) can submit a leave request
  (Earned / Sick / My Day / Compensatory / Unpaid, date range, optional reason) or an expense
  reimbursement request (fixed type — Travel/Meals/Software/Office Supplies/Other — amount,
  description, a **required** invoice attachment) from the "My Leaves" / "My Expenses" section of
  `/hr`. This is a **simple request/approval log — no balance or accrual tracking**.
- **Withdraw**: the requester, only while their own request is still pending.
- **Approve/reject**: Founder, Admin, or HR — via the dedicated `/approvals` page (not buried
  inside HR Zone), which lists every pending request org-wide plus a recent-decisions view for
  context.
- **Founder notification on admin/HR approval**: when an **admin or HR** approves (not on reject,
  and never when a founder approves) every founder in the org is notified. This reuses the
  **Escalations** table rather than a separate notifications system — one escalation row is
  auto-inserted per founder, `raised_by` the approving admin/HR user, `linked_type`
  `leave_request`/`expense_request`. Founders see it the same way they see any other escalation
  (the `/escalations` list and the dashboard's open-count), not a separate inbox.
- **Invoices**: stored in a private `expenses` Storage bucket (same org-prefixed-path pattern as the
  Deal Desk bucket), resolved to a time-limited signed URL server-side whenever a request is
  fetched — never a public URL.
- **Leave balances**: Founder/Admin/HR can set a per-person entitled-days total and a manual
  "already used" baseline for Earned/Sick/My Day/Compensatory leave (Unpaid is uncapped, no
  balance) on the "Balances" tab on `/approvals`. The **annual entitlement** itself (the org-wide
  days-per-type standard in `leave_policy`) is edited on that same tab by founder/admin/HR — it is
  not a code constant. Raising or lowering it re-bases everyone's remaining days, because remaining
  is always computed (entitlement − manual baseline − approved days) and never stored. **Informational only** — "remaining" is computed
  live (entitled − manual baseline − days from approved requests) and shown to the requester on
  the leave request form and to approvers on the "Team leaves" roster, but nothing blocks a
  request or approval that would take someone past zero remaining.
- **Work from Home** is a fifth tracked category (added 2026-08-22), 24 days a year by default
  and editable like the rest. It rides the same request/approve/balance machinery as leave —
  someone working from home is working, but it's requested and counted identically, so a parallel
  system would only drift. It is **not** a performance signal, same as every other leave type.
- **Team leaves roster**: the "Team leaves" tab on `/approvals` (Founder/Admin/HR) lists every
  leave request org-wide, any status, filterable by person — with the ability to re-decide
  (change approve/reject after the fact) or cancel any request, not just pending ones.

### Investors & Partners — HR access
HR was granted full edit access to Investors and Partners on 2026-08-17 (relationship
management sits with HR). This covers the `investors`, `investor_contacts` and
`franchise_partners` RLS policies, the matching action guards, the page gates and the nav.
HR does **not** gain Deal Flow access generally — this is scoped to these two records only.

Granting this took three passes, which is worth recording: the RLS policies, the *named* guard
helpers, and then three **inline** `requireRole([...])` arrays in `investors.ts` — and even then
HR still couldn't edit, because the client components (`InvestorDetail`, `InvestorGrid`) had their
own hardcoded role arrays, so the Edit button never rendered. When adding a role to a module,
check all four layers. Partner **earnings** (`/admin/partners/[partnerId]`) stays founder/admin:
that's payout data, not the relationship record HR needs.

**Birthdays:** angel investors and partner contacts carry a day/month birthday
(`birthday_md` / `contact_birthday_md`, stored `MM-DD`) plus an **optional** year
(`birthday_year` / `contact_birthday_year`, added 2026-08-19). Entered as `DD/MM` or
`DD/MM/YYYY`. The year stayed optional rather than becoming a DATE because it's usually unknown,
and a DATE would force an invented one that then leaks into sorting, display and age maths — the
day/month alone remains what "is it their birthday today" matches on. An unrecognised year is
dropped while the day/month is kept, and the form says so instead of failing silently.
Fund-type investors have no birthday field, since a fund doesn't have one.

### Performance analytics (`/analytics`)
**Currently founder/admin only** while the scoring model is evaluated — see footnote ⁶. The
capabilities below describe the module as built; the personal-scorecard branch and the wider RLS
grants are intact, so widening access later needs no migration.
- **Team view**: a per-person table and charts scoring everyone in the org for a chosen period —
  score, kudos (total and by area), on-time rate, overdue, pushed deadlines, recurring-duty
  completions, event attendance, and manual adjustments.
- **Own scorecard** (built, currently not reachable — would serve associate/general/HR if
  re-opened): the same numbers for themselves only, with a breakdown showing exactly which signals
  produced their score, and every adjustment recorded about them **including the reason** — RLS
  grants `user_id = auth.uid()` on `performance_adjustments` specifically so nobody can be marked
  down invisibly.
- **Manual adjustments**: signed points with a mandatory written reason and a recorded author, for
  things the data can't see. RLS permits HR here too, though the page is currently admin-gated.
- **Scoring weights** (Founder/Admin only): the formula lives in `performance_weights`, not in
  code, and the UI states the active weights next to the scores so they read as a judgement call
  rather than a measurement. HR can read the weights and record adjustments but cannot change how
  everyone's score is calculated.
- **Leave is deliberately not a signal.** Approved leave is an entitlement, and scoring it
  negatively pressures people to work while ill. Attendance concerns route through the manual
  adjustment path, where they carry a name and a reason.
- Scores are **period-scoped** (default 90 days) and shown alongside rates, so the table doesn't
  simply reward whoever was assigned the most work or has been here longest.

### Partner Portal (`/portal` — "My Links")
- **Partner** only: generate submission links, copy/open them, view their own issued links, and
  refer investors (auto-attributed to them).

### Wiki (`/wiki`)
- Readable by all authenticated roles.

---

## Enforcement notes
- Server actions live in `src/app/actions/` and guard every mutation with `requireRole(...)` /
  `requireAdmin()` / `requireInternal()`.
- RLS is the real boundary. Notable policies:
  - Partners get **read-only**, referral-scoped access to `active_deal_investors` /
    `active_deal_investor_fees` / `investors`, and read access to active deals in their org via the
    `entry_has_active_deal()` `SECURITY DEFINER` helper.
  - Partners have an **UPDATE** policy on `investors` pinned to their own referral and org, and
    **no write** policy on `investor_poc_users` (so ESV POC is locked to admins at the DB level).
  - Tasks: founders/admins manage all org tasks (cannot assign to partners); associates can only
    select/insert/update their own (insert limited to self/associate assignees).
- The migration history for these rules lives in `supabase/migrations/` — most recently
  `20260720000000_tasks_kpi_and_partner_investor_edit.sql` and
  `20260720100000_partners_see_all_active_deals.sql`.
- The `hr` role (`20260814000000_add_hr_role.sql` onward) followed the same enum-then-RLS pattern
  as `general`: a standalone `ALTER TYPE ... ADD VALUE` migration, then separate migrations widening
  task/HR-Zone/Bulletin/Events policies to add `hr` (and, for HR Zone/Bulletin/Events, swap `general`
  out of the create/update policies rather than just adding `hr` alongside it). The
  `hr_clock_settings`/`hr_birthdays` policies were **narrowed** (associate/general dropped) rather
  than widened — the only role-RLS change this session that removed access instead of granting it.
- `escalations.linked_type`'s CHECK constraint was widened (`20260814700000_approvals_notify_founders.sql`)
  to accept `leave_request`/`expense_request`, and its `"Escalations insert"` policy gained `hr` —
  both purely to support the founder-notify-on-approval mechanism described above, not a general
  escalations capability for HR.

### Reading the `users` table
Every internal role (`associate`, `general`, `hr`) plus founder/admin can read the org's `users`
rows; everyone else sees only their own. This matters more than it looks: person names throughout
the app arrive as **embedded joins** (`requester:requester_id(name, photo_url)` and friends), and
RLS filters a blocked join out silently rather than erroring — so a missing grant shows up as
"Unknown" in the UI, not as a failure. HR hit exactly this on `/approvals` before
`20260821000000`.

### HR Zone tabs
`/hr` is split into **Policies / Requests / Birthdays**. Birthdays only appears for
founder/admin/HR — it holds the clock-reminder windows and the birthday roster, which are HR
admin config rather than something an associate needs. The "+ New policy" button shows only on
the Policies tab.

### Push reasons & the "why it moved" KPI
Pushing a task's date **requires a reason** — validated server-side in `pushTask`, not just in the
modal, so the KPI can't silently fill with blanks. Only the task's assignee can push. Two optional
flags sit alongside it: *dependent on external party*, and *dependent on internal stakeholder*
(which reveals a single-person picker). Each push writes a `task_pushes` row and mirrors the reason
into the task's comment thread.

On `/tasks/kpi`: founder/admin get "Blocked ext." and "Waiting on" columns and can expand any row
for that person's recent reasons; everyone else sees the same breakdown for themselves only. RLS
does the scoping — non-leads can read only pushes on their own tasks.

### Active deal "Latest Update" thread
A timestamped thread on each active deal (`/active-deals/[id]`). Postable by **founder/admin or
anyone assigned to that deal** (its POCs), enforced by the `active_deal_updates` INSERT policy; the
UI's `canPost` check only mirrors it. Readable by every internal role; partners see nothing. The
newest entry is what the Weekly Update prints as `[Deal name]: [Latest Update]`.

### Personal To-Do List (`/my-todos`)
Renamed from "My To-Dos" (route unchanged). Items are **private by default** — the base policy is
`user_id = auth.uid()`. Assigning an item to a **work week** is the explicit opt-in that publishes
it to that week's Weekly Update, and is the only thing that makes it readable by founder/admin.
Anything with no work week stays invisible to everyone but its owner.

### Weekly Update (`/tasks/update`)
Open to every internal role. Founder/admin get the full team carousel and the "assigned by" filter;
**everyone else sees only their own card**.

That last part is a presentation choice layered on top of RLS, not a substitute for it. Tasks and
personal to-dos are already database-scoped, but active deals are readable org-wide — so without
the client-side narrowing a non-lead would still get a card per colleague containing nothing but
their mandates. Read-only and copyable in both cases; the copy button emits the identical WhatsApp
text either way.
