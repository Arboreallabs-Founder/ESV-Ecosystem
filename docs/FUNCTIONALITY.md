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

### Active Deals (`/active-deals`)
Post-acceptance deal lifecycle. Deal detail shows stage history, form/stage-question answers, team
assignment, and deal-category custom fields (categories/fields managed at `/admin/categories`).
Deal editing via an "Edit deal" button (name + per-category field values, `updateActiveDealDetails`).
Investor commitments live here too: add/remove investors per deal, track investing status
(not_started → commitment_received → funds_received → shares_transferred), amounts, shares, and
per-investor fees.

### Deal Desk (`/deal-desk`)
Associate-sourced pre-acceptance deal intake, separate from the Pipelines flow — associates import
deal cards via CSV, review call notes (with voice-note recording), and founders/admins triage them
per-associate (`/deal-desk/[associateId]`) with actions (reject / discuss in person / need more
info). Editable via a lightweight modal (`DealEditModal`) for the most-changed fields; structured
data (founders, cap table, revenue series) only comes from CSV re-import. **Visibility is
restricted**: RLS only grants founders/admins full visibility and associates their own deals —
`general` role has no access to Deal Desk at all (unlike Pipelines/Active Deals, where general has
read-only visibility).

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
links, and a KPI page showing who actually showed up. `general` role can create/edit (not delete)
both — see [ROLES.md](ROLES.md).

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
share per deal (`/earnings`) — no org totals, no other investors' data, computed server-side so
partners never read another partner's rows.

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
