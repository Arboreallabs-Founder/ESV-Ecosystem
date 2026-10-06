# Ecosystem — Current Functionality

> A from-the-code snapshot of what's actually built and live, not a roadmap. For "what each role
> can do," see [ROLES.md](ROLES.md). For migration history, see [MIGRATIONS.md](MIGRATIONS.md).
> If this drifts from the code again, trust the code — this is a point-in-time description.

## Tech stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript
- **Styling:** Vanilla CSS with CSS variables (`src/app/globals.css`) — no Tailwind, no dense
  external UI library. `@xyflow/react` is used only in the form builder canvas.
- **Backend:** Supabase Cloud (Postgres + Auth + Edge Functions), project `hsabrzwsetjeaqutjrjb`
  (ap-south-1). RLS-enforced; server actions are the only place writes happen.
- **Deployment:** Vercel, deployed from the repo root.

## Auth & role model

Sign-in via Google OAuth (primary) or email/password (secondary), gated to pre-approved emails
(`approved_emails` table). Six roles — `super_admin`, `founder`, `admin`, `associate`, `general`,
`franchise_partner` — see [ROLES.md](ROLES.md) for the full capability matrix. Every mutating
server action starts with `requireRole([...])` (defined in `src/lib/guards.ts`), which loads the
caller's role/org from `public.users` and throws if not permitted; each `src/app/actions/*.ts` file
wraps this in small local helpers (`requireAdmin`, `requireInternal`, etc.) with a domain-specific
role list. RLS is the actual security boundary — the UI/server-action checks are a mirror of it,
not a substitute.

All data is **org-scoped** (multi-tenant): every root table carries `org_id`, and
`get_user_org_id()` / `is_super_admin()` (both `SECURITY DEFINER`) gate every RLS policy.

## Modules

### Dashboard (`/dashboard`)
Role-aware landing page (founder/admin/general do not land here by default — see root redirect
below): greeting, open task/escalation counts, recent bulletin posts.

### Pipelines & Forms — intake (`/pipelines`, `/forms`, `/f/[token]`)
The in-app-built intake flow that replaced JotForm. An admin/founder builds a form as a directed
graph in the visual builder (`/forms/[id]/builder`, React Flow canvas: Start → Question → End
nodes, MCQ branching, "Submitted"/"Not Eligible" end types). The form is linked to a pipeline; team
members and partners generate personalized shareable links (`/f/[token]`, public, anonymous
submission via a `SECURITY DEFINER` RPC). Submissions land as entries on the pipeline's Kanban
board (`/pipelines/[id]`) — mandatory Lead/Accepted/Rejected stages plus custom stages, optional
typed question fields per custom stage, multi-assignee, rejection-reason capture, drag-and-drop.
Accepting an entry creates an **Active Deal**.

Each entry shows the pipeline as a step-by-step bar (every stage in order, Rejected off to the side)
with a **Move to next stage** button, alongside the board's drag-and-drop. Stages stay freely
addable and removable, and each one (Lead, Accepted and Rejected included, via their ⚙) can carry
**automatic tasks**: raised on the task board when an entry enters the stage, however it gets there,
and closed when it leaves. Each goes to the entry's assignees (a copy each), whoever moved it, or a
named person, with a due-in and priority. The entry lists the tasks its stages have raised
(20261017000000).

`/forms` has two tabs. **Forms** is the list and builder. **Share** (formerly the separate `/share`
page, which now redirects here) is where anyone who can build a form issues their own link: pick a
published form, add a private label, get a URL and a downloadable QR, and see per-link submission
counts. Founders and admins can widen the view to everyone's links; everyone else sees their own.
The two were separate pages, which split one job — you build a form here and hand it out there —
but Share stays a **tab rather than a button next to Edit/Build**, because that burial is why
associates never issued a link before it existed.

### Active Deals (`/active-deals`)
Post-acceptance deal lifecycle. Deal detail shows stage history, form/stage-question answers, team
assignment, and deal-category custom fields (categories/fields managed at `/admin/categories`).
Deal editing via an "Edit deal" button (name + per-category field values, `updateActiveDealDetails`).
Investor commitments live here too: add/remove investors per deal, track investing status
(not_started → commitment_received → funds_received → shares_transferred), amounts, shares, and
per-investor fees.

**The round** (20261021000000) is three numbers on the deal: `total_raise`, `external_raised` (of
that round, how much an outside party has already filled) and `min_ticket`. What is still open is
derived — total − external − committed through us — and never stored, since a stored remaining
disagrees with the investor rows the moment one is edited. A stacked bar shows the three slices.
Internal roles edit it inline; **the minimum ticket and the external raise are visible to partners
too**, carried by `get_partner_deal_summary` rather than inferred, since they are what a partner
needs before putting the deal in front of anyone. This replaces an older heuristic that sniffed the
deal's custom fields for a label matching /capital being raised/i and used it as the denominator,
which worked only where somebody had created a field with that exact wording.

### Projects (`/projects`)
Prefunding engagements (pitch decks, projections, valuation reports, market research, datarooms,
and custom work), moved out of Active Deals (20261014000000). Every lead is a project from the
first conversation, and its company goes into Companies whether or not they take the proposal.

- **Shared stages**, once per project: Lead → First call → Proposal → Data → Advance → In progress
  → Handover → Completed, or Dormant if the proposal is declined (reason required; revivable). The
  list shows each project's compact phase bar; the project page shows the detailed one plus a
  "Next step" panel with the gates for the current stage.
- **Services cart** at the proposal stage: pick services, type a price per line (no fixed price
  list), and the page shows subtotal, 18% GST, total and the 50% advance. The proposal itself is
  written outside the app and linked.
- **Data checklist**, seeded from the accepted services and editable; each item is Pending,
  Received or N/A. Data → Advance needs every item settled and the Google Drive folder linked.
- **Work** starts once the advance is recorded. Each service then has its own track: two drafts
  before the final, or valuation's model → registered valuer → approval → draft report → client
  approval → signed report and deck. A final can't go out until the balance is recorded. When every
  track is final the project moves to Handover; up to two post-handover changes are logged, the
  third is refused.
- **Stakeholders**: Connect, Project lead, Design team, Finance team, picked with photo chips; one
  person can hold several roles. Payments are recorded by founders, admins or the project lead;
  partner credit by founders/admins only (no claim flow). A credited partner sees the project on
  their portal.
- **Tasks are raised automatically** for each step, one copy for everyone holding the matching
  role (Connect for the first call, Lead for proposal/data/payments/handover, Finance for models and
  the valuer, Design for decks), and closed when the project moves past them. Each person's
  projects, with their stage and roles, also appear on their card in the Weekly Update.
- Projects are only ever created by hand ("+ New project"); nothing creates one automatically.
- **Client link** (`/pr/<token>`, "Copy client link" on the project): read-only status, each
  deliverable's progress, what data is still outstanding, payment status, and a button to the
  Google Drive project folder once it's linked (where the client uploads their data).
- Visibility: every internal user sees every project; external users only the ones they're on.

### Deal Desk (`/deal-desk`)
Associate-sourced pre-acceptance deal intake, separate from the Pipelines flow — associates import
deal cards via CSV, review call notes (with voice-note recording), and founders/admins triage them
per-associate (`/deal-desk/[associateId]`) with actions (reject / discuss in person / need more
info). Editable via a lightweight modal (`DealEditModal`) for the most-changed fields; structured
data (founders, cap table, revenue series) only comes from CSV re-import. **Visibility is
restricted**: RLS only grants founders/admins full visibility and associates their own deals —
`general` role has no access to Deal Desk at all (unlike Pipelines/Active Deals, where general has
read-only visibility).

One more way in, on an associate's own board: **"+ Log a deal"** is a quick-capture modal (name
required, everything else optional — `createDeskDeal`) for typing in a company you heard about
without building a CSV row first.

### Refer to ESV (`/referrals`, `/admin/referrals`)
The shareable half of team sourcing — every internal role (founder/admin/associate/general/hr), not
only associates. `/referrals` gives each person their own public `/f/[token]` link (LinkedIn, email,
a text — anywhere) via **"Get my link"**; whoever fills it in submits themselves, and it lands on a
dedicated "ESV Referrals" pipeline (`/pipelines/[id]`, standard Kanban), credited to whoever shared
it — not in `desk_deals`; same underlying mechanism as the partner referral link on `/my-companies`.
Every existing internal user already has a link, backfilled once when the feature shipped; anyone
who joins after gets theirs on first visit. `/admin/referrals` (founder/admin only) lists everyone's
link and how many companies it's brought in. See `docs/MIGRATIONS.md` §`20261007000000` /
§`20261008000000` for why this stays a separate system from Deal Desk.

### SGP Desk & partner companies (`/sgp-desk`, `/my-companies`)
The partner-sourced sibling of Deal Desk. A partner logs a company they've found with their own
comments (`/my-companies` — only the name is required, since the point is to capture a lead while
it's fresh). It lands on `/sgp-desk`, visible to founders, admins and any associate flagged
`is_sgp_coordinator`. The coordinator picks what happens next — set up first level call, send
prefunding proposal, or discuss with founder first — assigns it to an associate or general user,
and attaches supporting links. **That creates a real Task** on the existing board carrying the
partner's notes and the links, rather than a parallel to-do list, so it drives the assignee's
alerts, KPI numbers and weekly update like any other work. The partner sees the status move and
who has it, but not internal notes. Closing needs a reason, which the partner sees.

### Companies (`/companies`)
The startup "database of record" — richer than a deal record: founders, team, cap table, funding
rounds, documents, an update timeline, custom fields, and linkage back to both Deal Desk deals and
pipeline entries. Investor suggestions (sector/synergy/agnostic buckets) surface on a company
profile. Companies can be created directly, promoted from a Deal Desk deal, or auto-created when a
pipeline entry is accepted.

### Investors (`/investors`)
CRM for the investor/fund database — service type, sectors, ticket size, stage, multiple ESV POCs,
contacts, referral attribution (for franchise partners), portfolio history (deals they're on).
Angel-investor-specific onboarding/KYC fields. Full edit-audit log on the admin Activity Log page.

### Tasks (`/tasks`, `/tasks/kpi`, `/tasks/recurring`, `/tasks/update`)
Shared task board (Board / List / By-Person views), comment threads, an alerts bell (task
assignments + comments on your tasks, in-flow sub-bar under the sidebar header — not a floating
dropdown, to avoid clipping in the narrow sidebar column). Task editing (title, description,
assignee, priority, due date, linked company/deal/URL) via `updateTask`, permissioned to
founder/admin or whoever has a stake in the task (creator, assigner, or assignee). "Push" lets the
assignee move their own due date without losing the original. KPI view
(on-time/pushed/pending/not-completed) per person for founder/admin, own-only for others.
Recurring task templates with lead-time and completion tracking. A weekly update composer for
founder/admin/general.

### My Todos (`/my-todos`)
Personal, private to-do list, two-way synced with the shared Tasks board (porting a task in/out
keeps `done` status in sync both directions).

### Escalations (`/escalations`)
Internal escalation messages — one recipient (founder or partner), optional link to a deal/entry/
task/investor (title snapshot stored so the recipient sees "re: X" without needing entity access).
Status workflow Open → Acknowledged → Resolved.

### Bulletin (`/bulletin`) & Events (`/events`, `/events/past`, `/events/kpi`)
Bulletin posts are a single table (`bulletin_posts`) split by `post_type: 'event' | 'announcement'`.
Events get attendance tracking (self-RSVP + admin-added attendees), dedicated media/scanned-cards
links, and a KPI page showing who actually showed up.

Founder/admin/HR create and edit both. **Associates can create events** (2026-08-06) and edit the
ones they created — not announcements, and not someone else's event. Because the two share one
table, that grant is written against `post_type` in RLS rather than by role alone; see
[ROLES.md](ROLES.md) and [MIGRATIONS.md](MIGRATIONS.md). Delete, pin, complete and attendee
management remain founder/admin.

### HR Zone (`/hr`)
Company policy documents, editable by founder/admin and (as of 2026-08-12) `general`; full
edit-audit log.

### Admin
- **Users** (`/admin/users`) — approved-email allowlist, role assignment, account
  creation/revocation (calls a `create-user` edge function).
- **Partners** (`/admin/partners`, `/admin/partners/[partnerId]`) — franchise partner profiles, fee
  splits, and a per-partner earnings page (org total earning, referred earning, base selector,
  editable split %, computed share — mirrors the deal-detail earnings math exactly via the
  `get_partner_earnings` `SECURITY DEFINER` function).
- **Categories** (`/admin/categories`) — deal category + custom field CRUD.
- **Activity Log** (`/admin/activity-log`) — unified edit-history feed merging investor, HR-policy,
  and event edit logs.

### Super Admin (`(super-admin)` route group — separate shell)
Platform-level, cross-org — a capability not mentioned anywhere in the older project docs.
`super_admin` role only: list/create organizations, list/add users and approved emails per org.
This is what makes the multi-tenancy real: every other role is pinned to one `org_id` forever.

### Partner Portal (`/portal`, `/submissions`, `/earnings`)
Franchise-partner-only surface: browse published forms and their own issued links (`/portal`), see
entries that came in through those links (`/submissions`), and view their own computed earnings
share per deal plus their **referral tree** (`/earnings`) — no org totals, no other investors' data,
computed server-side so partners never read another partner's rows.

Partners come in two **tiers** (`franchise_partners.partner_tier`, 2026-10-06) with identical
referral rights: an **SGP** sees every deal left visible to partners; a **Venture Partner** sees only
deals they have been named on, granted from the deal page beside the visibility toggle. It is a tier
rather than a second role on purpose — see [ROLES.md](ROLES.md#partner_tier--sgp-vs-venture-partner).

### The referral tree (`/earnings`, `/admin/partners/[partnerId]`)
Referrals branch: a partner introduces an investor, and that investor introduces another. Credit
rolls up the chain to the partner at its root, and **ESV pays that partner gross** of the investor
fee — nothing below the root is modelled, because a split we do not pay is a number we would get
wrong. Both pages draw the tree (nested lists with CSS connectors, not `@xyflow/react`, which stays
confined to the form builder) with each investor's own investment and their branch total. Placing an
investor under another goes through the same two-signature attribution claim as any other credit, is
proposed from the investor's profile, and is cycle-guarded in the database.

### Wiki (`/wiki`)
Static in-app reference documentation (`src/lib/wiki.ts`), readable by every authenticated role.

### Settings (`/settings`)
Self-service profile (name, phone, photo, designation) and password change.

## Root redirect (`/`)
Role-based dispatcher: `franchise_partner` → `/submissions`, `associate`/`general` → `/tasks`,
everyone else → `/dashboard`.

## Server-action / data-access pattern

- `src/app/actions/*.ts` (19 files) are the only place mutations happen — each wraps
  `requireRole()` in a local guard and never calls `revalidatePath`; client components call
  `router.refresh()` after a mutation instead.
- `src/lib/*.ts` holds `cache()`-wrapped read helpers used by Server Components — request-scoped
  dedup, not cross-request caching, so newly written data always shows up on a fresh page load (but
  **not** automatically inside an already-open client session — e.g. a combobox list fetched at
  page-load time won't include something created afterward until the page is actually reloaded).
- `src/lib/supabase/`: `server.ts` (anon key, cookie-bound, used by almost everything),
  `client.ts` (anon key, browser), `admin.ts` (service-role key, bypasses RLS — only for
  privileged server-side operations like user provisioning and anonymous form submission).
