# ESV Ecosystem — Roles & Permissions

> Last updated: 2026-07-24 (added the `general` role).
> This is the authoritative reference for what each role can and cannot do.
> Enforcement happens at **two layers**: server-action guards (`requireRole` / `requireAdmin` /
> `requireInternal`) and Postgres **RLS policies** (`get_user_role()`, `get_user_org_id()`,
> `is_super_admin()` — all `SECURITY DEFINER`). The UI mirrors these but is never the security boundary.

---

## The six roles

| Role | Type | Scope |
|------|------|-------|
| **super_admin** | Platform | Cross-org. `org_id = NULL`. Manages organizations; bypasses org scoping. |
| **founder** | Internal | Full access within their org. |
| **admin** | Internal | Full access within their org (functionally equal to founder). |
| **associate** | Internal | Day-to-day operator with limited admin/edit rights; tasks scoped to self. |
| **general** | Internal | Narrow operator added 2026-08-05. Read-only on the deal pipeline (pipelines/active deals/companies/investors); full task access (same as associate); can create/edit — not delete — HR policies and Bulletin/Events posts. |
| **franchise_partner** | External | Referral partner. Read-mostly; scoped to their **own** links & referrals. |

"Internal" = founder, admin, associate, general. Everything is **org-scoped**: a user only ever
sees data in their own organization (super_admin excepted).

---

## Capability matrix (quick reference)

Legend: ✅ full · 🟡 limited/conditional · 👁 read-only · ❌ none

| Capability | Founder | Admin | Associate | General | Partner | Super admin |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pipelines board (view/move/assign) | ✅ | ✅ | 🟡 assigned | 👁 | ❌ | ❌ |
| Build / edit forms | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate submission links | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| My Submissions (own sourced entries) | — | — | — | — | 👁 | ❌ |
| Active Deals — view | ✅ all org | ✅ all org | ✅ all org | 👁 all org | 👁 all org¹ | ❌ |
| Active Deals — edit investors/fees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Partner deal shares — set base + split | ✅ | ✅ | 👁 | ❌ | ❌ | ❌ |
| Partner earnings — view | ✅ per partner³ | ✅ per partner³ | 👁 | ❌ | 👁 own only⁴ | ❌ |
| Accept a deal (entry → Accepted) | ✅ | ✅ | 🟡 if assigned | ❌ | ❌ | ❌ |
| Deal categories (CRUD) | ✅ | ✅ | 👁 | ❌ | 👁 | ❌ |
| Investors — create | ✅ | ✅ | ✅ | ❌ | 🟡 referrals | ❌ |
| Investors — edit | ✅ | ✅ | ❌ | ❌ | 🟡 own referrals² | ❌ |
| Investors — delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Investors — view | ✅ | ✅ | ✅ | 👁 | 🟡 own referrals | ❌ |
| Set ESV POC on investor | ✅ | ✅ | 🟡 on create | ❌ | ❌ | ❌ |
| Tasks — view | ✅ all | ✅ all | 🟡 own assigned | 🟡 own assigned | ❌ | ❌ |
| Tasks — create/assign | ✅ non-partners | ✅ non-partners | 🟡 self/associates/general | 🟡 self/associates/general | ❌ | ❌ |
| Tasks — push (new date) | 🟡 own | 🟡 own | 🟡 own | 🟡 own | ❌ | ❌ |
| Tasks — KPI view | ✅ everyone | ✅ everyone | 🟡 own | 🟡 own | ❌ | ❌ |
| Escalations — view | ✅ all | ✅ all | 🟡 own raised | ❌ | 🟡 sent to them | ❌ |
| Escalations — raise | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Escalations — set status | ✅ | ✅ | 🟡 own raised | ❌ | 🟡 received | ❌ |
| HR policies — create/edit (not delete) | ✅ | ✅ | ❌ | 🟡 | 👁 | ❌ |
| Bulletin / Events — create/edit (not delete) | ✅ | ✅ | ❌ | 🟡 | 👁 | ❌ |
| User management (`/admin/users`) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ cross-org |
| Partner management (`/admin/partners`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage organizations | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Wiki | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**General role note:** added 2026-08-05 (`20260805000000_add_general_role.sql` onward), purpose-built
as a narrower operator than associate — read-only into the deal/investor pipeline, but full task
parity with associate, plus (added 2026-08-12) write access to HR policies and Bulletin/Events posts
(create/edit, not delete — matches founder/admin there, unlike everywhere else in this table). See
[FUNCTIONALITY.md](FUNCTIONALITY.md) for the full module rundown.

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
