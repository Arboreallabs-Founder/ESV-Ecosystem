# ESV Ecosystem — Build Tasks
> Last updated: 2026-06-01. Phases 1–11, 13–14, 16 complete. Audited against actual codebase.

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
- [x] `transaction_fee_split_pct` + `success_fee_split_pct` columns on `franchise_partners` (% splits, replacing old fixed_fee/fee_split_pct)
- [x] `contract_link` column on `franchise_partners` (URL to partner contract document)
- [x] Partners page (`/admin/partners`) — shows all approved partner users; Fill in Details / Edit modals
- [x] Partner record auto-deleted when user is revoked from User Management

### Phase 16 — Google Auth (pre-approved emails only)
- [x] Google OAuth provider enabled in Supabase (Client ID + Secret configured)
- [x] Google Cloud Console OAuth credentials with Supabase redirect URI
- [x] "Continue with Google" button on login page (primary sign-in method)
- [x] Email/password login as secondary option (for pre-approved users with passwords set)
- [x] `approved_emails` table — `(email PK, name, role, added_by, added_at)`; RLS for founder/admin only
- [x] `handle_new_user()` DB trigger — checks `approved_emails` on signup; creates `public.users` with correct name + role; blocks unapproved accounts
- [x] `/auth/callback` route — exchanges OAuth code for session; redirects unapproved accounts to `/login?error=not_approved`
- [x] `/auth/denied` route — server-side sign-out + redirect to login with error
- [x] Middleware enforces approved-user check on all protected routes
- [x] `fetchAllUsers` / `fetchPartnerUsers` / `fetchApprovedUsers` all cross-check `approved_emails` (orphaned `public.users` rows filtered out)

### Code Quality
- [x] Standardised `revalidatePath` removal — server actions called from modals do not call `revalidatePath`; components call `router.refresh()` after the action instead. Inline optimistic-update actions (`moveDeal`, `updateTaskStatus`, `updateOutreachStatus`) retain `revalidatePath`.

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

### Phase 15 — JotForm Webhook
- [ ] `src/app/api/webhooks/jotform/route.ts` — POST handler
  - Validates webhook secret
  - Maps JotForm fields → deal fields
  - Creates deal at stage 'JotForm Received'
  - Inserts stage history entry

### Phase 17 — Wiki Integration with App Components
- [ ] Wire `<WikiButton sectionKey="..." />` into every page header:
  - Dashboard header → `sectionKey="dashboard"`
  - Pipeline header → `sectionKey="pipeline"`
  - Deal Detail header → `sectionKey="dealDetail"`
  - Tasks header → `sectionKey="tasks"`
  - Investors header → `sectionKey="investors"`
  - Partners header → `sectionKey="partners"`
  - Admin/Users header → `sectionKey="admin"`
  - Portal header → `sectionKey="portal"`
- [ ] Add wiki content for any missing sections (Memo, JotForm, Fee Calculator)
- [ ] Add inline tooltip hints on form fields (e.g. "What is a success fee?") that open the relevant wiki item

### Phase 18 — Global Search Bar
- [ ] **Command palette** (`Cmd+K` / `Ctrl+K`) — floating search overlay accessible from anywhere in the app
  - Search scope: deals (company name), investors (fund name), tasks (title), wiki articles
  - Results grouped by type (Deals, Investors, Tasks, Wiki)
  - Keyboard navigation (↑↓ to move, Enter to open, Esc to close)
  - Click result → navigate to deal detail / investor / task / wiki section
- [ ] Search input in sidebar (below nav links) as a fallback for non-keyboard users
- [ ] Debounced client-side search against locally fetched data (no extra DB round trips on free tier)
- [ ] Wiki search — filters `lib/wiki.ts` content by heading + body text, opens WikiPanel to matching section

### Phase 19 — Smart Matching (DB-01 to DB-12)
- [ ] **Entity tagging** — extend `investors` table with tag columns: sector[], stage_pref[], revenue_model[], thesis_keywords[], relationship_status (Warm/Lukewarm/Cold), past_co_investment bool
- [ ] **Deal tagging** — add tag columns to `deals`: sector_tags[], stage_tags[], revenue_model[], thesis_keywords[]
- [ ] **pgvector extension** — enable in Supabase; add `thesis_embedding vector(1536)` to investors; generate embeddings via Edge Function on create/update
- [ ] **Match Edge Function** — fires on deal reaching 'Mandate Accepted'; weighted tag overlap scoring + Claude API final ranking; stores result as `cached_match_results JSONB` on deal record
- [ ] **Match results UI** — 3-tab panel on Fund Outreach screen: Investors / Co-investors / Partnerships; shows match score, relationship status, contact; filter by sector/stage/relationship/geography
- [ ] **One-click add to outreach** — from match results → adds to `fund_outreach` with status 'Pending'
- [ ] **Entity history tab** — on investor record, show all deals outreached + status + outcome
- [ ] **Bulk CSV import** — for investors entity type; field mapping + duplicate detection on name + email

### Phase 20 — Microtools
- [ ] **MT-1: Call Note Structurer** — 'Structure my notes' button on Notes tab; raw text input (50–10,000 chars) → Claude API (claude-sonnet-4-6) → 6-section structured output preview → save as timestamped note; option to keep/discard raw input
- [ ] **MT-2: Pitch Deck Ingestion Engine** — 'Import from pitch deck' button on Memo tab; PDF upload (25MB max) → Claude API vision extraction → 10 fields mapped to memo sections; side-by-side review with per-field accept/edit/reject; 'Not found in deck' tag for missing sections; < 30s processing target
- [ ] **MT-3: CCPS Deal Structure Calculator** — floating panel (pinnable, accessible from deal record + global shortcut); instruments: CCPS / SAFE / Convertible / Equity; real-time recalculation (< 100ms) of cap table, dilution %, exit waterfall at 3 exit values; save named scenarios to deal record; PDF export; side-by-side scenario comparison (up to 3)
- [ ] **MT-4: In-App Messaging** — DM threads between internal users (Supabase Realtime); deal Comments tab (threaded, internal-only); @user mentions with in-app + email notification; @deal-name clickable references; unified unread inbox in nav; file attachments up to 10MB

### Phase 21 — DPDP Compliance (India)
- [ ] **Consent capture** — checkbox + plain-language notice on JotForm (DPDP-01); consent prompt on investor record creation (DPDP-02); immutable `consent_log` table (timestamp, principal ID, IP — no DELETE/UPDATE)
- [ ] **Privacy notice** — accessible from login page, JotForm footer, and Settings > Privacy (DPDP-03)
- [ ] **In-app policy pages** — Settings > Privacy > Privacy Policy (DPDP-04) and Data Handling Policy (DPDP-05); version-controlled, date-stamped
- [ ] **Right to access form** — Settings > Privacy > Request My Data; logged with timestamp; 30-day SLA (DPDP-06)
- [ ] **Right to correction form** — Settings > Privacy > Correct My Data; 14-day SLA (DPDP-07)
- [ ] **Right to erasure form** — Settings > Privacy > Delete My Data; 30-day SLA; lawful-hold check (DPDP-08)
- [ ] **Consent withdrawal** — triggers erasure workflow unless lawful retention basis exists (DPDP-09)
- [ ] **Auto-deletion cron job** — monthly Supabase cron; identifies records past retention period; sends 48-hour notice; deletes + logs (DPDP-10)
- [ ] **Breach notification workflow** — Admin-triggered from Admin Panel; generates plain-language notice to affected principals; 72-hour Board report template (DPDP-11)
- [ ] **Grievance form** — Settings > Privacy > Submit Grievance; 90-day SLA tracked (DPDP-12)
- [ ] **External privacy policy PDF** — linked from in-app and JotForm (DPDP-15)

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
