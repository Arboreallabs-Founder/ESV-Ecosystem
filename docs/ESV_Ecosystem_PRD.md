## **ECOSYSTEM** 

## by Earlyseed Ventures 

**Product Requirements Document** 

Version 1.0  |  2025  |  Confidential 

|**Product Name**|Ecosystem|
|---|---|
|**Version**|v1.0|
|**Status**|Draft — Pending Sign-off|
|**Author(s)**|Sakshay (Head of Prefunding & Research, Earlyseed Ventures)|
|**Reviewers**|Monica (ESV Founder), Siddhant Baliga (Admin)|
|**Target Release**|13 weeks from PRD sign-off|
|**Stakeholders**|Monica, Sakshay, Siddhant Baliga, External Developer, Designer|



## **Table of Contents** 

Table of Contents.......................................................................................................................... 1 1.1  Product Vision.....................................................................................................................1 1.2  Problem Statement.............................................................................................................1 1.3  Proposed Solution.............................................................................................................. 1 1.4  Success Metrics (North Star)..............................................................................................1 2.1  Business Context................................................................................................................1 2.2  Current Tooling & Gaps...................................................................................................... 1 2.3  Prior Work & Decision to Build Custom.............................................................................. 1 2.4  Existing IB Deal Flow (As-Is).............................................................................................. 1 3.1  Goals (v1 — MoSCoW Priority Order)................................................................................1 3.2  Non-Goals (Explicit v1 Out-of-Scope).................................................................................1 3.3  Assumptions....................................................................................................................... 1 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

3.4  Constraints..........................................................................................................................1 4.1  Persona Overview.............................................................................................................. 1 4.2  Jobs-to-be-Done.................................................................................................................1 5.1  Functional Requirements....................................................................................................1 5.2  Non-Functional Requirements............................................................................................1 Flow 1 — Organic Lead → JotForm → Pipeline Entry.............................................................. 1 Flow 2 — Franchise Partner Submits Deal via Portal................................................................1 Flow 3 — Call Scheduled → Notes Logged → Stage Updated.................................................1 Flow 4 — Fund Outreach → Status Tracked Per Fund............................................................. 1 Flow 5 — Close → Success Fee Logged + Split Calculated.....................................................1 6.1  Key Error States................................................................................................................. 1 7.1  Design Principles................................................................................................................1 7.2  Colour System & Themes...................................................................................................1 7.3  Screen Inventory.................................................................................................................1 7.4  Accessibility........................................................................................................................ 1 8.1  Development Toolchain...................................................................................................... 1 8.2  API & Integrations...............................................................................................................1 8.3  Data Model (High-Level).....................................................................................................1 8.4  Row-Level Security (Critical).............................................................................................. 1 8.5  Technical Risks...................................................................................................................1 9.1  How the Modules Connect..................................................................................................1 9.2  Cross-Module Trigger Map................................................................................................. 1 9.3  The Deal Record Activity Feed...........................................................................................1 9.4  Module Dependency Map...................................................................................................1 9.5  Shared Data Entities...........................................................................................................1 9.6  Notification Routing.............................................................................................................1 10.1  Overview...........................................................................................................................1 10.2  Entity Types...................................................................................................................... 1 10.3  Tag Taxonomy...................................................................................................................1 10.4  Smart Matching Logic.......................................................................................................1 10.5  Functional Requirements — Database & Matching..........................................................1 10.6  Matching — Technical Approach...................................................................................... 1 11.1  Regulatory Context........................................................................................................... 1 11.2  Data Principals Covered................................................................................................... 1 11.3  DPDP Obligations & Platform Implementation..................................................................1 11.4  Functional Requirements — DPDP Compliance.............................................................. 1 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

11.5  Data Storage & Security................................................................................................... 1 11.6  Third-Party Data Processors.............................................................................................1 11.7  Compliance Timeline.........................................................................................................1 12.1  Overview...........................................................................................................................1 13.1  Sprint Philosophy..............................................................................................................1 13.2  Pre-Sprint Setup (Before Week 1, Day 1).........................................................................1 13.3  Week 1 Sprint — Core Pipeline (Weeks 1–2 of build)...................................................... 1 13.4  Remaining Build Schedule (Weeks 3–11).........................................................................1 13.5  Daily Token Hygiene Rules...............................................................................................1 10.1  Rollout Phases..................................................................................................................1 10.2  Transition Plan (Parallel Run)...........................................................................................1 10.3  Data Migration Plan.......................................................................................................... 1 10.4  Communication & Training................................................................................................1 10.5  Analytics & Instrumentation.............................................................................................. 1 A.  Glossary............................................................................................................................... 1 B.  ESV Colour Palette Reference.............................................................................................1 C.  Revision History................................................................................................................... 1 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **1.  EXECUTIVE SUMMARY** 

## **1.1  Product Vision** 

Ecosystem is Earlyseed Ventures' unified operating platform — a single highway with structured exits into every action the firm needs to take. Whether sourcing deals, managing franchise partner relationships, running fund outreach, or tracking portfolio companies, every stakeholder navigates through one surface instead of context-switching across fragmented tools. 

## **1.2  Problem Statement** 

Earlyseed Ventures currently operates across Google Sheets, WhatsApp, and email with no single source of truth, poor cross-team visibility, no structured access channel for Franchise Partners, and no unified place for call notes, documents, or success fee tracking. As deal volume grows and the team scales, this fragmentation creates operational risk and inefficiency. 

## **1.3  Proposed Solution** 

A custom-built, role-based internal platform — Ecosystem — covering 7 operational modules: Deal Pipeline, CRM, Research, Portfolio Monitoring, Marketing & Content Ops, Task Management, and Fund Outreach. Built on Next.js + Supabase, designed to ESV brand standards, with both light and dark mode support. 

## **1.4  Success Metrics (North Star)** 

|**Metric**|**Target**|**Measurement**|
|---|---|---|
|All active deals tracked in<br>Ecosystem|100% within 30 days of Beta|Deal count vs Sheets tracker|
|Time to log a call note|< 2 minutes per call|User feedback at 30-day review|
|Franchise Partner deal<br>submissions via portal|100% of new referrals|Submission source tag|
|Stage history completeness|Every deal has full audit log|Records with 0 history entries =<br>0|
|Parallel run retired|Sheets archived within 60 days of<br>Beta|Date of Sheets archive|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **2.  BACKGROUND & CONTEXT** 

## **2.1  Business Context** 

Ecosystem is being built now because five concurrent pressures have made the current tooling unsustainable: 

- Franchise Partners are being onboarded and need a structured, trackable submission channel 

- Deal volume is growing beyond what a manually maintained Sheets tracker can support 

- The team is scaling and Founders need visibility without chasing updates on WhatsApp 

- LP and investor reporting readiness requires a consolidated, auditable data source 

- Admin and coordination overhead is consuming time that should go into deal work 

## **2.2  Current Tooling & Gaps** 

|**Tool / Artefact**|**What it does**|**Gap it leaves**|
|---|---|---|
|Startup Tracker (Sheets)|Logs all incoming deals with stage<br>and status|No notes, no document links, no<br>history log, no role-based access|
|Investor Database<br>(Sheets)|Stores fund contacts and thesis info|No outreach tracking per deal, no<br>fund-deal relationship|
|Mandate Tracker<br>(Sheets)|Tracks companies that reach mandate<br>stage|Separate from main pipeline — no<br>unified view|
|JotForm|External startup interest intake form|Data stays in JotForm — no<br>auto-entry into pipeline|
|Google Docs (linked<br>chips)|Call notes stored per company|Disconnected from deal record, no<br>searchability|
|WhatsApp / Email|Document sharing, team comms,<br>founder comms|No audit trail, no structure, nothing<br>searchable|



## **2.3  Prior Work & Decision to Build Custom** 

No off-the-shelf VC platform (Affinity, Visible, Edda, Salesforce) was evaluated as a fit. The decision to build custom reflects the need to embed ESV-specific workflows — particularly the IB deal flow with mandate logic, franchise fee splits, and multi-stakeholder access tiers — that generic CRM tools cannot accommodate without heavy customisation. 

## **2.4  Existing IB Deal Flow (As-Is)** 

The current end-to-end deal sourcing and execution process is documented below as the reference workflow Ecosystem must digitise: 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|**Ste**<br>**p**|**Activity**|**Current Tool**|**Gap**|
|---|---|---|---|
|1|Deal sourced via LinkedIn,<br>Franchise Partner, or fund<br>mandate|WhatsApp / Email|No structured intake or source tagging|
|2|JotForm sent to startup|JotForm|Manual step — no auto-trigger|
|3|Deal added to Startup<br>Tracker|Google Sheets|Manual entry, no JotForm sync|
|4|First-level call + notes|Google Docs linked to<br>Sheets|Notes disconnected from deal record|
|5|Analysis — pitch deck, MIS,<br>projections reviewed|Email / WhatsApp|Documents not stored against deal|
|6|Second-level call + fundraise<br>mandate sent (IB)|Mandate Tracker<br>(Sheets)|Separate tracker — no link to main<br>pipeline|
|7|Investment memo created +<br>data room built|Email / Google Drive|Not tracked in any system|
|8|Fund outreach against<br>curated investor list|Investor DB (Sheets)|No per-deal outreach status tracking|
|9|Close + success fee and split<br>logged|No tool|Entirely untracked|
|10|Portfolio monitoring<br>post-close|No tool|Entirely untracked|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **3.  GOALS & NON-GOALS** 

## **3.1  Goals (v1 — MoSCoW Priority Order)** 

|**Priority**|**Goal**|
|---|---|
|Must Have|G1: Ship a unified deal pipeline covering the full IB workflow from intake to close —<br>replacing Sheets + WhatsApp + Docs|
|Must Have|G2: Embedded call notes and transcript management per deal — replacing Google<br>Docs linked via Sheets chips|
|Must Have|G3: Franchise Partner portal for structured deal and lead submission — replacing<br>informal WhatsApp/email referrals|
|Should Have|G4: Investor database and fund outreach module with per-deal status tracking|
|Should Have|G5: Success fee and split tracking tied to mandate and franchise agreements|
|Could Have|G6: Portfolio monitoring dashboard for post-close tracking|



## **3.2  Non-Goals (Explicit v1 Out-of-Scope)** 

- No mobile app — web only for v1 

- No LP-facing reporting portal — internal use only 

- No accounting or invoicing integration — fee tracking is logged, not processed 

- No AI-generated memos or summaries — deferred to v2 

- No public-facing startup application page — JotForm continues as external intake for v1 

- No portfolio monitoring dashboard — deferred to v2 

## **3.3  Assumptions** 

- JotForm continues as the external intake form for v1; Ecosystem ingests data via webhook 

- Franchise Partners access a limited portal view only — not the full internal platform 

- Existing Startup Tracker, Investor Database, and Mandate Tracker data will be migrated manually pre-launch 

- The 3-month timeline assumes a dedicated external developer resource from Week 3 

- WhatsApp Business API template approval is initiated at project kickoff, not at launch 

## **3.4  Constraints** 

**Type Description Impact** 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Timeline|v1 target: 13 weeks from PRD sign-off|Strict scope discipline required —<br>marketing module may slip to v2|
|---|---|---|
|Budget|Custom build — full dev cost, no licensing|Developer selection and rate must be<br>confirmed at kickoff|
|Data|Migration from 3 existing Sheets trackers|1 week pre-launch buffer required for<br>migration + validation|
|Access|4 stakeholder roles from day one|Row-level security must be spec'd<br>before dev begins — not retrofitted|
|API|LinkedIn API does not expose outreach data|Outreach tracking in Ecosystem is<br>manual-only — no live sync|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **4.  USER PERSONAS** 

## **4.1  Persona Overview** 

|**Attribute**|**Firm Founders**|**Associates &**<br>**Analysts**|**Admin**|**Franchise**<br>**Partners**|
|---|---|---|---|---|
|Access level|Full read/write +<br>assign|Operational<br>read/write|System-level|Limited portal<br>only|
|Primary actions|Review pipeline,<br>assign work, read<br>reports, dashboard<br>overview|Create deals, log<br>notes, attach docs,<br>update stages, run<br>outreach, upload<br>memos|User<br>management,<br>settings, oversight|Submit deals,<br>track own<br>submission<br>status|
|Pain today|No single view of<br>pipeline or team<br>activity|Scattered across<br>Sheets, Docs,<br>WhatsApp|No formal system<br>to manage|No structured<br>submission<br>channel —<br>WhatsApp only|
|Tech savviness|High|High|Medium–High|Low–Medium|
|Usage frequency|Daily — review &<br>oversight|Daily —<br>operational|Weekly —<br>maintenance|Ad hoc — per<br>deal|
|Sees fee data|Yes — full fee +<br>split detail|No|Yes — full fee +<br>split detail|No|



## **4.2  Jobs-to-be-Done** 

- Firm Founder: When reviewing the week's deals, I want to see pipeline status and team activity in one place, so I can make decisions and assign next steps without chasing people on WhatsApp. 

- Associate / Analyst: When working a deal, I want to log notes, attach documents and update the stage without switching between five tools, so nothing falls through the cracks. 

- Franchise Partner: When I have a deal to refer, I want to submit it cleanly and know what's happening with it, so I'm not following up blind over WhatsApp. 

- Admin: When onboarding a new team member or partner, I want to assign their role and access level in one place, so they have the right permissions from day one. 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **5.  REQUIREMENTS** 

## **5.1  Functional Requirements** 

## **Deal Pipeline Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-0<br>1|Deal record with 9 defined fields (company,<br>sector, stage, source, founder contact,<br>referring partner, documents, notes, assignee,<br>fee, history)|Must Have|All fields present and validated<br>on save|
|FR-0<br>2|11-stage pipeline: New Lead → JotForm<br>Received → First Call Scheduled → First Call<br>Done → Analysis in Progress → Second Call /<br>Mandate Sent → Mandate Accepted → Memo<br>Created → Fund Outreach Active → Closed<br>Success → Closed Dead|Must Have|Deals move forward/backward;<br>stage change logged with<br>timestamp + user|
|FR-0<br>3|Kanban board view with drag-and-drop|Must Have|Cards draggable across<br>columns; stage updates on drop|
|FR-0<br>4|Table/list view with sort + filter; toggle from<br>Kanban|Must Have|All deals in sortable/filterable<br>rows; view persists per user<br>session|
|FR-0<br>5|Deal source tagging (organic / franchise / fund)<br>with conditional referring partner field|Must Have|Referring partner field appears<br>only when source = franchise or<br>fund|
|FR-0<br>6|Document attachments linked to deal record<br>(pitch deck, MIS, projections)|Must Have|Upload supported; files linked to<br>deal; viewable inline|
|FR-0<br>7|Call notes / transcript rich-text field per deal|Must Have|Rich text input or paste area;<br>entries timestamped; multiple<br>entries per deal|
|FR-0<br>8|Assigned team member with notification on<br>assignment|Must Have|Single or multi-assign; assignee<br>notified via email/WhatsApp on<br>assignment|
|FR-0<br>9|Success fee % + split details (Founders +<br>Admin only)|Should Have|Fields on deal record; hidden<br>from Associates and Franchise<br>Partners at data layer|
|FR-1<br>0|JotForm webhook → auto-create deal at<br>'JotForm Received'|Must Have|New JotForm submission<br>creates deal record within 60<br>seconds; all mapped fields<br>populated|
|FR-1<br>1|Stage history log (immutable)|Must Have|Every stage change recorded<br>with user and timestamp; no<br>deletion allowed|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|FR-1<br>2|Duplicate deal detection|Must Have|System flags if company name<br>+ founder email matches<br>existing record|
|---|---|---|---|



## **Investor Database & Fund Outreach Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-1<br>3|Fund record: name, contact person,<br>thesis/sector focus, stage preference, cheque<br>size range|Should Have|All fields present; searchable<br>and filterable by thesis, stage,<br>cheque size|
|FR-1<br>4|Fund outreach status flag per deal per fund<br>(Sent / Responded / Passed / Interested)|Should Have|Status selectable per fund on<br>deal record; visible in fund<br>outreach tab|
|FR-1<br>5|Fund search/filter when initiating outreach on a<br>deal|Should Have|User can filter investor DB by<br>thesis and stage to find<br>matching funds|



## **Franchise Partner Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-1<br>6|Franchise partner record: name, contact,<br>agreement type (referral / franchise), fee split<br>%|Must Have|Record created by Admin; fee<br>split % auto-pulls into deal fee<br>calculation|
|FR-1<br>7|Partner deal submission form (portal)|Must Have|Partner can submit: company<br>name, founder contact, sector,<br>description|
|FR-1<br>8|Partner deal status visibility (own submissions<br>only)|Must Have|Partner sees stage of their<br>submitted deals; cannot see<br>other deals or fee data|
|FR-1<br>9|Total fees earned/owed per franchise partner|Should Have|Aggregate view for Admin and<br>Founders; not visible to partner|



## **Task Management Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-2<br>0|Task record: title, description, assignee, due<br>date, priority level, status (To Do / In Progress /<br>Done)|Must Have|All fields present; task list<br>filterable by assignee and due<br>date|
|FR-2<br>1|Optional deal linkage on task|Must Have|Task can be linked to a deal<br>record; linked tasks visible on<br>deal detail|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **Marketing & Content Ops Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-2<br>2|Content calendar view|Could Have|Calendar shows scheduled<br>posts by date; colour-coded by<br>platform|
|FR-2<br>3|Schedule and publish social posts|Could Have|Posts can be scheduled via<br>social media API; published<br>automatically at scheduled time|
|FR-2<br>4|Assign content tasks to team members|Could Have|Content tasks assignable from<br>calendar view; assignee notified|



## **Memo Generation Module** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-2<br>7|Investment memo template with pre-defined<br>sections: Executive Summary, Company<br>Overview, Problem & Solution, Market<br>Opportunity, Business Model, Financials,<br>Team, ESV Commentary, Recommendation|Must Have|Template renders in memo<br>editor; all sections present and<br>editable|
|FR-2<br>8|Auto-populate memo fields from deal record<br>data (company name, sector, stage, founder<br>contact, financials summary)|Must Have|On memo creation, known deal<br>fields auto-fill; user edits<br>remaining sections|
|FR-2<br>9|Rich text editor for each memo section|Must Have|Bold, italic, bullet lists,<br>headings, tables supported per<br>section|
|FR-3<br>0|Memo linked to deal record and accessible<br>from deal detail page|Must Have|Deal record shows 'Memo' tab;<br>one active memo per deal;<br>previous versions archived|
|FR-3<br>1|Export memo as PDF|Must Have|One-click PDF export; ESV<br>brand header and footer<br>applied; clean print layout|
|FR-3<br>2|Export memo as Word document (.docx)|Should Have|Export preserves structure and<br>formatting; usable for external<br>sharing with light edits|
|FR-3<br>3|Memo status tracking (Draft / In Review / Final)|Should Have|Status visible on deal record;<br>Founders can mark memo as<br>Final|
|FR-3<br>4|AI-assisted memo drafting (v2)|Won't Have|Deferred — Claude API<br>integration to draft memo<br>sections from deal data; not in<br>v1 scope|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **Reporting & Dashboard** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|FR-2<br>5|Founder dashboard: deal counts by stage,<br>recent activity feed, open tasks summary|Must Have|Dashboard loads in < 2s; data<br>reflects real-time pipeline state|
|FR-2<br>6|Full analytics and reporting (v2)|Won't Have|Deferred — not in v1 scope|



## **5.2  Non-Functional Requirements** 

|**Category**|**Requirement**|**Target / Threshold**|
|---|---|---|
|Performance|Pipeline page load time|< 2 seconds for up to 500 deals|
|Performance|Dashboard load time|< 2 seconds real-time data|
|Scalability|Concurrent users at launch|20–50 concurrent users|
|Availability|Uptime during IST business hours|99.5%|
|Access control|Role-based field visibility|Fee fields hidden from Associates<br>+ Franchise Partners at data layer<br>— not just UI|
|Access control|Franchise Partners data isolation|Partners see only their own<br>submissions — enforced via<br>Supabase row-level security|
|Data integrity|Stage history log|Immutable — no deletions<br>permitted for any role including<br>Admin|
|Data|Migration from existing Sheets|All 3 trackers migrated and<br>validated before Beta launch|
|Security|Authentication|Supabase Auth with email +<br>password; role assigned at user<br>creation|
|File storage|Document attachments|Max 25MB per file; supported<br>types: PDF, XLSX, PPTX, DOCX,<br>JPG, PNG|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **6.  USER FLOWS & USE CASES** 

**Flow 1 — Organic Lead → JotForm → Pipeline Entry** 

|**Step**|**Detail**|
|---|---|
|Trigger|ESV team member shares JotForm link with a startup via LinkedIn or email|
|Step 1|Founder fills JotForm and submits|
|Step 2|JotForm webhook fires → deal record auto-created in Ecosystem at stage 'JotForm<br>Received'|
|Step 3|Assigned team member notified via email/WhatsApp|
|Step 4|Team reviews record and moves to 'First Call Scheduled'|
|Success state|Deal visible in pipeline at correct stage; all JotForm fields mapped; assignee notified|
|Edge case 1|Duplicate detected (same company + email) → system flags; user prompted to merge<br>or ignore|
|Edge case 2|Webhook fails → deal not created; error banner shown; user falls back to manual entry<br>with source tagged 'Manual'|



**Flow 2 — Franchise Partner Submits Deal via Portal** 

|**Step**|**Detail**|
|---|---|
|Trigger|Franchise Partner logs into portal and initiates a new deal submission|
|Step 1|Partner fills submission form: company name, founder contact, sector, brief description|
|Step 2|Deal created in pipeline at 'New Lead'; source = Franchise; referring partner<br>auto-tagged from logged-in partner account|
|Step 3|ESV internal team notified of new submission|
|Step 4|Partner portal shows submission as 'Submitted — Under Review'|
|Success state|Deal in pipeline; partner tagged; partner can track stage progression of their<br>submission|
|Edge case 1|Incomplete submission → validation blocks; required fields highlighted|
|Edge case 2|Duplicate deal → Admin flagged to resolve; partner sees 'Under Review' status<br>regardless|



**Flow 3 — Call Scheduled → Notes Logged → Stage Updated** 

|**Step**|**Detail**|
|---|---|
|Trigger|Associate/Analyst prepares for or completes a first or second call with a founder|
|Step 1|User opens deal record → updates stage to 'First Call Scheduled'|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Step 2|After call: user opens notes field → pastes transcript or types summary → saves|
|---|---|
|Step 3|User updates stage to 'First Call Done'|
|Step 4|Stage change logged with timestamp and user identity|
|Success state|Notes saved to deal record; stage updated; history log shows full trail|
|Edge case|User logs notes but forgets to update stage → stage remains stale; Founder can see<br>last-updated timestamp to flag inactivity; system does NOT auto-advance stage<br>(intentional)|



**Flow 4 — Fund Outreach → Status Tracked Per Fund** 

|**Step**|**Detail**|
|---|---|
|Trigger|Mandate accepted; investment memo ready; team begins fund outreach|
|Step 1|User opens deal record → navigates to Fund Outreach tab|
|Step 2|User searches investor database; filters by thesis, stage preference, cheque size|
|Step 3|User selects matching funds → marks each as 'Sent'|
|Step 4|As responses come in, user updates status per fund: Responded / Passed / Interested|
|Success state|Each fund has a clear status against the deal; interested funds surfaced at a glance;<br>full outreach list visible on deal record|
|Edge case 1|Fund not in investor database → user can add fund inline during outreach flow|
|Edge case 2|All funds pass → user manually moves deal to 'Closed — Dead'; no auto-close|



**Flow 5 — Close → Success Fee Logged + Split Calculated** 

|**Step**|**Detail**|
|---|---|
|Trigger|Fund confirms investment; deal moves to 'Closed — Success'|
|Step 1|User moves deal stage to 'Closed — Success'|
|Step 2|System prompts: enter success fee details (total fee %, deal value)|
|Step 3|Referring partner auto-populates from deal record; split % pulled from franchise<br>agreement on file|
|Step 4|System calculates ESV share vs partner share and saves to deal record|
|Step 5|Fee detail visible to Founders and Admin only|
|Success state|Fee logged; split calculated; record shows both ESV and partner shares clearly on<br>Founder dashboard|
|Edge case 1|No referring partner → full fee attributed to ESV; split field hidden|
|Edge case 2|Fee not entered at close → stage advances but fee section flagged as incomplete with<br>warning banner|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **6.1  Key Error States** 

|**Scenario**|**Expected Behaviour**|**User-Facing Message**|
|---|---|---|
|JotForm webhook fails|Deal not auto-created; logged in<br>system|Automatic import failed — please add<br>this deal manually|
|Duplicate deal detected|Flag raised; auto-create blocked|A deal for [Company] already exists.<br>Merge or create separately?|
|Franchise Partner submits<br>incomplete form|Submission blocked|Required fields highlighted in red —<br>please complete before submitting|
|Stage moved without required<br>fields|Warning shown; not blocked|Some required fields are empty for this<br>stage. Continue anyway?|
|Success fee saved without<br>split details|Fee saved; split flagged<br>incomplete|Split details incomplete — visible to<br>Founders only until resolved|
|User attempts to delete stage<br>history|Action blocked entirely|Stage history cannot be deleted|
|File upload exceeds 25MB|Upload rejected|File too large — maximum size is<br>25MB|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **7.  UX & DESIGN** 

## **7.1  Design Principles** 

- Clean and minimal — data surfaces first; chrome stays out of the way 

- Spacious card-based layout — no dense tables as the default view 

- ESV brand palette strictly followed — no off-brand colours introduced by dev 

- Both light and dark mode supported — dark mode as the power-user default 

- Consistent component language across all modules — same cards, badges, and inputs everywhere 

- Role-aware UI — fields and sections hidden at the component level in addition to row-level security 

## **7.2  Colour System & Themes** 

Ecosystem ships with 4 selectable themes — 2 ESV brand variants and 2 generic alternatives — each with full light and dark mode support. Users select their preferred theme from account settings; the selection persists per user. 

**Theme 1 — ESV Brand (Default)** 

|**Token**|**Name**|**Light Hex**|**Dark Hex**|**Usage**|
|---|---|---|---|---|
|Primary action|Purple|#745FFD|#745FFD|CTAs, active nav, selected<br>states|
|Primary light|Pastel Purple|#CEAAFD|#CEAAFD|Hover states, tags, badges|
|Page<br>background|Crema / Deep<br>Navy|#F7ECE2|#1A1A2E|Page surface|
|Card surface|Fair / Dark Raised|#F4F4F4|#22223A|Card and panel surface|
|Body text|Dark / Off-White|#2C2C3A|#F0EDE8|Primary body text|
|Muted text|Slate|#A39B95|#A39B95|Secondary labels,<br>placeholders|
|Border / divider|Sand / Dark<br>Border|#D3C1A9|#3A3A5C|Borders, dividers|
|Warm accent|Bronze|#D5AE8F|#D5AE8F|Franchise tags, warm<br>accents|
|Warning / fee|Golden Glow|#CB8C7C|#CB8C7C|Fee flags, warning states|
|Destructive|Red|#C0392B|#E74C3C|Errors, blocked actions|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **Theme 2 — ESV Brand — Minimal (ESV Variant)** 

A cleaner, more restrained version of the ESV palette. Uses white/off-white surfaces and reduces the warm tones — better for dense data views and power users. 

|**Token**|**Light Hex**|**Dark Hex**|**Usage**|
|---|---|---|---|
|Primary action|#745FFD|#745FFD|CTAs — same ESV<br>purple|
|Primary light|#CEAAFD|#4A3A8A|Hover — muted in dark<br>mode|
|Page background|#FAFAFA|#111118|Cooler, cleaner surface|
|Card surface|#FFFFFF|#1C1C26|White cards on light;<br>deep cards on dark|
|Body text|#1A1A2E|#EFEFFF|Slightly cooler text tone|
|Muted text|#888899|#8888AA|Cooler muted labels|
|Border / divider|#E8E8F0|#2E2E44|Subtle cool borders|
|Accent|#D5AE8F|#D5AE8F|Bronze retained as sole<br>warm accent|
|Warning|#CB8C7C|#CB8C7C|Golden Glow retained|
|Destructive|#C0392B|#E74C3C|Same red|



## **Theme 3 — Slate Pro (Generic — Professional)** 

A neutral, corporate-feel theme. Works well for Associates and Analysts who prefer a traditional business data interface. 

|**Token**|**Light Hex**|**Dark Hex**|**Usage**|
|---|---|---|---|
|Primary action|#2563EB|#3B82F6|Classic business blue<br>CTAs|
|Primary light|#DBEAFE|#1E3A5F|Blue hover, highlights|
|Page background|#F8FAFC|#0F172A|Clean white / deep navy|
|Card surface|#FFFFFF|#1E293B|Cards, panels|
|Body text|#0F172A|#F1F5F9|Primary text|
|Muted text|#64748B|#94A3B8|Secondary labels|
|Border / divider|#E2E8F0|#334155|Borders, dividers|
|Accent|#0EA5E9|#38BDF8|Sky blue tags, highlights|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Warning|#F59E0B|#FBBF24|Amber warnings|
|---|---|---|---|
|Destructive|#DC2626|#EF4444|Red errors|



## **Theme 4 — Forest (Generic — Warm & Calm)** 

An earthy, warm-toned alternative. Softer on the eyes for long sessions — suited for Founders who spend extended time on the dashboard. 

|**Token**|**Light Hex**|**Dark Hex**|**Usage**|
|---|---|---|---|
|Primary action|#16A34A|#22C55E|Forest green CTAs|
|Primary light|#DCFCE7|#14532D|Green hover, highlights|
|Page background|#FAFAF5|#1C1F1A|Warm off-white / dark<br>forest|
|Card surface|#FFFFFF|#252821|Cards, panels|
|Body text|#1C1F1A|#F0F4EE|Primary text|
|Muted text|#6B7280|#9CA3AF|Secondary labels|
|Border / divider|#E5E7EB|#2D3228|Borders, dividers|
|Accent|#CA8A04|#EAB308|Amber yellow highlights|
|Warning|#EA580C|#FB923C|Orange warnings|
|Destructive|#DC2626|#EF4444|Red errors|



Dev note: All themes are implemented via CSS custom properties (CSS variables) on the :root element. Switching themes updates only the variable values — no component-level changes required. Theme preference stored per user in Supabase user_preferences table. 

## **7.3  Screen Inventory** 

|**Screen / Module**|**Description**|**Primary Role(s)**|**Status**|
|---|---|---|---|
|Dashboard|Founder overview — deal counts by<br>stage, recent activity feed, open<br>tasks|Founders, Admin|Design TBD|
|Deal Pipeline — Kanban|All active deals as drag-and-drop<br>cards across 11 stages|All internal roles|Design TBD|
|Deal Pipeline — Table|All deals in sortable/filterable list<br>view; toggle from Kanban|All internal roles|Design TBD|
|Deal Record|Full deal detail — fields, notes,<br>documents, stage history, outreach<br>tab, fee tab|All internal roles|Design TBD|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Investor Database|Fund list with search + filter by thesis,<br>stage, cheque size|Associates,<br>Founders|Design TBD|
|---|---|---|---|
|Franchise Portal —<br>Submit|Partner-facing deal submission form|Franchise<br>Partners|Design TBD|
|Franchise Portal —<br>Status|Partner view of their submitted deals<br>and stage progression|Franchise<br>Partners|Design TBD|
|Franchise Partner<br>Records|Internal view of all partners,<br>agreements, fee splits, totals|Founders, Admin|Design TBD|
|Memo Editor|Rich text investment memo editor<br>linked to deal; PDF + DOCX export|Associates,<br>Founders|Design TBD|
|Marketing Calendar|Content calendar + post scheduling +<br>task assignment|All internal roles|Design TBD|
|Admin Panel|User management, role assignment,<br>system settings|Admin only|Design TBD|



## **7.4  Accessibility** 

- Keyboard navigable: Yes — all core pipeline and form flows 

- Colour contrast: WCAG AA minimum across both light and dark modes 

- Focus indicators: Required on all interactive elements 

- Screen reader: Best-effort for v1; full WCAG 2.1 AA compliance targeted for v2 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **8.  TECHNICAL CONSIDERATIONS** 

## **8.1  Development Toolchain** 

|**Tool**|**Role**|**Notes**|
|---|---|---|
|Claude Code|Lead developer / AI<br>coding agent|Handles all Next.js + Supabase implementation; use<br>CLAUDE.md for ESV brand and project context; Agent<br>SDK for complex multi-step workflows|
|Google Stitch|UI design & screen<br>generation|Generate ESV-branded screen designs from prompts;<br>export DESIGN.md + HTML to Claude Code as the<br>design spec; use Stitch MCP server for direct handoff|
|Supabase (CLI)|Backend, DB, auth,<br>storage|Use Supabase CLI for local dev, migrations, RLS<br>policies, and type generation; push to hosted Supabase<br>project for staging and production|
|Next.js (React)|Frontend framework|API routes for webhooks; SSR for performance; strong<br>Supabase + Vercel ecosystem|
|Vercel|Hosting & deployment|Native Next.js deployment; preview deployments per<br>PR for QA; environment variable management|
|Resend|Email notifications|Transactional email for assignment alerts and stage<br>change notifications|
|Twilio / WATI|WhatsApp notifications|Same triggers as email; requires WhatsApp Business<br>API template approval — initiate at kickoff|



## **Claude Code + Google Stitch Workflow** 

Recommended development workflow leveraging both tools: 

- Step 1 — Stitch: Generate screen designs per the screen inventory in Section 7.3, using ESV brand colour tokens and DESIGN.md export 

- Step 2 — Stitch → Claude Code: Export DESIGN.md from Stitch; place in project root as Claude Code context file; Claude Code uses this to maintain visual consistency across all generated components 

- Step 3 — Claude Code: Implement full Next.js app — routing, Supabase integration, RLS policies, API routes, webhook handlers, and business logic 

- Step 4 — Supabase CLI: Run supabase db push for schema migrations; supabase gen types typescript for type safety; supabase functions deploy for edge functions if needed 

- Step 5 — Iterate: Use Stitch MCP server for design updates; Claude Code picks up DESIGN.md changes and applies to components 

## **8.2  API & Integrations** 

**Integration Purpose Auth Risk / Constraint** 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|JotForm Webhook|Auto-create deal on form<br>submission|Webhook secret<br>key|Field mapping must be locked<br>— changes to JotForm schema<br>will break ingestion|
|---|---|---|---|
|Google Drive|Link/embed documents per<br>deal record|OAuth 2.0|v1 = link only; no full Drive sync;<br>user pastes Drive link into<br>document field|
|WhatsApp<br>(Twilio/WATI)|Team notifications on<br>assignment + stage<br>changes|API key +<br>approved<br>templates|Business template approval<br>required before launch —<br>initiate at kickoff|
|Email (Resend)|Same notification triggers<br>as WhatsApp fallback|API key|Low risk — standard<br>transactional email|
|Social Media APIs<br>(Meta/LinkedIn)|Schedule and publish posts<br>(marketing module)|OAuth per<br>platform|HIGH RISK: API approval<br>timelines unpredictable — stub<br>UI in v1; activate post-approval|
|LinkedIn Outreach|Track outreach status per<br>fund contact|Manual only|LinkedIn API does not expose<br>DM or connection data — no<br>live sync possible; manual<br>status flags only|



## **8.3  Data Model (High-Level)** 

Core tables in Supabase PostgreSQL: 

|**Table**|**Key Fields**|**Notes**|
|---|---|---|
|deals|id, company_name, sector, funding_stage,<br>source, referring_partner_id, assignee_id,<br>current_stage, success_fee_pct, split_pct,<br>created_at|Core deal record; fee fields<br>restricted by RLS|
|deal_stage_history|id, deal_id, from_stage, to_stage, changed_by,<br>changed_at|Immutable — no DELETE or<br>UPDATE permitted|
|deal_notes|id, deal_id, content, created_by, created_at|Rich text; multiple entries per<br>deal; timestamped|
|deal_documents|id, deal_id, file_url, file_type, file_name,<br>uploaded_by, uploaded_at|Supabase Storage URL; max<br>25MB per file|
|investors|id, fund_name, contact_name, contact_email,<br>thesis, stage_pref, cheque_size_min,<br>cheque_size_max|Investor database —<br>searchable|
|fund_outreach|id, deal_id, investor_id, status, updated_by,<br>updated_at|Status: Sent / Responded /<br>Passed / Interested|
|franchise_partners|id, name, contact_name, contact_email,<br>agreement_type, fee_split_pct|Fee split auto-populates deal<br>fee calculation|
|memos|id, deal_id, status (draft/in_review/final),<br>content_json, created_by, updated_by,<br>updated_at, version|Linked to deal; content stored<br>as structured JSON per<br>section; PDF/DOCX<br>generated on export|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## users 

id, email, role, name, franchise_partner_id Role: founder / associate / (nullable) admin / franchise_partner; managed via Supabase Auth 

## **8.4  Row-Level Security (Critical)** 

- Franchise Partners: SELECT only on deals where referring_partner_id = auth.uid() — cannot see any other deals 

- Associates: No SELECT on success_fee_pct or split_pct fields in deals table 

- Founders + Admin: Full access across all tables 

- All roles: No DELETE on deal_stage_history — enforced at DB level 

- Marketing module content: Only assigned team members can edit; all internal roles can view 

## **8.5  Technical Risks** 

|**Risk**|**Likelihood**|**Impact**|**Mitigation / Owner**|
|---|---|---|---|
|Social media API approval<br>delays|High|Medium|Stub marketing module UI at launch; activate<br>API post-approval / Dev|
|JotForm field mapping breaks<br>on form edit|Medium|High|Lock JotForm schema at launch; document<br>field-to-column mapping explicitly / Sakshay|
|WhatsApp Business template<br>approval delay|Medium|Low|Fall back to email-only notifications if delayed /<br>Dev|
|Data migration errors from<br>Sheets|Medium|High|Allocate 1 week pre-Beta for migration +<br>validation; Siddhant cross-checks record<br>counts|
|3-month timeline insufficient<br>for all 7 modules|High|High|Deprioritise marketing module to v2 if timeline<br>is at risk / Sakshay + Monica|
|LinkedIn API limitations block<br>outreach tracking|Certain|Low|Documented as manual-only in UI spec — no<br>integration attempted|
|Supabase free-tier storage<br>limits|Low|Medium|Confirm storage tier and set 25MB file size<br>cap before dev begins / Dev|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **9.  MODULE INTEGRATION & SYSTEM BEHAVIOUR** 

## **9.1  How the Modules Connect** 

Ecosystem is not a collection of standalone tools — every module shares a common data layer through Supabase, and events in one module propagate to others automatically. The deal record is the central spine of the system; most cross-module interactions either originate from or terminate on a deal record. 

_**Core principle: The deal record is the single source of truth. All modules read from and write to it. Nothing lives in isolation.**_ 

## **9.2  Cross-Module Trigger Map** 

The table below documents every automated trigger that crosses module boundaries — what fires it, what it does, and which modules are involved. 

|**Trigger**|**Source Module**|**Target Module(s)**|**Behaviour**|**User-Facing**<br>**Outcome**|
|---|---|---|---|---|
|Franchise Partner<br>submits a deal via<br>portal|Franchise<br>Portal|Deal Pipeline|Submission form POST<br>→ deal record<br>auto-created at stage<br>'New Lead'; source =<br>Franchise;<br>referring_partner_id<br>populated from logged-in<br>partner session|Deal appears in<br>pipeline<br>immediately;<br>assigned team<br>member notified;<br>partner sees<br>'Submitted —<br>Under Review' in<br>their portal|
|Deal advances to<br>a new stage|Deal Pipeline|Task Management<br>+ Activity Feed|Stage change event fires<br>→ system checks if a<br>default task template<br>exists for that stage<br>(configurable by Admin)<br>→ if yes, task<br>auto-created and<br>assigned; stage change<br>written to activity feed|Assignee<br>receives task<br>notification; deal<br>record activity<br>feed shows<br>'[User] moved<br>deal to [Stage] on<br>[Date]'|
|Deal reaches<br>'Mandate<br>Accepted' stage|Deal Pipeline|Memo Module +<br>Fund Outreach|System prompts user to<br>create investment memo;<br>memo pre-populated with<br>deal fields (company,<br>sector, stage, founder<br>contact); Fund Outreach<br>tab on deal record<br>becomes active|Memo editor<br>opens pre-filled;<br>Fund Outreach<br>tab unlocks for<br>outreach tracking;<br>both linked to<br>deal record|
|Memo created<br>from deal record|Memo Module|Deal Pipeline|On memo creation, deal<br>fields (company name,|User sees<br>pre-filled memo|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

||||sector, funding stage,<br>founder contact,<br>financials summary)<br>auto-populate memo<br>template sections; memo<br>status set to Draft; deal<br>record shows memo tab<br>as active|ready for editing;<br>deal record<br>shows 'Memo:<br>Draft' status<br>badge|
|---|---|---|---|---|
|Fund outreach<br>status updated<br>(any fund)|Fund Outreach|Deal Pipeline +<br>Activity Feed|Status flag change (Sent<br>/ Responded / Passed /<br>Interested) writes event<br>to deal activity feed; deal<br>record outreach<br>summary badge updates<br>to reflect count of<br>interested funds|Deal card on<br>Kanban shows<br>outreach<br>progress<br>indicator; activity<br>feed shows<br>'[User] marked<br>[Fund] as<br>Interested on<br>[Date]'|
|Deal moved to<br>'Closed —<br>Success'|Deal Pipeline|Success Fee<br>Tracker + Activity<br>Feed|Stage change to<br>Closed-Success triggers<br>system prompt for<br>success fee entry;<br>referring_partner_id<br>checked — if present, fee<br>split auto-calculated from<br>franchise agreement;<br>close event written to<br>activity feed and Founder<br>dashboard|Success fee<br>modal appears;<br>ESV share and<br>partner share<br>calculated; deal<br>card moves to<br>Closed column;<br>Founder<br>dashboard deal<br>count updates|
|Marketing content<br>task created|Marketing /<br>Content Ops|Task Management|Any content task<br>assigned to a team<br>member in the marketing<br>calendar auto-creates a<br>corresponding task<br>record in the Task<br>module with the same<br>assignee, due date, and<br>priority|Team member<br>sees the content<br>task in their<br>unified task list<br>alongside<br>deal-linked tasks;<br>one inbox for all<br>assigned work|
|Task marked as<br>complete|Task<br>Management|Deal Pipeline (if<br>task is<br>deal-linked) +<br>Activity Feed|If task has a deal_id,<br>completion event written<br>to that deal's activity<br>feed; deal record shows<br>task as resolved|Deal activity feed<br>shows '[User]<br>completed task:<br>[Task Title] on<br>[Date]'; deal-level<br>task count badge<br>updates|



## **9.3  The Deal Record Activity Feed** 

Every module writes events to a single, chronological activity feed on the deal record. This is the primary way the team understands what has happened on a deal without asking anyone. 

**Event Type Written By Feed Entry Format** 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Stage change|Deal Pipeline|[User] moved deal to [Stage] · [Date/Time]|
|---|---|---|
|Note added|Deal Pipeline|[User] added a call note · [Date/Time]|
|Document uploaded|Deal Pipeline|[User] uploaded [filename] · [Date/Time]|
|Memo created|Memo Module|[User] created investment memo (Draft) · [Date/Time]|
|Memo status changed|Memo Module|[User] marked memo as [Status] · [Date/Time]|
|Fund outreach updated|Fund Outreach|[User] marked [Fund Name] as [Status] · [Date/Time]|
|Task created (auto)|Task Management|Task auto-created: [Task Title] → assigned to [User] ·<br>[Date/Time]|
|Task completed|Task Management|[User] completed task: [Task Title] · [Date/Time]|
|Success fee logged|Deal Pipeline|[User] logged success fee · [Date/Time] — visible to<br>Founders + Admin only|
|Franchise submission|Franchise Portal|Deal submitted by [Partner Name] · [Date/Time]|
|Assignee changed|Deal Pipeline|[User] assigned deal to [User] · [Date/Time]|



## **9.4  Module Dependency Map** 

The diagram below shows which modules depend on other modules for data, and in which direction data flows at a system level. 

|**Module**|**Reads From**|**Writes To**|**Dependency Notes**|
|---|---|---|---|
|Deal Pipeline|JotForm (webhook),<br>Franchise Portal, Users|Activity Feed, Stage<br>History, Notifications|Central hub — all other<br>modules reference deal<br>records|
|Franchise Portal|Users (partner accounts),<br>Franchise Partner<br>records|Deal Pipeline (new deal<br>records)|One-directional at<br>submission; reads back deal<br>stage for status display|
|Memo Module|Deal Pipeline (deal fields)|Deal Pipeline (memo<br>status badge), Activity<br>Feed|Cannot exist without a deal<br>record; reads deal data on<br>creation|
|Fund Outreach|Investor Database, Deal<br>Pipeline (deal records)|Deal Pipeline (outreach<br>summary), Activity Feed|Requires investor DB to be<br>populated; tied to deal at<br>mandate stage|
|Task Management|Deal Pipeline (deal IDs),<br>Users, Marketing<br>Calendar|Deal Pipeline (activity<br>feed, task count)|Tasks exist independently OR<br>linked to deals; marketing<br>tasks sync here|
|Marketing /<br>Content Ops|Users|Task Management<br>(content tasks)|Lightest dependency —<br>mainly writes tasks; no deal<br>linkage|
|Reporting /<br>Dashboard|Deal Pipeline, Tasks,<br>Fund Outreach,<br>Franchise Portal, Memos|Nothing (read-only<br>aggregate)|Pure consumer — reads from<br>all modules; writes nothing|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Admin Panel|Users, Franchise Partner<br>records|Users, Role<br>assignments, Theme<br>preferences|System-level; affects access<br>across all modules via RLS|
|---|---|---|---|



## **9.5  Shared Data Entities** 

These entities are created once and referenced across multiple modules — they must be consistent and never duplicated: 

|**Entity**|**Created In**|**Referenced By**|**Uniqueness Rule**|
|---|---|---|---|
|Deal Record|Deal Pipeline (manual or<br>JotForm/Franchise<br>webhook)|Memo, Fund Outreach,<br>Tasks, Activity Feed,<br>Dashboard|One record per company<br>per active raise;<br>duplicates flagged|
|User|Admin Panel (Supabase<br>Auth)|All modules (assignee,<br>created_by, updated_by<br>fields)|One account per person;<br>role determines access<br>across all modules|
|Franchise Partner|Admin Panel|Franchise Portal (login), Deal<br>Pipeline<br>(referring_partner_id), Fee<br>tracking|One record per partner<br>firm; linked to portal login<br>account|
|Investor (Fund)|Investor Database|Fund Outreach (per-deal<br>status)|One record per fund;<br>shared across all deals|
|Task|Task Management or<br>auto-created on stage<br>change|Deal Pipeline (activity feed),<br>Marketing (content tasks)|Tasks are unique<br>records; deal_id is<br>optional foreign key|
|Memo|Memo Module (from deal<br>record)|Deal Pipeline (status badge,<br>activity feed)|One active memo per<br>deal at a time; prior<br>versions archived|



## **9.6  Notification Routing** 

Notifications are triggered by cross-module events and routed to the relevant user via email and/or WhatsApp depending on the event type and user preference. 

|**Event**|**Who Gets Notified**|**Channel**|**Configurable?**|
|---|---|---|---|
|Deal assigned to user|Assigned user|Email +<br>WhatsApp|Yes — per user preference|
|Stage change on deal I own|Assignee|Email|Yes|
|Franchise Partner submits a<br>new deal|All Associates +<br>Founders|Email|Yes — role-level setting|
|Task assigned to me|Assigned user|Email +<br>WhatsApp|Yes|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Task overdue (past due date)|Assigned user +<br>Founders|Email|Yes|
|---|---|---|---|
|Memo status changed to Final|Founders + deal<br>assignee|Email|No — always on|
|Fund marked as Interested|Deal assignee +<br>Founders|Email|Yes|
|Deal closed — success fee<br>prompt|Deal assignee|In-app only|No — always on|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **10.  DATABASE & SMART MATCHING** 

## **10.1  Overview** 

The Ecosystem database is more than a contact list — it is a structured, tagged registry of every entity ESV has relationships with. By attaching structured tags to both entities in the database and deals in the pipeline, Ecosystem can automatically surface the most relevant investors, co-investors, potential partners, and advisors for any given deal. This replaces the manual process of scanning the investor database sheet and applying judgment deal-by-deal. 

## **10.2  Entity Types** 

The database holds eight distinct entity types, each with its own field set and tag taxonomy: 

|**Entity Type**|**Primary Use in Ecosystem**|**Matched Against Deals For**|
|---|---|---|
|Funds / VCs|Primary outreach targets for<br>mandated deals|Investment outreach list|
|Angel investors|Individual cheque writers for<br>early-stage deals|Investment outreach list|
|Family offices|Larger ticket investors with longer<br>decision cycles|Investment outreach list|
|Strategic / corporate<br>investors|Industry-aligned investors who add<br>operational value|Investment outreach list + partnership<br>intros|
|Co-investors (other<br>VCs)|Syndication partners for deals ESV<br>wants to co-lead or fill|Co-investment syndication list|
|Portfolio founders|Founders from ESV's existing<br>portfolio; potential customers,<br>partners, or references|Partnership / intro list|
|Potential acquirers|Corporates or strategics who may<br>acquire the startup at exit|M&A / exit strategy outreach|
|Advisors / mentors|Domain experts who can add value<br>to a specific deal or portfolio<br>company|Advisor intro list|



## **10.3  Tag Taxonomy** 

Every entity in the database is tagged across six dimensions. These same tag dimensions are applied to deal records, enabling like-for-like matching: 

**Tag Dimension Examples Applied To** 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Sector / industry|Fintech, CleanTech, SaaS, D2C,<br>HealthTech, EdTech, AgriTech,<br>Logistics|All entity types + deals|
|---|---|---|
|Stage preference|Pre-seed, Seed, Series A, Series B,<br>Growth|Funds, Angels, Family Offices + deals|
|Revenue model|B2B, B2C, D2C, Marketplace, SaaS,<br>Transactional|All entity types + deals|
|Thesis keywords|Sustainability, AI/ML, India-first, GCC,<br>Climate, Consumer brands, Deep Tech|All entity types + deals|
|Past co-investment|Names of co-investors on prior deals —<br>used to surface syndication familiarity|Funds, Angels, Co-investors|
|Relationship status|Warm (met in person / active comms),<br>Lukewarm (introduced / occasional),<br>Cold (no prior contact)|All entity types|



## **10.4  Smart Matching Logic** 

When a deal reaches the 'Mandate Accepted' stage, Ecosystem runs a match against the full database and returns a ranked list of entities whose tags overlap with the deal's tags. The match is AI-ranked first, then user-filterable. 

|**Match Dimension**|**Weight**|**Logic**|
|---|---|---|
|Sector tag overlap|High|Entity sector tags ∩ deal sector tags — more overlapping tags<br>= higher score|
|Stage preference match|High|Entity stage preference includes deal's current funding stage|
|Thesis keyword overlap|High|Entity thesis keywords ∩ deal thesis keywords — semantic<br>match, not exact string|
|Revenue model match|Medium|Entity revenue model preference matches deal's revenue<br>model|
|Relationship status|Medium|Warm contacts ranked above Lukewarm; Cold contacts ranked<br>last|
|Past co-investment|Low|Entities who have co-invested with ESV previously get a boost|
|Geography preference|Tiebreaker|India / GCC preference matched against deal's operating<br>geography|



The resulting ranked list is presented in three tabs on the deal's Fund Outreach screen: 

- Investors — ranked list of Funds, Angels, Family Offices, and Strategics to pitch the deal to 

- Co-investors — ranked list of other VCs / co-investors for syndication 

- Partnerships & Intros — ranked list of portfolio founders, advisors, and strategics for non-investment value-add 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **10.5  Functional Requirements — Database & Matching** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|DB-0<br>1|Entity records for all 8 entity types with<br>type-specific field sets|Must Have|Each entity type has its own<br>create/edit form; field sets differ<br>per type|
|DB-0<br>2|Tag assignment across all 6 dimensions per<br>entity|Must Have|Tags selectable from a predefined<br>taxonomy + free-text custom tags;<br>multi-select|
|DB-0<br>3|Deal tagging across all 6 dimensions on<br>deal record|Must Have|Tags set on deal record at or<br>before Mandate Accepted stage|
|DB-0<br>4|AI-ranked match list generated when deal<br>reaches Mandate Accepted|Must Have|Match runs automatically on stage<br>change; result cached on deal<br>record; refreshable manually|
|DB-0<br>5|Matched results presented in 3 tabs:<br>Investors, Co-investors, Partnerships|Must Have|Each tab shows ranked list with<br>entity name, type, match score,<br>relationship status, and contact|
|DB-0<br>6|User can filter matched results by tag<br>dimension|Must Have|Filter panel on match results: by<br>sector, stage, relationship status,<br>geography|
|DB-0<br>7|One-click add to outreach list from match<br>results|Must Have|Entities selected from match<br>results added to deal's fund<br>outreach tracker with status<br>'Pending'|
|DB-0<br>8|Relationship status field per entity (Warm /<br>Lukewarm / Cold)|Must Have|Status editable on entity record;<br>affects match ranking; updated<br>manually by team|
|DB-0<br>9|Past co-investment field — link entity<br>records to prior ESV deals|Should Have|Admin can tag which entities have<br>co-invested on prior ESV deals;<br>used in match scoring|
|DB-1<br>0|Entity record shows all deals they have been<br>outreached for|Should Have|History tab on entity record shows<br>all deals, outreach status, and<br>outcome per deal|
|DB-1<br>1|Global database search with tag-based<br>filtering (independent of deal matching)|Should Have|Search bar + filter panel on<br>database home; results update in<br>real time|
|DB-1<br>2|Bulk import of entities via CSV|Could Have|CSV upload with field mapping;<br>duplicate detection on name +<br>email|



## **10.6  Matching — Technical Approach** 

- Tag overlap scoring: weighted sum of matching tags across dimensions; computed server-side in a Supabase Edge Function triggered on stage change 

- Thesis keyword matching: semantic similarity using embeddings (pgvector extension in Supabase PostgreSQL) — allows 'climate tech' to match 'sustainability' and 'green energy' without exact string match 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

- Match results stored as a JSONB column on the deal record (cached_match_results); refreshed on manual trigger or when deal tags change 

- AI ranking: Claude API called with deal profile + top-N tag-matched entities to produce a final ranked list with a short rationale per entity — displayed as a match reason tooltip on the results list 

- Performance target: match list generated or refreshed in < 5 seconds for a database of up to 2,000 entities 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **11.  DATA PRIVACY & DPDP ACT COMPLIANCE** 

## **11.1  Regulatory Context** 

Earlyseed Ventures, as the operator of Ecosystem, is a Data Fiduciary under the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Digital Personal Data Protection Rules, 2025 (DPDP Rules), notified by MeitY on 13 November 2025. Full compliance with consent, privacy notice, and security requirements is mandatory by 13 May 2027. ESV must be compliant at launch — building in compliance from day one is the only responsible approach. 

_Disclaimer: This section is a product requirements specification, not legal advice. Earlyseed Ventures should obtain independent legal counsel to verify DPDP compliance before launch._ 

## **11.2  Data Principals Covered** 

The following individuals' personal data is collected and processed by Ecosystem. Each is a Data Principal with full rights under the DPDP Act: 

|**Data Principal**|**Personal Data Collected**|**Purpose of Processing**|**Legal Basis**|
|---|---|---|---|
|Startup founders (deal<br>contacts)|Name, email, phone,<br>company, LinkedIn, financial<br>data shared voluntarily|Deal evaluation, fundraise<br>mandate execution, investor<br>outreach|Consent —<br>obtained at<br>JotForm<br>submission and<br>deal intake|
|Fund managers /<br>investors|Name, email, phone, fund<br>name, thesis, investment<br>history|Investment outreach,<br>syndication, deal matching|Consent —<br>obtained when<br>entity record is<br>created or on<br>first contact|
|Portfolio company<br>contacts|Name, email, phone,<br>company, update data|Portfolio monitoring, ESV<br>reporting|Consent —<br>obtained at<br>onboarding of<br>portfolio<br>company|



## **11.3  DPDP Obligations & Platform Implementation** 

|**Obligation**|**DPDP**<br>**Reference**|**How Ecosystem Implements It**|
|---|---|---|
|Consent before data<br>collection|Section 4 +<br>Rule 3|Consent checkbox on JotForm (founder intake); consent<br>prompt shown to fund managers when their record is first<br>created or when first contacted; no record created without<br>consent logged|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Privacy notice in plain<br>language|Section 5 +<br>Rule 3|Privacy notice shown at consent capture; states: what data is<br>collected, the purpose, how to exercise rights, and ESV contact<br>for complaints; available in English; accessible from all entry<br>points|
|---|---|---|
|Purpose limitation|Section 5|Data collected for stated purpose only; deal data used only for<br>ESV deal operations; investor data used only for deal matching<br>and outreach; no sale or sharing with third parties outside ESV<br>mandate|
|Right to access|Section 11|Data principals can submit an access request via in-app form<br>(Settings > Privacy > Request My Data); ESV must respond<br>within 30 days; response provides a summary of all personal<br>data held|
|Right to correction|Section 12|Data principals can request correction of inaccurate data via<br>in-app form; ESV team reviews and updates record within 14<br>days; requester notified on completion|
|Right to erasure|Section 13|Data principals can request deletion via in-app form; data<br>erased within 30 days unless ESV has a lawful retention<br>obligation (e.g. active mandate agreement); requester notified<br>on completion; audit log of erasure retained|
|Data retention &<br>auto-deletion|Rule 8|Deal contact data retained for duration of active deal + 3 years<br>post-close; investor data retained while relationship is active +<br>2 years of inactivity; auto-deletion job runs monthly; 48-hour<br>erasure notice sent to data principal before scheduled deletion|
|Data breach<br>notification|Section 8 +<br>Rule 7|On detection of any breach: affected data principals notified<br>without delay in plain language (what happened, impact, steps<br>taken, ESV contact); detailed report submitted to Data<br>Protection Board within 72 hours|
|Grievance mechanism|Section 13 +<br>Rules|Dedicated in-app grievance form (Settings > Privacy > Submit<br>Grievance); all grievances addressed within 90 days; contact<br>details for ESV's designated privacy officer published in-app<br>and in the privacy policy|



## **11.4  Functional Requirements — DPDP Compliance** 

|**ID**|**Requirement**|**Priority**|**Acceptance Criteria**|
|---|---|---|---|
|DPDP-0<br>1|Consent capture on JotForm —<br>checkbox with plain-language notice<br>before data is submitted|Must Have|Form cannot be submitted without<br>consent checked; consent<br>timestamp + IP logged|
|DPDP-0<br>2|Consent capture for fund manager /<br>investor records — prompt shown on<br>first record creation|Must Have|Record cannot be saved without<br>consent logged; consent status<br>visible on entity record|
|DPDP-0<br>3|Privacy notice accessible from all entry<br>points (JotForm, login screen, settings)|Must Have|Privacy notice URL present on<br>JotForm footer, Ecosystem login<br>page, and Settings > Privacy|
|DPDP-0<br>4|In-app privacy policy page (Settings ><br>Privacy > Privacy Policy)|Must Have|Page renders current privacy policy<br>in plain language; version-controlled;<br>date-stamped|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|DPDP-0<br>5|In-app data handling policy page<br>(Settings > Privacy > Data Handling<br>Policy)|Must Have|Page covers retention periods,<br>deletion schedule, security<br>measures, and third-party<br>processors|
|---|---|---|---|
|DPDP-0<br>6|Right to access — in-app request form|Must Have|Form in Settings > Privacy ><br>Request My Data; request logged<br>with timestamp; ESV notified;<br>response sent within 30 days|
|DPDP-0<br>7|Right to correction — in-app request<br>form|Must Have|Form in Settings > Privacy > Correct<br>My Data; linked to specific record;<br>team notified; completed within 14<br>days|
|DPDP-0<br>8|Right to erasure — in-app request form|Must Have|Form in Settings > Privacy > Delete<br>My Data; triggers review workflow;<br>deletion within 30 days unless lawful<br>hold; requester notified|
|DPDP-0<br>9|Consent withdrawal mechanism|Must Have|Data principal can withdraw consent<br>via in-app form; withdrawal triggers<br>erasure workflow unless lawful basis<br>for retention exists|
|DPDP-1<br>0|Auto-deletion job — monthly scheduled<br>run|Must Have|Supabase cron job identifies records<br>past retention period; sends 48-hour<br>notice; deletes on schedule; logs<br>deletion event|
|DPDP-1<br>1|Breach notification workflow|Must Have|Admin can trigger breach notification<br>from Admin Panel; auto-generates<br>plain-language notice to affected<br>principals; 72-hour Board report<br>template provided|
|DPDP-1<br>2|In-app grievance submission form|Must Have|Form in Settings > Privacy > Submit<br>Grievance; logged with timestamp;<br>ESV privacy officer notified; 90-day<br>SLA tracked|
|DPDP-1<br>3|Consent log — immutable audit table|Must Have|Every consent event (given,<br>withdrawn, updated) logged with<br>timestamp, data principal identifier,<br>and IP; no deletion permitted|
|DPDP-1<br>4|Purpose limitation enforcement — no<br>secondary use flag|Should Have|System flag on entity records<br>prevents data from being used<br>outside stated purpose; configurable<br>by Admin|
|DPDP-1<br>5|External privacy policy document (PDF)<br>— linked from in-app and JotForm|Must Have|PDF version of privacy policy<br>available for download; matches<br>in-app version; updated in sync|



## **11.5  Data Storage & Security** 

- All personal data stored in Supabase PostgreSQL hosted on AWS (Mumbai region — ap-south-1) to ensure data residency within India 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

- Encryption at rest: AES-256 (Supabase default); encryption in transit: TLS 1.2+ 

- Row-level security enforced at database layer — no user can access another data principal's personal data outside their authorised scope 

- File attachments (pitch decks, financials) stored in Supabase Storage with private bucket — no public URLs; pre-signed URLs with 1-hour expiry for in-app access 

- Supabase project access restricted to authorised ESV personnel only; developer access audited 

- Consent logs and stage history logs stored in append-only tables — no UPDATE or DELETE permitted at any role level 

## **11.6  Third-Party Data Processors** 

Earlyseed Ventures must ensure contractual data processing agreements are in place with all third-party processors before launch: 

|**Processor**|**Data Shared**|**Purpose**|**Agreement Required**|
|---|---|---|---|
|Supabase|All personal data (stored<br>in DB and file storage)|Database, auth, storage<br>infrastructure|Supabase Data Processing<br>Agreement (DPA) —<br>available in Supabase<br>dashboard|
|Vercel|Request metadata,<br>server-side logs (no<br>personal data in logs by<br>default)|Hosting and deployment|Vercel DPA — available on<br>Vercel website|
|Resend|Name, email address of<br>notification recipients|Transactional email<br>notifications|Resend DPA — must be<br>executed before launch|
|Twilio / WATI|Name, phone number of<br>WhatsApp notification<br>recipients|WhatsApp notifications|Twilio DPA — must be<br>executed before launch|
|Anthropic (Claude<br>API)|Deal profile data and<br>entity tags (for match<br>ranking)|AI-powered match<br>ranking in Database<br>module|Anthropic API Terms of<br>Service + DPA — review zero<br>data retention options|



## **11.7  Compliance Timeline** 

|**Milestone**|**Target**|**Owner**|
|---|---|---|
|Legal counsel engaged for DPDP<br>review|Before dev kickoff|Monica|
|Privacy policy and data handling policy<br>drafted (external legal doc)|Week 2|Monica + Legal|
|Consent capture implemented on<br>JotForm and entity creation|Alpha build (Week 6)|Dev|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|In-app privacy and data handling policy<br>pages live|Alpha build (Week 6)|Dev|
|---|---|---|
|All DPDP-01 to DPDP-13 requirements<br>implemented and tested|Beta launch (Week 10)|Dev + Siddhant|
|Third-party DPAs executed (Supabase,<br>Resend, Twilio, Anthropic)|Before Beta launch|Monica|
|Full DPDP compliance audit against<br>DPDP Rules 2025|Before GA (Week 13)|Legal|
|Full compliance mandatory deadline<br>(MeitY)|13 May 2027|Monica|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **12.  MICROTOOLS** 

## **12.1  Overview** 

Microtools are lightweight, focused utility modules that sit within Ecosystem and serve a specific high-frequency job. They are not full modules — they open as panels, drawers, or floating windows and require minimal context to use. Each microtool is accessible from the relevant module screen and from a global quick-launch shortcut. 

## **Microtool 1 — Call Note Structurer** 

Takes raw, unstructured call notes (typed live or pasted post-call) and returns a clean, structured summary in a consistent ESV format. Eliminates the effort of reformatting notes before filing them to a deal record. 

|**Attribute**|**Detail**|
|---|---|
|Access|From deal record Notes tab → 'Structure my notes' button; also accessible from<br>global quick-launch|
|Input|Free-text paste area — accepts messy bullet points, stream-of-consciousness<br>notes, or pasted AI transcripts|
|Output structure|Sections: (1) Company snapshot, (2) Key discussion points, (3) Founder's ask, (4)<br>Concerns / red flags, (5) Agreed next steps, (6) Follow-up owner + deadline|
|Processing|Claude API (claude-sonnet-4-6); prompt instructs model to extract and reformat<br>only — no fabrication; output shown in preview before saving|
|Save behaviour|User reviews structured output → clicks Save → appended as a new timestamped<br>note entry on the deal record; raw input discarded unless user chooses to keep<br>both|
|Edge case|If input is too short or ambiguous, model returns a clarification prompt rather than<br>a half-structured output|



|**ID**|**Requirement**|**Priority**|
|---|---|---|
|MT-0<br>1|Raw text input area with paste support (min 50 chars, max 10,000 chars)|Must Have|
|MT-0<br>2|Claude API call returns structured output in defined 6-section format|Must Have|
|MT-0<br>3|Preview pane showing structured output before save|Must Have|
|MT-0<br>4|Save appends to deal record notes as timestamped entry|Must Have|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|MT-0<br>5|Option to keep or discard raw input alongside structured output|Should Have|
|---|---|---|
|MT-0<br>6|Loading state with spinner during API call (target: < 8 seconds)|Must Have|



## **Microtool 2 — Pitch Deck Ingestion Engine** 

Accepts an uploaded pitch deck (PDF) and extracts structured data to auto-fill relevant sections of the investment memo. Saves the Associates 30–60 minutes of manual memo drafting per deal. 

|**Attribute**|**Detail**|
|---|---|
|Access|From deal record Memo tab → 'Import from pitch deck' button; or from document<br>upload on deal record|
|Input|PDF upload (max 25MB); must be a pitch deck — other document types will<br>return a warning|
|Extraction targets|Company name, sector, problem statement, solution, market size, business<br>model, revenue model, traction metrics, team bios, funding ask + use of funds|
|Output|Extracted data mapped to corresponding memo sections; user sees a<br>side-by-side view: extracted data on left, memo section on right; user accepts,<br>edits, or rejects each field individually|
|Processing|Claude API with document vision (PDF passed as base64); structured JSON<br>extraction prompt; each extracted field has a confidence indicator (High / Medium<br>/ Low)|
|Data not found|If a section is missing from the deck (e.g. no traction slide), the memo field is left<br>blank with a 'Not found in deck' tag — never fabricated|
|Save behaviour|User reviews all extracted fields → clicks 'Apply to memo' → accepted fields<br>populate memo; rejected fields remain blank for manual entry|



|**ID**|**Requirement**|**Priority**|
|---|---|---|
|MT-0<br>7|PDF upload with 25MB size limit and file type validation|Must Have|
|MT-0<br>8|Claude API extracts structured data across 10 defined fields|Must Have|
|MT-0<br>9|Confidence indicator (High / Medium / Low) per extracted field|Should Have|
|MT-1<br>0|Side-by-side review: extracted data vs memo section|Must Have|
|MT-1<br>1|Per-field accept / edit / reject before applying to memo|Must Have|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|MT-1<br>2|'Not found in deck' tag on missing sections — no fabrication|Must Have|
|---|---|---|
|MT-1<br>3|Processing time target: < 30 seconds for a standard 20-slide deck|Must Have|



## **Microtool 3 — CCPS Deal Structure Calculator** 

A live, interactive deal modelling panel designed to stay open during deal discussions. Changes to any assumption instantly recalculate all outputs — no spreadsheet, no waiting. Supports CCPS, SAFE notes, convertible notes, plain equity rounds, anti-dilution provisions, and liquidation preferences. 

|**Attribute**|**Detail**|
|---|---|
|Access|Global quick-launch (pinnable to any screen); also accessible from deal record →<br>'Open calculator' button|
|Instruments|CCPS, SAFE notes, Convertible notes, Plain equity (ordinary shares), with toggle<br>to switch between structures|
|Input parameters — all<br>deals|Pre-money valuation, investment amount, existing cap table (founder %, ESOP %,<br>prior investors %), new investor %|
|Input parameters —<br>CCPS|Coupon rate, conversion ratio, conversion trigger (IPO / next round / date),<br>preference multiple, participating vs non-participating|
|Input parameters —<br>SAFE / convertible|Valuation cap, discount rate, interest rate (convertible only), conversion trigger<br>event|
|Input parameters —<br>anti-dilution|Type (full ratchet / broad-based weighted average / narrow-based), down-round<br>scenario valuation|
|Input parameters —<br>liquidation preference|Preference multiple (1x / 1.5x / 2x), participating cap, seniority stack order|
|Outputs — always<br>visible|Post-money valuation, new investor %, founder dilution %, ESOP dilution %, fully<br>diluted cap table, ESV carry / fee implication|
|Outputs — exit<br>scenarios|Exit waterfall at 3 user-defined exit values: each stakeholder's payout, return<br>multiple (MOIC), IRR estimate|
|Recalculation|All outputs recalculate on every keystroke — no submit button; < 100ms target for<br>recalculation|
|Save / export|Snapshot of current assumptions + outputs saveable to deal record as a named<br>scenario (e.g. 'Scenario A — ₹5Cr CCPS'); multiple scenarios saved and<br>compared side-by-side; exportable as PDF|



|**ID**|**Requirement**|**Priority**|
|---|---|---|
|MT-1<br>4|Instrument toggle: CCPS / SAFE / Convertible / Equity|Must Have|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|MT-1<br>5|Real-time recalculation of all outputs on every input change (< 100ms)|Must Have|
|---|---|---|
|MT-1<br>6|Post-money valuation, dilution table, and fully diluted cap table always<br>visible|Must Have|
|MT-1<br>7|Exit waterfall at 3 user-defined exit values with per-stakeholder payout|Must Have|
|MT-1<br>8|Anti-dilution modelling (full ratchet + broad-based WA)|Must Have|
|MT-1<br>9|Liquidation preference modelling with participating cap and seniority stack|Must Have|
|MT-2<br>0|Save named scenario to deal record|Must Have|
|MT-2<br>1|Side-by-side scenario comparison (up to 3 saved scenarios)|Should Have|
|MT-2<br>2|Export scenario as PDF (assumptions + outputs + cap table)|Should Have|
|MT-2<br>3|Pinnable panel — stays open across screen navigation|Should Have|



## **Microtool 4 — In-App Messaging & Deal Comments** 

Two-layer communication system: direct messages between users (replacing WhatsApp for internal coordination), and deal-specific comment threads (replacing email chains about specific deals). Both support @mentions and deal/stage references. 

|**Attribute**|**Detail**|
|---|---|
|Layer 1 — DMs|Direct messages between any two internal users; persistent conversation history;<br>accessible from global inbox icon; unread count badge on nav|
|Layer 2 — Deal<br>comments|Each deal record has a Comments tab; threaded discussion visible to all internal<br>users assigned to or watching the deal; Franchise Partners cannot see internal<br>comments|
|@mentions|@user mentions send a notification to the mentioned user (in-app + email);<br>@deal-name creates a clickable reference to that deal record from within any<br>message or comment|
|Stage references|#stage-name (e.g. #mandate-accepted) creates a clickable reference to that<br>pipeline stage filter — useful for contextual handoffs|
|Notifications|Unread DMs and unread deal comments shown in a unified inbox; email<br>notification for @mentions; configurable per user|
|Attachments|Files up to 10MB attachable to DMs and comments; stored in Supabase Storage;<br>linked to the message, not the deal record directly|
|Retention|DM history retained for 2 years; deal comment history retained for the lifetime of<br>the deal record + 3 years post-archive|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

Access control 

DMs: internal users only; deal comments: internal users only (Franchise Partners excluded); Admin can view all DMs for compliance purposes 

|**ID**|**Requirement**|**Priority**|
|---|---|---|
|MT-2<br>4|DM thread between any two internal users; persistent history|Must Have|
|MT-2<br>5|Deal Comments tab on every deal record; threaded replies|Must Have|
|MT-2<br>6|@user mention with in-app + email notification|Must Have|
|MT-2<br>7|@deal-name reference creates clickable link to deal record|Must Have|
|MT-2<br>8|#stage-name reference creates clickable pipeline filter link|Should Have|
|MT-2<br>9|Unified inbox showing unread DMs and deal comment notifications|Must Have|
|MT-3<br>0|File attachments in DMs and comments (max 10MB per file)|Should Have|
|MT-3<br>1|Real-time message delivery using Supabase Realtime|Must Have|
|MT-3<br>2|Admin view of all DM history (compliance access)|Should Have|



## **Microtool 5 — HR Tool** 

A lightweight internal HR module for the ESV team. Handles the four most frequent HR touchpoints — travel reimbursements, expense claims, leave tracking, and employee document storage — without requiring an external HR tool. 

|**Sub-feature**|**Detail**|
|---|---|
|Travel reimbursement|Employee submits request: trip purpose, date, destination, expense breakdown,<br>receipt uploads (PDF/JPG); Founder or Admin approves or rejects with a<br>comment; approved requests tracked with payment status (Pending / Paid)|
|Expense claims<br>(non-travel)|Same flow as travel but for miscellaneous expenses (client entertainment, office<br>supplies, etc.); category tags required on submission|
|Holiday / leave tracking|Employee submits leave request: type (annual / sick / casual / WFH), dates,<br>notes; Founder or Admin approves; team calendar view shows who is on leave on<br>any given day; leave balance tracked per employee per leave type|
|Document storage|Secure per-employee document vault: offer letter, employment contract, NDA, ID<br>proofs, PAN, Aadhaar; uploaded by Admin at onboarding; accessible to the<br>employee and Admin/Founder only; never visible to peers|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|**ID**|**Requirement**|**Priority**|
|---|---|---|
|MT-3<br>3|Travel reimbursement request form with receipt upload|Must Have|
|MT-3<br>4|Expense claim form with category tagging|Must Have|
|MT-3<br>5|Approval workflow for reimbursements and claims (Founder / Admin<br>approves)|Must Have|
|MT-3<br>6|Payment status tracking on approved claims (Pending / Paid)|Must Have|
|MT-3<br>7|Leave request form with leave type selection|Must Have|
|MT-3<br>8|Leave approval workflow|Must Have|
|MT-3<br>9|Leave balance tracker per employee per leave type|Must Have|
|MT-4<br>0|Team calendar view showing approved leave by date|Should Have|
|MT-4<br>1|Per-employee document vault with role-based access (employee +<br>Admin/Founder only)|Must Have|
|MT-4<br>2|Document upload with file type validation (PDF, JPG, PNG)|Must Have|
|MT-4<br>3|DPDP compliance: employee documents covered by data handling policy;<br>erasure request supported|Must Have|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **13.  DEVELOPMENT SPRINT PLAN — TOKEN-EFFICIENT BUILD** 

## **13.1  Sprint Philosophy** 

Ecosystem is a large, multi-module build. The single biggest risk when using Claude Code as the lead developer is context window bloat — loading the entire codebase into every session burns tokens rapidly and degrades output quality as the window fills. This sprint plan is designed around three principles: 

- Vertical slices, not horizontal layers — each sprint day ships a complete, working feature end-to-end (DB schema + API + UI) rather than building all schemas first, then all APIs, then all UIs. This keeps each session focused and context-lean. 

- One module per session — each Claude Code session opens only the files relevant to the module being built that day. CLAUDE.md uses tiered skill loading: global conventions always loaded, module-specific context loaded on demand. 

- Compact and clear after each session — run /compact before ending any session; commit and push before closing; never carry stale context into the next day's session. 

|**Principle**|**Claude Code Implementation**|
|---|---|
|Tiered CLAUDE.md|Global CLAUDE.md: ESV brand tokens, Supabase config, RLS rules template,<br>naming conventions only (~300 tokens). Module-specific CLAUDE.md files in<br>/modules/[name]/CLAUDE.md loaded on demand — not at session start.|
|Stitch DESIGN.md first|Run Stitch to generate all screen designs and export DESIGN.md before dev<br>begins. Claude Code reads DESIGN.md at session start for the relevant<br>module — not the entire design system.|
|/compact aggressively|Run /compact whenever the session exceeds ~60% context usage. Do not let<br>context fill — performance degrades sharply above 80%.|
|One PR per day|Each sprint day ends with a clean, reviewed PR. Next day starts fresh from<br>main — no accumulated context debt.|
|Sonnet for build, Opus<br>for architecture|Use claude-sonnet-4-6 for all implementation (80% of sessions). Switch to<br>claude-opus-4-6 only for: initial schema design, RLS policy review, and match<br>algorithm architecture.|
|Sub-agents for parallel<br>work|Use Claude Code sub-agents for tasks that can run in parallel: e.g. build<br>Supabase schema in one agent while another scaffolds the Next.js route<br>structure.|



## **13.2  Pre-Sprint Setup (Before Week 1, Day 1)** 

Complete these once before the sprint begins — they are not part of the daily token budget: 

- Stitch: Generate all screens from Section 7.3 screen inventory; export DESIGN.md and place in project root 

- Supabase CLI: supabase init; create project on Supabase dashboard; configure local dev environment 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

- Next.js: npx create-next-app@latest ecosystem --typescript --tailwind; configure Supabase client 

- Global CLAUDE.md written: ESV colour tokens, Supabase project ref, naming conventions, RLS template, file structure 

- Module-specific CLAUDE.md stubs created in /modules/[name]/ for all modules — filled in as each module is built 

- Vercel project created and linked; environment variables configured 

- JotForm: field mapping document written — exported to /docs/jotform-field-map.md 

## **13.3  Week 1 Sprint — Core Pipeline (Weeks 1–2 of build)** 

This is the Alpha sprint. Goal: ship the deal pipeline end-to-end so Monica, Sakshay, and Siddhant can use it within 2 weeks. Everything else builds on this foundation. 

**Day 1 — Foundation & Auth** 

|**Time**|**Task**|**Claude Code Session Strategy**|**Token Budget**<br>**Guidance**|
|---|---|---|---|
|Morning|Supabase schema: users,<br>deals, deal_stage_history,<br>deal_notes, deal_documents<br>tables; RLS policies for all 4<br>roles|Session 1: Opus for schema +<br>RLS design only. Prompt:<br>'Design the Supabase schema<br>for [paste Section 8.3 data<br>model]. Output: SQL migration<br>files only.'|Use Opus here — this is<br>architecture. Expect<br>~15K tokens. Compact<br>and commit before<br>lunch.|
|Afternoon|Next.js auth flow: Supabase<br>Auth login page, role-based<br>redirect on login, protected<br>route middleware|Session 2: Sonnet. Load:<br>CLAUDE.md + DESIGN.md<br>(login screen only). Prompt:<br>'Build the login page and auth<br>middleware per the DESIGN.md<br>spec. Use Supabase Auth.'|Sonnet. ~10K tokens.<br>Commit and /clear<br>before end of day.|
|End of day|Test: all 4 role logins work;<br>RLS blocks cross-role data<br>access confirmed|Manual QA — no new Claude<br>session. Run Supabase test<br>queries directly.|Zero tokens.|



## **Day 2 — Deal Pipeline Core** 

|**Time**|**Task**|**Claude Code Session Strategy**|**Token Budget**<br>**Guidance**|
|---|---|---|---|
|Morning|Deal record CRUD: create,<br>read, update deal; all 9 fields;<br>JotForm webhook endpoint<br>that auto-creates a deal|Session 3: Sonnet. Load:<br>CLAUDE.md +<br>/modules/deals/CLAUDE.md +<br>jotform-field-map.md only. Build<br>API routes first, then form UI.|~12K tokens. Compact<br>after API routes done;<br>continue with UI in same<br>session if context allows.|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Afternoon|Kanban board view: 11<br>columns, drag-and-drop<br>cards, stage change persists<br>to DB and writes<br>stage_history row|Session 4: Sonnet. Load:<br>CLAUDE.md + DESIGN.md<br>(pipeline Kanban screen).<br>Reference: deal record API from<br>Day 1 (paste endpoint<br>signatures only — not full code).|~12K tokens. This is<br>UI-heavy — keep<br>DESIGN.md context<br>tight. Compact after<br>Kanban works.|
|---|---|---|---|
|End of day|Test: create deal manually +<br>via JotForm webhook; drag<br>card through 3 stages; verify<br>history log|Manual QA + Supabase<br>dashboard to confirm rows.|Zero tokens.|



## **Day 3 — Deal Record Detail & Notes** 

|**Time**|**Task**|**Claude Code Session Strategy**|**Token Budget**<br>**Guidance**|
|---|---|---|---|
|Morning|Deal record detail page: all<br>fields editable inline,<br>document upload to<br>Supabase Storage, stage<br>history timeline|Session 5: Sonnet. Load:<br>CLAUDE.md + DESIGN.md<br>(deal record screen). Do not<br>load Kanban code — reference<br>API endpoints by signature only.|~10K tokens. UI-heavy<br>day — stay disciplined<br>about not loading<br>yesterday's components<br>unless editing them.|
|Afternoon|Call notes module on deal<br>record: rich text input, multiple<br>entries per deal, timestamped,<br>Call Note Structurer microtool<br>(MT-01 to MT-06)|Session 6: Sonnet. Load:<br>CLAUDE.md +<br>/modules/notes/CLAUDE.md.<br>Claude API integration for note<br>structurer — use streaming<br>response for good UX.|~12K tokens. Claude<br>API call within Claude<br>Code — keep the API<br>integration prompt tight.<br>Test the structurer<br>end-to-end before<br>committing.|
|End of day|Test: upload 3 document<br>types; add 2 notes; run<br>structurer on raw note; verify<br>output appends correctly|Manual QA.|Zero tokens.|



## **Day 4 — Table View, Dashboard & Franchise Portal** 

|**Time**|**Task**|**Claude Code Session Strategy**|**Token Budget**<br>**Guidance**|
|---|---|---|---|
|Morning|Table/list view with sort + filter<br>+ Kanban toggle; Founder<br>dashboard (deal counts by<br>stage, recent activity feed,<br>open tasks summary)|Session 7: Sonnet. Load:<br>CLAUDE.md + DESIGN.md<br>(table view + dashboard<br>screens). Reference deal API<br>endpoints by signature — no<br>deal component code.|~11K tokens. Dashboard<br>is read-only aggregate<br>— fast to build. Compact<br>after dashboard done.|
|Afternoon|Franchise Partner portal: login<br>for franchise_partner role;<br>deal submission form;<br>submitted deal auto-creates|Session 8: Sonnet. Load:<br>CLAUDE.md +<br>/modules/franchise/CLAUDE.md<br>+ DESIGN.md (portal screens).|~12K tokens. RLS test is<br>mandatory before<br>committing. Run:<br>SELECT * FROM deals<br>as|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

||pipeline record; partner sees<br>their submission status only|RLS is critical here — partner<br>must not see other deals.|franchise_partner_user<br>— must return only their<br>deals.|
|---|---|---|---|
|End of day|Test: Founder dashboard<br>loads correctly; franchise<br>partner submits deal →<br>appears in pipeline; partner<br>cannot see other deals|Manual QA + RLS verification in<br>Supabase.|Zero tokens.|



## **Day 5 — Messaging, In-App Comms & Alpha QA** 

|**Time**|**Task**|**Claude Code Session Strategy**|**Token Budget**<br>**Guidance**|
|---|---|---|---|
|Morning|In-app DMs + deal comment<br>threads (MT-24 to MT-32):<br>Supabase Realtime for live<br>delivery; unified inbox;<br>@mention notifications|Session 9: Sonnet. Load:<br>CLAUDE.md +<br>/modules/messaging/CLAUDE.md.<br>Use Supabase Realtime channels<br>— one channel per DM pair, one<br>per deal. Keep UI minimal for<br>Alpha.|~13K tokens. Realtime<br>is the most complex<br>part of this day. Build<br>DMs first, then deal<br>comments. If context<br>gets heavy after DMs,<br>/compact and start fresh<br>for deal comments.|
|Afternoon|Alpha QA sprint: end-to-end<br>testing of all Day 1–5<br>features; bug fixes; deploy to<br>Vercel preview; share access<br>with Monica, Sakshay,<br>Siddhant|Session 10: Sonnet. Bug fix<br>session only. Load only the file(s)<br>with the bug — never load the<br>whole project. Paste the error +<br>the specific file.|~8K tokens for fixes.<br>Resist the urge to<br>refactor — Alpha is<br>about working, not<br>polished.|
|End of day|Alpha deployed; internal trio<br>has access; bug log created<br>in Notion/Linear for feedback<br>triage|Deploy: vercel --prod; smoke test<br>all 4 role logins on production<br>URL.|Zero tokens.|



## **13.4  Remaining Build Schedule (Weeks 3–11)** 

After the Week 1 Alpha sprint, the remaining modules are built in vertical slices at the same pace. Suggested sequencing: 

|**Sprint Week**|**Modules / Features**|**Key Token Efficiency Note**|
|---|---|---|
|Week 3|Investor Database + Fund Outreach module<br>(FR-13 to FR-15)|New module = new<br>/modules/investor/CLAUDE.md. Never<br>load deal module code in this session.|
|Week 4|Memo editor + Pitch Deck Ingestion Engine<br>(FR-27 to FR-34, MT-07 to MT-13)|Two Claude API integrations in one week<br>— build memo editor first, add ingestion<br>engine second. Separate sessions.|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|Week 5|CCPS Deal Calculator (MT-14 to MT-23)|This is pure frontend React with no DB<br>writes for real-time calc. Keep Supabase<br>calls only for save scenario. Fast to build.|
|---|---|---|
|Week 6|Database & Smart Matching module (DB-01 to<br>DB-12, pgvector, Claude API match ranking)|Opus session for pgvector schema and<br>embedding strategy. Sonnet for all UI.<br>This is the most technically complex<br>module.|
|Week 7|Task management + HR Tool (FR-20 to FR-21,<br>MT-33 to MT-43)|HR tool is largely CRUD — fast to build.<br>Task management links to deals (already<br>built).|
|Week 8|Marketing & Content Ops module (FR-22 to<br>FR-24); DPDP compliance screens (DPDP-01<br>to DPDP-15)|DPDP screens are mostly static policy<br>pages + form submissions. Low token<br>cost.|
|Week 9|Data migration from Sheets; Admin panel; user<br>management; theme switcher (4 themes)|Migration: build import script in one<br>focused Sonnet session. Admin panel:<br>straightforward CRUD.|
|Week 10|Beta launch; parallel run begins; team<br>onboarding; bug fix sprint|Bug fixes only — load single files, not full<br>project. Use /cost to monitor session<br>spend.|
|Week 11|Franchise Partner GA onboarding; polish;<br>performance optimisation; post-launch review|Performance: Opus session to review<br>query patterns and add indexes. Then<br>Sonnet for UI polish.|



## **13.5  Daily Token Hygiene Rules** 

These rules apply to every Claude Code session throughout the build: 

|**Rule**|**Why**|
|---|---|
|Start every session with /cost to see<br>remaining context budget|Prevents surprises mid-session when context is nearly full|
|Load only the files you are editing today<br>— never load the whole project|The single biggest source of token waste is loading irrelevant files|
|Paste API endpoint signatures, not full<br>implementations, when referencing<br>prior work|Signatures give Claude what it needs to integrate without loading<br>hundreds of lines|
|Run /compact when session hits ~60%<br>context usage|Performance degrades sharply above 80% — compact early, not<br>in a panic|
|Commit and push before /clear or<br>ending a session|Never lose work because you cleared context to free tokens|
|Use Sonnet (claude-sonnet-4-6) for all<br>implementation; Opus<br>(claude-opus-4-6) only for schema<br>design, RLS architecture, and algorithm<br>design|Opus costs 5x more — reserve it for decisions, not execution|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

|One feature per session where<br>possible; never mix modules in one<br>session|Mixing modules forces Claude to load context for both — doubles<br>token cost|
|---|---|
|Write module-specific CLAUDE.md<br>before starting each new module|A tight module CLAUDE.md replaces hundreds of tokens of<br>repeated explanation|
|Use sub-agents for parallel tasks<br>(schema + UI scaffold can run<br>simultaneously)|Sub-agents each get their own context window — effectively<br>doubling throughput|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **14.  GO-TO-MARKET & LAUNCH** 

## **10.1  Rollout Phases** 

|**Phase**|**Scope**|**Criteria to Advance**|**Target**|
|---|---|---|---|
|Alpha|Monica, Sakshay, Siddhant<br>only|Core pipeline functional; notes<br>working; JotForm webhook live; no<br>critical bugs|Week 6|
|Beta|Full internal team (Associates<br>+ Analysts onboarded)|All FR-01 to FR-21 passing; data<br>migrated from Sheets; Sheets set to<br>read-only|Week 10|
|GA v1|Franchise Partners onboarded<br>to portal|Partner submission flow tested<br>end-to-end; role permissions verified<br>by Siddhant|Week 13|



## **10.2  Transition Plan (Parallel Run)** 

- Parallel run during Alpha and Beta phases — Sheets remain the source of truth until Beta sign-off 

- At Beta go-live, Ecosystem becomes primary source of truth — Sheets maintained as read-only backup 

- 30 days after Beta go-live: Sheets archived permanently 

- Hard cutover date to be set at Beta launch by Monica — no extensions without sign-off 

## **10.3  Data Migration Plan** 

|**Source**|**Target Table**|**Owner**|**Validation Method**|
|---|---|---|---|
|Startup Tracker (Sheets)|deals|Sakshay|Row count match + sample<br>record check (10%)|
|Investor Database (Sheets)|investors|Sakshay|Row count match + contact<br>field completeness check|
|Mandate Tracker (Sheets)|deals (mandate-stage<br>records)|Sakshay|Cross-reference against<br>Startup Tracker entries|
|Post-migration validation|All tables|Siddhant|Sign-off on record counts<br>before Beta launch|



## **10.4  Communication & Training** 

- Internal team: Walkthrough session led by Sakshay before Beta launch 

- Franchise Partners: Onboarding guide + short demo video before GA 

- No public announcement — internal tool only for v1 

Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **10.5  Analytics & Instrumentation** 

|**Event**|**Trigger**|**Properties**|**Owner**|
|---|---|---|---|
|deal_created|New deal record saved|source, stage, assignee_id,<br>created_by|Dev|
|stage_changed|Deal moves to new stage|deal_id, from_stage, to_stage,<br>changed_by|Dev|
|note_added|Call note saved to deal|deal_id, created_by,<br>char_count|Dev|
|document_uploaded|File attached to deal<br>record|deal_id, file_type,<br>uploaded_by|Dev|
|franchise_deal_submitte<br>d|Partner submits via portal|partner_id, deal_id|Dev|
|outreach_status_updated|Fund status flag changed<br>on deal|deal_id, investor_id,<br>new_status, updated_by|Dev|
|fee_logged|Success fee saved on<br>closed deal|deal_id, has_split (bool)|Dev|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **15.  MILESTONES & TIMELINE** 

|**Milestone**|**Description**|**Owner**|**Target**|**Status**|
|---|---|---|---|---|
|PRD Sign-off|Monica, Sakshay, Siddhant<br>approve this document|Sakshay|Week 1|Pending|
|Designer briefed|ESV brand + screen inventory<br>handed to designer|Sakshay|Week 1|Not<br>Started|
|Developer engaged|External dev confirmed +<br>briefed|Monica|Week 2|Not<br>Started|
|Design complete|All screens finalised in ESV<br>brand style|Designer|Week 3|Not<br>Started|
|WhatsApp API submitted|Business template approval<br>submitted to Meta/Twilio|Dev|Week 3|Not<br>Started|
|Dev kickoff|Engineering sprint begins|External Dev|Week 3|Not<br>Started|
|Alpha build live|Core pipeline + notes +<br>JotForm webhook live for<br>internal trio|Dev|Week 6|Not<br>Started|
|Alpha review|Monica + Sakshay + Siddhant<br>review; bugs logged|Sakshay|Week 7|Not<br>Started|
|Data migration|All 3 Sheets migrated and<br>validated in Ecosystem|Sakshay +<br>Siddhant|Week 8|Not<br>Started|
|Beta launch|Full internal team onboarded;<br>Sheets set to read-only|Sakshay|Week 10|Not<br>Started|
|QA sign-off|All critical flows tested and<br>passing|Siddhant|Week 11|Not<br>Started|
|GA v1 — Franchise<br>Partners|Partners onboarded to portal;<br>role permissions verified|Sakshay +<br>Monica|Week 13|Not<br>Started|
|Sheets archived|Old Sheets trackers archived<br>permanently|Siddhant|Week 16|Not<br>Started|
|Post-launch review|Metrics + team feedback<br>session|Sakshay|Week 16|Not<br>Started|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **16.  RISKS & MITIGATION** 

|**#**|**Risk**|**Likelihood**|**Impact**|**Mitigation / Owner**|
|---|---|---|---|---|
|R1|Social media API approvals<br>delayed — marketing module<br>unusable at launch|High|Medium|Stub UI; activate post-approval.<br>Marketing module deprioritised if<br>timeline at risk / Dev|
|R2|3-month timeline too tight for all<br>7 modules|High|High|Marketing module moves to v2 if<br>needed. Decision point at Week 6<br>Alpha review / Sakshay + Monica|
|R3|JotForm field mapping breaks<br>on form edit|Medium|High|Lock JotForm schema at launch;<br>document field-to-column mapping<br>explicitly / Sakshay|
|R4|Data migration errors from<br>Sheets|Medium|High|1-week migration buffer pre-Beta;<br>Siddhant validates record counts /<br>Sakshay + Siddhant|
|R5|Franchise Partner onboarding<br>friction (low tech savviness)|Medium|Medium|Simple portal UX + onboarding<br>guide + demo video / Sakshay|
|R6|WhatsApp Business template<br>approval delayed|Medium|Low|Fall back to email-only notifications<br>until approved / Dev|
|R7|Parallel run extends beyond 30<br>days|Low|Medium|Hard cutover date set at Beta<br>launch by Monica — no extensions<br>without sign-off|
|R8|LinkedIn API limitations<br>prevent outreach tracking<br>automation|Certain|Low|Documented as manual-only in UI<br>— no integration attempted; already<br>accounted for in spec|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **17.  OPEN QUESTIONS & DECISIONS LOG** 

|**#**|**Question / Decision Needed**|**Owner**|**Due**|**Status**|
|---|---|---|---|---|
|Q1|Will JotForm continue as the external<br>intake form permanently, or does<br>Ecosystem build a native intake form in<br>v2?|Sakshay +<br>Monica|Pre-dev|Open|
|Q2|What is the exact fee split logic — fixed<br>% per agreement or variable per deal?|Monica|Week 1|Open|
|Q3|Should Associates see aggregated<br>success fee totals at portfolio level (not<br>per-deal detail)?|Monica|Week 1|Open|
|Q4|Which social platforms are in scope for<br>marketing module — LinkedIn only, or<br>Instagram too?|Sakshay|Week 2|Open|
|Q5|Is there a defined SLA for ESV to<br>respond to a Franchise Partner deal<br>submission?|Monica|Week 2|Open|
|Q6|Will Franchise Partners need individual<br>logins, or a shared credential per<br>partner firm?|Siddhant|Week 2|Open|
|Q7|What is the exact data migration plan<br>for deals already at mandate stage in<br>the Mandate Tracker?|Sakshay|Week 7|Open|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **18.  APPROVALS & SIGN-OFF** 

|**Name**|**Role**|**Date**|**Status**|
|---|---|---|---|
|Monica|ESV Founder||☐Approved☐Rejected<br>☐Pending|
|Sakshay|Admin||☐Approved☐Rejected<br>☐Pending|
|Siddhant Baliga|Admin||☐Approved☐Rejected<br>☐Pending|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

## **19.  APPENDIX** 

## **A.  Glossary** 

|**Term**|**Definition**|
|---|---|
|IB|Investment Banking — the deal advisory and fundraise mandate service ESV<br>provides to startups|
|Mandate|A signed agreement between ESV and a startup authorising ESV to run the<br>fundraising process on their behalf|
|Success fee|A percentage fee paid by the startup founder to ESV upon successful close of a<br>fundraising round|
|Franchise Partner|An external individual or firm with a referral or franchise agreement with ESV;<br>submits deals and earns a fee split on successful closes|
|Fund outreach|The process of identifying and approaching suitable VC funds whose thesis<br>matches a mandated deal|
|Data room|A secure, organised repository of a startup's documents (pitch deck, financials,<br>legal) shared with interested investors|
|JotForm|The current external form used to capture initial startup interest — continues in<br>v1 as the intake mechanism|
|RLS|Row-Level Security — a Supabase/PostgreSQL feature that enforces data<br>access rules at the database layer|
|MIS|Management Information System — a company's internal financial reporting<br>used during deal analysis|
|Parallel run|The transition period where both Ecosystem and the old Sheets trackers are<br>maintained simultaneously|



## **B.  ESV Colour Palette Reference** 

|**Name**|**Hex**|**Primary Usage**|
|---|---|---|
|Purple|#745FFD|Primary action, CTAs, active states|
|Pastel Purple|#CEAAFD|Hover, tags, secondary highlights|
|Crema|#F7ECE2|Light mode background surface|
|Fair|#F4F4F4|Light mode card surface|
|Slate|#A39B95|Muted text, secondary labels|
|Sand|#D3C1A9|Borders, dividers|
|Bronze|#D5AE8F|Franchise partner tags, warm accents|
|Golden Glow|#CB8C7C|Fee flags, warning indicators|
|Deep Navy|#1A1A2E|Dark mode background|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

Dark Raised #22223A Dark mode card surface 

## **C.  Revision History** 

|**Version**|**Date**|**Author**|**Changes**|
|---|---|---|---|
|v1.0|2025|Sakshay|Initial PRD — all 13 sections drafted and<br>approved|



Ecosystem by Earlyseed Ventures  |  Product Requirements Document  |  Confidential 

