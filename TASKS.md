# ESV Ecosystem — Build Tasks
> Last updated: 2026-06-18. Phases 1–11, 13–14, 16, 22 complete + Active Deals, multi-tenancy,
> partner scoping, and Tasks v2 (see "Since 2026-06-09" below). Deployed to Vercel.
> Role permissions are documented separately in [ROLES.md](ROLES.md).

---

## 🗺 New Intake Flow (Phase 22)

The intake pipeline has been rebuilt away from JotForm. The new flow is fully in-app:

```
Admin/Founder builds a form in /forms (flow-based, visual canvas)
         ↓
Form is linked to a Pipeline (many forms → one pipeline)
         ↓
Team members / partners generate personalised shareable links (/f/[token])
         ↓
Startup fills out the public form — branching logic routes them through questions
         ↓
If they reach a "Submitted" end node  → submitter info collected → entry created in pipeline
If they reach a "Not Eligible" end node → rejection screen shown, nothing recorded
         ↓
Entry appears in the pipeline Kanban board (Lead → custom stages → Accepted / Rejected)
Admin/Founder assigns it to one or more team members, moves through stages via drag & drop
         ↓
Moving to Rejected triggers a reason-for-rejection prompt (stored on entry)
Clicking the entry shows all Q&A responses + which user's link was used
```

**Key design decisions:**
- Each form is a directed graph (React Flow canvas): Start → Questions → End nodes
- Two end conditions enforced on every form: `Submitted` (green) and `Not Eligible` (amber)
- MCQ questions create one output handle per option — each option must be wired to exactly one next node
- Forms cannot be saved if any output handle is unconnected (open flow validation)
- Each handle enforces exactly one outgoing edge — contradictory logic is impossible
- Links are personalised — every link records who generated it; pipeline entries show "via [Name]'s link"
- Partners and associates can generate links; only admins/founders can build/edit forms
- Multiple forms can feed one pipeline simultaneously
- Every pipeline has three mandatory stages: **Lead** (entry point), **Accepted** and **Rejected** (end states)
- Multiple team members (non-partners) can be assigned to the same deal

---

## ✅ COMPLETED

### Phases 1–6 (Foundation)
- [x] Next.js 16 App Router project setup
- [x] Supabase Cloud project (`hsabrzwsetjeaqutjrjb`, ap-south-1)
- [x] Full DB schema: 9 tables (deals, users, franchise_partners, investors, fund_outreach, deal_notes, deal_documents, deal_stage_history, tasks)
- [x] RLS policies for all 4 roles via `get_user_role()` SECURITY DEFINER
- [x] `handle_new_user()` trigger — auto-fills `public.users` on signup (default role: associate)
- [x] Auth login page wired to Supabase Auth with role-based redirect
- [x] Kanban pipeline with 11 stages and HTML5 drag-and-drop
- [x] Deal detail page with stage stepper, advance/regress buttons
- [x] Notes, Documents, History tabs on deal detail
- [x] Franchise partner portal with deal submission

### Phase 7 — Pipeline Table View
- [x] Sortable, filterable table view (company, sector, stage, source, date)
- [x] Kanban / Table toggle persisted in localStorage

### Phase 8 — Deal Record (partial)
- [x] Founder Name + Founder Email fields on New Deal modal
- [x] Duplicate deal detection (ilike check, "Create Anyway" flow)
- [x] `founder_name`, `founder_email` migration applied to DB

### Phase 9 — Fund Outreach Module
- [x] Investor Database page (`/investors`) — searchable table, Add Investor modal
- [x] Fund Outreach tab on Deal Detail — add investors, update status (Sent/Responded/Interested/Passed)
- [x] Optimistic updates for outreach status changes

### Phase 10 — Franchise Partner Management
- [x] Partners page (`/admin/partners`) — table, Add Partner modal
- [x] Link partner record to portal user account
- [x] Franchise partner DB record created and linked

### Phase 11 — Task Management
- [x] Tasks DB migration (tasks table with priority/status enums)
- [x] Task board (`/tasks`) — 3 columns: To Do / In Progress / Done
- [x] New Task modal — title, description, assignee, deal link, due date, priority
- [x] Inline status change via dropdown on each card
- [x] Overdue date highlighting
- [x] Dashboard: Open Tasks stat card wired to live DB count

### Phase 13 — Admin Panel
- [x] User management page (`/admin/users`) — approved users table with Active/Pending status badges
- [x] Add Approved User modal — email, name, role, optional password (calls `create-user` edge function)
- [x] Edit user modal — update name + role across `approved_emails` + `public.users`
- [x] Revoke access — removes from allowlist, deletes `franchise_partners` record, deletes auth user
- [x] `addApprovedUser` / `updateApprovedUser` / `revokeUser` server actions with founder/admin guard

### Phase 14 — Navigation & Shell
- [x] SaaS-style sidebar with icons replacing top nav
- [x] Role-based nav visibility
- [x] Active link highlighting
- [x] User avatar initials + role badge in sidebar footer
- [x] Workspace label "Earlyseed Ventures"

### Caching & Performance
- [x] React `cache()` on all lib data-fetching functions (request-level deduplication)
- [x] Loading skeleton files for all routes (sidebar + content placeholder)

### Wiki System
- [x] `src/lib/wiki.ts` — static content for 7 sections
- [x] `WikiPanel` slide-in drawer component
- [x] `/wiki` full reference page
- [x] "Help & Wiki" + "Full Wiki" links in sidebar

### Auth & Accounts
- [x] Password change modal in sidebar footer
- [x] `create-user` + `delete-user` Supabase Edge Functions deployed
- [x] `users` table FK to `auth.users` changed to `ON DELETE CASCADE`

### Partner Fee Structure
- [x] `transaction_fee_split_pct` + `success_fee_split_pct` + `contract_link` on `franchise_partners`
- [x] Partners page — Fill in Details / Edit modals
- [x] Partner record auto-deleted when user is revoked

### Phase 16 — Google Auth (pre-approved emails only)
- [x] Google OAuth + email/password login
- [x] `approved_emails` table with RLS; `handle_new_user()` trigger blocks unapproved accounts
- [x] `/auth/callback` + `/auth/denied` routes; middleware on all protected routes

### Phase 22 — Form Builder & Intake Pipeline

#### DB Schema
- [x] `forms`, `form_nodes`, `form_node_options`, `form_edges`, `form_links` tables
- [x] `pipeline_entries` + `pipeline_entry_answers` tables
- [x] `pipeline_entry_assignees` junction table (multi-assign, replaces single `assigned_to`)
- [x] `pipeline_stages.stage_type` enum: `lead | accepted | rejected | custom`
- [x] `pipeline_entries.rejection_reason` column
- [x] `get_form_for_submission` RPC — full form graph with subtypes; works without pipeline

#### Form Builder (`/forms/[id]/builder`)
- [x] React Flow canvas — full-screen, fit-view, delete key support
- [x] Three node types: StartNode, QuestionNode (short/long/MCQ), EndNode (Submitted / Not Eligible)
- [x] Properties panel — question text with bold/italic markdown, answer type, MCQ options
- [x] Graph validation on Save: missing end types, open handles, duplicate edges all blocked
- [x] One-edge-per-handle: drawing a new edge from a connected handle replaces the old one
- [x] Published/Draft toggle; Form settings modal (⚙); Generate Link modal

#### Forms List (`/forms`)
- [x] "N links issued" badge per form — click to see who generated each link + label + date
- [x] "+ Get Link" button for all authenticated users (partners, associates, admins, founders)
- [x] Only admins/founders see Edit / Build and New Form

#### Public Form Renderer (`/f/[token]`)
- [x] Flow-based rendering with MCQ conditional branching
- [x] Submitted end → collects submitter info → pipeline entry created
- [x] Not Eligible end → rejection screen; nothing recorded

#### Pipeline Board (`/pipelines/[id]`)
- [x] **Mandatory stages**: Lead (first, purple), Accepted (end, green), Rejected (end, red) — cannot be deleted or renamed; seeded on new and existing pipelines
- [x] **Stage delete guard**: stages with active entries cannot be deleted
- [x] **Drag and drop** between columns; drop zone highlights
- [x] **Multi-assignee**: add/remove multiple team members per entry (franchise_partners excluded); chips UI; names shown on card
- [x] **Rejection reason modal**: moving to Rejected prompts for reason (optional); stored and shown in entry detail
- [x] **Entry detail modal**: Q&A responses, link creator chip, rejection reason box, multi-assignee management
- [x] **Forms modal**: link/unlink forms to pipeline from board

### Pipeline & Form Safety (Phase 22 follow-on)
- [x] **Delete pipeline confirmation** — admin must type the exact pipeline name to confirm; modal shows deal count warning; delete button locked until name matches
- [x] **Form → pipeline backfill** — linking a form with existing submissions to a new pipeline automatically imports all prior entries into the lead stage (answers copied, duplicates skipped by `form_link_id`)

### Deployment & Infrastructure
- [x] Repo restructured: Next.js app moved from `ecosystem-app/` to repo root for zero-config Vercel deployment
- [x] `ecosystem-app/` added to `.gitignore`; excluded from TypeScript compilation
- [x] Supabase Edge Function (`supabase/functions/`) excluded from Next.js TypeScript checker
- [x] Vercel environment variables configured: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] Root redirect fixed: associates now go to `/pipelines` (was `/pipeline`, deleted route)

### Code Quality & Bug Fixes
- [x] All 14+ modals: `onClick` → `onMouseDown` + `stopPropagation` — fixes accidental close on mouse drag
- [x] `get_form_for_submission` RPC: no longer returns null for forms without a pipeline
- [x] Assign dropdown: `.neq('role','partner')` → `.neq('role','franchise_partner')` (correct enum value)
- [x] Standardised `revalidatePath` removal — server actions use `router.refresh()` in components

---

## ✅ COMPLETED — Since 2026-06-09

### Active Deals module
- [x] `active_deals`, `active_deal_categories`, `active_deal_field_values` tables + Accept-deal flow (entry → Accepted creates an active deal)
- [x] Deal categories & fields admin (`/admin/categories`) — founder/admin CRUD; typed fields (text/numeric/percentage/url)
- [x] Active Deals page (`/active-deals`) — category filter tabs, deal cards, full detail panel (assignees, category details, stage history, form Q&A)
- [x] Deal investors: `active_deal_investors` + `active_deal_investor_fees` — add/remove investors, investing toggle, amounts, auto-populated percentage fees, edit/toggle/delete fees, live Investment/Earnings totals
- [x] Investor picker + create-investor-from-deal modals

### Investors v2
- [x] Redesigned investors (`service_type`, multi ESV POC via `investor_poc_users`, referral attribution, ticket size, sectors, stage)
- [x] Investor contacts (`investor_contacts`) with inline add/edit/delete
- [x] ESV POC as a searchable multi-select with chips

### Multi-tenancy / Organizations
- [x] `organizations` table + `super_admin` role; `org_id` added to all root tables (backfilled, NOT NULL)
- [x] `get_user_org_id()` + `is_super_admin()` SECURITY DEFINER helpers
- [x] All RLS replaced with org-scoped policies (`is_super_admin()` short-circuits first)

### Partner scoped navigation & read-only deal views
- [x] Partners get the normal sidebar (Active Deals, Investors, My Submissions, My Links) instead of an isolated portal
- [x] `/submissions` — partner view of entries that came through their own links
- [x] Investors list scoped to a partner's own referrals; active-deal investor section read-only & referral-scoped for partners

### Partner investor editing (POC locked)
- [x] Partners can **add** investors (auto-tagged as their referral) and **edit** their own referrals from `/investors`
- [x] ESV POC hidden/locked for partners; partner UPDATE never touches `investor_poc_users` or referral attribution (server guard + RLS)
- [x] Polished portal submission-link UI (card layout, "link ready" state, Open/Copy actions)

### Tasks v2 (push, scoping, KPIs)
- [x] Removed "In Progress" — board is now To Do / Done (existing rows migrated)
- [x] Visibility: founders/admins see all org tasks; **associates see only tasks assigned to them**; partners have no access and cannot be assigned tasks
- [x] Assignment rules enforced (server + RLS): founders/admins assign to any non-partner; associates only to self/other associates; role-filtered assignee dropdown
- [x] "Assigned by" shown on each card
- [x] **Push** a task to a new date — assignee-only; records `pushed_date` / `pushed_at` / `push_count`; original due date retained
- [x] `completed_at` stamped on Done (cleared when reopened)
- [x] **KPI view** (`/tasks/kpi`) — On-time / Pushed / Pending / Not-completed; per-person table for founders/admins, own-only for associates
- [x] Tasks nav converted to a Board / KPI group

### Escalations module
- [x] `escalations` table (`escalation_status` enum, single `recipient_user_id`, optional polymorphic link + snapshot `linked_title`) with org-scoped RLS
- [x] Associates/admins raise an escalation to one recipient (a founder or partner); optional link to an active deal / pipeline entry / task / investor
- [x] Status workflow Open → Acknowledged → Resolved (no reply thread); changeable by recipient/raiser/leadership; `resolved_at` stamped
- [x] Visibility: founders/admins see all (oversight); associates see own raised; partners see only ones addressed to them — verified via RLS simulation
- [x] `/escalations` page + list with status tabs, create modal (recipient + link pickers), gated status control; nav item for all roles; dashboard "Open Escalations" card

### Pipeline stage questions
- [x] `pipeline_stage_questions` + `pipeline_entry_stage_answers` tables (org-scoped RLS; partner read of answers gated via `entry_has_active_deal()`)
- [x] Admins attach typed question fields (text/numeric/percentage/url, required) to **custom** stages in the stage modal
- [x] Moving an entry into a stage with questions prompts for answers (required enforced) before the move commits
- [x] Answers shown in the entry detail card (admins can edit later) and in the active deal detail card (read-only; partners included)
- [x] Verified via RLS simulation (admin write, partner read of in-org deal answers)

### Partner earnings & deal shares
- [x] `active_deal_partner_shares` table (per deal+partner: `base_type` total/referred, nullable
  `split_pct` override; org-scoped RLS, partner reads only own rows) + `get_partner_earnings()`
  SECURITY DEFINER aggregator (single source of truth; mirrors the deal-detail "Total Earnings" math)
- [x] Partners tab → per-partner page (`/admin/partners/[partnerId]`): all deals the partner is tied to
  (sourced via their link OR a referred investor present on the deal), with org total earning, referred earning,
  base selector, editable split % (blank = Standard Fee Split), and computed share + summary totals
- [x] Partner **My Earnings** page (`/earnings`) + nav item: only their own final share per deal + total;
  no org totals / other investors (computed server-side, bypasses per-investor RLS)
- [x] Removed Transaction Fee Split; renamed Success Fee Split → **Standard Fee Split** in Partners tab
- [x] Verified: RLS simulation (partner self ✓, cross-partner Forbidden ✓, internal ✓) + math parity
  vs deal detail

### Fixes & docs
- [x] Re-accepting an entry no longer prompts for a category — entries carry `has_active_deal` (via an `active_deals` embed) and the accept branch short-circuits to a plain move when a deal already exists
- [x] Re-accepting an entry no longer creates a duplicate active deal — `acceptDeal` reuses the existing deal (preserving investors/fees/categories) + a `UNIQUE(pipeline_entry_id)` index enforces it at the DB level
- [x] Partners couldn't see active deals (sourced-only RLS gate) — added `entry_has_active_deal()` helper + `pipeline_entries` partner read policy so partners see all in-org deals
- [x] Active-deal entries leaking into partner "My Submissions" — `/submissions` now filters explicitly by the partner's own links
- [x] Nav flyout fixes — correct group menu shows; smooth fade; no longer shuts when alternating groups
- [x] Build fix: `userRole` threaded through `ActiveDealsOverlay` → `ActiveDealsList`
- [x] [ROLES.md](ROLES.md) — authoritative per-role capability reference (includes Escalations)

---

## 🔴 REMAINING

### Phase 8 — Deal Record (remaining)
- [ ] **Founder contact on Deal Detail** — display founder_name/founder_email in info grid; editable inline
- [ ] **Success fee form** — `success_fee_pct` + `split_pct` fields on deal detail, visible to founder/admin only
- [ ] **Success fee prompt on Close** — modal when stage → 'Closed Success' if fee fields are empty
- [ ] **Document upload** — Supabase Storage bucket `deal-documents`; upload on Documents tab; max 25MB

### Phase 11 — Tasks (remaining)
- [ ] **Tasks tab on Deal Detail** — show tasks linked to that specific deal; create tasks pre-linked to deal

### Phase 12 — Memo Module *(most complex remaining feature)*
- [ ] Memo tab on Deal Detail (visible when stage ≥ 'Mandate Accepted')
- [ ] Full memo editor at `/pipeline/[dealId]/memo` — 9 sections, auto-save, Draft/In Review/Final status
- [ ] PDF + DOCX export

### Phase 15 — JotForm Webhook *(likely superseded by Phase 22)*
- [ ] Evaluate if in-app form builder fully replaces JotForm; if not, build webhook handler

### Phase 17 — Wiki Integration with App Components
- [ ] Wire `<WikiButton sectionKey="..." />` into every page header
- [ ] Add wiki content for Forms, Form Builder, Intake Pipeline, Pipeline Board

### Phase 18 — Global Search Bar
- [ ] Command palette (`Cmd+K` / `Ctrl+K`) — search deals, investors, tasks, wiki
- [ ] Keyboard navigation, grouped results, debounced client-side search

### Phase 19 — Smart Matching
- [ ] Entity tagging on investors + deals; pgvector embeddings; Match Edge Function (Claude API)
- [ ] Match results UI on Fund Outreach screen; bulk CSV import for investors

### Phase 20 — Microtools
- [ ] **MT-1**: Call Note Structurer — Claude API → structured note from raw text
- [ ] **MT-2**: Pitch Deck Ingestion — PDF → Claude vision → memo section mapping
- [ ] **MT-3**: CCPS Deal Structure Calculator — cap table, dilution %, exit waterfall
- [ ] **MT-4**: In-App Messaging — DM threads, deal Comments, @mentions, Supabase Realtime

### Phase 21 — DPDP Compliance (India)
- [ ] Consent capture, privacy notices, right to access/correction/erasure forms
- [ ] Immutable `consent_log` table; auto-deletion cron; breach notification workflow

### Phase 22 — Form Builder (remaining polish)
- [ ] **Email notification on submission** — notify assigned team member when entry arrives
- [ ] **Form analytics** — views, submissions, drop-off rate per question, not-eligible rate
- [ ] **Submission review mode** — bulk view of all entries for a form
- [ ] **Re-submission prevention** — block same email from submitting the same form twice
- [ ] **Form duplication** — clone an existing form as a starting point

---

## ⏸ Deferred to v2

- Marketing & Content Ops module
- AI-assisted memo drafting
- Portfolio monitoring dashboard
- LP-facing reporting portal
- Mobile hamburger menu
- Full WCAG 2.1 AA audit
- Social media API integrations
- WhatsApp/Twilio notifications
- HR Tool microtool (MT-5)

---

## Infrastructure
- **Repo**: `https://github.com/Arboreallabs-Founder/ESV-Ecosystem` (public)
- **Dev server**: `http://localhost:3000` (run from repo root)
- **Vercel**: deployed from repo root; env vars set in Vercel dashboard
- **Supabase**: `hsabrzwsetjeaqutjrjb` (ap-south-1)
- **Sign-in**: Google OAuth (primary) or email/password (secondary)
- **Active accounts**: managed via `/admin/users` → `approved_emails` table
- **Routes**: `/forms` → `/forms/[id]/builder` → `/f/[token]` (public) | `/pipelines` → `/pipelines/[id]`
