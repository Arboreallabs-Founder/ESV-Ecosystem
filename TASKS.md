# ESV Ecosystem — Build Tasks
> Last updated: 2026-06-04. Phases 1–11, 13–14, 16, 22 complete. Audited against actual codebase.

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
Entry appears in the pipeline Kanban board
Admin/Founder assigns it to a team member, moves it through stages via drag & drop
         ↓
Clicking the entry shows all Q&A responses + which user's link was used
```

**Key design decisions:**
- Each form is a directed graph (React Flow canvas): Start → Questions → End nodes
- Two end conditions enforced on every form: `Submitted` (green) and `Not Eligible` (amber)
- MCQ questions create one output handle per option — each option must be wired to exactly one next node
- Forms cannot be saved if any output handle is unconnected (open flow validation)
- Each handle enforces exactly one outgoing edge — contradictory logic (one option → multiple destinations) is impossible
- Links are personalised — every link records who generated it; pipeline entries show "via [Name]'s link"
- Partners and associates can generate links; only admins/founders can build/edit forms
- Multiple forms can feed one pipeline simultaneously

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
- [x] Franchise partner DB record created and linked for partner@earlyseed.vc

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
- [x] Revoke access — removes from allowlist, deletes `franchise_partners` record, deletes `public.users`, calls `delete-user` edge function
- [x] `addApprovedUser` / `updateApprovedUser` / `revokeUser` server actions with founder/admin guard

### Phase 14 — Navigation & Shell
- [x] SaaS-style sidebar with icons replacing top nav
- [x] Role-based nav visibility
- [x] Active link highlighting
- [x] User avatar initials + role badge in sidebar footer
- [x] Workspace label "Earlyseed Ventures"

### Caching & Performance
- [x] React `cache()` on all lib data-fetching functions (request-level deduplication)
- [x] Loading skeleton files for all 6 routes (sidebar + content placeholder)

### Wiki System (partial)
- [x] `src/lib/wiki.ts` — static content for 7 sections (Dashboard, Pipeline, Tasks, Investors, Partners, Admin, Portal)
- [x] `WikiPanel` slide-in drawer component
- [x] `/wiki` full reference page
- [x] "Help & Wiki" + "Full Wiki" links in sidebar

### Auth & Accounts
- [x] Password change modal in sidebar footer (`supabase.auth.updateUser`)
- [x] `create-user` + `delete-user` Supabase Edge Functions deployed
- [x] `users` table FK to `auth.users` changed to `ON DELETE CASCADE`

### Partner Fee Structure
- [x] `transaction_fee_split_pct` + `success_fee_split_pct` columns on `franchise_partners`
- [x] `contract_link` column on `franchise_partners` (URL to partner contract document)
- [x] Partners page (`/admin/partners`) — shows all approved partner users; Fill in Details / Edit modals
- [x] Partner record auto-deleted when user is revoked from User Management

### Phase 16 — Google Auth (pre-approved emails only)
- [x] Google OAuth provider enabled in Supabase (Client ID + Secret configured)
- [x] "Continue with Google" button on login page (primary sign-in method)
- [x] Email/password login as secondary option
- [x] `approved_emails` table — `(email PK, name, role, added_by, added_at)`; RLS for founder/admin only
- [x] `handle_new_user()` DB trigger — checks `approved_emails`; blocks unapproved accounts
- [x] `/auth/callback` + `/auth/denied` routes
- [x] Middleware enforces approved-user check on all protected routes
- [x] `fetchAllUsers` / `fetchPartnerUsers` / `fetchApprovedUsers` cross-check `approved_emails`

### Phase 22 — Form Builder & Intake Pipeline (new flow replacing JotForm)

#### DB Schema
- [x] `forms` table — `id, title, description, pipeline_id, created_by, published`
- [x] `form_nodes` table — `id, form_id, type (start/end/question), subtype (success/rejected), position_x, position_y, question_text, answer_type (short_text/long_text/mcq)`
- [x] `form_node_options` table — MCQ options with position ordering
- [x] `form_edges` table — `source_node_id, target_node_id, condition_value (MCQ option id), condition_label`
- [x] `form_links` table — `form_id, created_by, token (uuid), label`; tracks who generated each link
- [x] `pipeline_entries` table — `pipeline_id, form_id, form_link_id, stage_id, assigned_to, title, submitter_name, submitter_email`
- [x] `pipeline_entry_answers` table — `entry_id, node_id, answer_text`
- [x] `get_form_for_submission` RPC — returns full form graph (nodes + edges + options + subtypes) for public renderer; works without pipeline

#### Form Builder (`/forms/[id]/builder`)
- [x] React Flow canvas — full-screen, fit-view, delete key support
- [x] Three node types: `StartNode` (green circle), `QuestionNode` (card), `EndNode` (circle, two variants)
- [x] Two end node variants enforced: **Submitted** (green ✓) and **Not Eligible** (amber ✕)
- [x] MCQ question nodes render one output handle per option; non-MCQ has single output handle
- [x] Properties panel (right sidebar) — edit question text with bold/italic markdown, answer type, MCQ options
- [x] "+ Question", "+ Submitted", "+ Not Eligible" buttons in top bar
- [x] **Graph validation on Save** — blocks save with error banner if:
  - Missing a Submitted or Not Eligible end node
  - Start node unconnected
  - Any question output handle unconnected
  - Any MCQ option unconnected
  - Any handle has more than one outgoing edge (contradictory logic)
- [x] **One-edge-per-handle enforcement** — drawing a new edge from a handle that already has one replaces the old edge; contradictory routing is impossible
- [x] Published / Draft toggle
- [x] **Form settings modal** (⚙ button) — edit title, description, pipeline link without leaving builder
- [x] Generate link modal — shareable URL with optional label
- [x] Save persists full graph (nodes + edges + MCQ options + subtypes) to DB

#### Forms List (`/forms`)
- [x] Card grid showing all forms — title, published/draft badge, pipeline link
- [x] **"N links issued"** badge on each card — click to see who generated links, when, and with what label
- [x] **"+ Get Link" button** on every published form card — available to all authenticated users (partners, associates, admins, founders)
- [x] New Form modal — title, description, pipeline selector; auto-seeds Start + Submitted + Not Eligible nodes
- [x] Only admins/founders see "Edit / Build" and "+ New Form"

#### Public Form Renderer (`/f/[token]`)
- [x] Flow-based rendering — follows graph edges from Start through questions to an end node
- [x] MCQ answers route to the correct next node based on `condition_value` (option id) on edges
- [x] Progress bar based on question count
- [x] Reaching **Submitted** end node → submitter name/email step → form data recorded in pipeline as entry
- [x] Reaching **Not Eligible** end node → rejection screen shown; no pipeline entry created
- [x] Form unavailable if not published (RPC returns null)

#### Pipeline Board (`/pipelines/[id]`)
- [x] **Drag and drop** — entry cards are draggable between stage columns; drop zone highlights with dashed purple border
- [x] **Entry detail modal** — async loads all Q&A responses (question + answer pairs); shows "via [Name]'s link" chip
- [x] **Assign to team member** — dropdown of all non-partner users; updates optimistically; assignee name shown on card
- [x] **Forms modal** (top bar "Forms" button) — link/unlink forms to pipeline directly from board; shows published/draft badge; forms linked to other pipelines shown greyed out
- [x] Multiple forms can be linked to the same pipeline simultaneously
- [x] `assigned_to` column added to `pipeline_entries` (FK → users, ON DELETE SET NULL)

### Code Quality & Bug Fixes
- [x] **Modal auto-close fix** — all 14+ modals across the app changed from `onClick` → `onMouseDown` + `stopPropagation` on inner modal; prevents accidental close when mouse drifts outside while clicking
- [x] **Form link fix** — `get_form_for_submission` RPC no longer returns null for forms without a pipeline; standalone forms work
- [x] **Assign dropdown fix** — filter was `.neq('role', 'partner')` but enum value is `franchise_partner`; corrected
- [x] Standardised `revalidatePath` removal — server actions use `router.refresh()` in components

---

## 🔴 REMAINING

### Phase 8 — Deal Record (remaining)
- [ ] **Founder contact on Deal Detail** — display founder_name/founder_email in info grid; editable inline for founder/admin/associate
- [ ] **Assignee field** — selector on Deal Detail; display on deal card; stored in deals.assignee_id
- [ ] **Success fee form** — `success_fee_pct` + `split_pct` fields on deal detail, visible to founder/admin only
- [ ] **Success fee prompt on Close** — modal when stage → 'Closed Success' if fee fields are empty
- [ ] **Document upload** — Supabase Storage bucket `deal-documents`; upload on Documents tab; max 25MB; PDF/XLSX/PPTX/DOCX/JPG/PNG

### Phase 11 — Tasks (remaining)
- [ ] **Tasks tab on Deal Detail** — show tasks linked to that specific deal; allow creating new tasks pre-linked to the deal

### Phase 12 — Memo Module *(most complex remaining feature)*
- [ ] Memo tab on Deal Detail (visible when stage ≥ 'Mandate Accepted')
- [ ] Full memo editor at `/pipeline/[dealId]/memo` — 9 sections, auto-save, status selector (Draft/In Review/Final)
- [ ] PDF export (`/api/memos/[memoId]/export`)
- [ ] DOCX export

### Phase 15 — JotForm Webhook *(may be superseded by Phase 22)*
- [ ] Evaluate whether in-app form builder fully replaces JotForm for all intake use cases
- [ ] If still needed: `src/app/api/webhooks/jotform/route.ts` — POST handler; maps JotForm fields → pipeline entry

### Phase 17 — Wiki Integration with App Components
- [ ] Wire `<WikiButton sectionKey="..." />` into every page header
- [ ] Add wiki content for Forms, Form Builder, Intake Pipeline flow
- [ ] Add inline tooltip hints on form builder nodes and fields

### Phase 18 — Global Search Bar
- [ ] **Command palette** (`Cmd+K` / `Ctrl+K`) — search deals, investors, tasks, wiki
- [ ] Keyboard navigation, grouped results, debounced client-side search

### Phase 19 — Smart Matching (DB-01 to DB-12)
- [ ] Entity tagging on investors + deals (sector, stage, thesis keywords)
- [ ] pgvector embeddings on investor thesis
- [ ] Match Edge Function — fires on deal reaching 'Mandate Accepted'; Claude API ranking
- [ ] Match results UI — 3-tab panel on Fund Outreach screen
- [ ] One-click add to outreach from match results
- [ ] Bulk CSV import for investors

### Phase 20 — Microtools
- [ ] **MT-1: Call Note Structurer** — Claude API → structured 6-section note from raw text
- [ ] **MT-2: Pitch Deck Ingestion Engine** — PDF upload → Claude vision → memo section mapping
- [ ] **MT-3: CCPS Deal Structure Calculator** — cap table, dilution %, exit waterfall; save scenarios to deal
- [ ] **MT-4: In-App Messaging** — DM threads, deal Comments tab, @mentions, Supabase Realtime

### Phase 21 — DPDP Compliance (India)
- [ ] Consent capture on intake forms and investor record creation
- [ ] Privacy notice, in-app policy pages, right to access/correction/erasure forms
- [ ] Immutable `consent_log` table; auto-deletion cron; breach notification workflow

### Phase 22 — Form Builder (remaining polish)
- [ ] **Email notification on submission** — send email to assigned team member when a new entry lands in their pipeline stage
- [ ] **Form analytics** — per-form stats: total views, submissions, drop-off rate per question, not-eligible rate
- [ ] **Submission review mode** — bulk view of all entries for a form with filter by end condition (submitted vs not eligible)
- [ ] **Re-submission prevention** — optionally block the same email from submitting the same form twice
- [ ] **Form duplication** — clone an existing form as a starting point

---

## ⏸ Deferred to v2

- Marketing & Content Ops module (FR-22, FR-23, FR-24)
- AI-assisted memo drafting (FR-34)
- Portfolio monitoring dashboard
- LP-facing reporting portal
- Mobile hamburger menu
- Full WCAG 2.1 AA audit
- Social media API integrations
- WhatsApp/Twilio notifications
- HR Tool microtool (MT-5) — travel reimbursements, expense claims, leave tracking, employee document vault

---

## Infrastructure
- Dev server: `http://localhost:3000`
- Supabase project: `hsabrzwsetjeaqutjrjb` (ap-south-1)
- Sign-in: Google OAuth (primary) or email/password (secondary, requires password set in User Management)
- Active accounts managed via User Management (`/admin/users`) → `approved_emails` table
- Forms route: `/forms` (list) → `/forms/[id]/builder` (canvas editor) → `/f/[token]` (public renderer)
- Pipelines route: `/pipelines` (list) → `/pipelines/[id]` (Kanban board with drag & drop)
