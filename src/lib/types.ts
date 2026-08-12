export type EscalationStatus = 'Open' | 'Acknowledged' | 'Resolved'

export type EscalationLinkedType = 'active_deal' | 'pipeline_entry' | 'task' | 'investor' | 'leave_request' | 'expense_request'

export type Escalation = {
  id: string
  org_id: string
  raised_by: string
  recipient_user_id: string
  subject: string
  body: string | null
  status: EscalationStatus
  linked_type: EscalationLinkedType | null
  linked_id: string | null
  linked_title: string | null
  created_at: string
  resolved_at: string | null
  raised_by_user?: { name: string; photo_url: string | null } | null
  recipient_user?: { name: string; role: string; photo_url: string | null } | null
}

export type TaskStatus = 'To Do' | 'Done'

export type Task = {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: 'Low' | 'Medium' | 'High'
  status: TaskStatus
  created_by: string | null
  assigned_by_id: string | null
  company_id: string | null
  desk_deal_id: string | null
  link_url: string | null
  created_at: string
  completed_at: string | null
  pushed_date: string | null
  pushed_at: string | null
  push_count: number
  assignee?: { name: string; photo_url: string | null } | null
  created_by_user?: { name: string; photo_url: string | null } | null
  assigned_by_user?: { name: string; photo_url: string | null } | null
  company?: { id: string; name: string } | null
  desk_deal?: { id: string; company_name: string } | null
}

export type TaskComment = {
  id: string
  task_id: string
  body: string
  author_id: string | null
  created_at: string
  author?: { name: string; photo_url: string | null } | null
}

/** One row per push — the history is the point, so reasons can be aggregated per person. */
export type TaskPush = {
  id: string
  task_id: string
  pushed_by: string
  from_date: string | null
  to_date: string
  reason: string
  blocked_external: boolean
  blocked_by_user_id: string | null
  created_at: string
  pushed_by_user?: { name: string | null; photo_url: string | null } | null
  blocked_by_user?: { name: string | null; photo_url: string | null } | null
  task?: { title: string; assignee_id: string | null } | null
}

/** Per-person push aggregation for the KPI page. */
export type PushStats = {
  user_id: string
  total: number
  blockedExternal: number
  /** userId -> times they blocked this person. */
  blockedBy: Record<string, number>
  recent: TaskPush[]
}

/** A timestamped update on an active deal; the newest is the deal's "latest update". */
export type ActiveDealUpdate = {
  id: string
  active_deal_id: string
  body: string
  created_by: string | null
  created_at: string
  created_by_user?: { name: string | null; photo_url: string | null } | null
}

export type PersonalTodo = {
  id: string
  user_id: string
  title: string
  notes: string | null
  done: boolean
  done_at: string | null
  due_date: string | null
  /** Monday of the work week this belongs to; independent of due_date. */
  work_week_start: string | null
  linked_task_id: string | null
  position: number
  created_at: string
  linked_task?: { id: string; title: string; status: TaskStatus; due_date: string | null } | null
}

export const RECURRENCE_TYPES = ['daily', 'weekly', 'monthly'] as const
export type RecurrenceType = typeof RECURRENCE_TYPES[number]

export type RecurringTaskStatus = 'hidden' | 'upcoming' | 'overdue'

export type RecurringTask = {
  id: string
  title: string
  description: string | null
  link_url: string | null
  recurrence_type: RecurrenceType
  lead_days: number
  assignee_id: string | null
  active: boolean
  next_due_date: string
  created_by: string | null
  created_at: string
  assignee?: { name: string; photo_url: string | null } | null
  last_completion?: { completed_at: string; completed_by_name: string | null } | null
}

export type RecurringTaskCompletion = {
  id: string
  recurring_task_id: string
  occurrence_date: string
  completed_by: string | null
  completed_at: string
  completed_by_user?: { name: string; photo_url: string | null } | null
}

export const BULLETIN_POST_TYPES = ['event', 'announcement'] as const
export type BulletinPostType = typeof BULLETIN_POST_TYPES[number]

export type BulletinEventMedia = {
  id: string
  post_id: string
  label: string | null
  url: string
  created_at: string
}

export type BulletinPost = {
  id: string
  post_type: BulletinPostType
  title: string
  body: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  pinned: boolean
  completed: boolean
  created_by: string | null
  created_at: string
  created_by_user?: { name: string; photo_url: string | null } | null
  attendees: Array<{ user_id: string; name: string; photo_url: string | null }>
  media: BulletinEventMedia[]
  // Event-only dedicated links (replacing the old generic media list for events).
  media_url: string | null
  scanned_cards_url: string | null
  // Uploaded poster image — rendered on the card, not linked like the two above.
  poster_url: string | null
}

// One row per past/upcoming event for the Bulletin KPI page — who actually showed up.
export type BulletinEventKpiRow = {
  id: string
  title: string
  event_date: string | null
  event_time: string | null
  location: string | null
  completed: boolean
  attendees: Array<{ user_id: string; name: string; photo_url: string | null }>
  media_count: number
}

export type HrPolicy = {
  id: string
  title: string
  category: string | null
  body: string
  position: number
  created_by: string | null
  updated_at: string
  created_by_user?: { name: string; photo_url: string | null } | null
}

// India-time clock-in/out reminder windows, HR-adjustable — one row per org. Times are
// 'HH:MM:SS' strings as returned by Postgres for a TIME column.
export type HrClockSettings = {
  id: string
  clock_in_start: string
  clock_in_end: string
  clock_out_start: string
  clock_out_end: string
  updated_at: string
}

// 'YYYY-MM-DD' as returned by Postgres for a DATE column — matched against today's IST
// date by month/day only (the year is stored but not used for the "is today" check).
export type HrBirthday = {
  id: string
  name: string
  birth_date: string
  created_by: string | null
  created_at: string
}

export type LeaveType = 'earned' | 'sick' | 'my_day' | 'compensatory' | 'unpaid' | 'wfh'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  earned: 'Earned Leave',
  sick: 'Sick Leave',
  my_day: 'My Day Leave',
  compensatory: 'Compensatory Leave',
  unpaid: 'Unpaid Leave',
  wfh: 'Work from Home',
}

export type LeaveRequest = {
  id: string
  requester_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  /** Only valid on a single-day request; counts 0.5 against the balance. */
  is_half_day: boolean
  reason: string | null
  status: ApprovalStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
  requester?: { name: string | null; email: string | null; photo_url: string | null } | null
  decided_by_user?: { name: string | null; photo_url: string | null } | null
}

// Leave types that carry an entitlement balance — Unpaid is deliberately excluded (uncapped).
export const BALANCE_LEAVE_TYPES: LeaveType[] = ['earned', 'sick', 'my_day', 'compensatory', 'wfh']

/** Short codes shown on the balance chips. */
export const LEAVE_TYPE_CODES: Record<string, string> = {
  earned: 'EL', sick: 'SL', my_day: 'MD', compensatory: 'CL', wfh: 'WFH',
}

/** Org-wide standard entitlement per leave type, in days. */
export type LeavePolicy = {
  id: string
  earned_days: number
  sick_days: number
  my_day_days: number
  compensatory_days: number
  wfh_days: number
  updated_at: string
}

/** Maps a leave type to its column on LeavePolicy. */
export const POLICY_COLUMN: Record<string, keyof LeavePolicy> = {
  earned: 'earned_days', sick: 'sick_days', my_day: 'my_day_days', compensatory: 'compensatory_days',
  wfh: 'wfh_days',
}

// One row per person+type; "remaining" is computed at read time (entitled - manual_used - sum
// of approved leave_requests days), never stored, so it can't drift out of sync with approvals.
export type LeaveBalance = {
  id: string | null
  user_id: string
  leave_type: LeaveType
  entitled_days: number
  manual_used_days: number
  used_from_requests: number
  remaining: number
}

export type LeaveBalanceRow = {
  user_id: string
  user_name: string
  designation: string | null
  photo_url: string | null
  balances: Record<string, LeaveBalance>
}

export type ExpenseType = 'travel' | 'meals' | 'software' | 'office_supplies' | 'other'

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  travel: 'Travel',
  meals: 'Meals',
  software: 'Software',
  office_supplies: 'Office Supplies',
  other: 'Other',
}

export type ExpenseRequest = {
  id: string
  requester_id: string
  expense_type: ExpenseType
  amount: number
  description: string | null
  invoice_path: string
  status: ApprovalStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
  requester?: { name: string | null; email: string | null; photo_url: string | null } | null
  decided_by_user?: { name: string | null; photo_url: string | null } | null
  invoice_signed_url?: string | null
}

export type KudosCategory = 'Teamwork' | 'Leadership' | 'Innovation' | 'Above & Beyond' | 'Customer Focus' | 'Other'

export type Kudos = {
  id: string
  giver_id: string
  recipient_id: string
  message: string
  category: KudosCategory | null
  created_at: string
  giver?: { name: string | null; photo_url: string | null } | null
  recipient?: { name: string | null; photo_url: string | null } | null
}

/* ── Performance analytics ──────────────────────────────────────────────
   Weights are stored, not hardcoded: the scoring formula is a judgement the org owns and can
   change, so the UI shows the active weights alongside every score. */
export type PerformanceWeights = {
  id: string
  kudos_received: number
  task_on_time: number
  task_overdue: number
  task_pushed: number
  recurring_completed: number
  event_attended: number
  updated_at: string
}

export type PerformanceAdjustment = {
  id: string
  user_id: string
  points: number
  reason: string
  occurred_on: string
  created_by: string | null
  created_at: string
  user?: { name: string | null; photo_url: string | null } | null
  created_by_user?: { name: string | null; photo_url: string | null } | null
}

export type ScorePeriod = '30d' | '90d' | 'quarter' | 'year' | 'all'

export const SCORE_PERIOD_LABELS: Record<ScorePeriod, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
}

/** One person's scored signals for the selected period. */
export type PerformanceRow = {
  user_id: string
  user_name: string
  photo_url: string | null
  role: string
  // Raw counts
  kudosReceived: number
  kudosByCategory: Record<string, number>
  tasksTotal: number
  tasksOnTime: number
  tasksOverdue: number
  tasksPushed: number
  recurringCompleted: number
  eventsAttended: number
  adjustmentPoints: number
  adjustmentCount: number
  // Derived rates — shown alongside totals so the table isn't purely volume-driven.
  onTimeRate: number | null
  // Weighted contributions, keyed the same as the weight columns, plus the final score.
  contributions: Record<string, number>
  score: number
}

export type ServiceType =
  | 'vc_fund' | 'angel_fund' | 'family_office' | 'angel_investor'
  | 'debt_fund' | 'corporate_vc' | 'private_equity' | 'growth_equity'
  | 'fund_of_funds' | 'accelerator' | 'sovereign_wealth' | 'merchant_bank'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  vc_fund: 'VC Fund',
  angel_fund: 'Angel Fund',
  family_office: 'Family Office',
  angel_investor: 'Angel Investor',
  debt_fund: 'Debt Fund',
  corporate_vc: 'Corporate VC Arm',
  private_equity: 'Private Equity Fund',
  growth_equity: 'Growth Equity Fund',
  fund_of_funds: 'Fund of Funds',
  accelerator: 'Accelerator / Incubator',
  sovereign_wealth: 'Sovereign Wealth Fund',
  merchant_bank: 'Merchant Bank / Investment Bank',
}

export const LINKEDIN_STATUS_OPTIONS = [
  'Connected', '1st', '2nd', '3rd', 'Pending', 'Not Connected',
] as const
export type LinkedInStatus = typeof LINKEDIN_STATUS_OPTIONS[number]

export const POC_RANKS = ['primary', 'secondary', 'other'] as const
export type PocRank = typeof POC_RANKS[number]

export const POC_EMPLOYMENT = ['active', 'moved_on', 'unknown'] as const
export type PocEmployment = typeof POC_EMPLOYMENT[number]

export const POC_EMPLOYMENT_LABELS: Record<PocEmployment, string> = {
  active: 'Still there',
  moved_on: 'Moved on',
  unknown: 'Not verified',
}

export type InvestorContact = {
  id: string
  investor_id: string
  name: string
  role: string | null
  linkedin_url: string | null
  linkedin_status: LinkedInStatus | null
  phone: string | null
  email: string | null
  sort_order: number
  created_at: string
  rank: PocRank
  employment_status: PocEmployment
  new_company: string | null
  new_designation: string | null
  audit_note: string | null
  last_verified_at: string | null
  contacted_by_user_id: string | null
  contacted_by_name: string | null
  contact_method: string | null
}

/** One company an investor has backed. Tags are the point — they are what makes the data queryable. */
export type PortfolioEntry = {
  id: string
  investor_id: string
  company_name: string
  company_id: string | null
  sector_tags: string[]
  business_type_tags: string[]
  invested_stage: InvestmentStage | null
  invested_year: number | null
  notes: string | null
  created_at: string
  company?: { id: string; name: string; logo_url: string | null } | null
}

export const INVESTMENT_STAGES = ['pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'growth'] as const
export type InvestmentStage = typeof INVESTMENT_STAGES[number]

export const INVESTMENT_STAGE_LABELS: Record<InvestmentStage, string> = {
  pre_seed: 'Pre-seed', seed: 'Seed', pre_series_a: 'Pre-Series A',
  series_a: 'Series A', series_b: 'Series B', growth: 'Growth',
}

export const CONNECT_STRENGTHS = ['warm', 'cold', 'unknown'] as const
export type ConnectStrength = typeof CONNECT_STRENGTHS[number]

/**
 * What the investors *list* needs, and nothing else.
 *
 * The full record is ~33 columns plus every contact; across 430 funds that is 660 KB to draw cards
 * showing a name, a country, some tags and a ticket range. The drawer fetches the rest for the one
 * investor it is actually showing.
 *
 * `contacts` is here only so the POC-coverage badge can be computed, so it carries the one field
 * pocCoverage() reads rather than the twenty a contact has.
 */
export type InvestorListItem = {
  id: string
  name: string
  country: string | null
  sectors: string[]
  service_type: ServiceType
  stage: string | null
  ticket_size_min: number | null
  ticket_size_max: number | null
  ticket_currency: 'INR' | 'USD' | null
  logo_url: string | null
  esv_poc: { name: string } | null
  esv_pocs: Array<{ id: string; name: string; photo_url: string | null }>
  referred_by_partner: { name: string } | null
  contacts: Array<{ id: string; employment_status: PocEmployment }>
}

export type Investor = {
  id: string
  name: string
  country: string | null
  website: string | null
  sectors: string[]
  business_types: string[]
  meta_tags: string[]
  service_type: ServiceType
  esv_poc_id: string | null
  ticket_size_min: number | null
  ticket_size_max: number | null
  stage: string | null
  referred_by_partner_id: string | null
  created_by: string | null
  created_at: string
  // Auto-generated at creation from the investor's name, future-proofing for possible
  // investor login/portal access later — not manually editable.
  username: string | null
  // Angel-investor only (shown/edited when service_type === 'angel_investor').
  // 'MM-DD' — the year is usually unknown, so only day/month is stored.
  birthday_md: string | null
  /** Optional; the day/month is often all that is known. */
  birthday_year: number | null
  onboarding_form_completed: boolean
  onboarding_form_url: string | null
  kyc_done: boolean
  /** Sectors the fund explicitly will not look at — "no meat, alcohol, gambling". */
  excluded_sectors: string[]
  connect_strength: ConnectStrength
  stage_min: InvestmentStage | null
  stage_max: InvestmentStage | null
  stage_raw: string | null
  ticket_currency: 'INR' | 'USD' | null
  /** Every ESV person who worked this fund, including those who have since left. */
  esv_poc_names: string[]
  import_source: string | null
  /** Thesis and free text from the source sheets; also read when ranking thematic matches. */
  notes: string | null
  /** Mirrored into our own bucket at save time — never a hotlink to a CDN that expires. */
  logo_url: string | null
  /** Set while somebody is actively hunting for a new contact at this fund. */
  poc_search_task_id: string | null
  poc_search_started_at: string | null
  portfolio?: PortfolioEntry[]
  esv_poc?: { name: string } | null
  esv_pocs?: Array<{ id: string; name: string; photo_url: string | null }>
  referred_by_partner?: { name: string } | null
  contacts?: InvestorContact[]
}

// Audit-trail row for an investor edit — founder/admin only (see fetchInvestorEditLog).
export type InvestorEditLogEntry = {
  id: string
  investor_id: string | null
  investor_name: string
  edited_by_name: string | null
  changes: string
  created_at: string
}

// Audit-trail row for an HR policy edit — founder/admin only (see fetchHrPolicyEditLog).
export type HrPolicyEditLogEntry = {
  id: string
  policy_id: string | null
  policy_title: string
  edited_by_name: string | null
  action: 'created' | 'updated'
  changes: string
  created_at: string
}

// Audit-trail row for an event edit — founder/admin only (see fetchEventEditLog).
export type EventEditLogEntry = {
  id: string
  event_id: string | null
  event_title: string
  edited_by_name: string | null
  action: 'created' | 'updated'
  changes: string
  created_at: string
}

// Unified feed for the admin Activity Log page — merges investor/HR-policy/event edit logs.
export type ActivityLogEntry = {
  id: string
  entity_type: 'investor' | 'hr_policy' | 'event'
  entity_name: string
  edited_by_name: string | null
  action: 'created' | 'updated'
  changes: string
  created_at: string
}

// One row per deal an investor is attached to, for the "Investment History" panel —
// surfaces the linked company's tags so the investor's revealed interests are visible.
export type InvestorPortfolioItem = {
  active_deal_id: string
  deal_title: string | null
  deal_state: DealState
  investment_amount: number | null
  company_id: string | null
  company_name: string | null
  company_sectors: string[]
  company_meta_tags: string[]
}

export type FranchisePartner = {
  id: string
  name: string
  contact_name: string
  contact_email: string
  agreement_type: string
  transaction_fee_split_pct: number
  success_fee_split_pct: number
  contract_link: string | null
  /** 'MM-DD' — the contact person's birthday; year is usually unknown. */
  contact_birthday_md: string | null
  contact_birthday_year: number | null
}

export type PartnerShareBase = 'total' | 'referred'

// One row per deal a partner is tied to (returned by get_partner_earnings).
export type PartnerDealEarning = {
  active_deal_id: string
  deal_title: string | null
  accepted_at: string
  org_total_earning: number
  referred_earning: number
  base_type: PartnerShareBase
  split_pct: number
  share_amount: number
  is_sourced: boolean
}

// Privacy-scoped subset shown to a partner on their own earnings page.
export type MyDealEarning = {
  active_deal_id: string
  deal_title: string | null
  accepted_at: string
  split_pct: number
  share_amount: number
}

export type UserRole = 'founder' | 'admin' | 'associate' | 'franchise_partner' | 'super_admin' | 'general' | 'hr'

export type UserRow = {
  id: string
  email: string
  role: UserRole
  name: string
  franchise_partner_id: string | null
  org_id: string | null  // null only for super_admin
  phone: string | null
  designation: string | null
  location: string | null
  photo_url: string | null
}

export type ApprovedUser = {
  email: string
  name: string
  role: UserRole
  added_at: string
  org_id: string | null
  userId: string | null
  /** Only set once they've signed in — the avatar lives on `users`, not `approved_emails`. */
  photo_url: string | null
  /** Job title, e.g. "Senior Investment Associate" — distinct from `role`, which is permissions.
   *  Also `users`-only, so it cannot be set before someone has logged in. */
  designation: string | null
  /** Triages partner-sourced companies on the SGP Desk. A flag rather than a role — see
   *  supabase/migrations/20260826000000. */
  is_sgp_coordinator: boolean
  /** Holds the second signature on partner attribution. Nimit, unless somebody else is given it. */
  is_sgp_approver: boolean
  hasLoggedIn: boolean
}

export type Organization = {
  id: string
  name: string
  slug: string
  created_at: string
}

export type PartnerUser = {
  id: string
  email: string
  name: string
  role: 'franchise_partner'
  franchise_partner_id: string | null
  franchise_partners: FranchisePartner | null
}

// ── Forms & Pipelines ─────────────────────────────────────────────────────────

export type Pipeline = {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  stages: PipelineStage[]
  entry_count: number
}

export type StageQuestionFieldType = 'text' | 'numeric' | 'percentage' | 'url' | 'boolean'

export type PipelineStageQuestion = {
  id: string
  stage_id: string
  label: string
  field_type: StageQuestionFieldType
  required: boolean
  position: number
}

export type PipelineStage = {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  stage_type: 'lead' | 'accepted' | 'rejected' | 'custom'
  questions?: PipelineStageQuestion[]
}

// Flattened stage-question answer for display in entry & active-deal detail.
export type StageAnswerView = {
  question_id: string
  label: string
  field_type: StageQuestionFieldType
  value: string | null
  stage_id: string
  stage_name: string
}

export type FormNodeOption = {
  id: string
  node_id: string
  label: string
  position: number
}

export type FormNode = {
  id: string
  form_id: string
  type: 'start' | 'end' | 'question'
  subtype: 'success' | 'rejected' | null
  position_x: number
  position_y: number
  question_text: string | null
  answer_type: 'short_text' | 'long_text' | 'mcq' | null
  options?: FormNodeOption[]
}

export type FormEdge = {
  id: string
  form_id: string
  source_node_id: string
  target_node_id: string
  condition_value: string | null
  condition_label: string | null
}

export type FormLinkSummary = {
  id: string
  token: string
  label: string | null
  created_at: string
  creator: { name: string } | null
}

export type PartnerFormLink = {
  id: string
  token: string
  label: string | null
  created_at: string
  form: { id: string; title: string } | null
  pipeline: { name: string } | null
}

export type PipelineEntryStageHistory = {
  id: string
  entry_id: string
  from_stage: { name: string } | null
  to_stage: { name: string } | null
  moved_by: string | null
  moved_at: string
}

export type Form = {
  id: string
  title: string
  /**
   * What the public form shows at the top of itself. Null falls back to `title`.
   *
   * The title is an internal label — "Partner Form" tells the team where a submission came from
   * and tells a founder filling it in nothing at all.
   */
  display_name: string | null
  description: string | null
  pipeline_id: string | null
  created_by: string | null
  published: boolean
  created_at: string
  pipeline?: { name: string } | null
  links?: FormLinkSummary[]
}

export type PipelineEntry = {
  id: string
  pipeline_id: string
  form_id: string | null
  form_link_id: string | null
  stage_id: string | null
  rejection_reason: string | null
  title: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitted_at: string
  company_id?: string | null
  form?: { title: string } | null
  link_creator?: { name: string } | null
  form_link_label?: string | null
  assignees?: Array<{ user_id: string; name: string; photo_url: string | null }>
  has_active_deal?: boolean
}

// ── Active Deals ──────────────────────────────────────────────────────────────

export const DEAL_STATES = ['active', 'dormant', 'closed', 'archived'] as const
export type DealState = typeof DEAL_STATES[number]

// Label + brand colour for each lifecycle state (used by badges & filters).
export const DEAL_STATE_META: Record<DealState, { label: string; color: string }> = {
  active:   { label: 'Active',   color: '#16a34a' },
  dormant:  { label: 'Dormant',  color: '#8B6245' },
  closed:   { label: 'Closed',   color: '#745FFD' },
  archived: { label: 'Archived', color: '#A39B95' },
}

export type DealCategoryField = {
  id: string
  category_id: string
  label: string
  field_type: 'text' | 'numeric' | 'percentage' | 'url'
  required: boolean
  position: number
  /** Partners see this field on a deal. Defaults false — fee structures and mandate links are not
   *  a referrer's to read, and a field added later stays private until someone decides otherwise. */
  visible_to_partners: boolean
}

export type DealCategory = {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
  fields: DealCategoryField[]
}

export type ActiveDealCategoryData = {
  category: DealCategory
  field_values: Array<{ field_id: string; value: string | null }>
}

/**
 * What a partner is allowed to know about a deal, assembled server-side.
 *
 * The page derives everything else from rows RLS hides from partners — investor rows, the user
 * directory, the company database — so for them those panels came back empty rather than
 * restricted. This is the projection they may have: aggregates instead of rows.
 */
export type PartnerDealSummary = {
  logo_url: string | null
  company_name: string | null
  /** What they do, in one line. Written for a card. */
  company_one_liner: string | null
  /**
   * The pitch that goes out with the deal — up to 200 characters, falling back to the one-liner.
   * Resolved in the database so a partner and an associate never see different introductions.
   */
  company_share_intro: string | null
  /** The company's own site — the first link in the share message. */
  company_website: string | null
  committed_total: number
  commitment_count: number
  assignees: Array<{
    user_id: string
    name: string | null
    photo_url: string | null
    designation?: string | null
    email?: string | null
    phone?: string | null
  }>
}

/** A company in the database tagged as introduced by a partner. */
export type PartnerReferredCompany = {
  id: string
  name: string
  one_liner: string | null
  logo_url: string | null
  sectors: string[] | null
  stage: string | null
  status: string | null
  created_at: string
}

/**
 * An investor a partner says they introduced, before anyone has checked.
 *
 * Deliberately not a row in `investors`. A referral is a claim about a relationship, not a fund
 * record, and it must not enter the database everyone searches until a coordinator has checked
 * whether we already hold the fund — which is the duplicate this whole flow exists to prevent.
 */
export type PartnerInvestorReferral = {
  id: string
  partner_id: string
  submitted_by: string | null
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  notes: string | null
  status: 'pending' | 'accepted' | 'rejected'
  investor_id: string | null
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
  partner?: { name: string } | null
  investor?: { id: string; name: string } | null
  submitter?: { name: string | null; photo_url: string | null } | null
  decided_by_user?: { name: string | null } | null
}

// ── Partner attribution claims ───────────────────────────────────────────────
/**
 * "This partner introduced this, and is therefore owed a fee."
 *
 * One ledger for what used to be three unrelated gestures — a partner's form submission, an
 * investor referral, and an admin ticking "referred by" in the database. They are the same claim,
 * they carry the same money, and they now take the same two signatures.
 *
 * The tag on companies/investors is only written once a claim reaches `approved`; a database
 * trigger refuses every other route to that column, so this type is not merely the UI's view of
 * the process — it is the process.
 */
export const ATTRIBUTION_SOURCES = [
  'form_submission', 'manual_submission', 'investor_referral', 'retroactive_tag',
] as const
export type AttributionSource = typeof ATTRIBUTION_SOURCES[number]

export const ATTRIBUTION_SOURCE_LABELS: Record<AttributionSource, string> = {
  form_submission: 'Through their link',
  manual_submission: 'Submitted directly',
  investor_referral: 'Investor referral',
  retroactive_tag: 'Tagged by us',
}

export const ATTRIBUTION_STATUSES = [
  'pending_coordinator', 'pending_founder', 'approved', 'rejected',
] as const
export type AttributionStatus = typeof ATTRIBUTION_STATUSES[number]

export const ATTRIBUTION_STATUS_LABELS: Record<AttributionStatus, string> = {
  pending_coordinator: 'With the coordinator',
  pending_founder: 'With the founder',
  approved: 'Approved',
  rejected: 'Not credited',
}

export const ATTRIBUTION_STATUS_COLORS: Record<AttributionStatus, string> = {
  pending_coordinator: '#D5AE8F',
  pending_founder: '#745FFD',
  approved: '#2E7D32',
  rejected: '#C0392B',
}

export type PartnerAttributionClaim = {
  id: string
  partner_id: string
  company_id: string | null
  investor_id: string | null
  source: AttributionSource
  referral_id: string | null
  pipeline_entry_id: string | null
  status: AttributionStatus
  note: string | null
  proposed_by: string | null
  coordinator_by: string | null
  coordinator_at: string | null
  coordinator_note: string | null
  founder_by: string | null
  founder_at: string | null
  founder_note: string | null
  rejected_note: string | null
  created_at: string
  partner?: { name: string } | null
  company?: { id: string; name: string } | null
  investor?: { id: string; name: string } | null
  proposer?: { name: string | null; photo_url: string | null } | null
  coordinator?: { name: string | null } | null
  founder?: { name: string | null } | null
}

/** What the claim is about, whichever kind it is. */
export function claimSubjectName(c: PartnerAttributionClaim): string {
  return c.company?.name ?? c.investor?.name ?? 'Unknown'
}

/**
 * The five links every deal needs, in the order people ask for them.
 *
 * A fixed set on purpose: the point is that everyone looks in the same place for the same thing,
 * and free text here would give us "Dataroom", "Data room" and "DataRoom" inside a fortnight.
 */
export const DEAL_DOCUMENT_KINDS = ['im', 'financials', 'deck', 'mis', 'dataroom'] as const
export type DealDocumentKind = typeof DEAL_DOCUMENT_KINDS[number]

export const DEAL_DOCUMENT_LABELS: Record<DealDocumentKind, string> = {
  im: 'Information Memorandum',
  financials: 'Financials',
  deck: 'Pitch Deck',
  mis: 'MIS',
  dataroom: 'Data Room',
}

/** The short form, for chips and tight columns. */
export const DEAL_DOCUMENT_SHORT: Record<DealDocumentKind, string> = {
  im: 'IM',
  financials: 'Financials',
  deck: 'Deck',
  mis: 'MIS',
  dataroom: 'Data Room',
}

export type ActiveDealDocument = {
  id: string
  active_deal_id: string
  kind: DealDocumentKind
  /** What to call this one when there is more than one of a kind: "MIS — July", "Deck v3". */
  label: string | null
  url: string
  /** Per document, so a deal can share its deck and hold back one MIS month. */
  visible_to_partners: boolean
  created_by: string | null
  created_at: string
  created_by_user?: { name: string | null } | null
}

export type ActiveDeal = {
  id: string
  pipeline_entry_id: string
  created_at: string
  deal_state: DealState
  logo_url: string | null
  /** False hides the deal from the partner portal. Internal roles always see it. */
  visible_to_partners: boolean
  entry: {
    title: string | null
    submitter_name: string | null
    submitter_email: string | null
    submitted_at: string
    pipeline_id: string
    company_id?: string | null
    company?: { id: string; name: string; logo_url: string | null; one_liner?: string | null; share_intro?: string | null; website?: string | null } | null
    assignees?: Array<{ user_id: string; name: string; photo_url: string | null }>
    sourced_via_partner?: { id: string; name: string } | null
  }
  categories: ActiveDealCategoryData[]
  field_values?: Array<{ field_id: string; value: string | null }>
}

export type ActiveDealInvestorFee = {
  id: string
  label: string
  rate: number | null
  source_field_id: string | null
  is_enabled: boolean
}

export const ACTIVE_DEAL_INVESTOR_STATUSES = ['not_started', 'commitment_received', 'funds_received', 'shares_transferred'] as const
export type ActiveDealInvestorStatus = typeof ACTIVE_DEAL_INVESTOR_STATUSES[number]

export const ACTIVE_DEAL_INVESTOR_STATUS_META: Record<ActiveDealInvestorStatus, { label: string; color: string }> = {
  not_started:          { label: 'Not Started',         color: '#A39B95' },
  commitment_received:  { label: 'Commitment Received', color: '#8B6245' },
  funds_received:       { label: 'Funds Received',       color: '#745FFD' },
  shares_transferred:   { label: 'Shares Transferred',   color: '#16a34a' },
}

export type ActiveDealInvestor = {
  id: string
  active_deal_id: string
  category_id: string | null
  investor: {
    id: string
    name: string
    service_type: ServiceType
    referred_by_partner_id: string | null
  }
  is_investing: boolean
  investment_amount: number | null
  is_referral: boolean
  status: ActiveDealInvestorStatus
  shares: number | null
  fees: ActiveDealInvestorFee[]
  created_at: string
}

// ── Deal Desk ─────────────────────────────────────────────────────────────────

export const DESK_STAGES = ['MVP', 'Pre-Seed', 'Seed', 'Pre-Series A', 'Series A', 'Series A+'] as const
export type DeskStage = typeof DESK_STAGES[number]

export const DESK_VALUATION_TYPES = ['Fixed', 'TBD'] as const
export type DeskValuationType = typeof DESK_VALUATION_TYPES[number]

export const DESK_REVENUE_STATUSES = ['Yes', 'Negligible', 'No'] as const
export type DeskRevenueStatus = typeof DESK_REVENUE_STATUSES[number]

export const DESK_REVENUE_PERIODS = ['Monthly', 'Annual'] as const
export type DeskRevenuePeriod = typeof DESK_REVENUE_PERIODS[number]

export type DeskDealStatus = 'open' | 'rejected' | 'discuss' | 'more_info'

export const DESK_DEAL_STATUS_LABELS: Record<DeskDealStatus, string> = {
  open: 'Open',
  rejected: 'Rejected',
  discuss: 'Discuss in person',
  more_info: 'More info requested',
}

export const DESK_INSTRUMENTS = ['Equity', 'SAFE', 'Convertible', 'Other'] as const
export type DeskInstrument = typeof DESK_INSTRUMENTS[number]

export const DESK_ROUND_STATUSES = ['Open', 'Closing', 'Committed'] as const
export type DeskRoundStatus = typeof DESK_ROUND_STATUSES[number]

export type DeskActionType = 'reject' | 'discuss_in_person' | 'need_more_info'

export const DESK_ACTION_LABELS: Record<DeskActionType, string> = {
  reject: 'Reject',
  discuss_in_person: 'Discuss in person',
  need_more_info: 'Need more info',
}

// Which deal_status an action moves the card into.
export const DESK_ACTION_TO_STATUS: Record<DeskActionType, DeskDealStatus> = {
  reject: 'rejected',
  discuss_in_person: 'discuss',
  need_more_info: 'more_info',
}

export type DeskFounder = {
  name: string
  affiliation: string | null
  bio: string | null
  linkedin_url: string | null
}

export type DeskRevenuePoint = {
  period: string   // e.g. "2026-01"
  amount: number
}

export type DeskDealMedia = {
  id: string
  deal_id: string
  url: string          // storage object path
  signed_url?: string  // resolved for display by the read helper
  sort_order: number
  created_at: string
}

export type DeskDealAction = {
  id: string
  deal_id: string
  action_type: DeskActionType
  comment_text: string | null
  voice_note_url: string | null       // storage object path
  voice_note_signed_url?: string      // resolved for display
  created_by: string
  created_by_user?: { name: string; photo_url: string | null } | null
  created_at: string
}

export type DeskDeal = {
  id: string
  org_id: string
  associate_id: string
  associate?: { name: string } | null
  company_name: string
  sector: string | null
  about: string | null
  location: string | null
  stage: DeskStage | null
  ask_inr: number | null
  valuation_type: DeskValuationType | null
  valuation_inr: number | null
  dilution_percent: number | null
  cap_table_notable_names: string[]
  cap_table_structure_notes: string | null
  revenue_status: DeskRevenueStatus | null
  revenue_period: DeskRevenuePeriod | null
  revenue_data: DeskRevenuePoint[]
  usp: string | null
  founders: DeskFounder[]
  pitch_deck_url: string | null
  notes: string | null
  call_date: string | null
  // Tier-2 enrichment (all optional)
  business_model: string | null
  instrument: DeskInstrument | null
  round_status: DeskRoundStatus | null
  committed_inr: number | null
  total_raised_inr: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  customers_count: number | null
  analyst_opinion: string | null   // added in-app after import (≤100 chars)
  referrer: string | null          // who referred/sourced the deal; indexed for BI
  company_id: string | null        // linked Company Profile, if promoted
  seen_status: boolean
  starred: boolean
  deal_status: DeskDealStatus
  created_at: string
  updated_at: string
  media: DeskDealMedia[]
  actions: DeskDealAction[]
}

export type DeskAssociateSummary = {
  id: string
  name: string
  photo_url: string | null
  unseen_count: number
  seen_count: number
  starred_count: number
}

// ── Company Profile / Startup Database ─────────────────────────────────────────

export const COMPANY_STATUSES = ['prospect', 'screening', 'active', 'portfolio', 'passed', 'dead'] as const
export type CompanyStatus = typeof COMPANY_STATUSES[number]
export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  prospect: 'Prospect', screening: 'Screening', active: 'Active', portfolio: 'Portfolio', passed: 'Passed', dead: 'Dead',
}

export const COMPANY_DOC_TYPES = ['deck', 'financial_model', 'cap_table', 'incorporation', 'data_room', 'other'] as const
export type CompanyDocType = typeof COMPANY_DOC_TYPES[number]
export const COMPANY_DOC_TYPE_LABELS: Record<CompanyDocType, string> = {
  deck: 'Pitch deck', financial_model: 'Financial model', cap_table: 'Cap table', incorporation: 'Incorporation', data_room: 'Data room', other: 'Other',
}

export const COMPANY_FIELD_TYPES = ['text', 'numeric', 'percentage', 'url', 'date'] as const
export type CompanyFieldType = typeof COMPANY_FIELD_TYPES[number]

export type CompanyFounder = {
  name: string
  role: string | null
  bio: string | null
  ex_affiliations: string | null
  linkedin_url: string | null
  photo_url: string | null
  equity_pct: number | null
}

export type CompanyTeamMember = {
  name: string
  role: string | null
  linkedin_url: string | null
}

export type CompanyFundingRound = {
  id: string
  company_id: string
  round_name: string | null
  date: string | null
  amount_inr: number | null
  valuation_inr: number | null
  instrument: string | null
  lead_investor: string | null
  investors: string[]
  notes: string | null
  sort_order: number
}

export type CompanyCapTableEntry = {
  id: string
  company_id: string
  holder_name: string
  holder_type: 'founder' | 'investor' | 'esop' | 'other' | null
  pct: number | null
  shares: number | null
  notes: string | null
  sort_order: number
}

export type CompanyDocument = {
  id: string
  company_id: string
  label: string
  doc_type: CompanyDocType
  url: string
  created_at: string
}

export type CompanyUpdate = {
  id: string
  company_id: string
  body: string
  author_id: string | null
  author?: { name: string; photo_url: string | null } | null
  created_at: string
}

export type CompanyFieldDef = {
  id: string
  label: string
  field_type: CompanyFieldType
  position: number
}

export type CompanyFieldValue = {
  field_def_id: string
  value: string | null
}

// Deal records linked to a company (shown in the profile's Linked deals section).
export type LinkedDeskDeal = { id: string; company_name: string; associate_id: string; deal_status: string }
export type LinkedPipelineEntry = {
  id: string
  title: string | null
  pipeline_id: string
  stage_name: string | null
  active_deal_id: string | null
  active_deal_state: DealState | null
}

export type Company = {
  id: string
  org_id: string
  created_by: string | null
  esv_poc_id: string | null
  esv_poc?: { name: string } | null
  // Identity / overview
  name: string
  legal_name: string | null
  website: string | null
  logo_url: string | null
  one_liner: string | null
  description: string | null
  hq_city: string | null
  hq_country: string | null
  founded_date: string | null
  incorporation_type: string | null
  incorporation_no: string | null
  sectors: string[]
  stage: string | null
  business_model: string | null
  status: CompanyStatus
  tags: string[]
  meta_tags: string[]   // themes for investor matching (keyword-extracted + hand-edited)
  // Product
  product_description: string | null
  usp: string | null
  tech_stack: string | null
  product_links: string[]
  // Traction summary
  arr_inr: number | null
  mrr_inr: number | null
  customers_count: number | null
  team_size: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  // Current raise
  ask_inr: number | null
  instrument: string | null
  pre_money_inr: number | null
  post_money_inr: number | null
  round_status: string | null
  min_ticket_inr: number | null
  total_raised_inr: number | null
  use_of_funds: string | null
  // Cap table share structure
  total_shares: number | null
  nominal_value_per_share: number | null
  // People
  founders: CompanyFounder[]
  team: CompanyTeamMember[]
  created_at: string
  updated_at: string
  // Embedded children (on full fetch)
  funding_rounds: CompanyFundingRound[]
  cap_table: CompanyCapTableEntry[]
  documents: CompanyDocument[]
  updates: CompanyUpdate[]
  field_values: CompanyFieldValue[]
  linked_desk_deals: LinkedDeskDeal[]
  linked_pipeline_entries: LinkedPipelineEntry[]
}

// Suggested investors on a company profile, bucketed by fit strength.
export type InvestorSuggestionBucket = 'sector' | 'synergy' | 'agnostic'
export type SuggestedInvestor = {
  id: string
  name: string
  service_type: ServiceType
  sectors: string[]
  stage: string | null
  ticket_size_min: number | null
  ticket_size_max: number | null
  bucket: InvestorSuggestionBucket
  reasons: string[]        // matched sector / tag names
  stageFit: boolean        // investor stage matches the company stage
}

// Trimmed row for the database list view.
export type CompanyListItem = {
  id: string
  name: string
  logo_url: string | null
  one_liner: string | null
  sectors: string[]
  stage: string | null
  status: CompanyStatus
  hq_city: string | null
  hq_country: string | null
  arr_inr: number | null
  updated_at: string
  has_active_deal: boolean
}

// ─── HR documents: employee profiles (Phase 1) ──────────────────────────────
// Kept off `users` deliberately — see supabase/migrations/20260823000000.

export const EMPLOYMENT_TYPES = ['full_time', 'intern', 'contract', 'consultant'] as const
export type EmploymentType = typeof EMPLOYMENT_TYPES[number]

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time', intern: 'Intern', contract: 'Contract', consultant: 'Consultant',
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
export type BloodGroup = typeof BLOOD_GROUPS[number]

export type EmployeeProfile = {
  user_id: string
  org_id: string
  employee_code: string | null
  date_of_joining: string | null
  employment_type: EmploymentType | null
  probation_end_date: string | null
  confirmation_date: string | null
  reporting_manager_id: string | null
  work_location: string | null
  notice_period_days: number | null
  date_of_exit: string | null
  exit_reason: string | null
  /** As on PAN — routinely differs from users.name, and letters must match presented ID. */
  legal_name: string | null
  date_of_birth: string | null
  residential_address: string | null
  personal_email: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  blood_group: BloodGroup | null
  /** Deliberately not users.photo_url — an ID card needs a photo supplied for that purpose. */
  id_photo_url: string | null
  updated_at: string
  reporting_manager?: { name: string | null } | null
}

/** A person plus their profile, which is how the People roster reads. */
export type EmployeeRow = {
  user: UserRow
  profile: EmployeeProfile | null
}

// ─── HR documents: compensation (Phase 2) ───────────────────────────────────
// Effective-dated. A payslip for March must reflect March, so records are never overwritten.

export type EmployeeCompensation = {
  id: string
  org_id: string
  user_id: string
  effective_from: string
  annual_ctc: number
  basic: number | null
  hra: number | null
  special_allowance: number | null
  employer_pf: number | null
  gratuity: number | null
  variable_pay: number | null
  other_allowances: number | null
  currency: string
  notes: string | null
  created_at: string
}

/** The breakdown lines, in the order a payslip prints them. */
export const COMPENSATION_COMPONENTS = [
  { key: 'basic', label: 'Basic' },
  { key: 'hra', label: 'HRA' },
  { key: 'special_allowance', label: 'Special Allowance' },
  { key: 'employer_pf', label: "Employer's PF" },
  { key: 'gratuity', label: 'Gratuity' },
  { key: 'variable_pay', label: 'Variable Pay' },
  { key: 'other_allowances', label: 'Other Allowances' },
] as const satisfies ReadonlyArray<{ key: keyof EmployeeCompensation; label: string }>

// ─── HR documents: the engine (Phase 3) ─────────────────────────────────────

export const SIGNATURE_MODES = ['system', 'visual', 'physical'] as const
export type SignatureMode = typeof SIGNATURE_MODES[number]

export const SIGNATURE_MODE_LABELS: Record<SignatureMode, string> = {
  system: 'System-generated',
  visual: 'Visual signature',
  physical: 'Requires physical signature',
}

export type DocumentCategory = 'leave' | 'verification' | 'onboarding' | 'compensation' | 'exit' | 'other'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  leave: 'Leave & attendance',
  verification: 'Employment verification',
  onboarding: 'Onboarding',
  compensation: 'Compensation',
  exit: 'Exit',
  other: 'Other',
}

export type DocumentType = {
  code: string
  name: string
  category: DocumentCategory
  signature_mode: SignatureMode
  id_segment: string
  sort_order: number
  active: boolean
}

export type IssuedDocument = {
  id: string
  org_id: string
  document_code: string
  subject_user_id: string
  /** Printed on the letter. Sequential, therefore guessable — never used for access. */
  human_id: string
  /** What the QR points at. */
  verify_token: string
  storage_path: string | null
  sha256: string | null
  /** Every value merged into the letter, frozen at issue time. */
  payload: Record<string, unknown>
  signature_mode: SignatureMode
  issued_by: string | null
  issued_at: string
  revoked_at: string | null
  revoked_reason: string | null
  document_type?: { name: string; category: DocumentCategory } | null
  subject?: { name: string | null; photo_url: string | null } | null
  issuer?: { name: string | null } | null
}

/** What the public /verify/[token] page is allowed to see. Deliberately narrow. */
export type DocumentVerification = {
  human_id: string
  document_name: string
  subject_name: string | null
  issued_at: string
  signature_mode: SignatureMode
  revoked: boolean
  org_name: string
}

// ─── Partner-sourced company intake (SGP) ───────────────────────────────────

export const SGP_INTAKE_ACTIONS = ['first_call', 'prefunding_proposal', 'discuss_with_founder'] as const
export type SgpIntakeAction = typeof SGP_INTAKE_ACTIONS[number]

/** The label the coordinator picks, and the title the resulting task carries. */
export const SGP_INTAKE_ACTION_LABELS: Record<SgpIntakeAction, string> = {
  first_call: 'Set up first level call',
  prefunding_proposal: 'Send prefunding proposal',
  discuss_with_founder: 'Discuss with founder first',
}

export const SGP_INTAKE_ACTION_HINTS: Record<SgpIntakeAction, string> = {
  first_call: 'Assignee books and runs an introductory call with the company.',
  prefunding_proposal: 'Assignee prepares and sends the prefunding proposal.',
  discuss_with_founder: 'Needs a founder’s view before anything goes to the company.',
}

export type SgpSubmissionStatus = 'submitted' | 'assigned' | 'closed'

export type SupportingLink = { label: string; url: string }


// ── Attendance statements (monthly, HR → employee approval) ──────────────────

export const ATTENDANCE_STATUSES = ['draft', 'sent', 'approved', 'disputed', 'locked'] as const
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number]

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting approval',
  approved: 'Approved',
  disputed: 'Disputed',
  locked: 'Locked for payroll',
}

export const ATTENDANCE_LINE_TYPES = [
  'late_login', 'half_day', 'wfh', 'no_punch_out', 'leave',
  'saturday_online', 'saturday_offline', 'saturday_leave',
  'google_form', 'event', 'other',
] as const
export type AttendanceLineType = typeof ATTENDANCE_LINE_TYPES[number]

// Wording follows the sheet HR already uses, so nobody has to learn a new vocabulary.
export const ATTENDANCE_LINE_LABELS: Record<AttendanceLineType, string> = {
  late_login: 'Late login',
  half_day: 'Half day',
  wfh: 'Work from home',
  no_punch_out: 'No punch out',
  leave: 'Leave',
  saturday_online: 'Saturday — online',
  saturday_offline: 'Saturday — in office',
  saturday_leave: 'Saturday — on leave',
  google_form: 'Google form',
  event: 'Event attended',
  other: 'Other',
}

/** Types the app can fill in from its own records. Everything else is HR's to enter. */
export const ATTENDANCE_AUTO_TYPES: AttendanceLineType[] = ['leave', 'wfh', 'event']

export type AttendanceLine = {
  id: string
  statement_id: string
  entry_date: string
  line_type: AttendanceLineType
  source: 'auto' | 'manual'
  detail: string | null
  leave_days: number
  waived: boolean
  waived_reason: string | null
}

export type AttendanceStatement = {
  id: string
  user_id: string
  period_month: string
  status: AttendanceStatus
  sent_at: string | null
  approved_at: string | null
  disputed_at: string | null
  dispute_note: string | null
  resolved_at: string | null
  resolution_note: string | null
  locked_at: string | null
  locked_without_approval: boolean
  deduction_note: string | null
  hr_note: string | null
  user?: { name: string; photo_url: string | null } | null
  lines: AttendanceLine[]
}

/**
 * Whether a fund has anyone we can actually call.
 *
 * DERIVED from the contacts, never stored. A `needs_poc` column would be wrong the moment someone
 * marks a contact active, and a stale flag on this is worse than none — it would send people to
 * find a POC for a fund that already has one, or worse, not send them at all.
 */
export type PocCoverage = 'covered' | 'all_left' | 'unverified' | 'none'

export const POC_COVERAGE_LABELS: Record<PocCoverage, string> = {
  covered: 'Contact confirmed',
  all_left: 'Needs a new POC',
  unverified: 'POC unverified',
  none: 'No POC at all',
}

export function pocCoverage(
  contacts: Array<{ employment_status: string }> | null | undefined,
): PocCoverage {
  const cs = contacts ?? []
  if (cs.length === 0) return 'none'
  if (cs.some((c) => c.employment_status === 'active')) return 'covered'
  // Somebody was there and has gone — that is a different job from never having checked.
  if (cs.some((c) => c.employment_status === 'moved_on')) return 'all_left'
  return 'unverified'
}

// ─── Fundraise Status List ───────────────────────────────────────────────────
// What happens after a founder approves an investor list: each approved fund becomes a row we work.

/**
 * The eight stored statuses.
 *
 * "Ghosted" is the ninth the team talks about and is deliberately not one of these — it is derived
 * from how long a fund has sat still, so it cannot disagree with the timeline it is read from, and
 * the moment anything moves it stops being true on its own.
 */
export const FUNDRAISE_STATUSES = [
  // Before anything can be sent: we hold no reachable contact at this fund.
  'no_contact', 'reaching_out', 'converted_poc',
  // The contact is a founder's connection.
  'sent_to_founder', 'founder_connected', 'founder_looped_in',
  // The contact is a partner's connection. The partner stays tagged, because the fee follows it.
  'sent_to_partner', 'partner_connected', 'partner_looped_in',
  // The regular workflow.
  'not_sent', 'deal_sent', 'data_requested', 'call_request',
  'due_diligence', 'accepted', 'rejected', 'closed',
] as const
export type FundraiseStatus = typeof FUNDRAISE_STATUSES[number]

/** What a status is called, including the derived one. */
export type FundraiseDisplayStatus = FundraiseStatus | 'ghosted'

export const FUNDRAISE_STATUS_LABELS: Record<FundraiseDisplayStatus, string> = {
  no_contact: 'No contact yet',
  reaching_out: 'Reaching out to a new contact',
  converted_poc: 'Converted to POC',
  sent_to_founder: 'Sent to founder',
  founder_connected: 'Founder has connected',
  founder_looped_in: 'Founder looped us in',
  sent_to_partner: 'Sent to partner',
  partner_connected: 'Partner has connected',
  partner_looped_in: 'Partner looped us in',
  not_sent: 'Not sent yet',
  deal_sent: 'Deal sent',
  data_requested: 'Data requested by fund',
  call_request: 'Call request',
  due_diligence: 'Fund due diligence',
  accepted: 'Accepted',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  closed: 'Closed',
}

/**
 * The three groups a status belongs to.
 *
 * The pre-workflow ones exist because a deal that never reached a human at the fund has not really
 * been sent, however green the list looks. Keeping them apart from the funnel is what stops
 * "we approached 40 funds" meaning "we emailed 40 addresses, 12 of which bounced".
 */
export const FUNDRAISE_STATUS_GROUP: Record<FundraiseStatus, 'contact' | 'intro' | 'workflow'> = {
  no_contact: 'contact', reaching_out: 'contact', converted_poc: 'contact',
  sent_to_founder: 'intro', founder_connected: 'intro', founder_looped_in: 'intro',
  sent_to_partner: 'intro', partner_connected: 'intro', partner_looped_in: 'intro',
  not_sent: 'workflow', deal_sent: 'workflow', data_requested: 'workflow',
  call_request: 'workflow', due_diligence: 'workflow', accepted: 'workflow',
  rejected: 'workflow', closed: 'workflow',
}

export const FUNDRAISE_GROUP_LABELS: Record<'contact' | 'intro' | 'workflow', string> = {
  contact: 'Finding a contact',
  intro: 'Waiting on an introduction',
  workflow: 'The raise',
}

/**
 * A sequential ramp for the funnel, and semantic colours for the three outcomes.
 *
 * The in-flight statuses are ordered, so they take a lightness ramp rather than unrelated hues —
 * you should be able to see depth without reading the legend. Accepted, rejected and ghosted are
 * outcomes, not depths, so they get their own colours. The pre-workflow statuses take the warm
 * accent: they are a different kind of thing, not an earlier rung of the same ladder.
 */
export const FUNDRAISE_STATUS_COLORS: Record<FundraiseDisplayStatus, string> = {
  no_contact: '#C0392B',
  reaching_out: '#D5AE8F',
  converted_poc: '#B08968',
  sent_to_founder: '#D5AE8F',
  founder_connected: '#C39B78',
  founder_looped_in: '#B08968',
  sent_to_partner: '#D5AE8F',
  partner_connected: '#C39B78',
  partner_looped_in: '#B08968',
  not_sent: '#A39B95',
  deal_sent: '#B9AEFE',
  data_requested: '#9C8BFD',
  call_request: '#8371FD',
  due_diligence: '#745FFD',
  accepted: '#2E7D32',
  rejected: '#C0392B',
  ghosted: '#8A7F78',
  closed: '#6B6B7B',
}

/** Only these can ghost: a fund never sent cannot go quiet, nor can one that already answered —
 *  and an introduction we are waiting on is our problem, not theirs. */
export const FUNDRAISE_IN_FLIGHT: FundraiseStatus[] = [
  'deal_sent', 'data_requested', 'call_request', 'due_diligence',
]

export const FUNDRAISE_GHOST_DAYS = 30

/** The same rule as is_fundraise_ghosted() in the database, for rendering without a round trip. */
export function isFundraiseGhosted(status: FundraiseStatus, statusChangedAt: string): boolean {
  if (!FUNDRAISE_IN_FLIGHT.includes(status)) return false
  const days = (Date.now() - new Date(statusChangedAt).getTime()) / 86_400_000
  return days > FUNDRAISE_GHOST_DAYS
}

export function fundraiseDisplayStatus(
  status: FundraiseStatus, statusChangedAt: string,
): FundraiseDisplayStatus {
  return isFundraiseGhosted(status, statusChangedAt) ? 'ghosted' : status
}

/** The five whose networks we route introductions through. Hardcoded, per the decision. */
export const CONNECTED_FOUNDERS = [
  'Monica Gupta', 'Manan Patel', 'Nimit Shah', 'Rahul Hingmire', 'Sudhir Mehta',
] as const
export type ConnectedFounder = typeof CONNECTED_FOUNDERS[number]

// ─── Angel Reachout ──────────────────────────────────────────────────────────
// Syndicate deals, internal only. Not a status funnel: an angel does not run a process, so what
// matters is who reached out, how, when, and what came back.

export const ANGEL_METHODS = ['in_person', 'whatsapp', 'email', 'other'] as const
export type AngelMethod = typeof ANGEL_METHODS[number]

export const ANGEL_METHOD_LABELS: Record<AngelMethod, string> = {
  in_person: 'In person',
  whatsapp: 'WhatsApp blast',
  email: 'Email blast',
  other: 'Other',
}

export type AngelReachoutMember = {
  id: string
  list_id: string
  investor_id: string
  included: boolean
  done: boolean
  done_by: string | null
  done_at: string | null
  response: string | null
  responded_at: string | null
  investor?: { id: string; name: string; service_type: string } | null
  done_by_user?: { name: string | null; photo_url: string | null } | null
}

export type AngelReachoutList = {
  id: string
  active_deal_id: string
  method: AngelMethod
  method_other: string | null
  title: string | null
  task_id: string | null
  created_by: string | null
  created_at: string
  members: AngelReachoutMember[]
  created_by_user?: { name: string | null } | null
}

export const FUNDRAISE_EVENT_KINDS = [
  'status_change', 'outreach', 'follow_up', 'note', 'request', 'response', 'founder_comment',
] as const
export type FundraiseEventKind = typeof FUNDRAISE_EVENT_KINDS[number]

export const FUNDRAISE_EVENT_LABELS: Record<FundraiseEventKind, string> = {
  status_change: 'Status change',
  outreach: 'Outreach',
  follow_up: 'Follow-up',
  note: 'Note',
  request: 'They asked for something',
  response: 'They replied',
  founder_comment: 'Founder',
}

export type FundraiseEvent = {
  id: string
  entry_id: string
  kind: FundraiseEventKind
  body: string | null
  from_status: FundraiseStatus | null
  to_status: FundraiseStatus | null
  /** False by default: an event nobody classified stays with the team. */
  founder_visible: boolean
  created_by: string | null
  author_label: string | null
  created_at: string
  created_by_user?: { name: string | null; photo_url: string | null } | null
}

export type FundraiseEntry = {
  id: string
  list_id: string
  investor_id: string
  status: FundraiseStatus
  /** The ghosting clock. A comment must not reset it, or a silent fund would look alive. */
  status_changed_at: string
  sent_at: string | null
  rejection_reason: string | null
  rejection_sector: string | null
  sort_order: number
  created_at: string
  investor?: {
    id: string
    name: string
    website: string | null
    logo_url: string | null
    sectors: string[]
    connect_strength: string | null
    contacts: Array<{ id: string; name: string; rank: string | null; employment_status: string }>
  } | null
  events?: FundraiseEvent[]
}

export type FundraiseList = {
  id: string
  active_deal_id: string
  share_token: string
  shared_at: string | null
  first_viewed_at: string | null
  reachout_template: string | null
  created_at: string
  entries: FundraiseEntry[]
}
