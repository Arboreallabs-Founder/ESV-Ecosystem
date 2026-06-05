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
    summary: 'Action items for the team. Tasks can be standalone or linked to a specific deal.',
    items: [
      { heading: 'Board Columns', body: 'To Do → In Progress → Done. Move tasks by changing the status dropdown on each card.' },
      { heading: 'Creating a Task', body: 'Click "+ New Task". Set a title, optional description, assignee (team member), linked deal, due date, and priority (Low / Medium / High).' },
      { heading: 'Priority Levels', body: 'High = blocks progress or has a hard deadline. Medium = standard work. Low = nice-to-have or whenever. Overdue tasks show a ⚠ warning.' },
      { heading: 'Linked Deals', body: 'Linking a task to a deal lets you track deal-specific work (e.g. "Send term sheet to founder") alongside the deal record.' },
      { heading: 'Assignees', body: 'Assign any internal team member. Associates see all tasks but typically own their own; founders/admins see the full picture.' },
    ],
  },

  investors: {
    title: 'Investors',
    summary: 'ESV\'s database of fund partners. Use this to track funds you\'ve introduced to deals and monitor outreach status.',
    items: [
      { heading: 'Adding an Investor', body: 'Click "+ Add Investor". Fill in fund name, primary contact, email, investment thesis, stage preference, and typical cheque range (min/max in ₹).' },
      { heading: 'Cheque Range', body: 'Amounts are in Indian Rupees. The system auto-formats large amounts (e.g. ₹50L, ₹2.5Cr) for display.' },
      { heading: 'Search', body: 'The search bar filters by fund name, contact name, email, thesis, or stage preference. No need to scroll.' },
      { heading: 'Fund Outreach', body: 'To add a fund to a deal\'s outreach, open the deal and go to the Fund Outreach tab. The investor must exist in this DB first.' },
      { heading: 'Outreach Statuses', body: 'Sent = intro made. Responded = any reply received. Interested = fund wants to proceed. Passed = fund declined.' },
    ],
  },

  partners: {
    title: 'Franchise Partners',
    summary: 'Manage ESV\'s external franchise partner network. Partners refer deals and earn fees based on their agreement.',
    items: [
      { heading: 'Adding a Partner', body: 'Click "+ Add Partner". Enter the firm name, primary contact, email, agreement type, fixed fee (₹ per closed deal), and variable fee split (% of success fee).' },
      { heading: 'Fee Structure', body: 'Each partner has a fixed fee (flat ₹ amount per successful deal) and a variable split % of the success fee. The split % can also be overridden at the deal level.' },
      { heading: 'Linking to a Portal Account', body: 'After creating the partner record, click "Link User" to connect it to a franchise_partner user account. This gives them access to the Partner Portal.' },
      { heading: 'Partner Portal', body: 'Linked partners log in and see only their referred deals. They submit deals via the portal\'s form and track status there.' },
      { heading: 'Deal-Level Override', body: 'The split % on individual deals can be set differently from the partner default — useful for negotiated arrangements.' },
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
