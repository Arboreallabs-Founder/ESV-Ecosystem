# ESV Ecosystem — Build Tasks
> Last updated: 2026-06-06. Phases 1–11, 13–14, 16, 22 complete. Deployed to Vercel.

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
