/**
 * Who a piece of the wiki is written for.
 *
 * `internal` is the default and the safe direction: a section nobody has classified stays with the
 * team. Partners were being shown all thirty sections — the SGP Desk they are triaged by, the fee
 * splits calculated on them, HR, attendance, admin — which is both confusing and none of their
 * business.
 */
export type WikiAudience = 'internal' | 'partner' | 'all'

export type WikiItem = {
  heading: string
  body: string
  /** Defaults to the section's audience. Set it to carve one item out of a shared section. */
  audience?: WikiAudience
  /**
   * A small picture of the thing being described, in monospace.
   *
   * Half of what people get stuck on is not "what does this do" but "where is it and what does it
   * look like when it is working". A sentence cannot answer that; a sketch of the actual screen
   * can, and costs nothing to keep current compared with a screenshot.
   */
  snippet?: string
}

export type WikiSection = {
  title: string
  summary: string
  /** Defaults to 'internal'. Nothing reaches a partner unless it says so. */
  audience?: WikiAudience
  items: WikiItem[]
}

/** Everyone who is not a franchise partner is internal, including super_admin. */
export function isPartnerRole(role: string | null | undefined): boolean {
  return role === 'franchise_partner'
}

/**
 * Internal staff read everything, including the partner-facing sections — an admin who cannot see
 * what a partner sees cannot answer a question about it. The scoping exists to stop partners
 * reading our side, not to stop us reading theirs.
 */
function audienceAllows(audience: WikiAudience | undefined, partner: boolean): boolean {
  if (!partner) return true
  return (audience ?? 'internal') !== 'internal'
}

/**
 * The wiki as this role should see it — sections and the items inside them.
 *
 * Filtering at the data layer rather than in each of the fifteen places the wiki is rendered: the
 * side panel, the sidebar browser and the full page all read this, so there is one answer to "can
 * they see this" instead of three that can drift.
 */
export function wikiFor(role: string | null | undefined): Record<string, WikiSection> {
  const partner = isPartnerRole(role)
  const out: Record<string, WikiSection> = {}
  for (const [key, section] of Object.entries(WIKI)) {
    if (!audienceAllows(section.audience, partner)) continue
    // An item in a shared section falls back to `internal`, not to the section's own audience.
    // Otherwise marking a section 'all' quietly opens every item in it — which is exactly how the
    // whole internal FAQ ended up in front of partners the first time.
    const fallback: WikiAudience = section.audience === 'all' ? 'internal' : (section.audience ?? 'internal')
    const items = section.items.filter((i) => audienceAllows(i.audience ?? fallback, partner))
    if (items.length === 0) continue
    out[key] = { ...section, items }
  }
  return out
}

export const WIKI: Record<string, WikiSection> = {

  dashboard: {
    title: 'Dashboard',
    summary: 'The command centre for Earlyseed Ventures. Shows live pipeline health and recent activity across all deals.',
    items: [
      { heading: 'Active Deals', body: 'Deals that are not yet Closed (Success or Dead). Use this to track the live book of work.' },
      { heading: 'In Mandate', body: 'Deals that have reached the "Mandate Accepted" stage — the founder has signed. These are your committed mandates.' },
      { heading: 'Total Closed', body: 'Sum of all Closed Success + Closed Dead deals. Gives a read on total throughput.' },
      { heading: 'Open Tasks', body: 'Tasks across all deals/assignees that are not yet Done. Click to jump to the task board.' },
      { heading: 'Recent Activity', body: 'The last 10 stage changes across all deals, with who made the change. Useful for team standup context.' },
    ],
  },

  pipeline: {
    title: 'Pipeline',
    summary: 'The central deal tracker. Every company ESV works with lives here, moving through 11 stages from first contact to close.',
    items: [
      { heading: 'Deal Stages', body: 'New Lead → JotForm Received → First Call Scheduled → First Call Done → Analysis in Progress → Second Call / Mandate Sent → Mandate Accepted → Memo Created → Fund Outreach Active → Closed Success / Closed Dead.' },
      { heading: 'Kanban View', body: 'Drag cards between columns to move a deal. Columns scroll horizontally. Best for daily management.' },
      { heading: 'Table View', body: 'Click the Table button to switch to a sortable, searchable list. Best for bulk review or reporting.' },
      { heading: 'Adding a Deal', body: 'Click "+ New Deal". Fill in company name, sector, funding stage, source, and founder contacts. The system will warn you if the company already exists.' },
      { heading: 'Duplicate Detection', body: 'Before saving, the system does a case-insensitive match on company name. If a duplicate is found you can choose to create anyway or cancel.' },
      { heading: 'Deal Detail', body: 'Click any deal card to open the full record. You\'ll see the stage stepper, founder info, tabs for Notes, Documents, History, and Fund Outreach.' },
    ],
  },

  dealDetail: {
    title: 'Deal Detail',
    summary: 'The full record for a single deal. All activity, notes, documents, and fund outreach in one place.',
    items: [
      { heading: 'Stage Stepper', body: 'Click any stage dot at the top to jump a deal directly to that stage. Or use Advance / Regress buttons for one step at a time.' },
      { heading: 'Notes Tab', body: 'Add internal team notes. Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to submit quickly. Notes are timestamped and attributed to you.' },
      { heading: 'Documents Tab', body: 'Attach pitch decks, financials, legal docs. Supported: PDF, XLSX, PPTX, DOCX, JPG, PNG. Max 25MB per file.' },
      { heading: 'History Tab', body: 'Immutable log of every stage change — who moved it, when, and from where. Useful for dispute resolution and reporting.' },
      { heading: 'Fund Outreach Tab', body: 'Once you\'re ready to reach investors, use this tab. Select an investor from the DB and add them to the outreach list. Update their status as you hear back: Sent → Responded → Interested or Passed.' },
    ],
  },

  tasks: {
    title: 'Tasks',
    summary: 'Action items for the team. Tasks can be standalone or linked to a specific deal. The board has four views: Board, Personal To-Do List, Recurring, and KPI.',
    items: [
      { heading: 'Board Columns', body: 'To Do → Done. Move tasks by changing the status dropdown on each card. Moving a task to Done stamps its completion time; moving it back to To Do clears it.' },
      { heading: 'Creating a Task', body: 'Click "+ New Task". Set a title, optional description, assignee, linked deal, due date, and priority (Low / Medium / High). Every card shows who it was assigned by.' },
      { heading: 'Who can be assigned', body: 'Founders/admins can assign any internal team member. Associates can only assign to themselves or other associates. SGPs can never be assigned tasks.' },
      { heading: 'Visibility', body: 'Founders and admins see all tasks in the organisation. Associates see only the tasks assigned to them. Partners have no task access.' },
      { heading: 'Pushing a task', body: 'Only the assignee can push their own task to a new target date. Pushing records the new date and increments the push count — the original due date is retained for reporting.' },
      { heading: 'Priority Levels', body: 'High = blocks progress or has a hard deadline. Medium = standard work. Low = nice-to-have or whenever. Overdue tasks show a ⚠ warning.' },
      { heading: 'Comments', body: 'Click "Comments" on any task card to open a discussion thread for that task. Founders/admins can comment on any task; associates only on tasks assigned to them. Anyone who can see the thread can delete a comment on it.' },
      { heading: 'KPI view', body: 'Switch to the KPI tab for performance metrics: On-time, Pushed, Pending, and Not-completed. Founders/admins see a per-person breakdown for the whole team plus org totals; associates see only their own numbers.' },
      { heading: 'Pushing a task', body: 'Only a task\'s assignee can push its date, and a reason is required every time. Tick "Dependent on external party" when a client, investor or vendor is holding things up, or "Dependent on internal stakeholder" and pick the colleague you are waiting on. The reason is posted to the task\'s comment thread and rolled up in the KPI view, so recurring causes of slippage — and internal bottlenecks — are visible rather than guessed at.' },
    ],
  },

  myTodos: {
    title: 'Personal To-Do List',
    summary: 'A personal checklist — private by default, so only you see your own list. Quick items and tasks assigned to you live side by side, with completion synced back to the Tasks board.',
    items: [
      { heading: 'Adding a quick item', body: 'Type into the box at the top and press Enter or click Add. Quick items are personal only — they never appear on the shared Tasks board.' },
      { heading: 'Porting in a task', body: 'Click "Port in a task" to pick from tasks assigned to you and add one to your list, linked back to the original. Already-ported tasks are excluded from the picker.' },
      { heading: 'Two-way sync', body: 'Checking off a ported item marks the linked Task as Done on the shared board too — and vice versa: marking a Task Done on the board flips any personal to-do linked to it. Unchecking either side reopens both.' },
      { heading: 'Notes & due dates', body: 'Click the "⋯" on any item to add notes or a due date, or to unlink it from its task (keeping it as a standalone personal item).' },
      { heading: 'Work weeks', body: 'Assign an item to a work week — when adding it, or later via the "⋯" menu — and it appears in that week\'s Weekly Update with its tick-box state. This is also the only thing that makes a personal item visible to founders and admins: anything with no work week stays private to you.' },
      { heading: 'Completed section', body: 'Finished items collapse into a "Completed" group at the bottom so your active list stays short.' },
    ],
  },

  recurringTasks: {
    title: 'Recurring Tasks',
    summary: 'Admin-defined tasks that repeat on a schedule (e.g. a weekly form to fill in) with a single shared tick-off per occurrence.',
    items: [
      { heading: 'When it shows up', body: 'A recurring task is hidden until a configurable number of days before it\'s due (2 by default) — then it appears as "Upcoming". If it\'s missed, it does not reset or disappear: it stays visible as "Overdue" indefinitely until someone ticks it off.' },
      { heading: 'Ticking off', body: 'Click the checkmark to mark the current occurrence done. This logs who completed it and when, then schedules the next occurrence — measured from the original due date, not the completion date, so a late tick-off doesn\'t shift the regular cadence (e.g. it\'s still due next Saturday, not "a week after you got to it").' },
      { heading: 'Supporting link', body: 'Each recurring task can carry a link (e.g. a Google Form) shown as an "Open" button, so the same link is reused every cycle.' },
      { heading: 'Creating one', body: 'Founders/admins click "+ New recurring task": title, optional description, optional link, repeat frequency (daily / weekly / monthly), lead time, optional assignee, and the first due date.' },
      { heading: 'Due vs All view', body: 'The "Due" tab (default) shows only what\'s actionable now. The "All" tab is the management view — see every recurring task regardless of due date, and edit, pause/resume, or delete it (founder/admin only).' },
    ],
  },

  escalations: {
    audience: 'all',
    title: 'Escalations',
    summary: 'A direct channel for raising a query or blocker to a single founder or partner, optionally tied to a specific deal, entry, task, or investor.',
    items: [
      { audience: 'all', heading: 'Who can raise', body: 'Associates and admins raise escalations. Founders and partners cannot raise — they are the recipients. Each escalation goes to exactly one recipient (a founder or a partner).' },
      { audience: 'all', heading: 'Raising one', body: 'Click "+ New Escalation". Give it a subject, optional details, pick the one recipient, and optionally link it to an active deal, pipeline entry, task, or investor. A snapshot of the linked item\'s title is stored so partners can see "re: X" without needing access to it.' },
      { audience: 'all', heading: 'Status workflow', body: 'Open → Acknowledged → Resolved (there is no reply thread). The status can be changed by the recipient, the person who raised it, or any founder/admin. Resolving stamps the resolution time.' },
      { audience: 'all', heading: 'Visibility', body: 'Founders and admins see every escalation in the organisation (oversight). Associates see only the ones they raised. Partners see only the ones addressed to them.' },
      { audience: 'all', heading: 'Deleting', body: 'The person who raised an escalation, or any founder/admin, can delete it.' },
    ],
  },

  activeDeals: {
    title: 'Active Deals',
    summary: 'The live book of work. Every deal accepted from a pipeline lands here with its full category details, investor list, and fee tracking.',
    items: [
      { heading: 'How a deal enters Active Deals', body: 'When a pipeline entry is moved to the Accepted column, you are prompted to select one or more categories and fill in their fields (e.g. success fee %, total capital). On confirmation the deal appears here.' },
      { heading: 'Re-accepting a deal', body: 'If you move an accepted entry back out of Accepted, its active deal lingers (investors, fees, and categories are preserved). Moving it back into Accepted simply restores it — you are not asked for categories again and no duplicate deal is created.' },
      { heading: 'Two-column layout', body: 'The detail panel opens in two columns. Left side shows Assigned To, Category Details, Stage History, and Form Responses. Right side shows the Investors panel for that deal.' },
      { heading: 'Adding Investors', body: 'In the Investors panel, click "+ Add Investor". Search the investor database and select one, or create a new investor on the spot (it will also be saved to the Investors tab). Each deal has its own independent investor list.' },
      { heading: 'Investing toggle & Amount', body: 'Each investor row has a Yes/No toggle for whether they are investing, and an amount field (₹). The total investment across all investing parties is shown in the totals bar at the bottom.' },
      { heading: 'Fee rows', body: 'When an investor is added, fee rows are auto-created for every percentage-type field in the deal\'s categories (e.g. Success Fee). The rate defaults to the value entered at acceptance but can be overridden per investor.' },
      { heading: 'Enabling / disabling a fee', body: 'Click the ● / ○ toggle next to a fee to enable or disable it. You will be asked to type the deal name to confirm — this prevents accidental changes. Disabled fees are excluded from the totals.' },
      { heading: 'Custom fees', body: 'Click "+ Add Fee" under any investor to add a fee that isn\'t part of the category (e.g. a separately negotiated charge). Custom fees have a label and a rate % and can be deleted.' },
      { heading: 'Fee calculations', body: 'For each fee, the system shows the rate % and the calculated earning (rate × investment amount). The totals bar sums all enabled fee earnings across all investors.' },
      { heading: 'Referral investors', body: 'If an investor was referred by an SGP, a Referral badge appears on their row automatically.' },
      { heading: 'Adding a deal directly', body: 'Not every deal comes through a pipeline — click "+ New deal" (founder/admin) to add a portfolio or off-pipeline deal straight into Active Deals. It creates or links a company profile by name automatically.' },
      { heading: 'Importing deals from CSV', body: 'Click "Import CSV" (founder/admin) for a bulk path: copy the AI-agent prompt (columns are generated from your org\'s deal categories), have an AI agent turn your source list into a CSV, then upload it. Each row becomes an active deal.' },
      { heading: 'Creating a deal from a company profile', body: 'On any Company Profile, founders/admins can click "Create deal" to add that company straight to Active Deals — linked directly to the profile rather than matched by name.' },
    ],
  },

  companies: {
    title: 'Companies',
    summary: 'The startup database — one master profile per company, the deep dossier behind every deal. Deal Desk cards, pipeline deals, and Active Deals all create-or-link a company profile automatically, so the same company is never duplicated.',
    items: [
      { heading: 'Profile sections', body: 'Overview, Traction & metrics, Current raise, Product, Founders, Team, Funding history, Cap table, Documents, Custom fields, and an Updates timeline — plus a Suggested Investors panel that matches the company\'s sectors and themes against your investor database.' },
      { heading: '"Update from call" form', body: 'Instead of editing each section separately, click "Update from call" to fill in everything from a founder call in one continuous form. Each section has an optional Notes box for anything that doesn\'t fit a field — on save, all filled notes post as one combined Company Update.' },
      { heading: 'Founders', body: 'Each founder can have a name, role, bio, ex-affiliations, LinkedIn URL, equity %, and a photo URL (shown as their avatar on the profile).' },
      { heading: 'Importing companies from CSV', body: 'Click "Import CSV" on the Companies list for the same AI-prompt-and-upload flow used elsewhere in the app. Rows are deduped by name: a matching company gets its blank fields filled in (never overwriting what\'s already entered); a new name creates a fresh profile.' },
      { heading: 'Meta-tags & Suggested Investors', body: 'Meta-tags are themes (e.g. "D2C", "Quick Commerce") extracted from the company\'s text, or set explicitly via the CSV. They drive the Suggested Investors panel, which buckets matches into Sector preference, Synergetic, and Sector-agnostic.' },
      { heading: 'Linking & creating decisions', body: 'A company profile can spawn a Deal Desk card ("Create card") or an Active Deal ("Create deal"). The Sync button backfills profiles from existing Deal Desk cards and active deals that predate the company database.' },
    ],
  },

  investors: {
    title: 'Investors',
    summary: 'ESV\'s database of investors and funds. Add them to Active Deals to track commitments and fees.',
    items: [
      { heading: 'Adding an Investor', body: 'Click "+ Add Investor". Name, type (VC Fund, Angel Fund, Family Office, or Angel Investor), country, website, stage preference, ticket size range, and sectors. Internal team only — partners cannot add investors; they tell us, and we link them to the fund we already hold.' },
      { heading: 'ESV POC', body: 'Select one or more internal team members as the Point of Contact for this investor. Type a name to search and click to select. Multiple POCs are supported — each appears as a chip.' },
      { heading: 'Referred by Partner', body: 'If this investor was introduced by an SGP, select the partner here (admin/founder only). The investor will show a Referral badge when added to any deal.' },
      { heading: 'Contacts', body: 'For funds (not angel investors), you can add individual contacts — name, role, email, phone, and LinkedIn URL. Contacts are managed from the investor detail drawer after creation.' },
      { heading: 'Search', body: 'The search bar filters by name, country, sector, stage, or ESV POC name. No need to scroll.' },
      { heading: 'Cheque Range', body: 'Pick the currency alongside the amount. A dollar fund displayed in rupees is out by roughly 80x, which is how "$2M – $6M" once read as "₹2L – ₹6L". Where the source never said which currency it meant, the range is withheld rather than guessed at, and the original wording is kept in the fund\'s notes.',
        snippet: '$2M – $6M\n2,00,000 – 6,00,000  (currency not recorded)' },
      { heading: 'The full profile', body: 'The card is a summary. "Edit / full profile" opens the fund\'s own page — excluded sectors, POC audit, portfolio, notes. See the Investor profile section.' },
      { heading: 'Filtering by type', body: 'Filter by fund type — VC, corporate VC arm, family office, angel network — alongside the search box, for when the question is "which corporate arms do we know" rather than a name.' },
      { heading: 'Adding to a deal', body: 'Investors are attached to deals from the Active Deals panel, not from here. Open an active deal, go to the Investors panel (right column), and click "+ Add Investor".' },
    ],
  },

  partners: {
    title: 'Strategic Growth Partners',
    summary: 'Manage ESV\'s external Strategic Growth Partner (SGP) network. Partners refer deals and earn a share of the resulting fees.',
    items: [
      { heading: 'Partner details', body: 'In the Partners tab, fill in or edit a partner\'s firm name, contact, agreement type, Standard Fee Split %, and contract link. The Standard Fee Split is the default percentage a partner earns of the relevant deal earning.' },
      { heading: 'Deals & earnings', body: 'Click "Deals & earnings" on a partner to open their per-partner page. It lists every deal they are tied to — deals sourced via their link, or deals where one of their referred investors appears — with the org total earning, the earning via their referred investors, and their computed share.' },
      { heading: 'Share base', body: 'For each deal, choose where the partner\'s share is calculated from: "Referred earning" (just their referred investors\' fees) or "Total earning" (the deal\'s whole org earning). Defaults to referred.' },
      { heading: 'Per-deal split override', body: 'Each deal uses the partner\'s Standard Fee Split by default. Override the split % on any individual deal — leave the field blank to fall back to the standard. The partner\'s share recalculates immediately.' },
      { heading: 'Linking to a Portal Account', body: 'A partner record is linked to an SGP user account from User Management. That gives them their scoped views: Active Deals, Investors (read-only), My Companies, and My Earnings.' },
      { heading: 'What a partner sees on a deal', body: 'Only the fields marked visible to partners — the ESV POC, total capital being raised, the company\'s financial metrics, sector, and how much of the raise is done. Never fees, mandate links, or which investors have committed. A newly added deal field is private until someone opens it.' },
      { heading: 'Linking a partner to an investor', body: 'Partners cannot create investors. When one introduces a fund we already hold, set "Referred by Partner" on that investor — one record, one relationship, and the fee split follows it.' },
    ],
  },

  earnings: {
    audience: 'partner',
    title: 'My Earnings (Partners)',
    summary: 'A partner\'s view of what they earn from each deal. Read-only and scoped to the partner.',
    items: [
      { heading: 'What you see', body: 'Every deal you earn on — one you sourced via your link, or one where a referred investor of yours appears — with your split % and your earning (₹), plus a total at the top.' },
      { heading: 'How it\'s calculated', body: 'Your earning = your split % × the base set by the ESV team for that deal (either the deal\'s total earning or the earning from your referred investors). The split defaults to your Standard Fee Split but can be adjusted per deal by ESV.' },
      { heading: 'Privacy', body: 'You only ever see your own final share. Other investors, their amounts, and the org\'s overall earnings are never shown.' },
    ],
  },

  admin: {
    title: 'Admin',
    summary: 'User management for Earlyseed Ventures\' internal team. Visible to the Admin role only.',
    items: [
      { heading: 'Roles', body: 'Founder: full access including financials. Admin: full access plus user management. Associate: pipeline, tasks, investors, no financials. General: tasks and their own work, no deal book. HR: the HR Zone, people, and attendance. SGP: the partner portal only. The full matrix is in docs/ROLES.md.' },
      { heading: 'SGP Coordinator', body: 'A flag on an associate or general user, not a role of its own. It adds the SGP Desk so they can triage partner-sourced companies. Several people can hold it; founders and admins always can.' },
      { heading: 'Changing a Role', body: 'Use the dropdown in the Role column to change any user\'s role. Takes effect immediately on their next page load.' },
      { heading: 'Creating Accounts', body: 'Click "+ Create Account" to add a new team member. Set their email, name, temporary password, and role. They can change their password after logging in.' },
      { heading: 'Your Own Account', body: 'You cannot change your own role (to prevent accidental lock-out). Contact another admin if needed.' },
      { heading: 'Password Resets', body: 'Admins cannot see passwords. Users can change their own password via the "Change Password" option in the sidebar footer.' },
    ],
  },

  forms: {
    title: 'Forms',
    summary: 'Build and manage intake forms that feed directly into pipelines. Forms are visual branching flows — each question can route founders down different paths.',
    items: [
      { heading: 'Creating a Form', body: 'Click "+ New Form". Give it a title, optional description, and optionally link it to a pipeline at creation. Only admins and founders can create or edit forms.' },
      { heading: 'Linking to a Pipeline', body: 'A form must be linked to a pipeline before submissions create entries. Link or change the pipeline from the form settings (⚙ button in the builder). Linking a form that already has submissions will automatically backfill all existing entries into the new pipeline\'s Lead stage.' },
      { heading: 'Generating Links', body: 'Any internal team member can generate a personalised shareable link from any published form. Click "+ Get Link". Each link records its creator, so entries show "via [Name]\'s link" in the pipeline.' },
      { heading: 'Display name', body: 'Form Settings has a title and a display name. The title is the team\'s label in the form list; the display name is what the person filling it in reads at the top of the page. "Partner Form" is useful to us and meaningless to a founder. Leave it blank and the title is used.' },
      { heading: 'The partner form', body: 'One form is marked as the partner form, and it is the only one partners may issue links from. It always feeds the Partner Sourced pipeline — the database refuses to point it elsewhere, because repointing it would send every referral past the SGP Coordinator. Its questions are editable in the builder like any other form.' },
      { heading: 'Published vs Draft', body: 'A form must be Published before public links work. Toggle this from the builder toolbar. Draft forms return an error page if anyone visits their link.' },
      { heading: 'Submission outcomes', body: 'If a founder reaches a "Submitted" end node, their contact info is collected and a pipeline entry is created in the Lead stage. If they reach a "Not Eligible" end node, a rejection screen is shown and nothing is recorded.' },
    ],
  },

  formBuilder: {
    title: 'Form Builder',
    summary: 'A visual canvas for building branching intake flows. Each form is a directed graph of question nodes with conditional routing.',
    items: [
      { heading: 'Node types', body: 'Start (entry point, one per form), Question (short text / long text / MCQ), End — either Submitted (green) or Not Eligible (amber). Every form must have exactly one of each end type.' },
      { heading: 'MCQ branching', body: 'Each MCQ option creates its own output handle. Wire each option to the next question or to an end node. Every handle must be connected before you can save.' },
      { heading: 'Properties panel', body: 'Click any node to open its properties on the right. Set question text (supports **bold** and *italic* markdown), answer type, and MCQ options. Options can be reordered.' },
      { heading: 'Saving & validation', body: 'The Save button runs a full graph check: missing end types, unconnected handles, and duplicate edges are all blocked with a specific error message. The form is only saved if it is fully valid.' },
      { heading: 'Keyboard shortcuts', body: 'Delete or Backspace removes selected nodes/edges. Scroll to zoom. Drag the canvas to pan. Use Fit View (bottom-left controls) to reset the view.' },
    ],
  },

  pipelines: {
    title: 'Pipelines',
    summary: 'Kanban boards that track form submissions from first lead through to accepted or rejected. Each pipeline has its own stages and deal cards.',
    items: [
      { heading: 'Mandatory stages', body: 'Every pipeline has three locked stages: Lead (entry point, purple), Accepted (end state, green), and Rejected (end state, red). These cannot be renamed or deleted.' },
      { heading: 'Custom stages', body: 'Add stages between Lead and the end states via the "+ Add Stage" button in the board header. Each stage has a custom name and colour. Custom stages with active deals cannot be deleted.' },
      { heading: 'Stage questions', body: 'When creating or editing a custom stage, admins/founders can attach question fields (label + type: text, numeric, percentage, or URL) and mark any as required. Lead, Accepted, and Rejected never carry questions — they keep their own prompts.' },
      { heading: 'Answering stage questions', body: 'Moving an entry into a stage that has questions opens a prompt — required questions must be answered before the move commits. Answers appear in the entry detail card (admins/founders can edit them later) and in the active deal detail card.' },
      { heading: 'Deleting a stage', body: 'If a custom stage has no active deals, deleting it moves any remaining entries to Unsorted. If the stage has active entries, the delete is blocked — move the deals first.' },
      { heading: 'Deleting a pipeline', body: 'Deleting a pipeline permanently destroys all its stages and every deal inside it. You must type the exact pipeline name to confirm. This cannot be undone.' },
      { heading: 'Deal cards', body: 'Each card shows the company name, submitter, assignees, and the link creator chip. Drag cards between columns to move stages. Click a card to open the full entry detail.' },
      { heading: 'Entry detail', body: 'The entry panel shows all Q&A answers from the form submission, which link was used ("via [Name]\'s link"), assigned team members (add/remove), and the rejection reason if applicable.' },
      { heading: 'Rejection flow', body: 'Moving a deal to the Rejected column triggers a prompt for a reason (optional). The reason is stored on the entry and shown in the detail panel.' },
      { heading: 'Assigning team members', body: 'Open the entry detail and use the assignee picker to add or remove team members. SGPs are excluded from assignment. Multiple people can own the same deal.' },
      { heading: 'Linking forms', body: 'Use the "Forms" button in the board header to link or unlink intake forms. Multiple forms can feed the same pipeline. Submissions from all linked forms appear in the Lead column.' },
    ],
  },

  portal: {
    audience: 'partner',
    title: 'SGP Portal',
    summary: 'The view for external SGPs. Submit deals and track their progress.',
    items: [
      { heading: 'Submitting a Deal', body: 'Go to My Companies. Add a company yourself, or send your referral link and let the founder submit. Both land in the same queue in front of an SGP Coordinator.' },
      { heading: 'Tracking Referrals', body: 'Each card shows the stage it is on, and the run of stages so the name means something on its own. It updates when the ESV team moves the card — there is no separate status to chase.' },
      { heading: 'Setup Notice', body: 'If you see "Account not set up", your portal account hasn\'t been linked to a partner record yet. Contact Earlyseed Ventures to resolve this.' },
      { heading: 'Confidentiality', body: 'You only see your own referred deals, not the broader ESV pipeline. All data is governed by your franchise agreement.' },
    ],
  },

  bulletin: {
    title: 'Bulletin Board',
    summary: 'A company-wide board for upcoming events and announcements. Internal team only (founder/admin/associate) — SGPs don\'t see it.',
    items: [
      { heading: 'Reading it', body: 'Posts are grouped into Pinned, Upcoming events, and Announcements, with a collapsed "Past events" section at the bottom so old events don\'t clutter the board.' },
      { heading: 'Posting', body: 'Founders/admins click "+ New post", choose Event or Announcement, and fill in a title and details. Events also take a date, optional time, and location.' },
      { heading: 'Pinning', body: 'Pin a post to keep it at the top of the board regardless of date, for anything that needs everyone\'s attention.' },
    ],
  },

  hr: {
    title: 'HR Zone',
    summary: 'Policies, leave and expense requests, employee records, generated letters, and birthdays. What you see depends on your role — everyone gets Policies and Requests; People and Documents are HR, founders and admins.',
    items: [
      { heading: 'The tabs', body: 'Policies, Requests, People, Documents, Birthdays. The subtitle and the action button change with the tab — a "+ New policy" button above the birthday list would be a trap.' },
      { heading: 'Requests', body: 'Your own leave and expense requests, and the count of anything waiting on you. Approved leave is what the attendance statement pulls in at the end of the month.' },
      { heading: 'People', body: 'Employee records — the data every generated letter is filled from. A letter is only as right as the record behind it, so fix it here rather than editing the document.' },
      { heading: 'Reading a policy', body: 'Click any policy title to expand it in place. Each policy shows an optional category tag and when it was last updated (and by whom).' },
      { heading: 'Publishing & editing', body: 'Founders/admins click "+ New policy" to publish one, or "Edit" on an existing one. A policy has a title, an optional category (e.g. Leave, Conduct, Expenses), and the full policy text.' },
    ],
  },

  attendance: {
    title: 'Attendance',
    summary: 'The monthly attendance statement each person approves before payroll. Replaces the sheet that used to go round on WhatsApp — the point is that "I approved it" is findable afterwards.',
    items: [
      { heading: 'Two tabs if you manage it', body: 'Founders, admins and HR get Team and My attendance. Managers are on the People roster too, so you have a statement of your own to approve like everyone else.' },
      { heading: 'How a month runs', body: 'HR opens the month, adds anything that deviates from a normal day, and sends it. You approve or dispute. HR locks it once payroll is done.',
        snippet: 'draft ──► sent ──► approved ──► locked\n            │                  ▲\n            └──► disputed ─────┘' },
      { heading: 'From records vs Entered by HR', body: 'Every line says which it is. Leave, WFH and events come from the app’s own records. Late logins, missed punch-outs, half days and Saturdays are typed in — nothing in the app records a punch, so there is nothing to pull them from.',
        snippet: '02 Aug  Half day        2.00 pm (2nd half)   Entered by HR   0.5\n05 Aug  Leave           Earned leave         From records    1\n09 Aug  Work from home  WFH                  From records    0' },
      { heading: 'Disputing', body: 'Name the date and what it should say. "Wrong" starts another WhatsApp thread; a specific dispute can be settled. Approving or disputing both close the task HR raised.' },
      { heading: 'Considered', body: 'HR can waive a line: it stays on the record but stops counting, and the reason is required. That is the "considered" column from the old sheet.' },
      { heading: 'Approval is required but not blocking', body: 'Payroll can lock a month you have not answered. When that happens the statement says so rather than looking approved.' },
    ],
  },

  attendanceHr: {
    title: 'Attendance — running a month',
    summary: 'For whoever compiles it. The order matters: pull first, then type, then send.',
    items: [
      { heading: 'Open the month', body: 'Pick the month, then "Open the month for N more" to create a statement for everyone on the roster who has not got one.' },
      { heading: 'Pull from records', body: 'Fills in approved leave, WFH and events attended. Only works while the statement is still a draft — re-pulling after it has been sent would change what somebody is being asked to approve.' },
      { heading: 'Add what the app cannot know', body: 'Late logins, half days, no punch-out, Saturday attendance. Date, type, a free-text detail like "2.00 pm (2nd half)", and how much leave it costs — 0, 0.5 or 1.' },
      { heading: 'Totals are computed', body: 'The chargeable total comes from the lines. There is no separate number to keep in step, which is how the old sheet ended up disagreeing with itself.' },
      { heading: 'Locking', body: 'Send, then lock once payroll has run. A disputed month cannot be locked — settle it first.' },
    ],
  },

  sgpDesk: {
    title: 'SGP Desk',
    summary: 'Where partner-sourced companies are triaged. Founders, admins, and any associate flagged as an SGP Coordinator in Admin.',
    items: [
      { heading: 'One queue now', body: 'Everything a partner submits — typed into My Companies or arriving through their referral link — lands on the Partner Sourced pipeline at Lead. There is no route that skips this.' },
      { heading: 'The board is where the stage moves', body: 'Open the board from the Desk. Moving a card is what updates the partner’s own view — there is no second status to keep in step.',
        snippet: 'Lead ─► First level call ─► Prefunding proposal ─► Founder discussion ─► Accepted\n                                                                       └─► Rejected' },
      { heading: 'Intake', body: 'Choose what happens next and hand it to an associate or general user. That creates a real task on their board carrying the partner’s notes and any links, so it lands in their normal workflow.' },
      { heading: 'Becoming a coordinator', body: 'Admin → User Management → edit a user → SGP Coordinator. Several people can hold it. Founders and admins can always triage.' },
    ],
  },

  myCompanies: {
    audience: 'partner',
    title: 'My Companies',
    summary: 'For partners: the companies you have brought in, and where each one has got to.',
    items: [
      { heading: 'Two ways in', body: 'Add a company yourself, or send your referral link and let them submit. Both arrive in the same queue, both credited to you.' },
      { heading: 'Your referral link', body: 'One link, yours, always on the partner form. Anyone who submits through it is attributed to you automatically — there is nothing to remember.' },
      { heading: 'Following it', body: 'Each card shows the stage it is on and the run of stages, so "First level call" means something without having seen the board.',
        snippet: 'Acme Corp                              First level call\n  Lead   [First level call]   Prefunding   Founder discussion' },
      { heading: 'Only the name is required', body: 'The point is to capture a lead while it is in front of you, not to make you complete a form first. Your comments are passed through verbatim to whoever picks it up.' },
      { heading: 'What you see', body: 'Your own submissions only. Another partner’s leads are never visible to you, and yours are not visible to them.' },
    ],
  },

  investorProfile: {
    title: 'Investor profile',
    summary: 'A fund’s own page: what it invests in, who to call, and what it has backed. Open it from any investor card via "Edit / full profile".',
    items: [
      { heading: 'Will not look at', body: 'Sectors a fund has explicitly ruled out, shown directly under the sectors it wants. Small list, high cost of missing — it is what keeps a meat startup off the list of a fund that wrote "no meat".' },
      { heading: 'Who to contact', body: 'Primary and secondary, each marked Still there, Moved on or Not verified. A contact nobody has checked says "Never verified" rather than looking confirmed.',
        snippet: 'Hemang Vaidya   Primary    Still there\n  Sr Investment Associate · hemang@gvfl.com\n  Verified 7 Aug 2026\n\nJay Dhadhal     Moved on\n  Now at Blume Ventures — Associate' },
      { heading: 'Where they went', body: 'When a POC leaves we record where to. Someone who moved to another fund is a warm introduction at the new one, not a dead record.' },
      { heading: 'Needs a POC', body: 'A fund with nobody confirmed reachable is flagged, and you can assign someone to find one — that becomes a task on their board carrying the last-known contacts as leads.' },
      { heading: 'Invested in', body: 'Their portfolio. Companies we already track are linked; the rest are free text. The tags are the point — they are what makes "which funds actually back D2C at seed" answerable.' },
      { heading: 'Notes & thesis', body: 'The fund’s own words — cheque structure, fund size, what they are looking for. Also what thematic matching reads when building an investor list.' },
    ],
  },

  investorLists: {
    title: 'Investor lists',
    summary: 'A shortlist of funds a founder approves before you approach anyone. Only on deals tagged Investment Banking.',
    items: [
      { heading: 'Building one', body: 'Suggestions come first, split into thematic matches and sector-agnostic funds. Thematic never sits below agnostic however warm the relationship.',
        snippet: 'Thematic & thesis matches      matched on FinTech, SaaS\n  [x] Blume Ventures    invests in FinTech · warm relationship\n  [ ] Prime Ventures    thesis mentions SaaS\n\n+ Sector-agnostic funds (24)' },
      { heading: 'Why each fund is suggested', body: 'In words, next to the name. A ranked list nobody can interrogate is not usable.' },
      { heading: 'What the founder sees', body: 'Fund name and website only. No ticket size, stage, sector focus or internal notes — they are deciding who may be approached, not evaluating funds.' },
      { heading: 'Everything starts ticked', body: 'They are removing objections, not building a list from scratch. An empty list someone has to fill in comes back empty.' },
      { heading: 'Their own exclusions', body: 'Founders can name anyone else to avoid, whether or not they are on the list. You then link those names to funds we hold — unmatched ones are flagged, because an exclusion we cannot resolve is one the outreach cannot be checked against.' },
      { heading: 'The email', body: 'Generated from the list, so the link and the fund count can never disagree with what was actually shared.' },
      { heading: 'No angels', body: 'Funds only, enforced in the database. An angel is a person, often one the founder already knows.' },
    ],
  },

  dealDesk: {
    title: 'Deal Desk',
    summary: 'The reviewer’s landing page: who has submitted what, and everything on the desk in one filterable table.',
    items: [
      { heading: 'Deals by stage', body: 'The company’s FUNDING stage — MVP through Series A+ — not review progress. Where a deal has got to in review is its status, in the table.' },
      { heading: 'Waiting on you', body: 'Unopened cards, longest first. Anything unopened a week is marked. This is the actual to-do on the page.' },
      { heading: '"vs last month"', body: 'Only on new deals. A deal created in June can be rejected in August, so a month-on-month count of rejections keyed on creation date would report something nobody asked about.' },
    ],
  },

  documents: {
    title: 'HR Documents',
    summary: 'Generated letters — offer, experience, salary, NOC and the rest — on ESV letterhead with a document ID and public verification.',
    items: [
      { heading: 'Issuing', body: 'HR Zone → Documents. Pick a person and a document type; the fields come from their employee profile and compensation record.' },
      { heading: 'Verification', body: 'Every document carries an ID and a public /verify link. Anyone holding the letter can confirm it is genuine — and nothing else. The verify page shows only that this ID was issued, to whom, and when.',
        snippet: 'ESV/EXP/2026/0184\n  Experience Letter · issued 4 Aug 2026\n  ✓ Genuine — issued by Earlyseed Ventures' },
      { heading: 'Signature', body: 'Set per document type: System-generated, Visual signature, or Requires physical signature. The mode is recorded on the issued document, so a letter that still needs wet ink says so rather than looking complete.' },
      { heading: 'The file', body: 'Stored in a private bucket. Opening one mints a short-lived signed URL — the link in your address bar expires, which is deliberate: a document URL that never dies is a document that leaks.' },
    ],
  },

  analytics: {
    title: 'KPI & Analytics',
    summary: 'Scores for the period: your own if you are an associate, the whole team if you are a founder or admin.',
    items: [
      { heading: 'My scorecard vs Team analytics', body: 'Same numbers, different scope. Associates see themselves; founders and admins see everyone and can compare.' },
      { heading: 'The period picker', body: 'Everything on the page moves together. A chart on one period beside a table on another is how two people end up quoting different figures for the same month.' },
      { heading: 'Weights', body: 'What each component contributes to the score, editable by founders and admins. Changing them re-scores the period being viewed — the score is derived, never stored.' },
      { heading: 'Adjustments', body: 'A manual correction with a reason attached. The reason is required, because an unexplained adjustment is indistinguishable from a mistake six weeks later.' },
    ],
  },

  taskKpis: {
    title: 'Task KPIs',
    summary: 'Completion, lateness and pushes per person. Founders and admins see everyone; everyone else sees their own.',
    items: [
      { heading: 'Pushed', body: 'How often a task\'s date moved. Every push carries a required reason, so the count is answerable rather than just alarming.' },
      { heading: 'Why things slip', body: 'A push can be flagged as blocked by an external party, or by a named internal person. That is what turns "we are always late" into something that can be fixed.' },
      { heading: 'The reason is a comment too', body: 'It is posted to the task thread as well, so the history sits with the task rather than only in a report nobody opens.' },
    ],
  },

  partnerDeals: {
    audience: 'partner',
    title: 'Active Deals (what you see)',
    summary: 'The deals Earlyseed Ventures has opened to you. A referrer\'s view — enough to know how a deal you sourced is going, and no more.',
    items: [
      { heading: 'Which deals appear', body: 'Only ones we have marked visible to partners. A deal missing from your list has not been opened rather than gone away.' },
      { heading: 'What is on a deal', body: 'The ESV point of contact, total capital being raised, the company\'s own financial metrics, its sector, and how much of the raise is done.' },
      { heading: 'What is not', body: 'Who has invested, fees, mandate and IM links, term sheets. The names on a cap table are the relationships Earlyseed Ventures is paid for; the progress number is the part that legitimately tells you how your referral is going.' },
      { heading: 'Raise progress', body: 'The amount committed so far and how many commitments — a count, never a list. Where the target is on the page you also get a percentage.',
        snippet: '████████░░░░░░░░  43% of ₹2.50 Cr\nCommitted so far  ₹1.08 Cr      Commitments  11' },
      { heading: 'Contacting your ESV point of contact', body: 'Click their name on any deal card for their designation, email and phone.' },
    ],
  },

  partnerInvestors: {
    audience: 'partner',
    title: 'Investors (referring one)',
    summary: 'The funds credited to you, and how to introduce a new one.',
    items: [
      { heading: 'Why you cannot add one directly', body: 'Because we probably already hold them. A second record splits the relationship and the fee for no reason, and nobody can tell afterwards which of the two is the real one.' },
      { heading: 'Referring instead', body: '"+ Refer an investor" — the name is the only required field. Say how you know them; that is the part that decides how we approach them.' },
      { heading: 'What happens next', body: 'An SGP Coordinator checks it against the funds we hold. If we have them, the existing record is tagged to you. If not, it is added credited to you. Either way you end up credited and the database stays clean.' },
      { heading: 'If it comes back', body: 'A referral that is not taken forward always carries a reason. If a fund is already credited to another partner we will tell you rather than quietly reassigning it.' },
      { heading: 'Your list', body: 'The Investors page shows the funds credited to you and any referral still waiting on a decision.' },
    ],
  },

  dealDocuments: {
    title: 'Deal documents',
    summary: 'The IM, financials, deck, MIS and data room for a deal, in one place on its page. Founders, admins and associates add them; partners can be given any of them.',
    items: [
      { heading: 'Links, not uploads', body: 'The file stays in Drive where it is edited. Copying it here would give us two versions and no way to tell which is current.' },
      { heading: 'Five fixed slots', body: 'IM, Financials, Deck, MIS, Data Room. Fixed because the point is that everyone looks in the same place for the same thing — free text would give us "Dataroom", "Data room" and "DataRoom" inside a fortnight.' },
      { heading: 'More than one of a kind', body: 'A deal has several MIS months and more than one version of a deck. Add another and label it — "July", "v3" — and they stack under the same heading.',
        snippet: 'MIS                                        + Add another\n  MIS — July      drive.google.com   Shared    ×\n  MIS — June      drive.google.com   Internal  ×' },
      { heading: 'Sharing with partners', body: 'Each link is Shared or Internal on its own, so a deal can hand over its deck and hold back one MIS month. New links are Shared by default — these five were opened to partners deliberately.' },
      { heading: 'Share on WhatsApp', body: 'Builds the message from the deal itself — the company\'s introduction, its website, and every document marked Shared, numbered in a fixed order with the website first. Available on the deal card as well as here, because sending a deal on is what people leave this page to do.',
        snippet: 'Hello Investor!\n\nEarlyseed Ventures presents this exciting investment opportunity.\n\n*ElectriQ*\nIndia\'s fastest-scaling clean-label food brand\n\nTo know more, refer to the material below:\n1. Website — https://…\n2. Information Memorandum — https://…\n\nTerms & conditions apply. Private equity is a high-risk investment.' },
      { heading: 'What the message carries', body: 'Only documents marked Shared. The message leaves the app, and an Internal document is one we withhold from partners — a WhatsApp forward is at least as exposed as a partner is. You see the exact text before it goes.' },
      { heading: 'Who can add', body: 'Founders, admins and associates. Associates work the deals, and making them ask someone else to paste a link is how links stay in WhatsApp. Partners read only.' },
    ],
  },

  partnerDocuments: {
    audience: 'partner',
    title: 'Deal documents',
    summary: 'The paperwork Earlyseed Ventures has shared with you on a deal.',
    items: [
      { heading: 'What can be here', body: 'The information memorandum, financials, pitch deck, MIS and data room. Each one is shared per deal and per document, so what you see on one deal says nothing about another.' },
      { heading: 'A heading you cannot see', body: 'Nothing is listed greyed-out. If a kind of document is not on the panel, it has not been shared — an empty row saying "Data Room" would only tell you one exists and you cannot have it.' },
      { heading: 'Passing a deal on', body: 'The WhatsApp button on a deal card, or on the deal itself, writes the message for you — the company\'s introduction, every document shared with you, and the risk note. Check it and send.' },
      { heading: 'They are links', body: 'They open the file where it actually lives, so what you read is the current version rather than a copy taken on some earlier day.' },
    ],
  },

  faq: {
    audience: 'all',
    title: 'FAQ',
    summary: 'The questions that actually come up.',
    items: [
      { audience: 'all', heading: 'I got "Server Action was not found on the server"', body: 'The app was updated while your page was open. Nothing was saved, so reloading and trying again will not duplicate anything. If it keeps happening, tell an admin — it means deploys are outrunning open tabs.' },
      { audience: 'all', heading: 'Why can I not add an investor as a partner?', body: 'Because we probably already have them. A duplicate record splits the relationship and the fee for no reason. Send us the name and we will link the existing fund to you.' },
      { heading: 'Why does a fund show no ticket size?', body: 'The source did not say which currency it was in, and guessing between dollars and rupees is an 80x error. The original text is in that fund’s notes for someone to check.' },
      { heading: 'My investor list shows only agnostic funds', body: 'The company on the deal has no sectors that match how funds describe themselves. The page names the tags it could not use — retag the company and the matches appear.' },
      { heading: 'Why can I not type a new sector?', body: 'Sectors are a fixed list. Free text is how "Fintech", "FinTech" and "Health tech" all came to exist, and nothing matched across them. Ask an admin to add one if it is genuinely missing.' },
      { audience: 'all', heading: 'Who can see a deal I am working on?', body: 'Internal staff see everything. Partners see only what has been opened to them — capital being raised, sector, financial metrics, raise progress — never fees, mandate links, or who has invested.' },
      { heading: 'A contact bounced', body: 'Mark them Moved on on the fund’s profile and, if you know, where they went. Then assign someone to find a replacement — it becomes a task with the old contacts attached as leads.' },
      { audience: 'all', heading: 'Where did My Companies submissions go?', body: 'They are pipeline entries now, on the Partner Sourced pipeline. Same list, but with real stages that update when a coordinator moves the card.' },
      { heading: 'Do founders need an account to answer an investor list?', body: 'No. The link is the key. It can be withdrawn at any time, and re-submitting replaces their previous answer rather than adding to it.' },
      { audience: 'all', heading: 'Something looks wrong on a page', body: 'Say which screen, what you were doing, and what happened instead. That is usually enough to find it; a screenshot makes it faster.' },
    ],
  },
}

export const WIKI_SECTIONS = Object.keys(WIKI) as Array<keyof typeof WIKI>

/**
 * The navigation grouping.
 *
 * Thirty sections in one flat list is a wall, not an index — and the order they were written in
 * (roughly, the order they were built) is not the order anyone looks for them. Grouped by the area
 * of the app you are actually in, with the two things a new person needs first at the top.
 *
 * Adding a section: put its key in a group here, or it will not appear in the nav. That is
 * deliberate — a section nobody can navigate to is a section nobody reads.
 */
export const WIKI_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: 'Start here', keys: ['dashboard', 'faq'] },
  { title: 'Deals', keys: ['dealDesk', 'activeDeals', 'dealDetail', 'dealDocuments', 'pipeline', 'pipelines'] },
  { title: 'Companies & investors', keys: ['companies', 'investors', 'investorProfile', 'investorLists'] },
  { title: 'Your work', keys: ['tasks', 'myTodos', 'recurringTasks', 'taskKpis', 'escalations', 'analytics'] },
  { title: 'Partners (SGP)', keys: ['partners', 'sgpDesk', 'myCompanies', 'portal', 'earnings', 'partnerDeals', 'partnerInvestors', 'partnerDocuments'] },
  { title: 'Intake forms', keys: ['forms', 'formBuilder'] },
  { title: 'People & HR', keys: ['hr', 'attendance', 'attendanceHr', 'documents'] },
  { title: 'Company-wide', keys: ['bulletin', 'admin'] },
]

/** Sections defined in WIKI but missing from WIKI_GROUPS, so nothing silently disappears. */
export const UNGROUPED_WIKI_KEYS = Object.keys(WIKI).filter(
  (k) => !WIKI_GROUPS.some((g) => g.keys.includes(k)),
)
