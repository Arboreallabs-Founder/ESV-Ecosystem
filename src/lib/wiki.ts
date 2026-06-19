export type WikiSection = {
  title: string
  summary: string
  items: Array<{ heading: string; body: string }>
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
    summary: 'Action items for the team. Tasks can be standalone or linked to a specific deal. The board has two views: Board and KPI.',
    items: [
      { heading: 'Board Columns', body: 'To Do → Done. Move tasks by changing the status dropdown on each card. Moving a task to Done stamps its completion time; moving it back to To Do clears it.' },
      { heading: 'Creating a Task', body: 'Click "+ New Task". Set a title, optional description, assignee, linked deal, due date, and priority (Low / Medium / High). Every card shows who it was assigned by.' },
      { heading: 'Who can be assigned', body: 'Founders/admins can assign any internal team member. Associates can only assign to themselves or other associates. Franchise partners can never be assigned tasks.' },
      { heading: 'Visibility', body: 'Founders and admins see all tasks in the organisation. Associates see only the tasks assigned to them. Partners have no task access.' },
      { heading: 'Pushing a task', body: 'Only the assignee can push their own task to a new target date. Pushing records the new date and increments the push count — the original due date is retained for reporting.' },
      { heading: 'Priority Levels', body: 'High = blocks progress or has a hard deadline. Medium = standard work. Low = nice-to-have or whenever. Overdue tasks show a ⚠ warning.' },
      { heading: 'KPI view', body: 'Switch to the KPI tab for performance metrics: On-time, Pushed, Pending, and Not-completed. Founders/admins see a per-person breakdown for the whole team plus org totals; associates see only their own numbers.' },
    ],
  },

  escalations: {
    title: 'Escalations',
    summary: 'A direct channel for raising a query or blocker to a single founder or partner, optionally tied to a specific deal, entry, task, or investor.',
    items: [
      { heading: 'Who can raise', body: 'Associates and admins raise escalations. Founders and partners cannot raise — they are the recipients. Each escalation goes to exactly one recipient (a founder or a partner).' },
      { heading: 'Raising one', body: 'Click "+ New Escalation". Give it a subject, optional details, pick the one recipient, and optionally link it to an active deal, pipeline entry, task, or investor. A snapshot of the linked item\'s title is stored so partners can see "re: X" without needing access to it.' },
      { heading: 'Status workflow', body: 'Open → Acknowledged → Resolved (there is no reply thread). The status can be changed by the recipient, the person who raised it, or any founder/admin. Resolving stamps the resolution time.' },
      { heading: 'Visibility', body: 'Founders and admins see every escalation in the organisation (oversight). Associates see only the ones they raised. Partners see only the ones addressed to them.' },
      { heading: 'Deleting', body: 'The person who raised an escalation, or any founder/admin, can delete it.' },
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
      { heading: 'Referral investors', body: 'If an investor was referred by a franchise partner, a Referral badge appears on their row automatically.' },
    ],
  },

  investors: {
    title: 'Investors',
    summary: 'ESV\'s database of investors and funds. Add them to Active Deals to track commitments and fees.',
    items: [
      { heading: 'Adding an Investor', body: 'Click "+ Add Investor". Fill in the name, type (VC Fund, Angel Fund, Family Office, or Angel Investor), country, website, stage preference, ticket size range (₹), and sectors.' },
      { heading: 'ESV POC', body: 'Select one or more internal team members as the Point of Contact for this investor. Type a name to search and click to select. Multiple POCs are supported — each appears as a chip.' },
      { heading: 'Referred by Partner', body: 'If this investor was introduced by a franchise partner, select the partner here (admin/founder only). The investor will show a Referral badge when added to any deal.' },
      { heading: 'Contacts', body: 'For funds (not angel investors), you can add individual contacts — name, role, email, phone, and LinkedIn URL. Contacts are managed from the investor detail drawer after creation.' },
      { heading: 'Search', body: 'The search bar filters by name, country, sector, stage, or ESV POC name. No need to scroll.' },
      { heading: 'Cheque Range', body: 'Amounts are in Indian Rupees. The system auto-formats large amounts (e.g. ₹50L, ₹2.5Cr) for display.' },
      { heading: 'Adding to a deal', body: 'Investors are attached to deals from the Active Deals panel, not from here. Open an active deal, go to the Investors panel (right column), and click "+ Add Investor".' },
    ],
  },

  partners: {
    title: 'Franchise Partners',
    summary: 'Manage ESV\'s external franchise partner network. Partners refer deals and earn a share of the resulting fees.',
    items: [
      { heading: 'Partner details', body: 'In the Partners tab, fill in or edit a partner\'s firm name, contact, agreement type, Standard Fee Split %, and contract link. The Standard Fee Split is the default percentage a partner earns of the relevant deal earning.' },
      { heading: 'Deals & earnings', body: 'Click "Deals & earnings" on a partner to open their per-partner page. It lists every deal they are tied to — deals sourced via their link, or deals where one of their referred investors is investing — with the org total earning, the earning via their referred investors, and their computed share.' },
      { heading: 'Share base', body: 'For each deal, choose where the partner\'s share is calculated from: "Referred earning" (just their referred investors\' fees) or "Total earning" (the deal\'s whole org earning). Defaults to referred.' },
      { heading: 'Per-deal split override', body: 'Each deal uses the partner\'s Standard Fee Split by default. Override the split % on any individual deal — leave the field blank to fall back to the standard. The partner\'s share recalculates immediately.' },
      { heading: 'Linking to a Portal Account', body: 'A partner record is linked to a franchise_partner user account from User Management. This gives them access to their scoped views (Active Deals, Investors, My Submissions, My Earnings, My Links).' },
    ],
  },

  earnings: {
    title: 'My Earnings (Partners)',
    summary: 'A partner\'s view of what they earn from each deal. Read-only and scoped to the partner.',
    items: [
      { heading: 'What you see', body: 'Every deal you earn on — one you sourced via your link, or one where a referred investor of yours is investing — with your split % and your earning (₹), plus a total at the top.' },
      { heading: 'How it\'s calculated', body: 'Your earning = your split % × the base set by the ESV team for that deal (either the deal\'s total earning or the earning from your referred investors). The split defaults to your Standard Fee Split but can be adjusted per deal by ESV.' },
      { heading: 'Privacy', body: 'You only ever see your own final share. Other investors, their amounts, and the org\'s overall earnings are never shown.' },
    ],
  },

  admin: {
    title: 'Admin',
    summary: 'User management for Earlyseed Ventures\' internal team. Visible to the Admin role only.',
    items: [
      { heading: 'Roles', body: 'Founder: full access including financials. Admin: full access + user management. Associate: pipeline, tasks, investors (no financials). Franchise Partner: portal only.' },
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
      { heading: 'Generating Links', body: 'Any team member (including associates and partners) can generate a personalised shareable link. Click "+ Get Link" on any published form. Each link records the creator\'s name so entries show "via [Name]\'s link" in the pipeline.' },
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
      { heading: 'Assigning team members', body: 'Open the entry detail and use the assignee picker to add or remove team members. Franchise partners are excluded from assignment. Multiple people can own the same deal.' },
      { heading: 'Linking forms', body: 'Use the "Forms" button in the board header to link or unlink intake forms. Multiple forms can feed the same pipeline. Submissions from all linked forms appear in the Lead column.' },
    ],
  },

  portal: {
    title: 'Franchise Partner Portal',
    summary: 'The view for external franchise partners. Submit deals and track their progress.',
    items: [
      { heading: 'Submitting a Deal', body: 'Click "+ Submit Deal". Fill in the company name, sector, and funding stage. ESV\'s team will pick it up and move it through the pipeline.' },
      { heading: 'Tracking Referrals', body: 'The table shows all deals you\'ve referred and their current stage. Stages auto-update as the ESV team moves them.' },
      { heading: 'Setup Notice', body: 'If you see "Account not set up", your portal account hasn\'t been linked to a partner record yet. Contact Earlyseed Ventures to resolve this.' },
      { heading: 'Confidentiality', body: 'You only see your own referred deals, not the broader ESV pipeline. All data is governed by your franchise agreement.' },
    ],
  },
}

export const WIKI_SECTIONS = Object.keys(WIKI) as Array<keyof typeof WIKI>
